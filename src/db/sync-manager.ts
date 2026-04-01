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

// ── Sync tables — all mutable tables to pull from cloud ──────────
const SYNC_TABLES = [
  'leads', 'clients', 'tasks', 'plans',
  'finance_transactions', 'payment_milestones', 'client_projects',
  'content_drafts', 'today_focus_state', 'today_focus_manual',
] as const;

let syncing = false;
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

export async function triggerFullSync(): Promise<void> {
  // Guards: don't run concurrently, too frequently, or when offline/unauthed
  if (syncing) return;
  if (Date.now() - lastSyncAt < MIN_SYNC_INTERVAL) return;
  if (!navigator.onLine) return;

  // Check auth
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
  } catch {
    return;
  }

  syncing = true;

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

    // Step 2: Pull fresh data from cloud → trigger component refresh
    dispatchSyncStatus('syncing', { pending: 0 });
    await pullCloudState();

    dispatchSyncStatus('idle', { pending: 0 });
  } catch (e) {
    // Sync failed — will retry on next trigger
    dispatchSyncStatus('idle', { pending: 0 });
  } finally {
    syncing = false;
    lastSyncAt = Date.now();
  }
}

// ── Init: register all automatic triggers ────────────────────────

let initialized = false;
let authSubscription: { unsubscribe: () => void } | null = null;

export function initSyncManager(): void {
  if (initialized) return;
  initialized = true;

  // 1. Sync when auth becomes ready (covers cold start)
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session && navigator.onLine) {
      // Small delay to let other init complete
      setTimeout(() => triggerFullSync(), 500);
    }
  });
  authSubscription = data.subscription;

  // 2. Sync when coming back online
  window.addEventListener('online', () => {
    triggerFullSync();
  });

  // 3. Sync when app returns from background (tab/app switch)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) {
      triggerFullSync();
    }
  });

  // 4. Try immediate sync on init
  triggerFullSync();
}

/** Cleanup — call on app teardown (tests, HMR) */
export function destroySyncManager(): void {
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }
  initialized = false;
  syncing = false;
}
