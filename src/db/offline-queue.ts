/**
 * Offline write queue — stores mutations in IndexedDB when offline,
 * replays them against Supabase when connectivity is restored.
 */
import { handleSupabaseRequest } from './supabase-api';

interface QueuedOp {
  id: number;
  method: string;
  path: string;
  body: any;
  timestamp: number;
}

const DB_NAME = 'yirenceo-offline-queue';
const STORE_NAME = 'ops';
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
    tx.objectStore(STORE_NAME).add({ method, path, body, timestamp: Date.now() });
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

// ── Replay queue ──────────────────────────────────────────────────

export async function replayQueue(): Promise<{ replayed: number; failed: number }> {
  if (replaying) return { replayed: 0, failed: 0 };
  replaying = true;

  let replayed = 0;
  let failed = 0;

  try {
    const ops = await getAllOps();
    if (!ops.length) return { replayed: 0, failed: 0 };

    console.info(`[OfflineQueue] Replaying ${ops.length} operations`);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing', pending: ops.length } }));

    for (const op of ops) {
      try {
        const result = await handleSupabaseRequest(op.method, op.path, op.body);
        if (result.status < 500) {
          await removeOp(op.id);
          replayed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  } finally {
    replaying = false;
    window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'idle', pending: 0 } }));
  }

  return { replayed, failed };
}

// ── Auto-replay on online event ──────────────────────────────────

let listening = false;

export function startOfflineQueueListener() {
  if (listening) return;
  listening = true;

  window.addEventListener('online', async () => {
    console.info('[OfflineQueue] Back online, replaying queue');
    const { replayed, failed } = await replayQueue();
    if (replayed > 0) {
      console.info(`[OfflineQueue] Replayed ${replayed}, failed ${failed}`);
    }
  });
}
