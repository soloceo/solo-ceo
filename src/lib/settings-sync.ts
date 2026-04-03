/**
 * settings-sync.ts
 * Debounced sync of user preferences to /api/settings (app_settings table).
 * Works in both online (Supabase) and offline (sql.js) modes.
 */
import { api } from './api';

/** Pending key-value pairs waiting to be flushed */
let pending: Record<string, string> = {};
let timer: ReturnType<typeof setTimeout> | undefined;
const DEBOUNCE_MS = 800;

/**
 * Queue a preference to be synced. Debounces multiple calls into one POST.
 */
export function syncPref(key: string, value: string) {
  pending[key] = value;
  clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

/**
 * Queue multiple preferences at once.
 */
export function syncPrefs(pairs: Record<string, string>) {
  Object.assign(pending, pairs);
  clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush() {
  const batch = pending;
  pending = {};
  if (!Object.keys(batch).length) return;
  try {
    await api.post('/api/settings', batch);
  } catch {
    // Silently fail — localStorage is the primary store, cloud sync is best-effort
  }
}

/**
 * Load preferences from /api/settings and apply them to stores.
 * Called once on app init after auth is resolved.
 */
export async function loadCloudPrefs(): Promise<Record<string, string> | null> {
  try {
    return await api.get<Record<string, string>>('/api/settings');
  } catch {
    return null;
  }
}
