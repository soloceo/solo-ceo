import { run, get, all, saveDb } from '../index';
import { str } from '../../lib/validate';
import {
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, logActivity,
} from './_shared';

export async function contentDraftsHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── CONTENT DRAFTS ─────────────────────────────────────────────────────
  if (path === '/api/content-drafts' && method === 'GET') {
    return ok(all(db, 'SELECT * FROM content_drafts WHERE soft_deleted=0 ORDER BY updated_at DESC, id DESC LIMIT 20'));
  }

  if (path === '/api/content-drafts' && method === 'POST') {
    const { id, topic, platform, language, content } = body;
    const safeTopic = str(topic, 255) || '';
    const safePlatform = str(platform, 50) || '';
    const safeLang = str(language, 10) || 'zh';
    if (id) {
      run(db, `UPDATE content_drafts SET topic=?,platform=?,language=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [safeTopic, safePlatform, safeLang, content||'', id]);
      logActivity(db, 'content', 'updated', `更新草稿：${safeTopic||'未命名草稿'}`, safePlatform ? `平台：${safePlatform}` : '', id);
      await saveDb();
      return ok({ id, success: true });
    }
    const res = run(db, `INSERT INTO content_drafts (topic, platform, language, content) VALUES (?,?,?,?)`,
      [safeTopic, safePlatform, safeLang, content||'']);
    logActivity(db, 'content', 'created', `保存草稿：${safeTopic||'未命名草稿'}`, safePlatform ? `平台：${safePlatform}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid, success: true });
  }

  const contentMatch = path.match(/^\/api\/content-drafts\/(\d+)$/);
  if (contentMatch && method === 'DELETE') {
    const id = contentMatch[1];
    const prev = get(db, 'SELECT topic FROM content_drafts WHERE id=?', [id]) as DbRow;
    run(db, 'UPDATE content_drafts SET soft_deleted=1 WHERE id=?', [id]);
    logActivity(db, 'content', 'deleted', `删除草稿：${prev?.topic||'未命名草稿'}`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  return null;
}
