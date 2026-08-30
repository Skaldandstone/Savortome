/* Public, account-independent assets only. Never cache application HTML or APIs. */
const CACHE = 'seconds-public-v3';
// CARE_OFFLINE_DOCUMENT is generated, never fetched from an authenticated page.
// No public offline HTML entry route exists.
const PUBLIC_FILES = ['/care-offline.js', '/icons/icon-192.png', '/icons/icon-512.png'];
const ownsCache = name => name.startsWith('seconds-') || /^(shell|pages|assets)-v/.test(name);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const fetched = await Promise.all(PUBLIC_FILES.map(async path => {
      const url = new URL(path, self.location.origin);
      const response = await fetch(url.href, { credentials: 'omit', cache: 'reload' });
      if (!canStore(url, response)) throw new Error('Public offline asset did not pass cache checks.');
      return [path, response];
    }));
    // Validate the complete shell before replacing any part of its cache.
    const cache = await caches.open(CACHE);
    await Promise.all(fetched.map(([path, response]) => cache.put(path, response)));
    await cache.put('/care-offline.html', new Response(CARE_OFFLINE_DOCUMENT, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(name => ownsCache(name) && name !== CACHE).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
function isPublicAsset(url, request) {
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || request.headers.has('authorization')) return false;
  return PUBLIC_FILES.includes(url.pathname) || /^\/_next\/static\/.+\.(js|css|woff2?|ttf)$/.test(url.pathname) || /^\/woodland\/[a-z0-9-]+\.(png|webp)$/.test(url.pathname);
}
function canStore(url, response) {
  if (!response.ok || response.redirected || response.type !== 'basic') return false;
  if (/private|no-store/i.test(response.headers.get('cache-control') || '')) return false;
  if (/(?:^|,)\s*(?:cookie|authorization|\*)\s*(?:,|$)/i.test(response.headers.get('vary') || '')) return false;
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (url.pathname.endsWith('.html')) return type === 'text/html';
  if (url.pathname.endsWith('.js')) return ['text/javascript', 'application/javascript'].includes(type);
  if (url.pathname.endsWith('.css')) return type === 'text/css';
  if (url.pathname.endsWith('.png')) return type === 'image/png';
  if (url.pathname.endsWith('.webp')) return type === 'image/webp';
  return /\.(woff2?|ttf)$/.test(url.pathname) && /^(font\/|application\/(?:font-|x-font-|octet-stream))/.test(type);
}
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;
  if (isPublicAsset(url, request)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (canStore(url, response)) await cache.put(request, response.clone()).catch(() => {});
      return response;
    }));
  } else if (request.mode === 'navigate' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/sign-')) {
    // The separate offline document has no account data or prior session state.
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/care-offline.html').then(page => page || Response.error())));
  }
});
