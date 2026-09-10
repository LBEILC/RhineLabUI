/* The build replaces both tokens; this file is never registered in development. */
const VERSION = __CACHE_VERSION__;
const FILES = __PRECACHE_FILES__;
const PREFIX = `rhine-lab:${new URL(self.registration.scope).pathname}:`;
const CACHE = PREFIX + VERSION;
const urls = FILES.map(path => new URL(path, self.registration.scope).href);
const allowed = new Set(urls);
const index = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // Limit connections so a complete font family does not flood the page.
      // Keep successful files private until every resource is present; failure
      // still deletes this entire release and leaves the active release intact.
      let next = 0;
      const workers = Array.from({ length: 6 }, async () => {
        while (next < urls.length) {
          const url = urls[next++];
          const immutable = /\/fonts\/misans-webfont-4\.3\.1\//.test(url) || /\/assets\/archive-(cassette|assembly)\.[a-f0-9]{16}\.glb$/.test(url);
          await cache.add(new Request(url, { cache: immutable ? "default" : "no-cache" }));
        }
      });
      const results = await Promise.allSettled(workers);
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys())
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "RHINE_APPLY_UPDATE") event.waitUntil(self.skipWaiting());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  url.search = "";
  url.hash = "";
  const navigation = event.request.mode === "navigate" &&
    (url.href === self.registration.scope || url.href === index);
  const key = navigation ? index : url.href;
  if (!allowed.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // HTML, hashed bundles and stable model URLs come from the same release.
    // A new release stays waiting until the user chooses to restart or exits.
    const cached = await cache.match(key);
    return cached ?? fetch(event.request);
  })());
});
