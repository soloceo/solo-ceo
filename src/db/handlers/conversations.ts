import { run, all, saveDb } from '../index';
import { str } from '../../lib/validate';
import {
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, err, safeJsonParse,
} from './_shared';

export async function conversationsHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── AI CONVERSATIONS ──────────────────────────────────────────────
  if (path === '/api/conversations' && method === 'GET') {
    const rows = all(db, `SELECT * FROM ai_conversations WHERE soft_deleted=0 ORDER BY updated_at DESC`);
    return ok(rows.map((r: DbRow) => ({
      ...r,
      agent_ids: safeJsonParse(r.agent_ids, []),
      messages: safeJsonParse(r.messages, []),
    })));
  }

  if (path === '/api/conversations' && method === 'POST') {
    const { id, title, agent_id, agent_ids, messages } = body;
    if (!id) return err(400, 'id is required');
    run(db,
      `INSERT OR IGNORE INTO ai_conversations (id, title, agent_id, agent_ids, messages)
       VALUES (?,?,?,?,?)`,
      [
        String(id),
        str(title || '', 200),
        agent_id != null ? Number(agent_id) : null,
        JSON.stringify(Array.isArray(agent_ids) ? agent_ids : []),
        JSON.stringify(Array.isArray(messages) ? messages : []),
      ]);
    await saveDb();
    return ok({ id, success: true });
  }

  const convMatch = path.match(/^\/api\/conversations\/(.+)$/);
  if (convMatch && method === 'PUT') {
    const id = convMatch[1];
    const patch: string[] = [];
    const vals: unknown[] = [];
    if (body.title !== undefined) { patch.push('title=?'); vals.push(str(body.title, 200)); }
    if (body.agent_id !== undefined) { patch.push('agent_id=?'); vals.push(body.agent_id != null ? Number(body.agent_id) : null); }
    if (body.agent_ids !== undefined) { patch.push('agent_ids=?'); vals.push(JSON.stringify(Array.isArray(body.agent_ids) ? body.agent_ids : [])); }
    if (body.messages !== undefined) {
      const msgs = Array.isArray(body.messages) ? body.messages.slice(-100) : [];
      const sanitized = msgs.map((m: Record<string, unknown>) => ({
        role: m.role, content: String(m.content || '').slice(0, 50_000),
        ...(m.agentId != null ? { agentId: m.agentId } : {}),
        ...(m.timestamp ? { timestamp: m.timestamp } : {}),
      }));
      patch.push('messages=?'); vals.push(JSON.stringify(sanitized));
    }
    if (patch.length === 0) return ok({ success: true });
    patch.push('updated_at=CURRENT_TIMESTAMP');
    vals.push(id);
    run(db, `UPDATE ai_conversations SET ${patch.join(',')} WHERE id=?`, vals);
    await saveDb();
    return ok({ success: true });
  }

  if (convMatch && method === 'DELETE') {
    const id = convMatch[1];
    run(db, 'UPDATE ai_conversations SET soft_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    await saveDb();
    return ok({ success: true });
  }

  return null;
}
