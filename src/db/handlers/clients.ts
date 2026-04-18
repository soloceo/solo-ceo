import { run, get, all, saveDb } from '../index';
import { str, enumVal } from '../../lib/validate';
import {
  VALID_CLIENT_STATUSES, VALID_BILLING_TYPES, VALID_TAX_MODES, VALID_PAYMENT_METHODS,
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, logActivity, syncClientSubscriptionLedger, normalizePlanTier, sanitizeSubscriptionTimeline,
} from './_shared';

export async function clientsHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── CLIENTS ────────────────────────────────────────────────────────────
  if (path === '/api/clients' && method === 'GET') {
    syncClientSubscriptionLedger(db);
    const currentYear = new Date().getFullYear();
    // Explicit column list keeps offline in parity with online (supabase-api.ts)
    // so new columns don't silently appear/disappear in only one handler
    const clients = all(db, `SELECT
      id, name, company_name, plan_tier, status, mrr, billing_type, project_fee,
      tax_mode, tax_rate, payment_method, industry, brand_context,
      contact_name, contact_email, contact_phone,
      subscription_start_date, paused_at, resumed_at, cancelled_at,
      mrr_effective_from, subscription_timeline, joined_at, created_at, updated_at,
      drive_folder_url, project_end_date
      FROM clients WHERE soft_deleted=0 ORDER BY joined_at DESC`);
    // Calculate lifetime/YTD revenue from finance_transactions (completed income per client) — matches online handler
    const revRows = all(db, `SELECT client_id, amount, date FROM finance_transactions WHERE type='income' AND status='已完成' AND soft_deleted=0 AND client_id IS NOT NULL`);
    const revMap = new Map<number, Array<{ amount: number; date: string }>>();
    for (const r of revRows) {
      const cid = Number(r.client_id);
      if (!revMap.has(cid)) revMap.set(cid, []);
      revMap.get(cid)!.push(r as { amount: number; date: string });
    }
    const rows = clients.map((client) => {
      const cl = revMap.get(Number(client.id)) || [];
      const lifetimeRevenue = cl.reduce((s, r) => s + Number(r.amount || 0), 0);
      const ytdRevenue = cl
        .filter((r) => String(r.date || '').startsWith(`${currentYear}-`))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      return { ...client, lifetimeRevenue, ytdRevenue };
    });
    return ok(rows);
  }

  if (path === '/api/clients' && method === 'POST') {
    const { name, industry, plan_tier, status, brand_context, mrr,
            subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from, subscription_timeline,
            company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate, drive_folder_url, payment_method } = body;
    const np = normalizePlanTier(plan_tier||'');
    const bt = enumVal(billing_type, VALID_BILLING_TYPES, 'subscription');
    const res = run(db, `INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr,
        subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from, subscription_timeline,
        company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate, drive_folder_url, payment_method)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [str(name, 255), str(industry, 100), np, enumVal(status, VALID_CLIENT_STATUSES, 'Active'), str(brand_context, 2000), mrr||0,
       str(subscription_start_date, 10), str(paused_at, 10), str(resumed_at, 10), str(cancelled_at, 10),
       str(mrr_effective_from, 10) || str(subscription_start_date, 10),
       subscription_timeline || JSON.stringify(subscription_start_date ? [{ type: 'start', date: subscription_start_date }] : []),
       str(company_name, 255), str(contact_name, 255), str(contact_email, 320), str(contact_phone, 30), bt, project_fee||0, str(project_end_date, 10),
       enumVal(tax_mode, VALID_TAX_MODES, 'none'), tax_rate||0, str(drive_folder_url, 2048), enumVal(payment_method, VALID_PAYMENT_METHODS, 'auto')]);
    syncClientSubscriptionLedger(db);
    logActivity(db, 'client', 'created', `新增客户：${name||'未命名客户'}`, np ? `方案：${np}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const clientMatch = path.match(/^\/api\/clients\/(\d+)$/);
  if (clientMatch) {
    const id = clientMatch[1];
    if (method === 'PUT') {
      const prev = get(db, `SELECT name, status, plan_tier, mrr, subscription_start_date,
        paused_at, resumed_at, cancelled_at, mrr_effective_from FROM clients WHERE id=?`, [id]) as DbRow;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) { sets.push('name=?'); vals.push(str(body.name, 255)); }
      if (body.industry !== undefined) { sets.push('industry=?'); vals.push(str(body.industry, 100)); }
      if (body.brand_context !== undefined) { sets.push('brand_context=?'); vals.push(str(body.brand_context, 2000)); }
      if (body.subscription_start_date !== undefined) { sets.push('subscription_start_date=?'); vals.push(str(body.subscription_start_date, 10)); }
      if (body.paused_at !== undefined) { sets.push('paused_at=?'); vals.push(str(body.paused_at, 10)); }
      if (body.resumed_at !== undefined) { sets.push('resumed_at=?'); vals.push(str(body.resumed_at, 10)); }
      if (body.cancelled_at !== undefined) { sets.push('cancelled_at=?'); vals.push(str(body.cancelled_at, 10)); }
      if (body.mrr_effective_from !== undefined) { sets.push('mrr_effective_from=?'); vals.push(str(body.mrr_effective_from, 10) || str(body.subscription_start_date, 10)); }
      if (body.subscription_timeline !== undefined) { sets.push('subscription_timeline=?'); vals.push(sanitizeSubscriptionTimeline(body.subscription_timeline)); }
      if (body.company_name !== undefined) { sets.push('company_name=?'); vals.push(str(body.company_name, 255)); }
      if (body.contact_name !== undefined) { sets.push('contact_name=?'); vals.push(str(body.contact_name, 255)); }
      if (body.contact_email !== undefined) { sets.push('contact_email=?'); vals.push(str(body.contact_email, 320)); }
      if (body.contact_phone !== undefined) { sets.push('contact_phone=?'); vals.push(str(body.contact_phone, 30)); }
      if (body.project_end_date !== undefined) { sets.push('project_end_date=?'); vals.push(str(body.project_end_date, 10)); }
      if (body.plan_tier !== undefined) { sets.push('plan_tier=?'); vals.push(normalizePlanTier(body.plan_tier||'')); }
      if (body.status !== undefined) { sets.push('status=?'); vals.push(enumVal(body.status, VALID_CLIENT_STATUSES, 'Active')); }
      if (body.mrr !== undefined) { sets.push('mrr=?'); vals.push(body.mrr || 0); }
      if (body.billing_type !== undefined) {
        const bt = enumVal(body.billing_type, VALID_BILLING_TYPES, 'subscription');
        sets.push('billing_type=?'); vals.push(bt);
        if (bt === 'subscription') { sets.push('project_fee=?', 'project_end_date=?'); vals.push(0, null); }
        else if (bt === 'project') { sets.push('mrr=?', 'plan_tier=?'); vals.push(0, ''); }
      }
      if (body.project_fee !== undefined) { sets.push('project_fee=?'); vals.push(body.project_fee || 0); }
      if (body.tax_mode !== undefined) { sets.push('tax_mode=?'); vals.push(enumVal(body.tax_mode, VALID_TAX_MODES, 'none')); }
      if (body.tax_rate !== undefined) { sets.push('tax_rate=?'); vals.push(body.tax_rate || 0); }
      if (body.drive_folder_url !== undefined) { sets.push('drive_folder_url=?'); vals.push(str(body.drive_folder_url, 2048)); }
      if (body.payment_method !== undefined) { sets.push('payment_method=?'); vals.push(enumVal(body.payment_method, VALID_PAYMENT_METHODS, 'auto')); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE clients SET ${sets.join(',')} WHERE id=?`, vals);
      }
      syncClientSubscriptionLedger(db);
      const displayName = body.name ?? prev?.name ?? '未命名客户';
      logActivity(db, 'client', 'updated', `更新客户：${displayName}`, '客户信息已更新', id);
      if (body.mrr !== undefined && Number(prev?.mrr||0) !== Number(body.mrr||0))
        logActivity(db, 'finance', 'subscription_changed', `订阅金额调整：${displayName}`,
          `MRR：$${Number(prev?.mrr||0).toLocaleString()} → $${Number(body.mrr||0).toLocaleString()}`, id);
      if (body.paused_at !== undefined && (prev?.paused_at||'') !== (body.paused_at||'') && (body.paused_at||''))
        logActivity(db, 'finance', 'subscription_paused', `订阅暂停：${displayName}`, `暂停日期：${body.paused_at}`, id);
      if (body.resumed_at !== undefined && (prev?.resumed_at||'') !== (body.resumed_at||'') && (body.resumed_at||''))
        logActivity(db, 'finance', 'subscription_resumed', `订阅恢复：${displayName}`, `恢复日期：${body.resumed_at}`, id);
      if (body.cancelled_at !== undefined && (prev?.cancelled_at||'') !== (body.cancelled_at||'') && (body.cancelled_at||''))
        logActivity(db, 'finance', 'subscription_cancelled', `订阅结束：${displayName}`, `结束日期：${body.cancelled_at}`, id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT name, company_name FROM clients WHERE id=?', [id]) as DbRow;

      // Fix Bug 1: Clean up related records before deleting the client
      const clientCompanyName = prev?.company_name || prev?.name || '';

      // Unlink tasks by client_id (reliable), fallback to name match for legacy data
      run(db, "UPDATE tasks SET client='', client_id=NULL WHERE client_id=?", [id]);
      run(db, "UPDATE tasks SET client='' WHERE client=? AND client_id IS NULL", [clientCompanyName]);

      // Unlink finance transactions - set client_id to null but preserve client_name for display
      const clientName = prev?.company_name || prev?.name || '';
      run(db, "UPDATE finance_transactions SET client_id=NULL, client_name=? WHERE client_id=?", [clientName, id]);

      // Soft-delete finance transactions linked to milestones (before milestones are soft-deleted)
      const clientMs = all(db, 'SELECT finance_tx_id FROM payment_milestones WHERE client_id=? AND soft_deleted=0', [id]);
      const msTxIds = clientMs.map((m: DbRow) => m.finance_tx_id).filter(Boolean);
      for (const txId of msTxIds) {
        run(db, 'UPDATE finance_transactions SET soft_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [txId]);
      }

      // Delete payment milestones and projects
      run(db, 'UPDATE payment_milestones SET soft_deleted=1 WHERE client_id=?', [id]);
      run(db, 'UPDATE client_projects SET soft_deleted=1 WHERE client_id=?', [id]);

      // Delete the client
      run(db, 'UPDATE clients SET soft_deleted=1 WHERE id=?', [id]);
      syncClientSubscriptionLedger(db);
      logActivity(db, 'client', 'deleted', `删除客户：${prev?.name||'未命名客户'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── CLIENT RESTORE ──────────────────────────────────────────────────────
  const restoreMatch = path.match(/^\/api\/clients\/(\d+)\/restore$/);
  if (restoreMatch && method === 'POST') {
    const id = restoreMatch[1];
    run(db, 'UPDATE clients SET soft_deleted=0, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    // Restore milestones
    const msRows = all(db, 'SELECT finance_tx_id FROM payment_milestones WHERE client_id=? AND soft_deleted=1', [id]);
    run(db, 'UPDATE payment_milestones SET soft_deleted=0 WHERE client_id=?', [id]);
    run(db, 'UPDATE client_projects SET soft_deleted=0 WHERE client_id=?', [id]);
    // Restore milestone finance transactions
    const txIds = msRows.map((m: DbRow) => m.finance_tx_id).filter(Boolean);
    for (const txId of txIds) {
      run(db, 'UPDATE finance_transactions SET soft_deleted=0, client_id=? WHERE id=?', [id, txId]);
    }
    logActivity(db, 'client', 'restored', `恢复客户`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  return null;
}
