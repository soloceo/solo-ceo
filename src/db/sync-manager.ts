/**
 * Sync Manager — orchestrates the full sync cycle:
 *   1. Replay offline queue (push local changes to cloud)
 *   2. Pull fresh data from cloud (fetch all tables)
 *   3. Notify UI via events + toast
 *
 * Triggers: auth ready, online event, visibilitychange, manual
 */
import { supabase } from './supabase-client';
import { replayQueue, getQueueLength } from './offline-queue';
import { getDb, saveDb, all, run, exec } from './index';
import { clearCache } from './data-cache';
import { useSettingsStore } from '../store/useSettingsStore';
import { APP_SETTINGS_SYNCED_EVENT } from '../lib/settings-events';
import { sanitizeSettingValue } from '../lib/local-only-settings';

// ── Sync tables — all mutable tables to pull from cloud ──────────
const SYNC_TABLES = [
  'leads', 'clients', 'tasks', 'plans',
  'finance_transactions', 'payment_milestones', 'client_projects',
  'content_drafts', 'today_focus_state', 'today_focus_manual',
  'ai_agents', 'ai_conversations',
] as const;

// Tables to pull from cloud → local sql.js (includes SYNC_TABLES + derived tables)
const PULL_TABLES = [
  ...SYNC_TABLES,
  'client_subscription_ledger',
  'activity_log',
  'app_settings',
] as const;

let syncPromise: Promise<void> | null = null;
let lastSyncAt = 0;
const MIN_SYNC_INTERVAL = 10_000; // minimum 10s between syncs

// ── Dispatch helpers ─────────────────────────────────────────────
// sync-status used to be broadcast via CustomEvent; it's now a Zustand
// slice so all consumers (SyncIndicator, SettingsPage, App) subscribe
// reactively and the value shows up in devtools.
// sync-toast is still a CustomEvent because the SyncToast component
// uses its own icon + variant scheme that doesn't round-trip through
// the generic showToast toast shape. Lift when that toast API grows.

function dispatchSyncStatus(status: "idle" | "syncing", extra?: { pending?: number }) {
  const settings = useSettingsStore.getState();
  settings.setSyncStatus(status);
  if (typeof extra?.pending === 'number') settings.setPendingOps(extra.pending);
}

function dispatchSyncToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('sync-toast', {
    detail: { message, type },
  }));
}

// ── Pull cloud data into local sql.js for offline use ───────────

async function pullCloudToLocal(): Promise<void> {
  const db = await getDb();

  const failedTables: string[] = [];
  let appSettingsPulled = false;
  for (const table of PULL_TABLES) {
    try {
      // Fetch all rows from Supabase (RLS filters by user_id)
      const { data: rows, error } = await supabase.from(table).select('*');
      if (error) {
        // Surface the specific error so "sync quietly stops working" becomes
        // debuggable from the browser console instead of needing a repro.
        console.warn(`[SyncManager] Pull error for ${table}:`, error);
        failedTables.push(table);
        continue;
      }
      const safeRows = table === 'app_settings'
        ? rows?.map((row) => ({
            ...row,
            value: sanitizeSettingValue(String(row.key ?? ''), row.value),
          }))
        : rows;
      if (!safeRows) continue;
      // Skip DELETE+INSERT if cloud returned 0 rows — prevents accidental data wipe.
      // Known limitation: if the user legitimately cleared all rows elsewhere,
      // this cold-start pull won't propagate the deletion to local. Realtime
      // postgres_changes covers live deletes while the tab is active, so this
      // only affects users who delete-all on device A then open device B fresh.
      // TODO: add last_sync_at / per-table cursor to enable safe diff pulls.
      if (safeRows.length === 0) {
        console.debug(`[SyncManager] ${table} returned 0 rows — keeping local copy`);
        continue;
      }

      // Get local column names via PRAGMA
      const colInfo = all(db, `PRAGMA table_info("${table}")`);
      const localCols = new Set(colInfo.map((c: Record<string, unknown>) => String(c.name)));
      if (localCols.size === 0) continue;

      // Atomic: delete old + insert new in a transaction
      try {
        exec(db, 'BEGIN TRANSACTION');
        exec(db, `DELETE FROM "${table}"`);

        for (const row of safeRows) {
          // Only insert columns that exist in local schema
          const cols: string[] = [];
          const vals: unknown[] = [];
          for (const [k, v] of Object.entries(row)) {
            if (!localCols.has(k)) continue;
            cols.push(`"${k}"`);
            // Convert boolean → integer for SQLite
            vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
          }
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(',');
          run(db, `INSERT INTO "${table}" (${cols.join(',')}) VALUES (${placeholders})`, vals);
        }

        exec(db, 'COMMIT');
        if (table === 'app_settings') appSettingsPulled = true;
      } catch (insertErr) {
        try { exec(db, 'ROLLBACK'); } catch { /* already rolled back */ }
        console.warn(`[SyncManager] Failed to write ${table} locally:`, insertErr);
        failedTables.push(table);
      }
    } catch (e) {
      console.warn(`[SyncManager] Failed to pull ${table}:`, e);
      failedTables.push(table);
    }
  }

  // Persist to IndexedDB
  await saveDb();

  // Invalidate SWR cache so components fetch fresh data
  clearCache();
  if (appSettingsPulled) {
    window.dispatchEvent(new Event(APP_SETTINGS_SYNCED_EVENT));
  }

  // One aggregated toast instead of spamming the user per-table. Only shown when
  // at least one table actually failed — successful syncs stay silent as before.
  if (failedTables.length > 0) {
    dispatchSyncToast(`${failedTables.length} 张表同步失败：${failedTables.join(', ')}`, 'warning');
  }
}

