const CACHE_NAME = 'ehr-cache-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy for API calls, cache-first for assets
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // Network only for API calls
    event.respondWith(fetch(event.request));
  } else {
    // Cache first, then network for assets
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
  }
});
