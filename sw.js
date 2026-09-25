const VERSION = "v2";
const PRECACHE = "sipasen-precache-" + VERSION;
const RUNTIME = "sipasen-runtime-" + VERSION;
const FONTS = "sipasen-fonts-" + VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./sipasen.html",
  "./offline.html",
  "./styles.css",
  "./app.js",
  "./sipasen.webmanifest",
  "./icons/icon.svg"
];

const SHELL_FALLBACK = "./index.html";
const OFFLINE_PAGE = "./offline.html";

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

async function putAll(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload", credentials: "same-origin" });
        if (res.ok) await cache.put(url, res);
      } catch (_) {}
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    await putAll(cache, APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PRECACHE, RUNTIME, FONTS]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isFontRequest(url) {
  return url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com") || url.pathname.endsWith(".woff2") || url.pathname.endsWith(".woff");
}

function isNavigation(request) {
  return request.mode === "navigate" || (request.destination === "document" && request.method === "GET");
}

async function fromCache(request, names) {
  for (const name of names) {
    const cache = await caches.open(name);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
  }
  return undefined;
}

async function putRuntime(request, response, cacheName) {
  if (!response || !response.ok) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function networkFirst(request, cacheName, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    await putRuntime(request, res, cacheName);
    return res;
  } catch (_) {
    clearTimeout(timer);
    return (await fromCache(request, [cacheName, PRECACHE])) || (await caches.match(SHELL_FALLBACK)) || (await caches.match(OFFLINE_PAGE));
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await fromCache(request, [cacheName, PRECACHE]);
  if (cached) {
    fetch(request).then((res) => putRuntime(request, res, cacheName)).catch(() => {});
    return cached;
  }
  const res = await fetch(request);
  await putRuntime(request, res, cacheName);
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await fromCache(request, [cacheName, PRECACHE]);
  const network = fetch(request).then(async (res) => {
    await putRuntime(request, res, cacheName);
    return res;
  }).catch(() => undefined);
  return cached || (await network);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(req, FONTS).catch(() => new Response("", { status: 504 })));
    return;
  }
  if (isNavigation(req)) {
    event.respondWith(networkFirst(req, PRECACHE, 2500));
    return;
  }
  if (sameOrigin(url)) {
    event.respondWith(cacheFirst(req, RUNTIME).catch(async () => (await caches.match(OFFLINE_PAGE)) || new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })));
  }
});
