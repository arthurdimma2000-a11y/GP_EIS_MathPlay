/* service-worker.js
   GP EIS no-op service worker.
   Purpose: clear stale installations safely and avoid intercepting lesson-page navigation.
*/

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
    } catch (_) {}
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", () => {
  // Intentionally no navigation interception.
});
