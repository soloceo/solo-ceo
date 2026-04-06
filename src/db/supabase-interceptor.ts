/**
 * Supabase fetch interceptor — replaces the old LAN-based interceptor.
 *
 * All platforms (Electron, iOS, Android, Web) use this single interceptor.
 * Priority:
 *   1. If online + authenticated → route through Supabase (supabase-api.ts)
 *   2. If offline → use local sql.js (api.ts) + queue for later replay
 */
import { handleSupabaseRequest } from './supabase-api';
import { initDb, handleApiRequest } from './api';
import { enqueue, startOfflineQueueListener } from './offline-queue';
import { initSyncManager } from './sync-manager';
import { supabase } from './supabase-client';
import { cacheGet, cacheSet, cacheToResponse, isFresh, invalidateForMutation, notifyUpdate, clearCache, cacheVersion } from './data-cache';

let installed = false;

// ── Check connectivity ────────────────────────────────────────────

function isOnline(): boolean {
  return navigator.onLine;
}

// ── Auth status cache (sync, zero network calls) ─────────────────

let _cachedAuthed = false;
let _authSub: { unsubscribe: () => void } | null = null;

function setupAuthCache() {
  // Clean up previous subscription (hot reload safety)
  _authSub?.unsubscribe();

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    _cachedAuthed = !!session;
  });
  _authSub = data.subscription;

  // Init from localStorage — no network request
  supabase.auth.getSession().then(({ data }) => {
    _cachedAuthed = !!data.session;
  }).catch(() => { /* auth check — silent in offline mode */ });
}

setupAuthCache();

function isAuthenticated(): boolean {
  return _cachedAuthed;
}

/** Clear cached auth state on sign-out to prevent stale routing */
export function resetCachedAuth(): void {
  _cachedAuthed = false;
  clearCache();
}


// ── Parse body from fetch args ────────────────────────────────────

async function parseBody(input: RequestInfo | URL, init?: RequestInit): Promise<any> {
  if (init?.body) {
    try { return JSON.parse(init.body as string); } catch { return init.body; }
  }
  if (input instanceof Request && input.body) {
    try { return await input.clone().json(); } catch { return null; }
  }
  return null;
}

// ── Handle locally via sql.js ─────────────────────────────────────

async function handleLocally(
  method: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    const { status, data } = await handleApiRequest(method, path, body);
    if (path === '/api/finance/report' && status === 200) {
      return new Response(data as string, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('[LocalAPI]', method, path, e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Handle via Supabase ───────────────────────────────────────────

async function handleViaSupabase(
  method: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    const { status, data } = await handleSupabaseRequest(method, path, body);
    if (path === '/api/finance/report' && status === 200) {
      return new Response(data as string, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('[SupabaseAPI]', method, path, e);
    // Fall back to local on Supabase errors
    return handleLocally(method, path, body);
  }
}

// ── Public entry ──────────────────────────────────────────────────

export async function installSupabaseInterceptor(): Promise<void> {
  if (installed) return;
  installed = true;

  // Always init local sql.js DB for offline support
  await initDb();

  // Start listening for online events (lightweight fallback)
  startOfflineQueueListener();

  // Initialize the sync manager — handles:
  //   - Replay on auth ready (cold start)
  //   - Replay on online event
  //   - Replay + pull on visibilitychange (app returns from background)
  initSyncManager();

  const orig = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    // Only intercept /api/* calls
    if (!url.startsWith('/api/')) return orig(input, init);

    const method = (
      init?.method ||
      (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const path = url.split('?')[0];
    const body = await parseBody(input, init);

    // ── Mutations: invalidate cache, then proceed ──
    if (method !== 'GET') {
      invalidateForMutation(path);
      if (isOnline() && isAuthenticated()) {
        return await handleViaSupabase(method, path, body);
      }
      enqueue(method, path, body).catch((e) => console.warn("[Offline] Failed to enqueue:", e));
      return handleLocally(method, path, body);
    }

    // ── GET: SWR cache layer ──
    const cached = cacheGet(path);

    // Helper: fetch fresh data, cache it, and return/notify.
    // Captures version at fetch start so stale responses (from before a mutation) are rejected.
    const fetchFresh = async (source: 'supabase' | 'local'): Promise<Response> => {
      const ver = cacheVersion(path); // snapshot version before fetch
      const resp = source === 'supabase'
        ? await handleViaSupabase(method, path, body)
        : await handleLocally(method, path, body);
      const ct = resp.headers.get('Content-Type') || 'application/json';
      const clone = resp.clone();
      clone.text().then((text) => {
        cacheSet(path, text, ct, resp.status, ver); // rejected if mutation bumped ver
      }).catch(() => {});
      return resp;
    };

    const online = isOnline() && isAuthenticated();

    // If we have a cached response, return it immediately
    if (cached) {
      // If still fresh, just return cache — no revalidation needed
      if (isFresh(cached)) {
        return cacheToResponse(cached);
      }
      // Stale: return cache now, revalidate in background
      fetchFresh(online ? 'supabase' : 'local').then(() => {
        notifyUpdate(path);
      }).catch(() => {});
      return cacheToResponse(cached);
    }

    // No cache — fetch and cache synchronously
    return fetchFresh(online ? 'supabase' : 'local');
  };
}
