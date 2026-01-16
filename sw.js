/* Angel Collab Workshop — SW (cache safe) */
const SW_VERSION = "acw-sw-v1.0.0"; // ✅ 以後更新：只要改這行版本號
const CACHE_NAME = SW_VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

// 安裝：預先快取必要檔
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 啟用：清除舊快取
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

// 取用策略：HTML 用網路優先，其他用快取優先
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只處理同網域
  if (url.origin !== location.origin) return;

  // HTML：network-first（確保更新容易生效）
  if (req.mode === "navigate" || (req.destination === "document")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      })()
    );
    return;
  }

  // 其他資源：cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
      return fresh;
    })()
  );
});