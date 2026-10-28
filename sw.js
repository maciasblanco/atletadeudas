const CACHE = 'atletadeudas-v7';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  // Rutas actualizadas a la carpeta icons
  './icons/launchericon-48x48.png',
  './icons/launchericon-72x72.png',
  './icons/launchericon-96x96.png',
  './icons/launchericon-144x144.png',
  './icons/launchericon-192x192.png',
  './icons/launchericon-512x512.png',
  // Capturas de pantalla (si las subes a la carpeta icons)
  './icons/screenshot-mobile.png',
  './icons/screenshot-desktop.png',
  // Librerías externas
  'https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/sql-wasm.js',
  'https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/sql-wasm.wasm'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.log('[SW] addAll err', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Nunca cachear la API de GitHub (siempre red)
  if (url.hostname === 'api.github.com') return;

  // JSON público de GitHub: network-first con fallback a cache
  if (url.hostname === 'raw.githubusercontent.com') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // App shell: cache-first
  if (req.method === 'GET') {
    e.respondWith(
      caches.match(req).then(hit => {
        if (hit) return hit;
        return fetch(req).then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return r;
        }).catch(() => caches.match('./index.html'));
      })
    );
  }
});