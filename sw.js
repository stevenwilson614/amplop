const CACHE_VERSION = "amplop-v4";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.includes("/assets/") || url.pathname.endsWith(".html") || url.pathname.endsWith("/amplop/")) {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res.ok) return res;
        return caches.match(event.request);
      }).catch(() => caches.match(event.request)),
    );
    return;
  }
});
