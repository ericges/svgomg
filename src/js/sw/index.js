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
        'images/icon.png',
        'js/gzip-worker.js',
        'js/page.js',
        'js/prism-worker.js',
        'js/svgo-worker.js',
        // Only the demo that loads itself on startup. The rest of the demo menu
        // is ~1MB of artwork nobody asked for, so those stay network-only —
        // picking one offline fails with the usual toast.
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

// The font cache is unversioned, so nothing in the normal update flow would ever
// replace a font that changed under the same filename. Refreshing it in the
// background is what keeps it from pinning one build's fonts forever.
async function revalidateFont(request) {
  try {
    // `no-cache` makes this a conditional request: an unchanged font costs a
    // 304 rather than a re-download. Without it the HTTP cache would be free to
    // answer with the very bytes we're trying to replace.
    const response = await fetch(request.url, { cache: 'no-cache' });
    if (!response.ok) return;

    const fontCache = await caches.open(fontCacheName);
    await fontCache.put(request, response);
  } catch {
    // Offline, or the font is gone — either way the cached copy still stands.
  }
}

async function handleFontRequest(event) {
  // Scoped to this build's cache rather than a global `caches.match()`, which
  // searches every cache in creation order — oldest first — and so would prefer
  // a previous build's static cache that `activate` hasn't deleted yet.
  const staticCache = await caches.open(staticCacheName);
  const precached = await staticCache.match(event.request);
  // Precached fonts are replaced whenever the build hash changes, so they need
  // no revalidation and must not be copied into the unversioned cache below.
  if (precached) return precached;

  const fontCache = await caches.open(fontCacheName);
  const cached = await fontCache.match(event.request);

  if (cached) {
    // Stale-while-revalidate: serve the cached font now, refresh it for the
    // next load. waitUntil keeps the worker alive for a write the font doesn't
    // have to wait on.
    event.waitUntil(revalidateFont(event.request));
    return cached;
  }

  const response = await fetch(event.request);

  // This cache is served cache-first and deliberately survives build changes,
  // so a transient 404/500 stored here would outlive the outage.
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(fontCache.put(event.request, copy));
  }

  return response;
}

addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method === 'GET' &&
    url.origin === location.origin &&
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(handleFontRequest(event));
    return;
  }

  // Scoped for the same reason as in `handleFontRequest`. Safe because every
  // entry in the font cache is a same-origin `.woff2` GET, and those have all
  // been answered above.
  event.respondWith(
    (async () => {
      const staticCache = await caches.open(staticCacheName);
      const response = await staticCache.match(event.request);
      return response || fetch(event.request);
    })(),
  );
});
