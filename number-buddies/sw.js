// Offline cache for Number Buddies. Bump CACHE when you change any file —
// `npm run publish` does it for you.
const CACHE = 'number-buddies-v3';
const FILES = [
  './', './index.html', './style.css', './game.js', './blocks.js', './render.js',
  './audio.js', './build.js', './add.js', './play.js', './nudge.js', './hold.js', './manifest.webmanifest', './voice/manifest.json',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

async function fill(cache) {
  await cache.addAll(FILES);
  // Every voice clip, taken from the generated manifest so the list here
  // never falls behind `npm run voice`.
  try {
    const { clips } = await (await fetch('./voice/manifest.json')).json();
    await cache.addAll(Object.values(clips).map(f => `./voice/${f}`));
  } catch (err) {
    console.warn('voice clips not cached', err);
  }
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(fill).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cached copy first for instant offline start; refresh the cache in the background.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
