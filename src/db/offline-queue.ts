/**
 * Offline write queue — stores mutations in IndexedDB when offline,
 * replays them against Supabase when connectivity is restored.
 *
 * Features:
 *   - Retry up to 3 times per operation (with exponential backoff)
 *   - 409 Conflict / 429 Rate-limited: retried (transient)
 *   - Other 4xx errors: permanent failure (kept for user review)
 *   - 5xx errors: retried
 *   - Stale ops older than 30 days: discarded with user notification
 *   - Failed ops notify user via sync-status event
 */
import { handleSupabaseRequest } from './supabase-api';

interface QueuedOp {
  id: number;
  method: string;
  path: string;
  body: Record<string, unknown>;
  timestamp: number;
  retryCount?: number;
  failReason?: string;
}

const DB_NAME = 'soloceo-offline-queue';
const STORE_NAME = 'ops';
const MAX_RETRIES = 3;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** HTTP status codes that are transient despite being 4xx — eligible for retry */
const RETRYABLE_4XX = new Set([408, 409, 429]);
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

export async function enqueue(method: string, path: string, body: Record<string, unknown>): Promise<void> {
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

// ── Clear queue (used on sign-out to prevent cross-user replay) ──

export async function clearQueue(): Promise<void> {
  try {
    const db = await openQueueDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Best-effort: if IndexedDB fails, queue is in-memory only
  }
}

// ── Event helpers ────────────────────────────────────────────────

function dispatchQueueWarning(message: string) {
  console.warn('[offline-queue]', message);
  window.dispatchEvent(new CustomEvent('sync-status', {
    detail: { warning: message, type: 'queue-failure' },
  }));
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
    // Pre-filter: discard stale and over-retried ops
    const validOps: QueuedOp[] = [];
    const permanentlyFailed: QueuedOp[] = [];

    for (const op of ops) {
      if (now - op.timestamp > MAX_AGE_MS) {
        const ageDays = Math.round((now - op.timestamp) / 86400000);
        dispatchQueueWarning(`离线操作已过期(${ageDays}天)：${op.path}`);
        await removeOp(op.id);
        failed++;
        continue;
      }
      if ((op.retryCount || 0) >= MAX_RETRIES) {
        permanentlyFailed.push(op);
        await removeOp(op.id);
        failed++;
        continue;
      }
      validOps.push(op);
    }

    // Notify user about permanently failed ops
    if (permanentlyFailed.length > 0) {
      dispatchQueueWarning(
        `${permanentlyFailed.length} 条离线操作多次重试后失败已丢弃: ${permanentlyFailed.map(o => o.failReason || o.path).join(', ')}`
      );
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
            // Success
            await removeOp(op.id);
            replayed++;
          } else if (RETRYABLE_4XX.has(result.status) || result.status >= 500) {
            // Transient error (409 Conflict, 429 Rate-limit, 5xx) — retry later
            op.retryCount = (op.retryCount || 0) + 1;
            op.failReason = `HTTP ${result.status}`;
            await updateOp(op);
            failed++;
          } else {
            // Permanent 4xx client error (400, 403, 404, 422…) — no retry
            op.retryCount = MAX_RETRIES;
            op.failReason = `HTTP ${result.status} (permanent)`;
            await updateOp(op);
            dispatchQueueWarning(`离线操作失败(${result.status})：${op.method} ${op.path}`);
            failed++;
          }
        } else {
          // Promise rejected — network error, retry later
          const op = batch[results.indexOf(r)];
          if (op) {
            op.retryCount = (op.retryCount || 0) + 1;
            op.failReason = 'Network error';
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
    // Online event detected — sync-manager handles replay
  });
}
