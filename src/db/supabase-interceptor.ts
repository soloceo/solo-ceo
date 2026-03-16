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
import { enqueue, startOfflineQueueListener, replayQueue } from './offline-queue';
import { supabase } from './supabase-client';

let installed = false;

// ── Check connectivity ────────────────────────────────────────────

function isOnline(): boolean {
  return navigator.onLine;
}

// ── Auth status cache (sync, zero network calls) ─────────────────

let _cachedAuthed = false;

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedAuthed = !!session;
});

// Init from localStorage — no network request
supabase.auth.getSession().then(({ data }) => {
  _cachedAuthed = !!data.session;
}).catch(() => {});

function isAuthenticated(): boolean {
  return _cachedAuthed;
}

// ── Parse body from fetch args ────────────────────────────────────

async function parseBody(input: RequestInfo | URL, init?: RequestInit): Promise<any> {
  if (init?.body) {
    try { return JSON.parse(init.body as string); } catch { return init.body; }
  }
  if (input instanceof Request && input.body) {
    try { return await input.json(); } catch { return null; }
  }
  return null;
}

// ── Handle locally via sql.js ─────────────────────────────────────

async function handleLocally(
  method: string,
  path: string,
  body: any,
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
  } catch (e: any) {
    console.error('[LocalAPI]', method, path, e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Handle via Supabase ───────────────────────────────────────────

async function handleViaSupabase(
  method: string,
  path: string,
  body: any,
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
  } catch (e: any) {
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

  // Start listening for online events to replay queued ops
  startOfflineQueueListener();

  // Try replaying any pending offline ops
  if (isOnline() && isAuthenticated()) {
    replayQueue().catch(() => {});
  }

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

    // Check if we're online and authenticated — both are sync, zero latency
    if (isOnline() && isAuthenticated()) {
      return await handleViaSupabase(method, path, body);
    }

    // Offline or not authenticated → use local DB
    // Queue write operations for later replay
    if (method !== 'GET') {
      enqueue(method, path, body).catch(() => {});
    }
    return handleLocally(method, path, body);
  };
}
