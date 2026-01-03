/**
 * Service Worker for Push Notifications
 * Handles background notifications and offline functionality
 */

// Cache version for updates
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `pitchey-cache-${CACHE_VERSION}`;

// Files to cache for offline access
const STATIC_CACHE_URLS = [
  '/',
  '/offline.html',
  '/logo-192x192.png',
  '/logo-512x512.png',
  '/sounds/notification.mp3'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_CACHE_URLS).catch(err => {
        console.error('[Service Worker] Failed to cache:', err);
      });
    })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('pitchey-cache-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  
  // Claim all clients immediately
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone the response for caching
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      });
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  let notification = {
    title: 'Pitchey Notification',
    body: 'You have a new notification',
    icon: '/logo-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {}
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notification = {
        title: data.title || notification.title,
        body: data.body || data.message || notification.body,
        icon: data.icon || notification.icon,
        badge: data.badge || notification.badge,
        image: data.image,
        tag: data.tag || `notification-${Date.now()}`,
        requireInteraction: data.priority === 'urgent',
        actions: data.actions || [],
        data: data.data || data,
        vibrate: data.vibrate || notification.vibrate,
        silent: data.silent || false,
        timestamp: data.timestamp || Date.now()
      };
    } catch (error) {
      console.error('[Service Worker] Failed to parse push data:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notification.title, notification)
  );
  
  // Update badge count
  if ('setAppBadge' in navigator && notification.data.unreadCount) {
    navigator.setAppBadge(notification.data.unreadCount);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = '/notifications';
  
  // Handle action clicks
  if (event.action) {
    switch (event.action) {
      case 'view':
        url = data.actionUrl || `/pitch/${data.pitchId}` || '/notifications';
        break;
      case 'dismiss':
        return; // Just close the notification
      default:
        url = data.actionUrl || '/notifications';
    }
  } else if (data.actionUrl) {
    url = data.actionUrl;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      
      // Open new window if app is not open
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered');
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

// Sync notifications when back online
async function syncNotifications() {
  try {
    // Get any pending actions from IndexedDB
    const pendingActions = await getPendingActions();
    
    for (const action of pendingActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: JSON.stringify(action.body)
        });
        
        if (response.ok) {
          await removePendingAction(action.id);
        }
      } catch (error) {
        console.error('[Service Worker] Failed to sync action:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// IndexedDB helpers for offline queue
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PitcheyOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function getPendingActions() {
  const db = await openDB();
  const transaction = db.transaction(['pendingActions'], 'readonly');
  const store = transaction.objectStore('pendingActions');
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removePendingAction(id) {
  const db = await openDB();
  const transaction = db.transaction(['pendingActions'], 'readwrite');
  const store = transaction.objectStore('pendingActions');
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Message handler for client communication
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge();
    }
  }
  
  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('Test Notification', {
      body: 'This is a test notification from Pitchey',
      icon: '/logo-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [200, 100, 200],
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  }
});