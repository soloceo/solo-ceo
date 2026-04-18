import { run, get, saveDb } from '../index';
import { str, enumVal } from '../../lib/validate';
import { renderFinanceReport } from '../../lib/finance-report';
import {
  VALID_TAX_MODES, VALID_TX_TYPES, VALID_TX_STATUSES,
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, err, logActivity, getFinanceRows,
} from './_shared';

export async function financeHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── FINANCE ────────────────────────────────────────────────────────────
  if (path === '/api/finance' && method === 'GET') {
    return ok(getFinanceRows(db));
  }

  if (path === '/api/finance/report' && method === 'GET') {
    const transactions = getFinanceRows(db);
    const completedIncome = transactions.filter((t: DbRow) => t.type === 'income' && (t.status||'已完成') === '已完成').reduce((s,t) => s + Number(t.amount||0), 0);
    const completedExpense = transactions.filter((t: DbRow) => t.type === 'expense' && (t.status||'已完成') === '已完成').reduce((s,t) => s + Number(t.amount||0), 0);
    const receivables = transactions.filter((t: DbRow) => String(t.status||'').includes('应收')).reduce((s,t) => s + Number(t.amount||0), 0);
    const payables = transactions.filter((t: DbRow) => String(t.status||'').includes('应付')).reduce((s,t) => s + Number(t.amount||0), 0);
    const totalTax = transactions.filter((t: DbRow) => (t.status||'已完成') === '已完成' && Number(t.tax_amount||0) > 0).reduce((s,t) => s + Number(t.tax_amount||0), 0);
    const html = renderFinanceReport({
      completedIncome, completedExpense, receivables, payables, totalTax,
      rows: transactions,
    });
    return { status: 200, data: html };
  }

  if (path === '/api/finance' && method === 'POST') {
    const { type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name, source, source_id } = body;
    const res = run(db, `INSERT INTO finance_transactions (type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name, source, source_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [enumVal(type, VALID_TX_TYPES, 'income'), amount||0, str(category, 100), str(description, 500), str(date, 10), enumVal(status, VALID_TX_STATUSES, '已完成'), enumVal(tax_mode, VALID_TAX_MODES, 'none'), tax_rate||0, tax_amount||0, client_id||null, str(client_name, 255), source||'manual', source_id||null]);
    logActivity(db, 'finance', 'created', `新增交易：${description||'未命名交易'}`,
      `${type==='income'?'+':'-'}$${Number(amount||0).toLocaleString()} · ${category||'未分类'}`, res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  // ── Confirm / Undo receipt for subscription transactions ──
  const confirmReceiptMatch = path.match(/^\/api\/finance\/(\d+)\/confirm-receipt$/);
  if (confirmReceiptMatch && method === 'POST') {
    const id = Number(confirmReceiptMatch[1]);
    const txRow = get(db, 'SELECT source, status, description FROM finance_transactions WHERE id=?', [id]) as DbRow;
    if (!txRow) return err(404, 'Transaction not found');
    if (txRow.source !== 'subscription') return err(400, 'Only subscription transactions can use confirm-receipt');
    if (txRow.status === '已完成') return err(400, 'Already confirmed');
    run(db, `UPDATE finance_transactions SET status='已完成' WHERE id=?`, [id]);
    logActivity(db, 'finance', 'updated', `确认收款：${txRow.description || '未命名交易'}`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  const undoReceiptMatch = path.match(/^\/api\/finance\/(\d+)\/undo-receipt$/);
  if (undoReceiptMatch && method === 'POST') {
    const id = Number(undoReceiptMatch[1]);
    const txRow = get(db, 'SELECT source, status, description FROM finance_transactions WHERE id=?', [id]) as DbRow;
    if (!txRow) return err(404, 'Transaction not found');
    if (txRow.source !== 'subscription') return err(400, 'Only subscription transactions can use undo-receipt');
    if (txRow.status !== '已完成') return err(400, 'Not confirmed yet');
    run(db, `UPDATE finance_transactions SET status='待收款 (应收)' WHERE id=?`, [id]);
    logActivity(db, 'finance', 'updated', `撤销确认：${txRow.description || '未命名交易'}`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  const financeMatch = path.match(/^\/api\/finance\/(\d+)$/);
  if (financeMatch) {
    const id = Number(financeMatch[1]);
    // Check source — only manual transactions can be edited/deleted
    const txRow = get(db, 'SELECT source, description FROM finance_transactions WHERE id=?', [id]) as DbRow;
    if (!txRow) return err(404, 'Transaction not found');
    const src = txRow.source || 'manual';
    if (src === 'subscription') return err(400, '订阅流水由客户状态自动生成，请在客户管理中编辑');
    if (src === 'milestone') return err(400, '此交易由里程碑自动生成，请前往签约客户中修改');
    if (src === 'project_fee') return err(400, '项目总费待收款，请在客户管理中编辑');

    if (method === 'PUT') {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.type !== undefined) { sets.push('type=?'); vals.push(enumVal(body.type, VALID_TX_TYPES, 'income')); }
      if (body.category !== undefined) { sets.push('category=?'); vals.push(str(body.category, 100)); }
      if (body.description !== undefined) { sets.push('description=?'); vals.push(str(body.description, 500)); }
      if (body.date !== undefined) { sets.push('date=?'); vals.push(str(body.date, 10)); }
      if (body.status !== undefined) { sets.push('status=?'); vals.push(enumVal(body.status, VALID_TX_STATUSES, '已完成')); }
      if (body.tax_mode !== undefined) { sets.push('tax_mode=?'); vals.push(enumVal(body.tax_mode, VALID_TAX_MODES, 'none')); }
      if (body.client_name !== undefined) { sets.push('client_name=?'); vals.push(str(body.client_name, 255)); }
      const numFields = ['amount','tax_rate','tax_amount'];
      for (const f of numFields) { if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f] || 0); } }
      if (body.client_id !== undefined) { sets.push('client_id=?'); vals.push(body.client_id || null); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE finance_transactions SET ${sets.join(',')} WHERE id=?`, vals);
      }
      logActivity(db, 'finance', 'updated', `更新交易：${body.description||txRow?.description||'未命名交易'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      run(db, 'UPDATE finance_transactions SET soft_deleted=1 WHERE id=?', [id]);
      logActivity(db, 'finance', 'deleted', `删除交易：${txRow.description||'未命名交易'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  return null;
}
