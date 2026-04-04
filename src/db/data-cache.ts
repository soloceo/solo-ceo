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
}

const cache = new Map<string, CacheEntry>();

/** How long cached data is considered "fresh" (no revalidation needed) */
const FRESH_MS = 10_000;  // 10 seconds

// ── Public API ───────────────────────────────────────────────────────

/** Store a GET response in cache */
export function cacheSet(path: string, body: string, contentType: string, status: number): void {
  cache.set(path, { body, contentType, status, ts: Date.now() });
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
}

/** Dispatch event so pages know to re-render with fresh data */
export function notifyUpdate(path: string): void {
  window.dispatchEvent(new CustomEvent('api-cache-updated', { detail: { path } }));
}

/** Clear all cache (e.g. on sign-out) */
export function clearCache(): void {
  cache.clear();
}
