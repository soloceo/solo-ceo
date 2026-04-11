/**
 * Lightweight SWR (stale-while-revalidate) cache for API GET requests.
 *
 * - Returns cached data instantly on tab switch (no loading spinner)
 * - Background-revalidates and dispatches 'api-cache-updated' event
 *   so pages can re-render with fresh data
 * - Mutations invalidate related cache entries
 */

interface CacheEntry {
  body: string;            // serialized JSON response
  contentType: string;
  status: number;
  ts: number;              // Date.now() when cached
  ver: number;             // monotonic version — prevents stale overwrites
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 100;

/** Monotonic version per path — incremented on every mutation invalidation */
const pathVersion = new Map<string, number>();
function nextVer(path: string): number {
  const v = (pathVersion.get(path) || 0) + 1;
  pathVersion.set(path, v);
  return v;
}
function curVer(path: string): number {
  return pathVersion.get(path) || 0;
}

/** How long cached data is considered "fresh" (no revalidation needed) */
const FRESH_MS = 10_000;  // 10 seconds

// ── Public API ───────────────────────────────────────────────────────

/** Store a GET response in cache. ver must match current pathVersion or write is rejected (stale). */
export function cacheSet(path: string, body: string, contentType: string, status: number, ver?: number): void {
  // Never cache error responses — they should not be served from cache
  if (status >= 400) return;
  // If a version is provided, reject stale writes (a mutation happened after this fetch started)
  if (ver !== undefined && ver < curVer(path)) return;
  // Evict oldest entry if cache exceeds size limit
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(path)) {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [key, entry] of cache) {
      if (entry.ts < oldestTs) { oldestTs = entry.ts; oldestKey = key; }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(path, { body, contentType, status, ts: Date.now(), ver: ver ?? curVer(path) });
}

/** Get cached entry if it exists. Returns null if no cache. */
export function cacheGet(path: string): CacheEntry | null {
  return cache.get(path) ?? null;
}

/** Is the cached entry still fresh (< FRESH_MS old)? */
export function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.ts < FRESH_MS;
}

/** Build a Response from a cache entry */
export function cacheToResponse(entry: CacheEntry): Response {
  return new Response(entry.body, {
    status: entry.status,
    headers: { 'Content-Type': entry.contentType },
  });
}

/**
 * Invalidate cache entries that a mutation might affect.
 * E.g. POST /api/tasks → invalidate /api/tasks
 * E.g. PUT /api/clients/5 → invalidate /api/clients
 */
export function invalidateForMutation(path: string): void {
  // Extract the base resource path: /api/tasks/5/foo → /api/tasks
  const segments = path.split('/');
  const basePath = segments.length >= 3 ? segments.slice(0, 3).join('/') : path;

  for (const key of cache.keys()) {
    if (key === path || key === basePath || key.startsWith(basePath + '/') || key.startsWith(basePath + '?')) {
      cache.delete(key);
      nextVer(key); // bump version so in-flight background fetches become stale
    }
  }

  // Also invalidate /api/finance/report when finance mutates
  if (basePath === '/api/finance') {
    cache.delete('/api/finance/report');
  }
  // Milestone mutations affect finance too
  if (basePath === '/api/milestones' || path.includes('/milestones')) {
    cache.delete('/api/finance');
    cache.delete('/api/finance/report');
  }

  // Dashboard aggregates all data — always invalidate on any mutation
  cache.delete('/api/dashboard');
}

/** Dispatch event so pages know to re-render with fresh data */
export function notifyUpdate(path: string): void {
  window.dispatchEvent(new CustomEvent('api-cache-updated', { detail: { path } }));
}

/** Get current version for a path (used by interceptor to tag fetches) */
export function cacheVersion(path: string): number {
  return curVer(path);
}

/** Clear all cache (e.g. on sign-out) */
export function clearCache(): void {
  cache.clear();
  pathVersion.clear();
}
