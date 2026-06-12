const CACHE_NAME = 'mundial2026-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/paises.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/src/components/Login.js',
  '/src/components/Layout.js',
  '/src/components/MatchList.js',
  '/src/components/Admin.js',
  '/src/components/Ranking.js',
  '/src/components/MyPredictions.js',
  '/src/services/api.js',
  '/src/services/auth.js',
  '/src/services/game.js',
  '/src/utils/helpers.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
        )
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Ignorar esquemas no soportados (extensiones, etc.)
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // No cachear API ni config.js (config.js es dinámico)
  if (url.pathname.startsWith('/api/') || url.pathname === '/config.js') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Solo cachear respuestas válidas de nuestro dominio
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback solo para navegación (HTML)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
