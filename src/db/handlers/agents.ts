import { run, get, all, saveDb } from '../index';
import { str } from '../../lib/validate';
import {
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, err, logActivity, safeJsonParse,
} from './_shared';

export async function agentsHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── AI AGENTS ─────────────────────────────────────────────────────
  if (path === '/api/agents' && method === 'GET') {
    const rows = all(db, `SELECT * FROM ai_agents WHERE soft_deleted=0 ORDER BY sort_order ASC, created_at ASC`);
    // Parse JSON fields
    return ok(rows.map((r: DbRow) => ({
      ...r,
      is_default: !!r.is_default,
      tools: safeJsonParse(r.tools, []),
      conversation_starters: safeJsonParse(r.conversation_starters, []),
    })));
  }

  if (path === '/api/agents' && method === 'POST') {
    const { name, avatar, role, personality, rules, tools, conversation_starters, template_id, is_default, sort_order } = body;
    if (!name || !String(name).trim()) return err(400, 'name is required');
    const res = run(db,
      `INSERT INTO ai_agents (name, avatar, role, personality, rules, tools, conversation_starters, template_id, is_default, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        str(name, 100), str(avatar || '', 10), str(role || '', 2000),
        str(personality || '', 2000), str(rules || '', 2000),
        JSON.stringify(Array.isArray(tools) ? tools : []),
        JSON.stringify(Array.isArray(conversation_starters) ? conversation_starters : []),
        str(template_id || '', 50), is_default ? 1 : 0, Number(sort_order) || 0,
      ]);
    logActivity(db, 'ai_agent', 'created', `创建 Agent：${String(name).trim()}`, '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid, success: true });
  }

  const agentMatch = path.match(/^\/api\/agents\/(\d+)$/);
  if (agentMatch && method === 'PUT') {
    const id = agentMatch[1];
    const patch: string[] = [];
    const vals: unknown[] = [];
    if (body.name !== undefined) { patch.push('name=?'); vals.push(str(body.name, 100)); }
    if (body.avatar !== undefined) { patch.push('avatar=?'); vals.push(str(body.avatar, 10)); }
    if (body.role !== undefined) { patch.push('role=?'); vals.push(str(body.role, 2000)); }
    if (body.personality !== undefined) { patch.push('personality=?'); vals.push(str(body.personality, 2000)); }
    if (body.rules !== undefined) { patch.push('rules=?'); vals.push(str(body.rules, 2000)); }
    if (body.tools !== undefined) { patch.push('tools=?'); vals.push(JSON.stringify(Array.isArray(body.tools) ? body.tools : [])); }
    if (body.conversation_starters !== undefined) { patch.push('conversation_starters=?'); vals.push(JSON.stringify(Array.isArray(body.conversation_starters) ? body.conversation_starters : [])); }
    if (body.template_id !== undefined) { patch.push('template_id=?'); vals.push(str(body.template_id, 50)); }
    if (body.is_default !== undefined) { patch.push('is_default=?'); vals.push(body.is_default ? 1 : 0); }
    if (body.sort_order !== undefined) { patch.push('sort_order=?'); vals.push(Number(body.sort_order) || 0); }
    if (patch.length === 0) return ok({ success: true });
    patch.push('updated_at=CURRENT_TIMESTAMP');
    vals.push(id);
    run(db, `UPDATE ai_agents SET ${patch.join(',')} WHERE id=?`, vals);
    logActivity(db, 'ai_agent', 'updated', `更新 Agent：${body.name || ''}`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  if (agentMatch && method === 'DELETE') {
    const id = agentMatch[1];
    const prev = get(db, 'SELECT name FROM ai_agents WHERE id=?', [id]) as DbRow;
    run(db, 'UPDATE ai_agents SET soft_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    logActivity(db, 'ai_agent', 'deleted', `删除 Agent：${prev?.name || ''}`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  return null;
}