// ── Pull cloud state into components ─────────────────────────────

async function pullCloudState(): Promise<void> {
  // Batch event — listeners that understand batching can handle all at once
  window.dispatchEvent(new CustomEvent('supabase-change-batch', {
    detail: { tables: [...SYNC_TABLES], eventType: 'SYNC_PULL' },
  }));
  // Individual events for backward compat (components using useRealtimeRefresh)
  for (const table of SYNC_TABLES) {
    window.dispatchEvent(new CustomEvent('supabase-change', {
      detail: { table, eventType: 'SYNC_PULL', new: null, old: null, batched: true },
    }));
  }
}

// ── Full sync cycle ──────────────────────────────────────────────

export function triggerFullSync(): Promise<void> {
  if (syncPromise) return syncPromise;
  if (Date.now() - lastSyncAt < MIN_SYNC_INTERVAL) return Promise.resolve();
  if (!navigator.onLine) return Promise.resolve();
  syncPromise = performFullSync();
  return syncPromise;
}

async function performFullSync(): Promise<void> {
  let authenticated = false;

  try {
    // Check auth. Previously both the no-session branch and the thrown-error
    // branch were silent — sync would appear to run (status flips to idle)
    // while actually doing nothing, which matches the "data stopped syncing
    // but UI says OK" symptom users have reported.
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    } catch (authErr) {
      console.warn('[SyncManager] Skipping sync: getSession threw', authErr);
      return;
    }

    if (!session) {
      console.warn('[SyncManager] Skipping sync: no active session');
      return;
    }
    authenticated = true;
    const userId = session.user.id;
    const pending = await getQueueLength();
    dispatchSyncStatus('syncing', { pending });

    // Step 1: Replay offline queue (push local → cloud)
    if (pending > 0) {
      const { replayed, failed } = await replayQueue(userId);

      if (replayed > 0) {
        dispatchSyncToast(`已同步 ${replayed} 条离线操作`, 'success');
      }
      if (failed > 0) {
        dispatchSyncToast(`${failed} 条操作同步失败，将稍后重试`, 'warning');
      }
    }

    // Step 2: Pull cloud data into local sql.js for offline use
    await pullCloudToLocal();

    // Step 3: Trigger component refresh
    const remaining = await getQueueLength();
    dispatchSyncStatus('syncing', { pending: remaining });
    await pullCloudState();

    dispatchSyncStatus('idle', { pending: remaining });
  } catch (e) {
    // Sync failed — will retry on next trigger. Log + toast so users and
    // devs stop having to guess whether a failure actually occurred.
    console.error('[SyncManager] performFullSync failed:', e);
    dispatchSyncToast('同步失败，将稍后重试', 'warning');
    const remaining = await getQueueLength().catch(() => 0);
    dispatchSyncStatus('idle', { pending: remaining });
  } finally {
    syncPromise = null;
    // A no-session cold start should not throttle the first real sync after
    // the user signs in. Only successful auth checks count toward the sync
    // interval; otherwise SIGNED_IN can be ignored for up to MIN_SYNC_INTERVAL.
    if (authenticated) lastSyncAt = Date.now();
  }
}

// ── Init: register all automatic triggers ────────────────────────

let initialized = false;
let authSubscription: { unsubscribe: () => void } | null = null;
let onlineHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;

export function initSyncManager(): void {
  if (initialized) return;
  initialized = true;

  // 1. Sync when auth becomes ready (covers cold start)
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && navigator.onLine) {
      // Small delay to let other init complete
      setTimeout(() => triggerFullSync(), 500);
    }
  });
  authSubscription = data.subscription;

  // 2. Sync when coming back online
  onlineHandler = () => { triggerFullSync(); };
  window.addEventListener('online', onlineHandler);

  // 3. Sync when app returns from background (tab/app switch)
  visibilityHandler = () => {
    if (!document.hidden && navigator.onLine) {
      triggerFullSync();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  // 4. Try immediate sync on init
  triggerFullSync();
}

/** Cleanup — call on app teardown (tests, HMR) */
export function destroySyncManager(): void {
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  initialized = false;
  syncPromise = null;
  lastSyncAt = 0;
}
