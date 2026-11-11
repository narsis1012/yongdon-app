// 앱 화면을 폰에 저장해 두어 인터넷이 없어도 열리게 해 줍니다.
// 앱을 고친 뒤에는 아래 버전 숫자를 올려 주세요.
const VERSION = 'yd-v1';
const SHELL = ['./', './index.html', './config.js', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const fresh = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
