// Bump this on every deploy so old clients detect the change and refresh
// their cache instead of being stuck on a stale cached app shell.
const CACHE_NAME = 'bycatch-log-v7';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // MapLibre (Sport's pilot map engine) — precached explicitly instead of
  // relying on the browser's own HTTP cache, which has no offline
  // guarantee (iOS Safari in particular purges it under storage pressure
  // or after ~7 days unused). Bump CACHE_NAME above if these version
  // pins ever change, so returning clients pick up the new pin.
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  // Offline base-map coastline (Sport's "offline style" fallback — see
  // OFFLINE_COASTLINE_URL in index.html). Natural Earth 1:110m Admin-0
  // Countries, public domain (naturalearthdata.com), mirrored through
  // jsDelivr's GitHub CDN. Precached here — not left to the opportunistic
  // OpenFreeMap/Esri handlers below — so the offline map looks right even
  // the very first time a captain opens the app with no signal, as long
  // as the app itself was installed/opened online at least once.
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson'
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
// Must match TILE_CACHE_NAME in index.html exactly — the page writes to
// this cache by name, the service worker reads from it by name, so the
// two are only ever connected through this string matching.
const TILE_CACHE_NAME = 'bycatch-map-tiles-v2';

// Separate cache for OpenFreeMap's vector style/glyphs/sprites/tiles —
// see the isVectorMapAsset handler below for why it's opportunistic
// rather than explicit-download-only like TILE_CACHE_NAME.
const VECTOR_TILE_CACHE_NAME = 'bycatch-vector-tiles-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwnOrigin = url.origin === self.location.origin;

  // Map tiles: try the network first (so the app's live/offline detection
  // ping and normal browsing always prefer fresh tiles), but fall back to
  // any tile pre-downloaded via "Download this area" when the network
  // request fails. This is the one external-origin exception — everything
  // else external (fonts, Leaflet library, connectivity checks) still
  // passes straight through untouched.
  //
  // Tile provider is CartoDB (basemaps.cartocdn.com), matching
  // TILE_URL_TEMPLATE in index.html. If that constant ever changes
  // providers again, update the hostname check below to match.
  //
  // The app's own connectivity probe deliberately requests zoom-0 tile
  // 0/0.png with a cache-busting ?check= param — explicitly excluded here
  // so a cached tile can never make the probe falsely report "online".
  const isConnectivityProbe = url.search.includes('check=');
  const isMapTile = url.hostname.endsWith('basemaps.cartocdn.com') && !isConnectivityProbe;
  if (isMapTile) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.open(TILE_CACHE_NAME).then((cache) => cache.match(event.request))
      )
    );
    return;
  }

  // OpenFreeMap (Sport's MapLibre vector basemap: style JSON, glyphs,
  // sprites, and vector tiles all come from this one host). Unlike
  // CartoDB above, there's no "Download this area" button feeding this
  // cache yet — it's opportunistic instead: every successful fetch while
  // online gets stored, so whatever the person has already panned/zoomed
  // through becomes available offline automatically. Same tradeoff as
  // the app shell below (network-first, cache as fallback), just scoped
  // to its own cache name so a stale-vector-tile bug can't ever wipe the
  // app shell or the CartoDB tile cache.
  const isVectorMapAsset = url.hostname.endsWith('tiles.openfreemap.org');
  if (isVectorMapAsset) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(VECTOR_TILE_CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() =>
        caches.open(VECTOR_TILE_CACHE_NAME).then((cache) => cache.match(event.request))
      )
    );
    return;
  }

  // Esri satellite — pre-existing gap, not caused by the MapLibre switch:
  // the "Download this area" feature only ever populated TILE_CACHE_NAME
  // with CartoDB street tiles, never satellite. Same opportunistic
  // pattern as OpenFreeMap above.
  const isEsriSatellite = url.hostname.endsWith('server.arcgisonline.com');
  if (isEsriSatellite) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(VECTOR_TILE_CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() =>
        caches.open(VECTOR_TILE_CACHE_NAME).then((cache) => cache.match(event.request))
      )
    );
    return;
  }

  // Offline coastline data (Sport's offline-style fallback). Precached in
  // APP_SHELL above, so this is network-first-with-cache-fallback rather
  // than opportunistic — the file basically never changes (it's a static
  // public-domain dataset), so there's no "fetch fresh tiles" pressure
  // like the map-tile branches above.
  const isOfflineCoastline = url.hostname.endsWith('cdn.jsdelivr.net') && url.pathname.includes('natural-earth-vector');
  if (isOfflineCoastline) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
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
