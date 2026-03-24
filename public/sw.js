// Service Worker for 一人CEO — offline web caching
const CACHE_NAME = 'soloceo-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './icon-128.png',
  './icon-256.png',
  './icon-512.png',
  './sql-js/sql-wasm.wasm',
];

// Install: pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/Supabase, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin API calls (Supabase, etc.)
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // For navigation requests, try network first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For JS/CSS/images: stale-while-revalidate
  if (/\.(js|css|png|jpg|woff2?|wasm)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetching = fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
        return cached || fetching;
      })
    );
    return;
  }
});
