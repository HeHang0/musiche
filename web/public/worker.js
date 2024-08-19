const CACHE_NAME = 'musiche-cache';

const cacheFirst = [
  /(.*?)\.(html|js|json|css|png|jpg|jpeg|woff2|webm|webp)/i,
  /\/proxy\?url=[\S]+/i
];

const networkFirst = /\/node_modules\//i;
const routerPattern =
  /\/(recommend|yours|ranking|search|playlist|album|lover|recent|local|created|setting|version$)/i;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.skipWaiting());
});

async function cacheThenNetwork(request) {
  const requestUrl = new URL(request.url).toString();
  let willCache = false;
  for (let i = 0; i < cacheFirst.length; i++) {
    if (cacheFirst[i].test(requestUrl)) {
      willCache = true;
      break;
    }
  }
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  const response = await fetch(request);
  const cacheRouter =
    response.headers.get('content-type')?.includes('text/html') &&
    routerPattern.test(requestUrl);
  if (
    requestUrl.startsWith('http') &&
    request.method === 'GET' &&
    response.status === 200 &&
    !networkFirst.test(requestUrl) &&
    (cacheRouter || (willCache && response.ok))
  ) {
    try {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    } catch (error) {
      console.error('Failed to cache the response:', error);
    }
  }
  return response;
}

self.addEventListener('fetch', event => {
  event.respondWith(cacheThenNetwork(event.request));
});

async function clearAllCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  keys.forEach(key => {
    cache.delete(key);
  });
  self.skipWaiting();
}

self.addEventListener('update', event => {
  event.waitUntil(clearAllCache());
});
