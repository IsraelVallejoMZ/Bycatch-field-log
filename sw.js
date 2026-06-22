
// Bump this on every deploy so old clients detect the change and refresh
// their cache instead of being stuck on a stale cached app shell.
const CACHE_NAME = 'bycatch-log-v4';
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

// Separate, larger cache for map tiles, populated explicitly by the app's
// "Download this area for offline use" feature — kept apart from the
// app-shell cache so it isn't wiped out by app-shell version bumps.
const TILE_CACHE_NAME = 'bycatch-map-tiles-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwnOrigin = url.origin === self.location.origin;

  // OSM map tiles: try the network first (so the app's live/offline
  // detection ping and normal browsing always prefer fresh tiles), but
  // fall back to any tile pre-downloaded via "Download this area" when
  // the network request fails. This is the one external-origin exception —
  // everything else external (fonts, Leaflet library, connectivity checks)
  // still passes straight through untouched.
  //
  // The app's own connectivity probe deliberately requests zoom-0 tile
  // 0/0.png with a cache-busting ?check= param — explicitly excluded here
  // so a cached tile can never make the probe falsely report "online".
  const isConnectivityProbe = url.search.includes('check=');
  const isOsmTile = url.hostname.endsWith('tile.openstreetmap.org') && !isConnectivityProbe;
  if (isOsmTile) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.open(TILE_CACHE_NAME).then((cache) => cache.match(event.request))
      )
    );
    return;
  }

  if (!isOwnOrigin) {
    // Never intercept other external requests (fonts, Leaflet, the
    // connectivity-check ping). Let them hit the network normally so the
    // app's own online/offline detection for the map keeps working correctly.
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
