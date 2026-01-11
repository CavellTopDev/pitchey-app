// Enhanced Mobile Service Worker for Pitchey Platform
// Version: 2.0.0 - Mobile Optimized
// Last Updated: January 2026

const CACHE_VERSION = 'v2.0.0-mobile'
const CACHE_NAMES = {
  static: `static-cache-${CACHE_VERSION}`,
  dynamic: `dynamic-cache-${CACHE_VERSION}`,
  images: `image-cache-${CACHE_VERSION}`,
  api: `api-cache-${CACHE_VERSION}`,
  offline: `offline-cache-${CACHE_VERSION}`,
  mobile: `mobile-cache-${CACHE_VERSION}`
}

// Mobile-optimized static assets
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html',
  '/mobile-offline.html',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  // Critical mobile CSS and JS will be added dynamically
]

// Mobile-specific API patterns for caching
const MOBILE_CACHEABLE_API_PATTERNS = [
  /\/api\/pitches\/trending\?limit=\d+/,
  /\/api\/pitches\/\d+$/,
  /\/api\/genres/,
  /\/api\/formats/,
  /\/api\/search\?.*limit=\d+/,
  /\/api\/mobile\/.*/, // Mobile-specific endpoints
  /\/api\/auth\/session/, // Session validation
  /\/api\/notifications\/unread/, // Notification count
]

// Mobile bandwidth detection
let connectionType = 'unknown'
let effectiveType = '4g'

// Update connection info when available
if ('connection' in navigator) {
  const conn = navigator.connection
  connectionType = conn.type || 'unknown'
  effectiveType = conn.effectiveType || '4g'
  
  conn.addEventListener('change', () => {
    connectionType = conn.type || 'unknown'
    effectiveType = conn.effectiveType || '4g'
  })
}

// Mobile-optimized cache strategies
const MobileCacheStrategy = {
  // Fast cache-first for static assets on mobile
  mobileCacheFirst: async (request, cacheName) => {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    
    if (cached) {
      // Only update cache on WiFi or good connection
      if (effectiveType === '4g' || connectionType === 'wifi') {
        fetch(request)
          .then(response => {
            if (response.ok) {
              cache.put(request, response.clone())
            }
          })
          .catch(() => {})
      }
      return cached
    }
    
    try {
      const response = await fetch(request)
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    } catch (error) {
      // Return mobile offline page for navigation
      if (request.mode === 'navigate') {
        return caches.match('/mobile-offline.html') || caches.match('/offline.html')
      }
      throw error
    }
  },

  // Bandwidth-aware network first
  mobileNetworkFirst: async (request, cacheName, maxAge = 300000) => {
    const cache = await caches.open(cacheName)
    
    try {
      // Skip network on slow connections for non-critical requests
      if ((effectiveType === '2g' || effectiveType === 'slow-2g') && 
          !request.url.includes('/api/auth/') &&
          !request.url.includes('/api/notifications/')) {
        const cached = await cache.match(request)
        if (cached) return cached
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 
        effectiveType === '2g' ? 3000 : effectiveType === '3g' ? 5000 : 8000)
      
      const response = await fetch(request, { signal: controller.signal })
      clearTimeout(timeoutId)
      
      if (response.ok) {
        // Add mobile-specific headers
        const responseWithHeaders = response.clone()
        const headers = new Headers(responseWithHeaders.headers)
        headers.set('sw-cache-date', new Date().toISOString())
        headers.set('sw-connection-type', connectionType)
        headers.set('sw-effective-type', effectiveType)
        
        const modifiedResponse = new Response(responseWithHeaders.body, {
          status: responseWithHeaders.status,
          statusText: responseWithHeaders.statusText,
          headers
        })
        
        cache.put(request, modifiedResponse)
      }
      return response
    } catch (error) {
      const cached = await cache.match(request)
      if (cached) {
        // Check cache freshness based on connection
        const cachedDate = cached.headers.get('sw-cache-date')
        if (cachedDate) {
          const age = Date.now() - new Date(cachedDate).getTime()
          const maxCacheAge = effectiveType === '2g' ? 600000 : maxAge // 10 min on 2G
          if (age < maxCacheAge) {
            return cached
          }
        }
        return cached
      }
      throw error
    }
  },

  // Image optimization for mobile
  mobileImageStrategy: async (request, cacheName) => {
    const url = new URL(request.url)
    const cache = await caches.open(cacheName)
    
    // Check for cached optimized version first
    let optimizedRequest = request
    
    // Add mobile image optimization parameters
    if (url.pathname.match(/\.(jpg|jpeg|png|webp)$/)) {
      const params = new URLSearchParams()
      
      // Optimize based on connection
      if (effectiveType === '2g' || effectiveType === 'slow-2g') {
        params.set('quality', '60')
        params.set('format', 'webp')
        params.set('width', '400')
      } else if (effectiveType === '3g') {
        params.set('quality', '75')
        params.set('format', 'webp')
        params.set('width', '800')
      }
      
      if (params.toString()) {
        url.search = params.toString()
        optimizedRequest = new Request(url.toString(), {
          method: request.method,
          headers: request.headers,
          mode: request.mode,
          credentials: request.credentials
        })
      }
    }
    
    const cached = await cache.match(optimizedRequest)
    if (cached) return cached
    
    try {
      const response = await fetch(optimizedRequest)
      if (response.ok) {
        cache.put(optimizedRequest, response.clone())
      }
      return response
    } catch (error) {
      // Try original request as fallback
      if (optimizedRequest !== request) {
        const fallback = await cache.match(request)
        if (fallback) return fallback
        
        try {
          const fallbackResponse = await fetch(request)
          if (fallbackResponse.ok) {
            cache.put(request, fallbackResponse.clone())
          }
          return fallbackResponse
        } catch (fallbackError) {
          throw error
        }
      }
      throw error
    }
  }
}

