import { run, get, all, saveDb } from '../index';
import { str, enumVal } from '../../lib/validate';
import {
  VALID_TASK_PRIORITIES, VALID_TASK_COLUMNS, VALID_TASK_SCOPES,
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, logActivity,
} from './_shared';

export async function tasksHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── TASKS ──────────────────────────────────────────────────────────────
  if (path === '/api/tasks' && method === 'GET') {
    return ok(all(db, 'SELECT * FROM tasks WHERE soft_deleted=0 ORDER BY created_at DESC'));
  }

  if (path === '/api/tasks' && method === 'POST') {
    const { title, client, client_id, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory, scope, parent_id } = body;
    const res = run(db, `INSERT INTO tasks (title, client, client_id, priority, due, "column", originalRequest, aiBreakdown, aiMjPrompts, aiStory, scope, parent_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [str(title, 500), str(client, 255), client_id||null, enumVal(priority, VALID_TASK_PRIORITIES, 'Medium'),
       str(due, 16), enumVal(column, VALID_TASK_COLUMNS, 'todo'),
       str(originalRequest, 5000), str(aiBreakdown, 10000), str(aiMjPrompts, 5000), str(aiStory, 5000),
       enumVal(scope, VALID_TASK_SCOPES, 'work'), parent_id||null]);
    logActivity(db, 'task', 'created', `新增任务：${title||'未命名任务'}`, client ? `客户：${client}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch) {
    const id = taskMatch[1];
    if (method === 'PUT') {
      const prev = get(db, 'SELECT title, "column" FROM tasks WHERE id=?', [id]) as DbRow;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.title !== undefined) { sets.push('title=?'); vals.push(str(body.title, 500)); }
      if (body.client !== undefined) { sets.push('client=?'); vals.push(str(body.client, 255)); }
      if (body.priority !== undefined) { sets.push('priority=?'); vals.push(enumVal(body.priority, VALID_TASK_PRIORITIES, 'Medium')); }
      if (body.due !== undefined) { sets.push('due=?'); vals.push(str(body.due, 16)); }
      if (body.originalRequest !== undefined) { sets.push('originalRequest=?'); vals.push(str(body.originalRequest, 5000)); }
      if (body.aiBreakdown !== undefined) { sets.push('aiBreakdown=?'); vals.push(str(body.aiBreakdown, 10000)); }
      if (body.aiMjPrompts !== undefined) { sets.push('aiMjPrompts=?'); vals.push(str(body.aiMjPrompts, 5000)); }
      if (body.aiStory !== undefined) { sets.push('aiStory=?'); vals.push(str(body.aiStory, 5000)); }
      if (body.scope !== undefined) { sets.push('scope=?'); vals.push(enumVal(body.scope, VALID_TASK_SCOPES, 'work')); }
      if (body.column !== undefined) { sets.push('"column"=?'); vals.push(enumVal(body.column, VALID_TASK_COLUMNS, 'todo')); }
      if (body.client_id !== undefined) { sets.push('client_id=?'); vals.push(body.client_id || null); }
      if (body.parent_id !== undefined) { sets.push('parent_id=?'); vals.push(body.parent_id || null); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE tasks SET ${sets.join(',')} WHERE id=?`, vals);
      }
      const detail = body.column !== undefined && prev?.column && prev.column !== body.column
        ? `kanban:${prev.column}→${body.column}` : 'content-updated';
      logActivity(db, 'task', 'updated', `更新任务：${body.title||prev?.title||'未命名任务'}`, detail, id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT title FROM tasks WHERE id=?', [id]) as DbRow;
      run(db, `UPDATE tasks SET soft_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE parent_id=?`, [id]);
      run(db, 'UPDATE tasks SET soft_deleted=1 WHERE id=?', [id]);
      logActivity(db, 'task', 'deleted', `删除任务：${prev?.title||'未命名任务'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  return null;
}
