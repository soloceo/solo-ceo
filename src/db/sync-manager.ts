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

function dispatchSyncStatus(status: string, extra?: Record<string, any>) {
  window.dispatchEvent(new CustomEvent('sync-status', {
    detail: { status, ...extra },
  }));
}

function dispatchSyncToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('sync-toast', {
    detail: { message, type },
  }));
}

// ── Pull cloud data into local sql.js for offline use ───────────

async function pullCloudToLocal(): Promise<void> {
  const db = await getDb();

  for (const table of PULL_TABLES) {
    try {
      // Fetch all rows from Supabase (RLS filters by user_id)
      const { data: rows, error } = await supabase.from(table).select('*');
      if (error || !rows) continue;
      // Skip DELETE+INSERT if cloud returned 0 rows — prevents accidental data wipe
      if (rows.length === 0) continue;

      // Get local column names via PRAGMA
      const colInfo = all(db, `PRAGMA table_info("${table}")`);
      const localCols = new Set(colInfo.map((c: Record<string, unknown>) => String(c.name)));
      if (localCols.size === 0) continue;

      // Atomic: delete old + insert new in a transaction
      try {
        exec(db, 'BEGIN TRANSACTION');
        exec(db, `DELETE FROM "${table}"`);

        for (const row of rows) {
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
      } catch (insertErr) {
        try { exec(db, 'ROLLBACK'); } catch { /* already rolled back */ }
        console.warn(`[SyncManager] Failed to write ${table} locally:`, insertErr);
      }
    } catch (e) {
      console.warn(`[SyncManager] Failed to pull ${table}:`, e);
    }
  }

  // Persist to IndexedDB
  await saveDb();

  // Invalidate SWR cache so components fetch fresh data
  clearCache();
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
  // Check auth
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
  } catch {
    return;
  }


  try {
    const pending = await getQueueLength();

    // Step 1: Replay offline queue (push local → cloud)
    if (pending > 0) {
      dispatchSyncStatus('syncing', { pending });
      const { replayed, failed } = await replayQueue();

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
    // Sync failed — will retry on next trigger
    const remaining = await getQueueLength().catch(() => 0);
    dispatchSyncStatus('idle', { pending: remaining });
  } finally {
    syncPromise = null;
    lastSyncAt = Date.now();
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
