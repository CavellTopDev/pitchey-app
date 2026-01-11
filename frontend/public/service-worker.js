// Service Worker for Pitchey Platform
// Version: 1.0.0
// Last Updated: 2024

const CACHE_VERSION = 'v1.0.0'
const CACHE_NAMES = {
  static: `static-cache-${CACHE_VERSION}`,
  dynamic: `dynamic-cache-${CACHE_VERSION}`,
  images: `image-cache-${CACHE_VERSION}`,
  api: `api-cache-${CACHE_VERSION}`
}

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html'
]

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/api\/pitches\/trending/,
  /\/api\/pitches\/\d+$/,
  /\/api\/genres/,
  /\/api\/formats/,
  /\/api\/search\?/
]

// Cache strategies
const CacheStrategy = {
  // Cache First - for static assets
  cacheFirst: async (request, cacheName) => {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    
    if (cached) {
      // Update cache in background
      fetch(request)
        .then(response => {
          if (response.ok) {
            cache.put(request, response.clone())
          }
        })
        .catch(() => {})
      
      return cached
    }
    
    try {
      const response = await fetch(request)
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    } catch (error) {
      // Return offline page for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/offline.html')
      }
      throw error
    }
  },
  
  // Network First - for API calls
  networkFirst: async (request, cacheName, maxAge = 300000) => {
    try {
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(cacheName)
        cache.put(request, response.clone())
      }
      return response
    } catch (error) {
      const cache = await caches.open(cacheName)
      const cached = await cache.match(request)
      
      if (cached) {
        // Check if cache is still fresh
        const cachedDate = cached.headers.get('sw-cache-date')
        if (cachedDate) {
          const age = Date.now() - new Date(cachedDate).getTime()
          if (age < maxAge) {
            return cached
          }
        }
        return cached
      }
      
      throw error
    }
  },
  
  // Stale While Revalidate
  staleWhileRevalidate: async (request, cacheName) => {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    
    const fetchPromise = fetch(request)
      .then(response => {
        if (response.ok) {
          const responseWithDate = response.clone()
          const headers = new Headers(responseWithDate.headers)
          headers.set('sw-cache-date', new Date().toISOString())
          
          const modifiedResponse = new Response(responseWithDate.body, {
            status: responseWithDate.status,
            statusText: responseWithDate.statusText,
            headers
          })
          
          cache.put(request, modifiedResponse)
        }
        return response
      })
      .catch(error => {
        if (cached) return cached
        throw error
      })
    
    return cached || fetchPromise
  }
}

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...')
  
  event.waitUntil(
    caches.open(CACHE_NAMES.static)
      .then(cache => {
        console.log('[ServiceWorker] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...')
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return !Object.values(CACHE_NAMES).includes(cacheName)
            })
            .map(cacheName => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Skip WebSocket requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return
  }
  
  // Handle different request types with appropriate strategies
  
  // Static assets - Cache First
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|eot|otf)$/) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/static/')
  ) {
    event.respondWith(
      CacheStrategy.cacheFirst(request, CACHE_NAMES.static)
    )
    return
  }
  
  // Images - Stale While Revalidate
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/)) {
    event.respondWith(
      CacheStrategy.staleWhileRevalidate(request, CACHE_NAMES.images)
    )
    return
  }
  
  // API calls - Network First with cache fallback
  if (url.pathname.startsWith('/api/')) {
    // Check if this API endpoint should be cached
    const shouldCache = CACHEABLE_API_PATTERNS.some(pattern => 
      pattern.test(url.pathname + url.search)
    )
    
    if (shouldCache) {
      event.respondWith(
        CacheStrategy.networkFirst(request, CACHE_NAMES.api)
      )
    }
    return
  }
  
  // HTML pages - Network First
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(
      CacheStrategy.networkFirst(request, CACHE_NAMES.dynamic)
    )
    return
  }
  
  // Default - Stale While Revalidate
  event.respondWith(
    CacheStrategy.staleWhileRevalidate(request, CACHE_NAMES.dynamic)
  )
})

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[ServiceWorker] Background sync:', event.tag)
  
  if (event.tag === 'sync-pitches') {
    event.waitUntil(syncPitches())
  }
})

// Push notifications
self.addEventListener('push', event => {
  console.log('[ServiceWorker] Push received')
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from Pitchey',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/close.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('Pitchey', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('[ServiceWorker] Notification click:', event.action)
  
  event.notification.close()
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Message handler for cache management from the app
self.addEventListener('message', event => {
  console.log('[ServiceWorker] Message received:', event.data)
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data.type === 'CACHE_URLS') {
    cacheUrls(event.data.urls)
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    clearCache(event.data.cacheName)
  }
})

// Helper functions

async function syncPitches() {
  try {
    const cache = await caches.open(CACHE_NAMES.api)
    const requests = await cache.keys()
    
    for (const request of requests) {
      if (request.url.includes('/api/pitches')) {
        const response = await fetch(request)
        if (response.ok) {
          await cache.put(request, response)
        }
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error)
  }
}

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAMES.dynamic)
  await cache.addAll(urls)
}

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName)
  } else {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
  }
}

// Performance monitoring
function trackCachePerformance(request, response, strategy) {
  if (self.performance && self.performance.mark) {
    const entry = {
      url: request.url,
      strategy,
      cached: response.headers.get('sw-cache-date') ? true : false,
      timestamp: Date.now()
    }
    
    // Send to analytics
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'CACHE_PERFORMANCE',
          data: entry
        })
      })
    })
  }
}

console.log('[ServiceWorker] Loaded successfully')