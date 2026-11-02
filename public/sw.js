/**
 * Community Teachers — Safe Pass-Through Service Worker
 *
 * Satisfies browser PWA installability criteria while strictly avoiding
 * caching of private recordings, Google Drive data, API responses, or
 * outdated application bundles.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Strictly pass through all requests without caching private recordings,
  // Google Drive data, API responses, or outdated application content.
  if (!event || !event.request || event.request.method !== 'GET') return;
});

