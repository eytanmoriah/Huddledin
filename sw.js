// Huddledin Service Worker v1.0
const CACHE_NAME = 'huddledin-__BUILD_VERSION__';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fall back to cache. Always returns a Response (never undefined).
self.addEventListener('fetch', event => {
  // Skip non-GET and non-http(s) requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Skip Supabase, Sentry, Plausible, Resend — always go to network directly
  const url = new URL(event.request.url);
  const skipDomains = ['supabase.co', 'sentry.io', 'plausible.io', 'resend.com'];
  if (skipDomains.some(d => url.hostname.includes(d))) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        // Cache successful same-origin responses for offline use
        if (response && response.ok && event.request.url.includes(self.location.origin)) {
          try {
            const clone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, clone);
          } catch (_) { /* cache write failure shouldn't break the response */ }
        }
        return response;
      } catch (_) {
        // Network failed — try cache
        try {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          // Navigation fallback: return cached app shell so the SPA can boot offline
          if (event.request.mode === 'navigate') {
            const shell = await caches.match('/index.html');
            if (shell) return shell;
          }
        } catch (_) { /* fall through to error response */ }
        // Last resort — return a real Response so the SW never throws
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      }
    })()
  );
});

// ── Web Push ──────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data?.text() || '' }; }
  const title = data.title || 'Huddledin';
  const body = data.body || '';
  const tag = data.tag || 'default';
  const url = data.url || '/';
  event.waitUntil((async () => {
    // Suppress OS notification if any tab/window is focused AND visible — the
    // in-app realtime + 'push-received' message will refresh the UI instead.
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focusedClients = clientList.filter(c =>
      c.url.includes(self.location.origin) && c.focused && c.visibilityState === 'visible'
    );
    if (focusedClients.length > 0) {
      focusedClients.forEach(c => {
        try { c.postMessage({ type: 'push-received', data }); } catch (_) {}
      });
      return;
    }
    await self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      renotify: true,
      data: { url }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Prefer a CURRENTLY visible client — that's the one the user can actually see.
    // Background Chrome tabs are ignored so the OS can route to the installed PWA via openWindow.
    const visible = list.find(c =>
      c.url.includes(self.location.origin) &&
      c.visibilityState === 'visible' &&
      'focus' in c
    );
    if (visible) {
      try { visible.postMessage({ type: 'notification-click', url }); } catch (_) {}
      return visible.focus();
    }
    // No visible client — let the OS pick the right app to launch (PWA preferred over Chrome)
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
