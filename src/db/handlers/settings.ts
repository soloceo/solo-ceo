import { run, all, saveDb } from '../index';
import {
  type HandlerCtx, type HandlerResult,
  ok,
} from './_shared';

export async function settingsHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
  // ── SETTINGS ────────────────────────────────────────────────────────
  if (path === '/api/settings' && method === 'GET') {
    const rows = all(db, 'SELECT key, value FROM app_settings');
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key as string] = r.value as string;
    return ok(settings);
  }

  if (path === '/api/settings' && method === 'POST') {
    const entries = Object.entries(body || {});
    for (const [key, value] of entries) {
      run(db, `INSERT INTO app_settings (key, value, updated_at)
               VALUES (?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(key)
               DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, String(value ?? '')]);
    }
    await saveDb();
    return ok({ success: true });
  }

  return null;
}
