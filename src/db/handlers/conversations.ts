import { run, all, saveDb } from '../index';
import { str } from '../../lib/validate';
import {
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, err, safeJsonParse,
} from './_shared';

function normalizeIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  return [...new Set(ids)];
}

function getLocalAgentIdSet(db: HandlerCtx['db'], agentIds: number[]): Set<number> {
  if (agentIds.length === 0) return new Set();
  const placeholders = agentIds.map(() => '?').join(',');
  const rows = all(db, `SELECT id FROM ai_agents WHERE soft_deleted=0 AND id IN (${placeholders})`, agentIds);
  return new Set(rows.map((row) => Number(row.id)));
}

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
    const primaryAgentId = agent_id != null ? Number(agent_id) : null;
    const multiAgentIds = normalizeIdList(agent_ids);
    const idsToCheck = [
      ...(primaryAgentId != null ? [primaryAgentId] : []),
      ...multiAgentIds,
    ];
    const existingAgentIds = getLocalAgentIdSet(db, idsToCheck);
    if (primaryAgentId != null && !existingAgentIds.has(primaryAgentId)) return err(404, 'Agent not found');
    if (multiAgentIds.some((agentId) => !existingAgentIds.has(agentId))) return err(404, 'Agent not found');
    run(db,
      `INSERT OR IGNORE INTO ai_conversations (id, title, agent_id, agent_ids, messages)
       VALUES (?,?,?,?,?)`,
      [
        String(id),
        str(title || '', 200),
        primaryAgentId,
        JSON.stringify(multiAgentIds),
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
    if (body.agent_id !== undefined) {
      const primaryAgentId = body.agent_id != null ? Number(body.agent_id) : null;
      if (primaryAgentId != null && !getLocalAgentIdSet(db, [primaryAgentId]).has(primaryAgentId)) return err(404, 'Agent not found');
      patch.push('agent_id=?'); vals.push(primaryAgentId);
    }
    if (body.agent_ids !== undefined) {
      const multiAgentIds = normalizeIdList(body.agent_ids);
      const existingAgentIds = getLocalAgentIdSet(db, multiAgentIds);
      if (multiAgentIds.some((agentId) => !existingAgentIds.has(agentId))) return err(404, 'Agent not found');
      patch.push('agent_ids=?'); vals.push(JSON.stringify(multiAgentIds));
    }
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
