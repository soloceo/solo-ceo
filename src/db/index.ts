import initSqlJs, { Database } from 'sql.js';

let _db: Database | null = null;
let _initPromise: Promise<Database> | null = null;

// ── IndexedDB persistence ──────────────────────────────────────────────────
function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('soloceo-db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('data');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIdb(): Promise<Uint8Array | null> {
  try {
    const idb = await openIdb();
    return new Promise((resolve) => {
      const tx = idb.transaction('data', 'readonly');
      const get = tx.objectStore('data').get('db');
      get.onsuccess = () =>
        resolve(get.result ? new Uint8Array(get.result) : null);
      get.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveDb(): Promise<void> {
  if (!_db) return;
  const data = _db.export();
  try {
    const idb = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction('data', 'readwrite');
      tx.objectStore('data').put(new Uint8Array(data), 'db');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // saveDb failed — non-critical, data remains in memory
  }
}

// ── Initialise ─────────────────────────────────────────────────────────────
export async function getDb(): Promise<Database> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => new URL('./sql-js/sql-wasm.wasm', document.baseURI).href,
    });

    const saved = await loadFromIdb();
    _db = saved ? new SQL.Database(saved) : new SQL.Database();
    return _db;
  })();

  return _initPromise;
}

// ── Clear local DB (used on sign-out to prevent cross-user data leaks) ─────
export async function clearLocalDb(): Promise<void> {
  // Close in-memory db
  if (_db) {
    try { _db.close(); } catch { /* already closed */ }
    _db = null;
  }
  _initPromise = null;

  // Delete IndexedDB store
  try {
    const idb = await openIdb();
    await new Promise<void>((resolve) => {
      const tx = idb.transaction('data', 'readwrite');
      tx.objectStore('data').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Best-effort
  }
}

// ── Query helpers (mirror better-sqlite3 API) ──────────────────────────────
export function all(
  db: Database,
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql.js rows are dynamically typed
  params: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Record<string, any>[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function get(
  db: Database,
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> | null {
  return all(db, sql, params)[0] ?? null;
}

export function run(
  db: Database,
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[] = []
): { lastInsertRowid: number } {
  db.run(sql, params);
  const row = get(db, 'SELECT last_insert_rowid() as id');
  return { lastInsertRowid: Number(row?.id ?? 0) };
}

export function exec(db: Database, sql: string): void {
  db.run(sql);
}