// Install event with mobile optimization
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing mobile-optimized version...')
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAMES.static).then(cache => {
        console.log('[ServiceWorker] Caching static assets for mobile')
        return cache.addAll(STATIC_ASSETS)
      }),
      // Pre-cache mobile offline page
      caches.open(CACHE_NAMES.offline).then(cache => {
        return cache.add('/mobile-offline.html').catch(() => {
          return cache.add('/offline.html')
        })
      })
    ]).then(() => {
      console.log('[ServiceWorker] Mobile optimization complete')
      return self.skipWaiting()
    })
  )
})

// Enhanced activate event
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating mobile version...')
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => !Object.values(CACHE_NAMES).includes(cacheName))
            .map(cacheName => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      }),
      // Detect mobile capabilities
      self.clients.claim().then(() => {
        // Notify clients of mobile SW activation
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_MOBILE_ACTIVATED',
              connectionType,
              effectiveType
            })
          })
        })
      })
    ])
  )
})

// Enhanced fetch handler with mobile optimizations
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') return
  
  // Skip WebSocket and Chrome extension requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || 
      url.protocol === 'chrome-extension:') return
  
  // Handle different request types with mobile-optimized strategies
  
  // Static assets - Mobile cache first
  if (url.pathname.match(/\.(js|css|woff2?|ttf|eot|otf)$/) ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/static/') ||
      url.pathname.startsWith('/icons/')) {
    event.respondWith(
      MobileCacheStrategy.mobileCacheFirst(request, CACHE_NAMES.static)
    )
    return
  }
  
  // Images - Mobile image optimization
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/)) {
    event.respondWith(
      MobileCacheStrategy.mobileImageStrategy(request, CACHE_NAMES.images)
    )
    return
  }
  
  // API calls - Mobile network first
  if (url.pathname.startsWith('/api/')) {
    const shouldCache = MOBILE_CACHEABLE_API_PATTERNS.some(pattern => 
      pattern.test(url.pathname + url.search)
    )
    
    if (shouldCache) {
      event.respondWith(
        MobileCacheStrategy.mobileNetworkFirst(request, CACHE_NAMES.api)
      )
    }
    return
  }
  
  // Navigation - Mobile network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      MobileCacheStrategy.mobileNetworkFirst(request, CACHE_NAMES.dynamic)
        .catch(() => caches.match('/mobile-offline.html') || caches.match('/offline.html'))
    )
    return
  }
  
  // Default - Mobile cache first for everything else
  event.respondWith(
    MobileCacheStrategy.mobileCacheFirst(request, CACHE_NAMES.mobile)
  )
})

// Enhanced background sync for mobile
self.addEventListener('sync', event => {
  console.log('[ServiceWorker] Background sync:', event.tag)
  
  switch (event.tag) {
    case 'sync-pitches-mobile':
      event.waitUntil(syncMobilePitches())
      break
    case 'sync-notifications':
      event.waitUntil(syncNotifications())
      break
    case 'sync-offline-actions':
      event.waitUntil(syncOfflineActions())
      break
  }
})

