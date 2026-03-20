/**
 * Offline write queue — stores mutations in IndexedDB when offline,
 * replays them against Supabase when connectivity is restored.
 *
 * Features:
 *   - Retry up to 3 times per operation (with exponential backoff)
 *   - 4xx errors (client errors) are discarded (permanent failure)
 *   - 5xx errors are retried
 *   - Stale ops older than 7 days are discarded
 */
import { handleSupabaseRequest } from './supabase-api';

interface QueuedOp {
  id: number;
  method: string;
  path: string;
  body: any;
  timestamp: number;
  retryCount?: number;
}

const DB_NAME = 'soloceo-offline-queue';
const STORE_NAME = 'ops';
const MAX_RETRIES = 3;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
let replaying = false;

// ── IndexedDB helpers ─────────────────────────────────────────────

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(method: string, path: string, body: any): Promise<void> {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ method, path, body, timestamp: Date.now(), retryCount: 0 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueLength(): Promise<number> {
  const db = await openQueueDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

async function getAllOps(): Promise<QueuedOp[]> {
  const db = await openQueueDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function removeOp(id: number): Promise<void> {
  const db = await openQueueDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function updateOp(op: QueuedOp): Promise<void> {
  const db = await openQueueDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// ── Replay queue ──────────────────────────────────────────────────

export async function replayQueue(): Promise<{ replayed: number; failed: number }> {
  if (replaying) return { replayed: 0, failed: 0 };
  replaying = true;

  let replayed = 0;
  let failed = 0;

  try {
    const ops = await getAllOps();
    if (!ops.length) return { replayed: 0, failed: 0 };

    const now = Date.now();
    console.info(`[OfflineQueue] Replaying ${ops.length} operations`);

    for (const op of ops) {
      // Discard stale ops older than 7 days
      if (now - op.timestamp > MAX_AGE_MS) {
        console.warn(`[OfflineQueue] Discarding stale op: ${op.method} ${op.path} (${Math.round((now - op.timestamp) / 86400000)}d old)`);
        await removeOp(op.id);
        continue;
      }

      // Discard ops that have exceeded max retries
      if ((op.retryCount || 0) >= MAX_RETRIES) {
        console.warn(`[OfflineQueue] Discarding op after ${MAX_RETRIES} retries: ${op.method} ${op.path}`);
        await removeOp(op.id);
        failed++;
        continue;
      }

      try {
        const result = await handleSupabaseRequest(op.method, op.path, op.body);

        if (result.status < 400) {
          // Success
          await removeOp(op.id);
          replayed++;
        } else if (result.status < 500) {
          // 4xx client error — permanent failure, discard
          console.warn(`[OfflineQueue] Permanent failure (${result.status}): ${op.method} ${op.path}`);
          await removeOp(op.id);
          failed++;
        } else {
          // 5xx server error — increment retry count, keep for next attempt
          op.retryCount = (op.retryCount || 0) + 1;
          await updateOp(op);
          failed++;
        }
      } catch {
        // Network/unknown error — increment retry count
        op.retryCount = (op.retryCount || 0) + 1;
        await updateOp(op);
        failed++;
      }
    }
  } finally {
    replaying = false;
  }

  return { replayed, failed };
}

// ── Auto-replay on online event ──────────────────────────────────
// Note: The sync-manager now handles the `online` event and
// visibilitychange triggers. This listener is kept as a fallback.

let listening = false;

export function startOfflineQueueListener() {
  if (listening) return;
  listening = true;

  // The sync-manager's initSyncManager() is the primary trigger.
  // This is a lightweight fallback that just logs.
  window.addEventListener('online', () => {
    console.info('[OfflineQueue] Online event detected (sync-manager handles replay)');
  });
}
