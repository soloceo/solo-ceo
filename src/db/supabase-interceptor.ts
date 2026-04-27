/**
 * Supabase fetch interceptor — replaces the old LAN-based interceptor.
 *
 * All platforms (Electron, iOS, Android, Web) use this single interceptor.
 * Priority:
 *   1. If online + authenticated → route through Supabase (supabase-api.ts)
 *   2. If authenticated but offline/Supabase unavailable → local sql.js + queue
 *   3. If not authenticated → local-only, no queue (matches "skip login" copy)
 */
import { handleSupabaseRequest } from './supabase-api';
import { initDb, handleApiRequest } from './api';
import { enqueue } from './offline-queue';
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
let _cachedUserId: string | null = null;
let _authSub: { unsubscribe: () => void } | null = null;

function setupAuthCache() {
  // Clean up previous subscription (hot reload safety)
  _authSub?.unsubscribe();

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    _cachedAuthed = !!session;
    _cachedUserId = session?.user?.id ?? null;
  });
  _authSub = data.subscription;

  // Init from localStorage — no network request
  supabase.auth.getSession().then(({ data }) => {
    _cachedAuthed = !!data.session;
    _cachedUserId = data.session?.user?.id ?? null;
  }).catch(() => { /* auth check — silent in offline mode */ });
}

setupAuthCache();

async function getAuthenticatedUserId(): Promise<string | null> {
  if (_cachedAuthed && _cachedUserId) return _cachedUserId;
  try {
    const { data } = await supabase.auth.getSession();
    _cachedAuthed = !!data.session;
    _cachedUserId = data.session?.user?.id ?? null;
    return _cachedUserId;
  } catch {
    return null;
  }
}

/** Clear cached auth state on sign-out to prevent stale routing */
export function resetCachedAuth(): void {
  _cachedAuthed = false;
  _cachedUserId = null;
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
// Note: no internal fallback — exceptions propagate so callers can decide
// whether to enqueue (mutations) or silently fall back to local (reads).

async function handleViaSupabase(
  method: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
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
}

// ── Public entry ──────────────────────────────────────────────────

export async function installSupabaseInterceptor(): Promise<void> {
  if (installed) return;
  installed = true;

  // Always init local sql.js DB for offline support
  await initDb();

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
      const authedUserId = await getAuthenticatedUserId();

      // Try Supabase first when online + authenticated.
      // 2xx/3xx → return to UI.
      // 4xx    → real application error (RLS/validation/auth) — return to UI, do NOT enqueue (replay would fail the same way).
      // 5xx response → Supabase reached but rejected the mutation; return it
      // instead of queueing a deterministic failure that will reappear on next launch.
      // thrown exception → network/Supabase unavailable → fall through to local+enqueue.
      if (isOnline() && authedUserId) {
        try {
          const resp = await handleViaSupabase(method, path, body);
          if (resp.status < 500) return resp;
          console.warn('[Interceptor] Supabase mutation returned', resp.status, '— not queueing:', method, path);
          return resp;
        } catch (e) {
          console.warn('[Interceptor] Supabase mutation threw — falling back to local+queue:', method, path, e);
        }
      }

      // Offline authenticated users get a local write + replay queue.
      // Unauthenticated/offline-mode users are local-only: the login page copy
      // promises that skipped-login data does not sync to cloud, and queueing
      // those mutations caused noisy failures after the user later signed in.
      const localResponse = await handleLocally(method, path, body);

      if (authedUserId) {
        let localId: number | undefined;
        if (method === 'POST') {
          try {
            const cloned = localResponse.clone();
            const json = await cloned.json();
            if (json && typeof json === 'object' && typeof json.id === 'number') {
              localId = json.id;
            }
          } catch { /* response may not be JSON — skip localId extraction */ }
        }
        enqueue(method, path, body, localId, authedUserId).catch((e) => console.warn("[Offline] Failed to enqueue:", e));
      }
      return localResponse;
    }

    // ── GET: SWR cache layer ──
    const cached = cacheGet(path);

    // Helper: fetch fresh data, cache it, and return/notify.
    // Captures version at fetch start so stale responses (from before a mutation) are rejected.
    // Reads are resilient: if Supabase fails, silently fall back to local — GETs don't need enqueue.
    const fetchFresh = async (source: 'supabase' | 'local'): Promise<Response> => {
      const ver = cacheVersion(path); // snapshot version before fetch
      let resp: Response;
      if (source === 'supabase') {
        try {
          resp = await handleViaSupabase(method, path, body);
        } catch (e) {
          console.warn('[Interceptor] Supabase GET failed — using local:', path, e);
          resp = await handleLocally(method, path, body);
        }
      } else {
        resp = await handleLocally(method, path, body);
      }
      const ct = resp.headers.get('Content-Type') || 'application/json';
      const clone = resp.clone();
      clone.text().then((text) => {
        cacheSet(path, text, ct, resp.status, ver); // rejected if mutation bumped ver
      }).catch(() => {});
      return resp;
    };

    const online = isOnline() && !!await getAuthenticatedUserId();

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