// Enhanced push notifications for mobile
self.addEventListener('push', event => {
  console.log('[ServiceWorker] Push received for mobile')
  
  let notificationData = {
    title: 'Pitchey',
    body: 'New notification',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/badge-72x72.svg'
  }
  
  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = {
        title: data.title || 'Pitchey',
        body: data.body || 'New notification',
        icon: data.icon || '/icons/icon-192x192.svg',
        badge: data.badge || '/icons/badge-72x72.svg',
        image: data.image,
        vibrate: data.vibrate || [100, 50, 100],
        data: data.data || {},
        actions: data.actions || [
          {
            action: 'view',
            title: 'View',
            icon: '/icons/view.svg'
          },
          {
            action: 'close',
            title: 'Close',
            icon: '/icons/close.svg'
          }
        ],
        // Mobile-specific options
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        tag: data.tag || 'pitchey-notification',
        renotify: data.renotify || false
      }
    } catch (error) {
      console.error('[ServiceWorker] Failed to parse notification data:', error)
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  )
})

// Enhanced notification click handler
self.addEventListener('notificationclick', event => {
  console.log('[ServiceWorker] Notification click:', event.action)
  
  event.notification.close()
  
  if (event.action === 'view' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/'
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          // Check if there's already a window/tab open
          for (const client of clientList) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus()
            }
          }
          
          // Open new window/tab
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen)
          }
        })
    )
  }
})

// Message handler with mobile features
self.addEventListener('message', event => {
  console.log('[ServiceWorker] Message received:', event.data)
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'CACHE_MOBILE_ASSETS':
      event.waitUntil(cacheMobileAssets(event.data.assets))
      break
      
    case 'UPDATE_CONNECTION_TYPE':
      connectionType = event.data.connectionType
      effectiveType = event.data.effectiveType
      break
      
    case 'CLEAR_MOBILE_CACHE':
      event.waitUntil(clearMobileCache(event.data.cacheType))
      break
      
    case 'GET_CACHE_STATUS':
      event.waitUntil(getCacheStatus().then(status => {
        event.ports[0]?.postMessage(status)
      }))
      break
  }
})

// Mobile-specific helper functions

async function syncMobilePitches() {
  try {
    const cache = await caches.open(CACHE_NAMES.api)
    const requests = await cache.keys()
    
    // Only sync on good connections
    if (effectiveType === '2g' || effectiveType === 'slow-2g') {
      console.log('[ServiceWorker] Skipping sync on slow connection')
      return
    }
    
    const pitchRequests = requests.filter(request => 
      request.url.includes('/api/pitches') && 
      request.url.includes('limit=')
    )
    
    for (const request of pitchRequests.slice(0, 5)) { // Limit to 5 requests
      try {
        const response = await fetch(request)
        if (response.ok) {
          await cache.put(request, response)
        }
      } catch (error) {
        console.error('[ServiceWorker] Sync failed for:', request.url, error)
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Mobile pitch sync failed:', error)
  }
}

async function syncNotifications() {
  try {
    const response = await fetch('/api/notifications/unread')
    if (response.ok) {
      const data = await response.json()
      
      // Send count to all clients
      const clients = await self.clients.matchAll()
      clients.forEach(client => {
        client.postMessage({
          type: 'NOTIFICATION_COUNT_UPDATE',
          count: data.count || 0
        })
      })
    }
  } catch (error) {
    console.error('[ServiceWorker] Notification sync failed:', error)
  }
}

async function syncOfflineActions() {
  // Sync any offline actions stored in IndexedDB
  try {
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_OFFLINE_ACTIONS' })
    })
  } catch (error) {
    console.error('[ServiceWorker] Offline actions sync failed:', error)
  }
}

async function cacheMobileAssets(assets) {
  const cache = await caches.open(CACHE_NAMES.mobile)
  await cache.addAll(assets)
}

async function clearMobileCache(cacheType) {
  if (cacheType) {
    const cacheName = CACHE_NAMES[cacheType]
    if (cacheName) {
      await caches.delete(cacheName)
    }
  } else {
    // Clear all mobile caches
    const cacheNames = Object.values(CACHE_NAMES)
    await Promise.all(cacheNames.map(name => caches.delete(name)))
  }
}

async function getCacheStatus() {
  const status = {}
  
  for (const [type, cacheName] of Object.entries(CACHE_NAMES)) {
    try {
      const cache = await caches.open(cacheName)
      const keys = await cache.keys()
      status[type] = keys.length
    } catch (error) {
      status[type] = 0
    }
  }
  
  return {
    caches: status,
    connectionType,
    effectiveType,
    version: CACHE_VERSION
  }
}

console.log('[ServiceWorker] Mobile-optimized service worker loaded successfully')