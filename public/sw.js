// ============================================================
// sw.js — Static-shell-only service worker.
//
// CRITICAL: this worker NEVER caches API or proxy responses.
// On race day, runner positions change every 60 seconds, so any
// cached HTML response would freeze the UI on a stale snapshot.
// We only cache same-origin GET requests for static assets, and
// always go to the network for any URL we don't recognise.
// ============================================================
const CACHE = 'blizzard-v2';

// Hostnames whose responses must never enter the cache.
const NEVER_CACHE_HOSTS = [
  'rtrt.me',
  'api.allorigins.win',
  'corsproxy.io',
  'api.codetabs.com',
  'api.open-meteo.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['./']).catch(() => {/* offline shell is best-effort */})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isApi = NEVER_CACHE_HOSTS.some((h) => url.hostname.endsWith(h));
  const isSameOrigin = url.origin === self.location.origin;

  if (isApi) {
    // Always go straight to network. Never cache. Never serve stale.
    return; // let the browser handle it
  }

  if (!isSameOrigin) return; // 3rd-party tiles, fonts → browser handles

  // Stale-while-revalidate for app shell + static assets only.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || fetchPromise;
    })
  );
});
