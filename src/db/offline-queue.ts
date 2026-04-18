/**
 * Offline write queue — stores mutations in IndexedDB when offline,
 * replays them against Supabase when connectivity is restored.
 *
 * Features:
 *   - Retry up to 3 times per operation (on next reconnect or visibility change)
 *   - 409 Conflict / 429 Rate-limited: retried (transient)
 *   - Other 4xx errors: permanent failure (kept for user review)
 *   - 5xx errors: retried
 *   - Stale ops older than 30 days: discarded with user notification
 *   - Failed ops notify user via a sync-toast warning
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
  /** Local ID returned by the offline handler for POST operations.
   *  Used during replay to remap references after Supabase assigns real IDs. */
  localId?: number;
}

const DB_NAME = 'soloceo-offline-queue';
const STORE_NAME = 'ops';
const MAX_RETRIES = 3;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** HTTP status codes that are transient despite being 4xx — eligible for retry */
const RETRYABLE_4XX = new Set([408, 409, 429]);
let replayPromise: Promise<{ replayed: number; failed: number }> | null = null;

// ── IndexedDB helpers ─────────────────────────────────────────────

let cachedDb: IDBDatabase | null = null;

function openQueueDb(): Promise<IDBDatabase> {
  if (cachedDb) return Promise.resolve(cachedDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => {
      cachedDb = req.result;
      // Invalidate cache if browser closes the connection (e.g. storage pressure)
      cachedDb.onclose = () => { cachedDb = null; };
      resolve(cachedDb);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(method: string, path: string, body: Record<string, unknown>, localId?: number): Promise<void> {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const entry: Record<string, unknown> = { method, path, body, timestamp: Date.now(), retryCount: 0 };
    if (localId != null) entry.localId = localId;
    tx.objectStore(STORE_NAME).add(entry);
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      console.warn('[offline-queue] removeOp failed for id:', id, tx.error);
      reject(tx.error);
    };
  });
}

async function updateOp(op: QueuedOp): Promise<void> {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      console.warn('[offline-queue] updateOp failed for id:', op.id, tx.error);
      reject(tx.error);
    };
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
    // Close and invalidate cached connection (prevents cross-user replay)
    db.close();
    cachedDb = null;
  } catch {
    // Best-effort: if IndexedDB fails, queue is in-memory only
    cachedDb = null;
  }
}

// ── Event helpers ────────────────────────────────────────────────

function dispatchQueueWarning(message: string) {
  console.warn('[offline-queue]', message);
  // Previously dispatched to the `sync-status` CustomEvent with a
  // `{ warning, type: 'queue-failure' }` payload, but no consumer ever
  // read that shape — App.tsx and SettingsPage only looked at `status` /
  // `pending`. Surface via the sync-toast channel so failures are
  // actually visible to the user.
  window.dispatchEvent(new CustomEvent('sync-toast', {
    detail: { message, type: 'warning' },
  }));
}

// ── ID remapping helpers ─────────────────────────────────────────

/** Body fields that may reference local IDs created during the same offline session */
const REMAPPABLE_BODY_FIELDS = ['client_id', 'parent_id', 'source_id', 'project_id', 'finance_tx_id'];

/**
 * Replace entity IDs in URL path segments using the idMap.
 * Matches patterns like `/api/clients/42/milestones` and remaps `42` → new ID.
 * Only remaps the numeric segment immediately after an entity name segment.
 */
function remapPath(path: string, idMap: Map<number, number>): string {
  if (idMap.size === 0) return path;
  // Split path into segments: ['', 'api', 'clients', '42', 'milestones']
  return path.replace(/\/(\d+)(\/|$)/g, (_match, numStr, trailing) => {
    const num = Number(numStr);
    const mapped = idMap.get(num);
    return mapped != null ? `/${mapped}${trailing}` : `/${numStr}${trailing}`;
  });
}

/**
 * Replace local IDs in request body fields using the idMap.
 * Returns a shallow copy if any field was remapped, otherwise the original body.
 */
function remapBody(body: Record<string, unknown>, idMap: Map<number, number>): Record<string, unknown> {
  if (idMap.size === 0 || !body) return body;
  let changed = false;
  const result = { ...body };
  for (const field of REMAPPABLE_BODY_FIELDS) {
    const val = result[field];
    if (typeof val === 'number' && idMap.has(val)) {
      result[field] = idMap.get(val);
      changed = true;
    }
  }
  return changed ? result : body;
}

/**
 * Try to extract the `id` field from a Supabase response.
 * Returns the numeric id or undefined.
 */
