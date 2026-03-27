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

    // Pre-filter: discard stale and over-retried ops
    const validOps = [];
    for (const op of ops) {
      if (now - op.timestamp > MAX_AGE_MS) {
        await removeOp(op.id);
        continue;
      }
      if ((op.retryCount || 0) >= MAX_RETRIES) {
        await removeOp(op.id);
        failed++;
        continue;
      }
      validOps.push(op);
    }

    // Replay in batches of 5 (parallel within batch, sequential across batches)
    const BATCH_SIZE = 5;
    for (let i = 0; i < validOps.length; i += BATCH_SIZE) {
      const batch = validOps.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (op) => {
          const result = await handleSupabaseRequest(op.method, op.path, op.body);
          return { op, result };
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          const { op, result } = r.value;
          if (result.status < 400) {
            await removeOp(op.id);
            replayed++;
          } else if (result.status < 500) {
            await removeOp(op.id);
            failed++;
          } else {
            op.retryCount = (op.retryCount || 0) + 1;
            await updateOp(op);
            failed++;
          }
        } else {
          // Promise rejected — network error
          const op = batch[results.indexOf(r)];
          if (op) {
            op.retryCount = (op.retryCount || 0) + 1;
            await updateOp(op);
          }
          failed++;
        }
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
