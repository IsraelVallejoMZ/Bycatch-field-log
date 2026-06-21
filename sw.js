// Bump this on every deploy so old clients detect the change and refresh
// their cache instead of being stuck on a stale cached app shell.
const CACHE_NAME = 'bycatch-log-v3';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwnOrigin = url.origin === self.location.origin;

  if (!isOwnOrigin) {
    // Never intercept external requests (fonts, Leaflet, OSM tiles).
    // Let them hit the network normally so the app's own online/offline
    // detection for the map keeps working correctly.
    return;
  }

  // Network-first for the app shell: always try to fetch the latest version.
  // Only fall back to the cached copy when there's genuinely no connection,
  // which is what makes this an offline-capable field tool rather than a
  // version trap that hides updates from the user.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Lets the page ask the active service worker to take over immediately
// after a new version has been installed, instead of waiting for a full
// close-and-reopen of the app.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