function extractResponseId(data: unknown): number | undefined {
  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as Record<string, unknown>).id;
    if (typeof id === 'number') return id;
  }
  return undefined;
}

/**
 * After a POST creates a cloud entity, rewrite all pending queue entries
 * in IndexedDB to reference the new cloud ID instead of the local one.
 *
 * This makes the queue self-consistent across sessions — if the browser
 * crashes or the user closes the tab mid-replay, any remaining ops already
 * carry the correct cloud IDs when the next session picks up.
 */
async function persistRemap(localId: number, remoteId: number): Promise<void> {
  const oneMap = new Map([[localId, remoteId]]);
  const currentOps = await getAllOps();
  for (const op of currentOps) {
    const newPath = remapPath(op.path, oneMap);
    const newBody = remapBody(op.body, oneMap);
    if (newPath !== op.path || newBody !== op.body) {
      try {
        await updateOp({ ...op, path: newPath, body: newBody });
      } catch (e) {
        console.warn('[offline-queue] persistRemap failed for op', op.id, e);
      }
    }
  }
}

// ── Replay queue ──────────────────────────────────────────────────

export function replayQueue(): Promise<{ replayed: number; failed: number }> {
  if (replayPromise) return replayPromise;
  replayPromise = performReplay();
  return replayPromise;
}

async function performReplay(): Promise<{ replayed: number; failed: number }> {

  let replayed = 0;
  let failed = 0;

  try {
    const ops = await getAllOps();
    if (!ops.length) return { replayed: 0, failed: 0 };

    // Map from local (offline) IDs → remote (Supabase) IDs.
    // Built up as POSTs are replayed sequentially.
    const idMap = new Map<number, number>();

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

    // POSTs run first and sequentially (they create entities referenced by later ops).
    // Then PUTs/DELETEs run in parallel batches (safe since entities already exist).
    const posts = validOps.filter(op => op.method === 'POST');
    const rest = validOps.filter(op => op.method !== 'POST');
    const ordered = [...posts, ...rest];

    const BATCH_SIZE = 5;
    // Iterate with explicit progress so a malformed queue entry can't stall the
    // loop. Previously the step size was computed from `ordered[i]?.method`,
    // and if that evaluated to undefined the loop would keep revisiting the
    // same index — a real risk during concurrent removeOp/updateOp calls.
    let i = 0;
    while (i < ordered.length) {
      const cur = ordered[i];
      if (!cur) { i++; continue; }
      const isPost = cur.method === 'POST';
      const batch = isPost ? [cur] : ordered.slice(i, i + BATCH_SIZE).filter(op => op.method !== 'POST');
      const step = isPost ? 1 : Math.max(batch.length, 1);
      i += step;
      const results = await Promise.allSettled(
        batch.map(async (op) => {
          // Apply ID remapping before sending to Supabase.
          // Mutate the in-memory op so that any later updateOp() (on retry)
          // persists the remapped values instead of rolling back to local IDs.
          const mappedPath = remapPath(op.path, idMap);
          const mappedBody = remapBody(op.body, idMap);
          if (mappedPath !== op.path) op.path = mappedPath;
          if (mappedBody !== op.body) op.body = mappedBody;
          const result = await handleSupabaseRequest(op.method, op.path, op.body);
          return { op, result };
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          const { op, result } = r.value;
          if (result.status < 400) {
            // Success — if this was a POST with a localId, record the mapping
            // AND persist the remap so that remaining queue entries survive
            // a browser crash / session end.
            if (op.method === 'POST' && op.localId != null) {
              const remoteId = extractResponseId(result.data);
              if (remoteId != null) {
                idMap.set(op.localId, remoteId);
                await persistRemap(op.localId, remoteId);
              }
            }
            await removeOp(op.id);
            replayed++;
          } else if (RETRYABLE_4XX.has(result.status) || result.status >= 500) {
            // Transient error (409 Conflict, 429 Rate-limit, 5xx) — retry later
            op.retryCount = (op.retryCount || 0) + 1;
            op.failReason = `HTTP ${result.status}`;
            await updateOp(op);
            failed++;
          } else {
            // Permanent 4xx client error (400, 403, 404, 422…) — no retry.
            // Remove from queue immediately so the pendingOps badge drops and
            // the next replay cycle doesn't re-warn the user about the same op.
            await removeOp(op.id);
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
    replayPromise = null;
  }

  return { replayed, failed };
}

// Note: auto-replay triggers (online event, visibilitychange, auth-ready)
// are handled entirely by sync-manager.ts — see initSyncManager().
