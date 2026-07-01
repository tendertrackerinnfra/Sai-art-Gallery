const CACHE_NAME = "sag-shell-v1";
const OFFLINE_URL = "/offline";
const APP_SHELL = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico?v=20260701",
  "/icon.png?v=20260701",
  "/apple-icon.png?v=20260701",
  "/branding/icon-192.png?v=20260701",
  "/branding/icon-512.png?v=20260701",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.headers.get("RSC")) return;

  const url = new URL(request.url);
  if (url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || Response.error();
      }),
    );
    return;
  }

  if (
    url.origin === self.location.origin &&
    (
      (url.pathname.startsWith("/_next/static/") && !url.pathname.includes("/server/")) ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/icon.png" ||
      url.pathname === "/apple-icon.png" ||
      url.pathname === "/branding/icon-192.png" ||
      url.pathname === "/branding/icon-512.png" ||
      url.pathname === "/manifest.webmanifest"
    )
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      }),
    );
  }
});
