/**
 * Offline write queue — stores mutations in IndexedDB when offline,
 * replays them against Supabase when connectivity is restored.
 *
 * Features:
 *   - Retry up to 3 times per operation (on next reconnect or visibility change)
 *   - 409 Conflict / 429 Rate-limited: retried (transient)
 *   - Other 4xx errors: permanent failure (removed after notifying user)
 *   - 5xx errors: retried
 *   - Stale ops older than 30 days: discarded with user notification
 *   - Failed ops notify user via a sync-toast warning
 */
import { handleSupabaseRequest } from './supabase-api';

interface QueuedOp {
  id: number;
  /** Supabase auth user that created this queued mutation. */
  userId?: string;
  method: string;
  path: string;
  body: Record<string, unknown>;
  timestamp: number;
  retryCount?: number;
  failReason?: string;
  /** Local ID returned by the offline handler for POST operations.
   *  Used during replay to remap references after Supabase assigns real IDs. */
  localId?: number;
  /** Entity scope (resource name, e.g. "clients", "tasks", "projects").
   *  Paired with `localId` to form a per-entity-type map key so local IDs from
   *  different tables (which all auto-increment independently) can't collide.
   *  Derived from the POST path at enqueue time.
   *  Optional for backward compat with ops enqueued before this field existed —
   *  those ops simply don't participate in downstream-reference remapping. */
  localScope?: string;
}

interface ReplayResult {
  replayed: number;
  /** Operations that remain queued and will retry later. */
  failed: number;
  /** Stale or permanently invalid operations removed from the queue. */
  discarded: number;
}

const DB_NAME = 'soloceo-offline-queue';
const STORE_NAME = 'ops';
const MAX_RETRIES = 3;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** HTTP status codes that are transient despite being 4xx — eligible for retry */
const RETRYABLE_4XX = new Set([408, 409, 429]);
let replayPromise: Promise<ReplayResult> | null = null;

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

/**
 * Derive a scope name from a POST path. The scope is the last non-numeric,
 * non-"api" segment — e.g.
 *   /api/clients                      → "clients"
 *   /api/clients/42/milestones        → "milestones"
 *   /api/clients/42/projects          → "projects"
 *   /api/tasks                        → "tasks"
 * Returns "unknown" when nothing sensible can be derived; such ops simply
 * don't participate in cross-op reference remapping.
 */
export function pathToScope(path: string): string {
  const parts = path.split('?')[0].split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    if (seg !== 'api' && !/^\d+$/.test(seg)) return seg;
  }
  return 'unknown';
}

export async function enqueue(
  method: string,
  path: string,
  body: Record<string, unknown>,
  localId?: number,
  userId?: string,
): Promise<void> {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const entry: Record<string, unknown> = { method, path, body, timestamp: Date.now(), retryCount: 0 };
    if (userId) entry.userId = userId;
    if (localId != null) {
      entry.localId = localId;
      // Pair the local ID with its table scope so replay builds a
      // Map<"scope:localId", remoteId> instead of a global Map<localId, remoteId>
      // (which would collide across tables — every SQLite AUTOINCREMENT starts
      // at 1, so client(1), project(1), task(1) would all share one key).
      entry.localScope = pathToScope(path);
    }
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
//
// The remap uses a scoped-ID map: Map<"scope:localId", remoteId>. Scope is
// the table/resource name (e.g. "clients", "tasks"). Since every SQLite
// AUTOINCREMENT column starts at 1, client(id=1), project(id=1), task(id=1)
// can all coexist — keying by "scope:localId" prevents cross-table collisions
// that a bare Map<number, number> would conflate. Without this, replaying
// two POSTs that both produced local id=1 would silently alias every future
// reference to the second one.

/** Map scope-key helper */
const scopeKey = (scope: string, id: number) => `${scope}:${id}`;

/**
 * Map a foreign-key field name → the scope that ID resolves in.
 * `source_id` is polymorphic — its scope depends on the row's `source` field.
 * Returns null when the field can't be resolved (unknown or N/A type). */
function fieldScope(field: string, body: Record<string, unknown>): string | null {
  switch (field) {
    case 'client_id':      return 'clients';
    case 'project_id':     return 'projects';
    case 'parent_id':      return 'tasks';    // only used on tasks
    case 'finance_tx_id':  return 'finance';  // finance POSTs land at /api/finance
    case 'source_id': {
      // Polymorphic — inspect `source` to discover the target table.
      const source = body.source;
      if (source === 'milestone')    return 'milestones';
      if (source === 'project_fee')  return 'projects';
      // subscription/manual sources aren't remappable here; ledger rows aren't
      // POSTed via the offline queue.
      return null;
    }
    default: return null;
  }
}

/** Body fields that may reference local IDs created during the same offline session */
const REMAPPABLE_BODY_FIELDS = ['client_id', 'parent_id', 'source_id', 'project_id', 'finance_tx_id'];

/**
 * Replace entity IDs in URL path segments using the idMap.
 *
 * Walks segments and, for each numeric segment, looks up the preceding
 * non-numeric segment as its scope. For `/api/clients/42/milestones/7`:
 *   - segment "42" sits after "clients" → lookup "clients:42"
 *   - segment "7"  sits after "milestones" → lookup "milestones:7"
 * This avoids the old bug where a bare `Map<number, number>` would remap the
 * client ID and the milestone ID through the same key if they happened to be
 * equal (common for fresh local DBs where both start at 1).
 */
function remapPath(path: string, idMap: Map<string, number>): string {
  if (idMap.size === 0) return path;
  const [pathPart, queryPart] = path.split('?');
  const parts = pathPart.split('/');
  let prevScope: string | null = null;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (!seg) continue;
    if (/^\d+$/.test(seg)) {
      if (prevScope) {
        const remote = idMap.get(scopeKey(prevScope, Number(seg)));
        if (remote != null) parts[i] = String(remote);
      }
      // Numeric segments don't themselves become scope for the next one.
      continue;
    }
    // Track the most recent non-numeric, non-"api" segment as the active scope
    if (seg !== 'api') prevScope = seg;
  }
  return queryPart ? `${parts.join('/')}?${queryPart}` : parts.join('/');
}

