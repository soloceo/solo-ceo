import { run, get, all, saveDb } from '../index';
import { str, enumVal } from '../../lib/validate';
import { todayDateKey } from '../../lib/date-utils';
import {
  VALID_MS_STATUSES,
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, err, logActivity, calcTaxOffline,
} from './_shared';

export async function milestonesHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── PAYMENT MILESTONES ──────────────────────────────────────────────────
  const milestoneListMatch = path.match(/^\/api\/clients\/(\d+)\/milestones$/);
  if (milestoneListMatch) {
    const clientId = milestoneListMatch[1];
    if (method === 'GET') {
      const today = todayDateKey();
      const rows = all(db, 'SELECT * FROM payment_milestones WHERE client_id=? AND soft_deleted=0 ORDER BY sort_order ASC, created_at ASC', [clientId]);
      const result = rows.map((m) => ({
        ...m,
        status: m.status === 'pending' && m.due_date && String(m.due_date) < today ? 'overdue' : m.status,
      }));
      return ok(result);
    }
    if (method === 'POST') {
      const { label, amount, percentage, due_date, payment_method, invoice_number, note, sort_order, project_id } = body;
      const res = run(db,
        `INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, payment_method, invoice_number, note, sort_order, status, project_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [clientId, str(label, 255), amount||0, percentage||0, str(due_date, 10), str(payment_method, 50), str(invoice_number, 100), str(note, 1000), sort_order??0, 'pending', project_id||null]);
      const msId = res.lastInsertRowid;
      const client = get(db, 'SELECT name, company_name, tax_mode, tax_rate FROM clients WHERE id=?', [clientId]) as DbRow;
      const cName = (client?.company_name as string) || (client?.name as string) || '';
      const txAmt = Number(amount || 0);
      // If project_id is provided, get tax from project; else fallback to client
      let tm = (client?.tax_mode as string) || 'none';
      let tr = Number(client?.tax_rate || 0);
      if (project_id) {
        const proj = get(db, 'SELECT tax_mode, tax_rate FROM client_projects WHERE id=?', [project_id]) as DbRow;
        if (proj) { tm = (proj.tax_mode as string) || 'none'; tr = Number(proj.tax_rate || 0); }
      }
      if (txAmt > 0) {
        try {
          const txRes = run(db,
            `INSERT INTO finance_transactions (type, amount, category, description, date, status, source, source_id, client_id, client_name, tax_mode, tax_rate, tax_amount, project_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            ['income', txAmt, '项目收入', `${cName} · ${label || '项目付款'}`, due_date || todayDateKey(), '待收款 (应收)', 'milestone', msId, clientId, cName, tm, tr, calcTaxOffline(txAmt, tm, tr), project_id || null]);
          const txId = txRes.lastInsertRowid;
          if (txId) run(db, `UPDATE payment_milestones SET finance_tx_id=? WHERE id=?`, [txId, msId]);
        } catch (txErr) {
          // Rollback: soft-delete the milestone
          run(db, 'UPDATE payment_milestones SET soft_deleted=1 WHERE id=?', [msId]);
          return err(500, 'Failed to create linked finance transaction');
        }
      }
      logActivity(db, 'milestone', 'created', `新增付款节点：${cName} · ${label||''}`,
        amount ? `$${Number(amount).toLocaleString()}` : '', msId);
      await saveDb();
      return ok({ id: msId });
    }
  }

  const milestoneMatch = path.match(/^\/api\/milestones\/(\d+)$/);
  if (milestoneMatch) {
    const id = milestoneMatch[1];
    if (method === 'PUT') {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.label !== undefined) { sets.push('label=?'); vals.push(str(body.label, 255)); }
      if (body.due_date !== undefined) { sets.push('due_date=?'); vals.push(str(body.due_date, 10)); }
      if (body.paid_date !== undefined) { sets.push('paid_date=?'); vals.push(str(body.paid_date, 10)); }
      if (body.payment_method !== undefined) { sets.push('payment_method=?'); vals.push(str(body.payment_method, 50)); }
      if (body.status !== undefined) { sets.push('status=?'); vals.push(enumVal(body.status, VALID_MS_STATUSES, 'pending')); }
      if (body.invoice_number !== undefined) { sets.push('invoice_number=?'); vals.push(str(body.invoice_number, 100)); }
      if (body.note !== undefined) { sets.push('note=?'); vals.push(str(body.note, 1000)); }
      if (body.project_id !== undefined) { sets.push('project_id=?'); vals.push(body.project_id); }
      const numFields = ['amount','percentage','sort_order'];
      for (const f of numFields) { if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f] ?? 0); } }
      if (sets.length > 0) {
        sets.push('updated_at=CURRENT_TIMESTAMP');
        vals.push(id);
        run(db, `UPDATE payment_milestones SET ${sets.join(',')} WHERE id=?`, vals);
      }
      // Cascade paid_date / amount changes to linked finance transaction
      if (body.paid_date !== undefined || body.amount !== undefined) {
        const msRow = get(db, 'SELECT finance_tx_id FROM payment_milestones WHERE id=?', [id]) as DbRow;
        if (msRow?.finance_tx_id) {
          const updates: string[] = [];
          const uVals: unknown[] = [];
          if (body.paid_date !== undefined) { updates.push('date=?'); uVals.push(str(body.paid_date, 10)); }
          if (body.amount !== undefined) {
            const newAmt = Number(body.amount) || 0;
            updates.push('amount=?'); uVals.push(newAmt);
            const ftx = get(db, 'SELECT tax_mode, tax_rate FROM finance_transactions WHERE id=?', [msRow.finance_tx_id]) as DbRow;
            if (ftx) {
              const tm = String(ftx.tax_mode || 'none');
              const tr = Number(ftx.tax_rate || 0);
              updates.push('tax_amount=?'); uVals.push(calcTaxOffline(newAmt, tm, tr));
            }
          }
          if (updates.length > 0) {
            uVals.push(msRow.finance_tx_id);
            run(db, `UPDATE finance_transactions SET ${updates.join(',')} WHERE id=?`, uVals);
          }
        }
      }
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT label, finance_tx_id FROM payment_milestones WHERE id=?', [id]) as DbRow;
      run(db, 'UPDATE payment_milestones SET soft_deleted=1 WHERE id=?', [id]);
      if (prev?.finance_tx_id) {
        run(db, 'UPDATE finance_transactions SET soft_deleted=1 WHERE id=?', [prev.finance_tx_id]);
      }
      logActivity(db, 'milestone', 'deleted', `删除付款节点：${prev?.label||''}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  const markPaidMatch = path.match(/^\/api\/milestones\/(\d+)\/mark-paid$/);
  if (markPaidMatch && method === 'POST') {
    const id = markPaidMatch[1];
    const { payment_method, paid_date } = body || {};
    const actualDate = paid_date || todayDateKey();
    const milestone = get(db, 'SELECT * FROM payment_milestones WHERE id=?', [id]) as DbRow;
    if (!milestone) return err(404, 'Milestone not found');

    // Fix Bug 2: Check idempotency - if milestone is already marked as paid, return early
    if (milestone.status === 'paid') {
      return ok({ success: true, financeId: milestone.finance_tx_id, alreadyPaid: true });
    }

    const client = get(db, 'SELECT name, tax_mode, tax_rate FROM clients WHERE id=?', [milestone.client_id]) as DbRow;
    const clientName = client?.name || '';

    // If milestone already has a linked finance transaction, UPDATE it (match online handler)
    let resolvedFinanceId: number;
    if (milestone.finance_tx_id) {
      run(db,
        `UPDATE finance_transactions SET status='已完成', date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [actualDate, milestone.finance_tx_id]);
      resolvedFinanceId = Number(milestone.finance_tx_id);
    } else {
      let txTaxMode = client?.tax_mode || 'none';
      let txTaxRate = Number(client?.tax_rate || 0);
      // Prefer project-level tax settings if milestone belongs to a project
      if (milestone.project_id) {
        const proj = get(db, 'SELECT tax_mode, tax_rate FROM client_projects WHERE id=?', [milestone.project_id]) as DbRow;
        if (proj) { txTaxMode = proj.tax_mode || txTaxMode; txTaxRate = Number(proj.tax_rate || 0) || txTaxRate; }
      }
      const txAmount = Number(milestone.amount||0);
      const txTaxAmount = txTaxMode === 'exclusive' ? Math.round((txAmount * txTaxRate) / 100 * 100) / 100
                        : txTaxMode === 'inclusive' ? Math.round((txAmount * txTaxRate) / (100 + txTaxRate) * 100) / 100
                        : 0;

      // Create finance transaction (source='milestone' to prevent manual edit/delete)
      const txRes = run(db,
        `INSERT INTO finance_transactions (type, amount, category, description, date, status, source, source_id, client_id, client_name, tax_mode, tax_rate, tax_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ['income', txAmount, '项目收入',
         `${clientName} · ${milestone.label||'项目付款'}`, actualDate, '已完成',
         'milestone', milestone.id, milestone.client_id, clientName, txTaxMode, txTaxRate, txTaxAmount]);
      resolvedFinanceId = txRes.lastInsertRowid;
    }

    // Update milestone
    run(db,
      `UPDATE payment_milestones SET status='paid', paid_date=?, payment_method=?, finance_tx_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [actualDate, payment_method || milestone.payment_method || '', resolvedFinanceId, id]);

    logActivity(db, 'milestone', 'paid',
      `确认收款：${clientName} · ${milestone.label||'项目付款'}`,
      `$${Number(milestone.amount||0).toLocaleString()} · ${payment_method||''}`, id);
    await saveDb();
    return ok({ success: true, financeId: resolvedFinanceId });
  }

  const undoPaidMatch = path.match(/^\/api\/milestones\/(\d+)\/undo-paid$/);
  if (undoPaidMatch && method === 'POST') {
    const id = undoPaidMatch[1];
    const milestone = get(db, 'SELECT * FROM payment_milestones WHERE id=?', [id]) as DbRow;
    if (!milestone) return err(404, 'Milestone not found');
    // Idempotency: already pending, nothing to undo
    if (milestone.status === 'pending') return ok({ success: true, alreadyPending: true });
    // Soft-delete linked finance transaction
    if (milestone.finance_tx_id) {
      run(db, 'UPDATE finance_transactions SET soft_deleted=1 WHERE id=?', [milestone.finance_tx_id]);
    }
    // Reset milestone to pending
    run(db, `UPDATE payment_milestones SET status='pending', paid_date='', payment_method='', finance_tx_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [id]);
    const client = get(db, 'SELECT name, company_name FROM clients WHERE id=?', [milestone.client_id]) as DbRow;
    logActivity(db, 'milestone', 'undo_paid',
      `撤销收款：${client?.company_name || client?.name || ''} · ${milestone.label || ''}`,
      `$${Number(milestone.amount || 0).toLocaleString()}`, id);
    await saveDb();
    return ok({ success: true });
  }

  return null;
}
