/* globals SVGOMG_BUILD_ID:false */

// A hash of everything the build produces, injected by the gulpfile. It changes
// exactly when the cached assets change, so the cache below is rebuilt only
// when there's something new to cache.
const cachePrefix = 'svgomg-';
const staticCacheName = `${cachePrefix}static-${SVGOMG_BUILD_ID}`;
const fontCacheName = `${cachePrefix}fonts`;
const expectedCaches = new Set([staticCacheName, fontCacheName]);

addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(staticCacheName);

      await cache.addAll([
        './',
        'all.css',
        'fonts/code-latin.woff2',
        'imgs/icon.png',
        'js/gzip-worker.js',
        'js/page.js',
        'js/prism-worker.js',
        'js/svgo-worker.js',
        'test-svgs/car-lite.svg',
      ]);

      // Without versions there's no way to tell a breaking update from a safe
      // one, so every update activates straight away; `MainController` then
      // either reloads silently or offers the user a reload.
      self.skipWaiting();
    })(),
  );
});

addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // remove caches beginning "svgomg-" that aren't in expectedCaches
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(cachePrefix) &&
              !expectedCaches.has(cacheName),
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
    })(),
  );
});

async function handleFontRequest(request) {
  const match = await caches.match(request);
  if (match) return match;

  const [response, fontCache] = await Promise.all([
    fetch(request),
    caches.open(fontCacheName),
  ]);

  fontCache.put(request, response.clone());
  return response;
}

addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.endsWith('.woff2')) {
    event.respondWith(handleFontRequest(event.request));
    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request)),
  );
});
