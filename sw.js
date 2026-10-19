// Only public static assets are cached. Never store API responses or replay orders.
const CACHE = "restolink-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/icon.svg", "/offline.html"])),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
          ),
        ),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("@vite") ||
    url.pathname.startsWith("/src/")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname === "/icon.svg")
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, clone));
            }
            return response;
          }),
      ),
    );
});
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "RestoLink", {
      body: message.body || "Новый заказ",
      icon: "/api/icon/192.png",
      badge: "/api/icon/192.png",
      tag: "restolink-orders",
      data: { url: "/app?page=orders" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const client = clients.find(
          (c) => new URL(c.url).origin === location.origin,
        );
        if (client) {
          await client.navigate("/app?page=orders");
          return client.focus();
        }
        return self.clients.openWindow("/app?page=orders");
      }),
  );
});
