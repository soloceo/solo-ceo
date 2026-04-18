import { run, get, all, saveDb } from '../index';
import { str, enumVal } from '../../lib/validate';
import { todayDateKey } from '../../lib/date-utils';
import {
  VALID_LEAD_COLUMNS, VALID_BILLING_TYPES, VALID_CLIENT_STATUSES,
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, err, logActivity, syncClientSubscriptionLedger, normalizePlanTier,
} from './_shared';

export async function leadsHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  if (path === '/api/leads' && method === 'GET') {
    return ok(all(db, 'SELECT id, name, industry, needs, website, "column", aiDraft, source, created_at, updated_at FROM leads WHERE soft_deleted=0 ORDER BY created_at DESC'));
  }

  if (path === '/api/leads' && method === 'POST') {
    const { name, industry, needs, website, column, aiDraft, source } = body;
    const res = run(db, `INSERT INTO leads (name, industry, needs, website, column, aiDraft, source)
      VALUES (?,?,?,?,?,?,?)`,
      [str(name, 255), str(industry, 100), str(needs, 2000), str(website, 2048), enumVal(column, VALID_LEAD_COLUMNS, 'new'), str(aiDraft, 5000), str(source, 100)]);
    logActivity(db, 'lead', 'created', `新增线索：${name||'未命名线索'}`, source ? `来源：${source}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const leadMatch = path.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch) {
    const id = leadMatch[1];
    let dirty = false;
    if (method === 'PUT') {
      const prev = get(db, 'SELECT name, column FROM leads WHERE id=?', [id]) as DbRow;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) { sets.push('name=?'); vals.push(str(body.name, 255)); }
      if (body.industry !== undefined) { sets.push('industry=?'); vals.push(str(body.industry, 100)); }
      if (body.needs !== undefined) { sets.push('needs=?'); vals.push(str(body.needs, 2000)); }
      if (body.website !== undefined) { sets.push('website=?'); vals.push(str(body.website, 2048)); }
      if (body.column !== undefined) { sets.push('"column"=?'); vals.push(enumVal(body.column, VALID_LEAD_COLUMNS, 'new')); }
      if (body.aiDraft !== undefined) { sets.push('aiDraft=?'); vals.push(str(body.aiDraft, 5000)); }
      if (body.source !== undefined) { sets.push('source=?'); vals.push(str(body.source, 100)); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE leads SET ${sets.join(',')} WHERE id=?`, vals);
      }
      const detail = prev?.column && body.column !== undefined && prev.column !== body.column
        ? `阶段：${prev.column} → ${body.column}` : '线索信息已更新';
      logActivity(db, 'lead', 'updated', `更新线索：${body.name||prev?.name||'未命名线索'}`, detail, id);
      dirty = true;
    } else if (method === 'DELETE') {
      const prev = get(db, 'SELECT name FROM leads WHERE id=?', [id]) as DbRow;
      run(db, 'UPDATE leads SET soft_deleted=1 WHERE id=?', [id]);
      logActivity(db, 'lead', 'deleted', `删除线索：${prev?.name||'未命名线索'}`, '', id);
      dirty = true;
    }
    if (dirty) await saveDb();
    return ok({ success: true });
  }

  const convertMatch = path.match(/^\/api\/leads\/(\d+)\/convert$/);
  if (convertMatch && method === 'POST') {
    const id = convertMatch[1];
    const lead = get(db, 'SELECT * FROM leads WHERE id=?', [id]) as DbRow;
    if (!lead) return err(404, 'Lead not found');
    if (lead.column === 'won') return err(400, 'Lead already converted');
    const { plan_tier, status, mrr, subscription_start_date, mrr_effective_from, billing_type, project_fee } = body || {};
    const np = normalizePlanTier(plan_tier || '');
    const bt = enumVal(billing_type, VALID_BILLING_TYPES, 'subscription');
    const today = todayDateKey();
    const res = run(db, `INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr,
        subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from,
        billing_type, project_fee, subscription_timeline)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [lead.name||'', lead.industry||'', np, enumVal(status, VALID_CLIENT_STATUSES, 'Active'), lead.needs||'',
       bt === 'subscription' ? Number(mrr||0) : 0, subscription_start_date||today, '', '', '',
       mrr_effective_from||subscription_start_date||today,
       bt, bt === 'project' ? Number(project_fee||0) : 0,
       JSON.stringify([{ type: 'start', date: subscription_start_date || today }])]);
    run(db, `UPDATE leads SET column='won' WHERE id=?`, [id]);
    syncClientSubscriptionLedger(db);
    logActivity(db, 'lead', 'converted', `线索转客户：${lead.name||'未命名线索'}`, np ? `方案：${np}` : '已转为客户', id);
    logActivity(db, 'client', 'created', `新增客户：${lead.name||'未命名客户'}`, np ? `来自线索转化 · 方案：${np}` : '来自线索转化', res.lastInsertRowid);
    await saveDb();
    return ok({ success: true, clientId: res.lastInsertRowid });
  }

  return null;
}
