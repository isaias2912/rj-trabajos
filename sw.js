// Service worker de R.J Trabajos: deja la app abrible sin señal.
// Los datos los maneja Firestore (con su propia caché); acá solo se guardan los archivos de la app.
const CACHE = 'rj-v2';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './firebase-config.js',
  './precios-iniciales.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function guardar(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return res;
}
function conTiempo(ms, p) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos de la app: primero la red (para recibir cambios), si no hay señal la copia guardada.
  if (url.origin === self.location.origin) {
    e.respondWith(
      conTiempo(4000, fetch(req))
        .then((res) => guardar(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Librerías de Firebase y tipografías: se guardan la primera vez y después se usan desde la copia.
  if (url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => guardar(req, res))));
  }
  // Todo lo demás (Firestore, login) va directo a la red.
});
