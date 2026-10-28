// Safe service worker: never touches pages, redirects or the API.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) =>
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k); // purge legacy and bad entries
    await self.clients.claim();
  })())
);

self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (r.mode === "navigate" || u.pathname.startsWith("/api/")) return; // browser handles page navigations and APIs
  if (u.pathname.startsWith("/_next/static/")) {                      // hashed immutable files only
    e.respondWith(caches.open("static-v2").then(async (c) => {
      const hit = await c.match(r); if (hit) return hit;
      const res = await fetch(r);
      if (res.ok && res.type === "basic" && !res.redirected) c.put(r, res.clone());
      return res;
    }));
  }
});
