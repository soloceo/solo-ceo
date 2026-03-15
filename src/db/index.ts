import initSqlJs, { Database } from 'sql.js';

let _db: Database | null = null;
let _initPromise: Promise<Database> | null = null;

// ── IndexedDB persistence ──────────────────────────────────────────────────
function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('yirenceo-db', 1);
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
      tx.objectStore('data').put(data.buffer, 'db');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('saveDb failed', e);
  }
}

// ── Initialise ─────────────────────────────────────────────────────────────
export async function getDb(): Promise<Database> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => '/sql-js/sql-wasm.wasm',
    });

    const saved = await loadFromIdb();
    _db = saved ? new SQL.Database(saved) : new SQL.Database();
    return _db;
  })();

  return _initPromise;
}

// ── Query helpers (mirror better-sqlite3 API) ──────────────────────────────
export function all(
  db: Database,
  sql: string,
  params: any[] = []
): Record<string, any>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, any>[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function get(
  db: Database,
  sql: string,
  params: any[] = []
): Record<string, any> | null {
  return all(db, sql, params)[0] ?? null;
}

export function run(
  db: Database,
  sql: string,
  params: any[] = []
): { lastInsertRowid: number } {
  db.run(sql, params);
  const row = get(db, 'SELECT last_insert_rowid() as id');
  return { lastInsertRowid: Number(row?.id ?? 0) };
}

export function exec(db: Database, sql: string): void {
  db.run(sql);
}
