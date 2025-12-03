/**
 * Advanced Service Worker with Multi-Strategy Caching
 * Implements sophisticated caching patterns for optimal performance
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAMES = {
  STATIC: `static-cache-${CACHE_VERSION}`,
  DYNAMIC: `dynamic-cache-${CACHE_VERSION}`,
  IMAGES: `image-cache-${CACHE_VERSION}`,
  API: `api-cache-${CACHE_VERSION}`,
  MEDIA: `media-cache-${CACHE_VERSION}`,
};

// Cache configuration with TTLs
const CACHE_CONFIG = {
  STATIC: {
    maxAge: 86400000, // 24 hours
    maxEntries: 100,
  },
  DYNAMIC: {
    maxAge: 3600000, // 1 hour
    maxEntries: 50,
  },
  IMAGES: {
    maxAge: 604800000, // 7 days
    maxEntries: 200,
  },
  API: {
    maxAge: 300000, // 5 minutes
    maxEntries: 100,
  },
  MEDIA: {
    maxAge: 2592000000, // 30 days
    maxEntries: 50,
  },
};

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// API endpoints with custom caching strategies
const API_CACHE_STRATEGIES = {
  // Cache first, network fallback
  CACHE_FIRST: [
    '/api/config',
    '/api/static',
  ],
  // Network first, cache fallback
  NETWORK_FIRST: [
    '/api/user',
    '/api/auth',
  ],
  // Stale while revalidate
  STALE_WHILE_REVALIDATE: [
    '/api/pitches',
    '/api/browse',
    '/api/search',
  ],
  // Network only (no cache)
  NETWORK_ONLY: [
    '/api/payments',
    '/api/messages',
    '/api/notifications',
  ],
};

// Install event - pre-cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Determine caching strategy
  const strategy = getCachingStrategy(url.pathname);
  
  switch (strategy) {
    case 'CACHE_FIRST':
      event.respondWith(cacheFirst(request));
      break;
    case 'NETWORK_FIRST':
      event.respondWith(networkFirst(request));
      break;
    case 'STALE_WHILE_REVALIDATE':
      event.respondWith(staleWhileRevalidate(request));
      break;
    case 'NETWORK_ONLY':
      event.respondWith(networkOnly(request));
      break;
    default:
      // Default to network first for unknown resources
      event.respondWith(networkFirst(request));
  }
});

// Caching Strategies Implementation

async function cacheFirst(request) {
  const cache = await caches.open(getCacheName(request));
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Check if cache is still valid
    if (isCacheValid(cachedResponse, request)) {
      console.log('[SW] Cache hit:', request.url);
      return cachedResponse;
    }
  }
  
  console.log('[SW] Cache miss, fetching:', request.url);
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const responseToCache = networkResponse.clone();
    await cache.put(request, addCacheHeaders(responseToCache));
  }
  
  return networkResponse;
}

async function networkFirst(request) {
  const cache = await caches.open(getCacheName(request));
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, addCacheHeaders(responseToCache));
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page if available
    if (request.destination === 'document') {
      return cache.match('/offline.html');
    }
    
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(getCacheName(request));
  const cachedResponse = await cache.match(request);
  
  // Return cached response immediately
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, addCacheHeaders(networkResponse.clone()));
    }
    return networkResponse;
  });
  
  return cachedResponse || fetchPromise;
}

async function networkOnly(request) {
  return fetch(request);
}

// Helper Functions

function getCachingStrategy(pathname) {
  // Check API cache strategies
  for (const [strategy, patterns] of Object.entries(API_CACHE_STRATEGIES)) {
    if (patterns.some(pattern => pathname.startsWith(pattern))) {
      return strategy;
    }
  }
  
  // Static assets
  if (isStaticAsset(pathname)) {
    return 'CACHE_FIRST';
  }
  
  // Images
  if (isImage(pathname)) {
    return 'CACHE_FIRST';
  }
  
  // Default
  return 'NETWORK_FIRST';
}

function getCacheName(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  if (pathname.startsWith('/api')) {
    return CACHE_NAMES.API;
  } else if (isImage(pathname)) {
    return CACHE_NAMES.IMAGES;
  } else if (isMedia(pathname)) {
    return CACHE_NAMES.MEDIA;
  } else if (isStaticAsset(pathname)) {
    return CACHE_NAMES.STATIC;
  } else {
    return CACHE_NAMES.DYNAMIC;
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|otf|eot)$/.test(pathname);
}

function isImage(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|webp|avif|ico)$/.test(pathname);
}

function isMedia(pathname) {
  return /\.(mp4|webm|ogg|mp3|wav|pdf)$/.test(pathname);
}

function isCacheValid(response, request) {
  const cacheTime = response.headers.get('sw-cache-time');
  if (!cacheTime) return true;
  
  const age = Date.now() - parseInt(cacheTime);
  const cacheName = getCacheName(request);
  const config = CACHE_CONFIG[cacheName.split('-')[0].toUpperCase()];
  
  return age < (config?.maxAge || 3600000);
}

function addCacheHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-time', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pitches') {
    event.waitUntil(syncPitches());
  }
});

async function syncPitches() {
  console.log('[SW] Syncing pitches...');
  // Implement sync logic
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };
  
  event.waitUntil(
    self.registration.showNotification('Pitchey', options)
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  } else if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(cacheUrls(event.data.urls));
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAMES.DYNAMIC);
  await cache.addAll(urls);
  console.log('[SW] URLs cached:', urls.length);
}

// Performance monitoring
self.addEventListener('fetch', (event) => {
  const startTime = performance.now();
  
  event.waitUntil(
    event.respondWith.then(() => {
      const duration = performance.now() - startTime;
      
      // Send performance metrics to analytics
      if (self.registration.sync) {
        self.registration.sync.register('send-analytics');
      }
      
      // Log slow requests
      if (duration > 1000) {
        console.warn('[SW] Slow request:', event.request.url, duration + 'ms');
      }
    })
  );
});