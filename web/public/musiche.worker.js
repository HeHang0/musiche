const CACHE_NAME = 'musiche-cache';

const cacheFirst = [
  /(.*?)\.(html|js|json|css|png|jpg|jpeg|woff2|webm|webp)/i,
  /\/proxy\?url=[\S]+/i
];

const networkFirst = /\/node_modules\//i;
const routerPattern =
  /\/(recommend|yours|ranking|search|playlist|album|lover|recent|local|created|setting|version$)/i;

self.addEventListener('install', event => {
  console.log('Service Worker installing.');
  event.waitUntil(caches.open(CACHE_NAME));
});
let proxyAddress = '';
let useHuaweiCloud = false;

function getHuaweiCloudResponse(response) {
  const data = await response.json();
  const decodedData = atob(data.body);
  const uint8Array = new Uint8Array(decodedData.length);
  const blob = new Blob(uint8Array, {
    type:
      (data?.headers && data?.headers['content-type']) ||
      'application/octet-stream'
  });
  for (let i = 0; i < decodedData.length; i++) {
    uint8Array[i] = decodedData.charCodeAt(i);
  }
  const customHeaders = new Headers();
  Object.keys(data?.headers || {}).forEach(headerKey => {
    customHeaders.set(headerKey, data.headers[headerKey]);
  });
  return new Response(blob, {
    status: data.statusCode || 200,
    statusText: 'OK',
    ok: true,
    headers: customHeaders
  });
}

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
  let response = null;
  try {
    response = await fetch(request);
    if (useHuaweiCloud && response.ok && requestUrl.startsWith(proxyAddress)) {
      response = getHuaweiCloudResponse(response)
    }
  } catch (error) {
    if (
      proxyAddress &&
      (request.destination === 'image' || request.destination === 'audio') &&
      !requestUrl.startsWith(proxyAddress)
    ) {
      response = await fetch(
        proxyAddress + '?url=' + encodeURIComponent(requestUrl)
      );
      if (useHuaweiCloud && response.ok) {
        response = getHuaweiCloudResponse(response)
      }
    }
  }
  const cacheRouter =
    response.headers.get('content-type')?.includes('text/html') &&
    routerPattern.test(requestUrl);
  if (
    requestUrl.startsWith('http') &&
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
  console.log('Service Worker updating.');
  // event.waitUntil(clearAllCache());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'MESSAGE_PROXY_ADDRESS') {
    console.log('收到了！', event.data.payload);
    proxyAddress = event.data.payload || '';
    useHuaweiCloud = proxyAddress.includes('huawei');
  }
});
