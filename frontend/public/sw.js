/**
 * LactaMap Service Worker
 * Strategy:
 *   - Hashed static bundles (_expo/static/**): cache-first (immutable)
 *   - Map tiles (OSM) and CDN libs (unpkg): cache-first
 *   - API calls (/api/**): network-only (always fresh)
 *   - Navigation: network-first → fallback to cached shell
 *   - Everything else: stale-while-revalidate
 */

const CACHE = 'lactamap-v1';

// App shell – minimal set cached at install time
const SHELL = ['/'];

// ── Lifecycle ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET over HTTP(S)
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // API – always network
  if (url.pathname.startsWith('/api/')) return;

  // Hashed bundles – cache-first (content-addressed, never change)
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Map tiles & CDN assets – cache-first
  if (
    url.hostname.endsWith('tile.openstreetmap.org') ||
    url.hostname === 'unpkg.com' ||
    url.hostname === 'cdn.jsdelivr.net'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation – network-first → cached shell as offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/').then((r) => r ?? offlinePage()))
    );
    return;
  }

  // Default – stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached ?? networkFetch;
}

function offlinePage() {
  return new Response(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
    <title>LactaMap – Sin conexión</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
    justify-content:center;height:100vh;margin:0;background:#fff1f2;color:#be123c}
    h1{font-size:2rem;margin-bottom:.5rem}p{color:#475569}</style></head>
    <body><h1>🤱 LactaMap</h1><p>Sin conexión. Intenta de nuevo cuando tengas internet.</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
