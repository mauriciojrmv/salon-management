// Minimal service worker — exists primarily so browsers show the
// "Add to Home Screen" / install prompt. We deliberately do NOT cache
// app data (sessions, queue, dashboard) because everything is driven by
// Firestore onSnapshot and stale cached state would mislead workers.
//
// Strategy: network-first for everything, with a network-failure fallback
// that returns a generic "offline" response. No precaching, no shell
// caching — Next.js already hashes assets so the browser HTTP cache
// handles static JS/CSS/images efficiently.

const VERSION = 'v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle everything normally. The service worker only
  // needs to exist to qualify as a PWA — we don't intercept traffic.
});
