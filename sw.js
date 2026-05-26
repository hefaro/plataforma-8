const CACHE_NAME = 'bibliokids8-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/libros.html',
  '/style.css',
  '/libros.css',
  '/libros.js',
  '/manifest.json',
  'Image_8.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME && caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', (e) => {
  // Ignoramos las peticiones de descarga de libros (se manejan en app.js con IndexedDB)
  if (e.request.url.includes('/libros/')) return;
  
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});