// Phase 1 stub — expanded in Phase 9 with offline queue + app shell cache
const CACHE_NAME = "amplop-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", () => {
  // Phase 9: cache app shell, queue offline transactions in IndexedDB
});
