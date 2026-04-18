import { run, get, all, saveDb } from '../index';
import {
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, logActivity,
} from './_shared';

export async function plansHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── PLANS ──────────────────────────────────────────────────────────────
  if (path === '/api/plans' && method === 'GET') {
    const planClientCounts = all(db,
      `SELECT plan_tier, COUNT(*) as count FROM clients WHERE status='Active' AND soft_deleted=0 GROUP BY plan_tier`);
    const countMap = new Map<string, number>();
    for (const r of planClientCounts) countMap.set(r.plan_tier||'', Number(r.count||0));

    const aliases: Record<string, string[]> = {
      '基础版': ['基础版','Basic','basic'],
      '专业版': ['专业版','Pro','pro','Professional','professional'],
      '企业版': ['企业版','Enterprise','enterprise'],
    };
    const plans = all(db, 'SELECT * FROM plans WHERE soft_deleted=0').map((p) => {
      const al = aliases[p.name as string] || [p.name];
      const clients = al.reduce((s, a) => s + (countMap.get(a) || 0), 0);
      let features: string[] = [];
      try { features = JSON.parse(p.features as string); } catch { /* malformed JSON */ }
      return { ...p, features, clients };
    });
    return ok(plans);
  }

  if (path === '/api/plans' && method === 'POST') {
    const { name, price, deliverySpeed, features, clients } = body;
    const res = run(db, `INSERT INTO plans (name, price, deliverySpeed, features, clients) VALUES (?,?,?,?,?)`,
      [name||'', price||0, deliverySpeed||'', JSON.stringify(features||[]), clients||0]);
    logActivity(db, 'plan', 'created', `新增方案：${name||'未命名方案'}`, price ? `价格：$${price}/月` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const planMatch = path.match(/^\/api\/plans\/(\d+)$/);
  if (planMatch) {
    const id = planMatch[1];
    if (method === 'PUT') {
      const prev = get(db, 'SELECT name FROM plans WHERE id=?', [id]) as DbRow;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) { sets.push('name=?'); vals.push(body.name); }
      if (body.price !== undefined) { sets.push('price=?'); vals.push(body.price); }
      if (body.deliverySpeed !== undefined) { sets.push('deliverySpeed=?'); vals.push(body.deliverySpeed); }
      if (body.features !== undefined) { sets.push('features=?'); vals.push(JSON.stringify(body.features)); }
      if (body.clients !== undefined) { sets.push('clients=?'); vals.push(body.clients); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE plans SET ${sets.join(',')} WHERE id=?`, vals);
      }
      const displayName = body.name ?? prev?.name ?? '未命名方案';
      logActivity(db, 'plan', 'updated', `更新方案：${displayName}`, body.price ? `价格：$${body.price}/月` : '方案信息已更新', id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT name FROM plans WHERE id=?', [id]) as DbRow;
      run(db, 'UPDATE plans SET soft_deleted=1 WHERE id=?', [id]);
      logActivity(db, 'plan', 'deleted', `删除方案：${prev?.name||'未命名方案'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  return null;
}
