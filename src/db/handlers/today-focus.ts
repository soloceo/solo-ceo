import { run, get, saveDb } from '../index';
import { str } from '../../lib/validate';
import { todayDateKey } from '../../lib/date-utils';
import {
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, err, logActivity, upsertTodayFocusState,
} from './_shared';

export async function todayFocusHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── TODAY FOCUS ────────────────────────────────────────────────────────
  if (path === '/api/today-focus/state' && method === 'POST') {
    const { focusKey, status } = body || {};
    if (!focusKey) return err(400, 'focusKey is required');
    const norm = status === 'completed' ? 'completed' : 'pending';
    upsertTodayFocusState(db, String(focusKey), norm);
    await saveDb();
    return ok({ success: true, focusKey: String(focusKey), status: norm });
  }

  if (path === '/api/today-focus/manual' && method === 'POST') {
    const { type, title, note } = body || {};
    const cleanTitle = str(title, 500).trim();
    if (!cleanTitle) return err(400, 'title is required');
    const cleanType = str(type, 50) || '系统';
    const cleanNote = str(note, 2000).trim();
    const focusDate = todayDateKey();
    const res = run(db, `INSERT INTO today_focus_manual (focus_date, type, title, note, updated_at)
      VALUES (?,?,?,?,CURRENT_TIMESTAMP)`,
      [focusDate, cleanType, cleanTitle, cleanNote]);
    const focusKey = `manual-${res.lastInsertRowid}`;
    upsertTodayFocusState(db, focusKey, 'pending', focusDate);
    logActivity(db, 'today_focus', 'manual_created', `记录今日事件：${cleanTitle}`, cleanType ? `类型：${cleanType}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ success: true, id: res.lastInsertRowid, focusKey });
  }

  const manualMatch = path.match(/^\/api\/today-focus\/manual\/(\d+)$/);
  if (manualMatch) {
    const id = manualMatch[1];
    if (method === 'PUT') {
      const prev = get(db, 'SELECT title, type FROM today_focus_manual WHERE id=? AND soft_deleted=0', [id]) as DbRow;
      if (!prev) return err(404, 'manual event not found');
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.type !== undefined) { sets.push('type=?'); vals.push(str(body.type, 50)); }
      if (body.title !== undefined) { sets.push('title=?'); vals.push(str(body.title, 500).trim()); }
      if (body.note !== undefined) { sets.push('note=?'); vals.push(str(body.note, 2000).trim()); }
      if (sets.length === 0) return ok({ success: true });
      sets.push('updated_at=CURRENT_TIMESTAMP');
      vals.push(id);
      run(db, `UPDATE today_focus_manual SET ${sets.join(',')} WHERE id=?`, vals);
      const loggedTitle = body.title !== undefined ? str(body.title, 500).trim() : prev?.title;
      const loggedType = body.type !== undefined ? str(body.type, 50) : (prev?.type || '系统');
      logActivity(db, 'today_focus', 'manual_updated', `更新今日事件：${loggedTitle}`, `类型：${loggedType}`, id);
      await saveDb();
      return ok({ success: true, id: Number(id) });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT title FROM today_focus_manual WHERE id=?', [id]) as DbRow;
      if (!prev) return err(404, 'manual event not found');
      run(db, 'UPDATE today_focus_manual SET soft_deleted=1 WHERE id=?', [id]);
      run(db, `DELETE FROM today_focus_state WHERE focus_date=? AND focus_key=?`, [todayDateKey(), `manual-${id}`]);
      logActivity(db, 'today_focus', 'manual_deleted', `删除今日事件：${prev?.title||'未命名事件'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  return null;
}