/**
 * Replace local IDs in request body fields using the idMap.
 * Looks up each known FK field under its correct scope — prevents a local
 * client(id=1) from being remapped by a project(id=1) entry that happens to
 * have been replayed first.
 * Returns a shallow copy if any field was remapped, otherwise the original body.
 */
function remapBody(body: Record<string, unknown>, idMap: Map<string, number>): Record<string, unknown> {
  if (idMap.size === 0 || !body) return body;
  let changed = false;
  const result = { ...body };
  for (const field of REMAPPABLE_BODY_FIELDS) {
    const val = result[field];
    if (typeof val !== 'number') continue;
    const scope = fieldScope(field, result);
    if (!scope) continue;
    const remote = idMap.get(scopeKey(scope, val));
    if (remote != null) {
      result[field] = remote;
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
 *
 * `scope` identifies which table the `localId` lives in so cross-table
 * remaps (e.g. a project id=1 being applied to a client_id=1 reference)
 * can't happen.
 */
async function persistRemap(scope: string, localId: number, remoteId: number): Promise<void> {
  const oneMap = new Map<string, number>([[scopeKey(scope, localId), remoteId]]);
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

export function replayQueue(currentUserId?: string): Promise<ReplayResult> {
  if (replayPromise) return replayPromise;
  replayPromise = performReplay(currentUserId);
  return replayPromise;
}

async function performReplay(currentUserId?: string): Promise<ReplayResult> {

  let replayed = 0;
  let failed = 0;
  let discarded = 0;

  try {
    const ops = await getAllOps();
    if (!ops.length) return { replayed: 0, failed: 0, discarded: 0 };

    // Map from SCOPED local IDs → remote (Supabase) IDs.
    // Key shape: "<scope>:<localId>" (e.g. "clients:1", "projects:1").
    // Built up as POSTs are replayed sequentially. Scoping prevents
    // cross-table collisions — without it, a client id=1 and a project id=1
    // would share a key and the second POST's mapping would silently corrupt
    // later references to the first.
    const idMap = new Map<string, number>();

    const now = Date.now();
    // Pre-filter: discard stale and over-retried ops
    const validOps: QueuedOp[] = [];
    const permanentlyFailed: QueuedOp[] = [];

    for (const op of ops) {
      // Queue entries created by older app versions did not carry a userId.
      // They may have come from "skip login" mode, so replaying them after
      // sign-in can cause the recurring "N operations failed" toast. Treat
      // unowned or cross-user entries as stale local-only history.
      if (!op.userId || (currentUserId && op.userId !== currentUserId)) {
        console.warn('[offline-queue] discarded unowned queue op:', op.method, op.path);
        await removeOp(op.id);
        discarded++;
        continue;
      }
      if (now - op.timestamp > MAX_AGE_MS) {
        const ageDays = Math.round((now - op.timestamp) / 86400000);
        dispatchQueueWarning(`离线操作已过期(${ageDays}天)：${op.path}`);
        await removeOp(op.id);
        discarded++;
        continue;
      }
      if ((op.retryCount || 0) >= MAX_RETRIES) {
        permanentlyFailed.push(op);
        await removeOp(op.id);
        discarded++;
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
            // Success — if this was a POST with a localId + scope, record the
            // scoped mapping AND persist it so remaining queue entries survive
            // a browser crash / session end. Ops enqueued before localScope
            // existed (older builds) are skipped for remapping — safer than
            // falling back to the old cross-table-collision behavior.
            if (op.method === 'POST' && op.localId != null && op.localScope) {
              const remoteId = extractResponseId(result.data);
              if (remoteId != null) {
                idMap.set(scopeKey(op.localScope, op.localId), remoteId);
                await persistRemap(op.localScope, op.localId, remoteId);
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
            discarded++;
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

  return { replayed, failed, discarded };
}

// Note: auto-replay triggers (online event, visibilitychange, auth-ready)
// are handled entirely by sync-manager.ts — see initSyncManager().
