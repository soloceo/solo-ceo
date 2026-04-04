import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  console.error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Use fallback values to prevent createClient from throwing
// when env vars are missing (e.g. in offline-only builds).
// All Supabase calls are wrapped in try/catch so a dummy client is harmless.
const safeUrl  = url  || 'https://placeholder.supabase.co';
const safeAnon = anon || 'placeholder-anon-key';

export const supabase = createClient(safeUrl, safeAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  // Global fetch with timeout to prevent hanging when offline.
  // First data request gets 15s for Supabase cold-start wake-up;
  // subsequent data requests use 8s for snappy UX.
  // Auth endpoints always get 15s.
  global: {
    fetch: (() => {
      let firstData = true;
      return (input: RequestInfo | URL, init?: RequestInit) => {
        const isAuth = typeof input === 'string' && input.includes('/auth/');
        const ms = isAuth ? 15000 : (firstData ? 15000 : 8000);
        if (!isAuth) firstData = false;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ms);
        return fetch(input, {
          ...init,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
      };
    })(),
  },
});
