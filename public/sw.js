const CACHE = 'esplay-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './img/case-esplay.png',
  './img/esquema-ligacoes.svg',
  './downloads/CaseESPboyV5.stl',
  './games/games.json',
  './games/testebotoes.ino',
  './games/pixelmath.ino',
  './games/acentoquest.ino',
  './games/ciclofis.ino',
  './games/regiomap.ino',
  './games/algoritmando.ino',
  './js/main.js',
  './js/util.js',
  './js/stlviewer.js',
  './js/preview.js',
  './js/library.js',
  './js/menu.js',
  './js/creator.js',
  './js/painel.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
