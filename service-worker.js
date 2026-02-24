// Minimal service worker - required for PWA but no offline caching
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// No fetch event listener = no caching, everything always from network
