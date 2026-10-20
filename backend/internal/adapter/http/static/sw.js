// Caches are split by resource class so that trimming one class can never
// evict another's entries. They previously shared a single 80-entry budget:
// a build emits ~35 code chunks (entry, CSS, vendor, ~25 lazy routes) plus ~8
// fonts, so the second deploy pushed the total past the cap and FIFO trimming
// began dropping entries from the *current* build — turning cache hits back into
// network fetches. Separate budgets give each class room for two deploys.
const CODE_CACHE = 'proxyloadouts-code-v1'
const FONT_CACHE = 'proxyloadouts-fonts-v1'
const NAVIGATION_CACHE = 'proxyloadouts-navigation-v1'
const IMAGE_CACHE = 'proxyloadouts-images-v2'
const APP_CACHE_PREFIX = 'proxyloadouts-'
const RETAINED_CACHES = new Set([CODE_CACHE, FONT_CACHE, NAVIGATION_CACHE, IMAGE_CACHE])

// ~35 entries per build, sized for two deploys plus headroom.
const MAX_CODE_ENTRIES = 96
// ~8 woff2 faces per build, sized for two deploys.
const MAX_FONT_ENTRIES = 24
const MAX_IMAGE_ENTRIES = 120

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(APP_CACHE_PREFIX) && !RETAINED_CACHES.has(cacheName),
          )
          .map((cacheName) => caches.delete(cacheName)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const isSameOrigin = url.origin === self.location.origin

  // Authentication, account data, mutations, and validation must always go to
  // the network. The worker deliberately has no API cache.
  if (isSameOrigin && url.pathname.startsWith('/api/')) return
  if (isSameOrigin && url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    respondWithCache(event, networkFirstNavigation(request))
    return
  }

  if (request.destination === 'image') {
    respondWithCache(event, cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES, ['image/']))
    return
  }

  if (!isSameOrigin) return

  if (request.destination === 'font' || url.pathname.endsWith('.woff2')) {
    respondWithCache(event, cacheFirst(request, FONT_CACHE, MAX_FONT_ENTRIES, ['font/']))
    return
  }

  if (url.pathname.startsWith('/assets/') || ['script', 'style', 'worker'].includes(request.destination)) {
    respondWithCache(
      event,
      cacheFirst(request, CODE_CACHE, MAX_CODE_ENTRIES, [
        'application/javascript',
        'image/',
        'text/css',
        'text/javascript',
      ]),
    )
  }
})

function respondWithCache(event, resultPromise) {
  event.respondWith(resultPromise.then(({ response }) => response))
  event.waitUntil(
    resultPromise.then(({ cachePromise }) => cachePromise).catch(() => undefined),
  )
}

async function cacheFirst(request, cacheName, maxEntries, allowedContentTypes) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  if (cachedResponse) return { response: cachedResponse, cachePromise: Promise.resolve() }

  const response = await fetch(request)
  const cachePromise = isCacheable(response, allowedContentTypes)
    ? writeCacheEntry(cache, request, response, maxEntries)
    : Promise.resolve()

  return { response, cachePromise }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(NAVIGATION_CACHE)

  try {
    const response = await fetch(request)
    return {
      response,
      cachePromise: response.ok ? cache.put('/', response.clone()) : Promise.resolve(),
    }
  } catch {
    return {
      response:
        (await cache.match('/')) ??
        new Response('Application is offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      cachePromise: Promise.resolve(),
    }
  }
}

function isCacheable(response, allowedContentTypes) {
  if (response.type === 'opaque') return true
  if (!response.ok) return false

  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim()
  return Boolean(
    contentType && allowedContentTypes.some((allowedType) => contentType.startsWith(allowedType)),
  )
}

async function writeCacheEntry(cache, request, response, maxEntries) {
  await cache.put(request, response.clone())
  await trimCache(cache, maxEntries)
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys()
  const overflow = keys.length - maxEntries
  if (overflow <= 0 || maxEntries === undefined) return

  await Promise.all(keys.slice(0, overflow).map((request) => cache.delete(request)))
}
