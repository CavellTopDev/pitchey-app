import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Wifi, WifiOff, Download } from 'lucide-react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isInstalling: boolean;
  isWaiting: boolean;
  isOnline: boolean;
  swPath?: string;
  registration?: ServiceWorkerRegistration;
  error?: string;
}

interface ServiceWorkerManagerProps {
  onRegistration?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: string) => void;
  showStatus?: boolean;
  enableMobileOptimizations?: boolean;
}

export default function ServiceWorkerManager({ 
  onRegistration, 
  onError,
  showStatus = false,
  enableMobileOptimizations = true
}: ServiceWorkerManagerProps) {
  const [swState, setSwState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isInstalling: false,
    isWaiting: false,
    isOnline: navigator.onLine,
  });

  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    if (!swState.isSupported) {
      const error = 'Service Workers not supported';
      setSwState(prev => ({ ...prev, error }));
      onError?.(error);
      return;
    }

    registerServiceWorker();

    // Listen for online/offline changes
    const handleOnline = () => setSwState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSwState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      
      switch (event.data.type) {
        case 'SW_MOBILE_ACTIVATED':
          break;
        case 'CACHE_PERFORMANCE':
          break;
        case 'NOTIFICATION_COUNT_UPDATE':
          // Handle notification count updates
          window.dispatchEvent(new CustomEvent('notificationCountUpdate', {
            detail: { count: event.data.count }
          }));
          break;
        case 'SYNC_OFFLINE_ACTIONS':
          // Handle offline action sync
          window.dispatchEvent(new CustomEvent('syncOfflineActions'));
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [swState.isSupported, onError]);

  const registerServiceWorker = async () => {
    try {
      setSwState(prev => ({ ...prev, isInstalling: true }));

      // Choose service worker based on mobile optimization setting
      const swPath = enableMobileOptimizations && isMobile ? '/sw-mobile.js' : '/service-worker.js';

      const registration = await navigator.serviceWorker.register(swPath, {
        scope: '/',
        updateViaCache: 'none'
      });

      setSwState(prev => ({ 
        ...prev, 
        isRegistered: true, 
        isInstalling: false,
        registration,
        swPath
      }));

      onRegistration?.(registration);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setShowUpdatePrompt(true);
              setSwState(prev => ({ ...prev, isWaiting: true }));
            }
          });
        }
      });

      // Send connection info to service worker for mobile optimization
      if (enableMobileOptimizations && 'connection' in navigator) {
        const connection = (navigator as any).connection;
        registration.active?.postMessage({
          type: 'UPDATE_CONNECTION_TYPE',
          connectionType: connection.type || 'unknown',
          effectiveType: connection.effectiveType || '4g'
        });
      }

      // Get initial cache status
      await getCacheStatus(registration);

    } catch (error) {
      const errorMsg = `Service Worker registration failed: ${error}`;
      console.error(errorMsg);
      setSwState(prev => ({ 
        ...prev, 
        error: errorMsg, 
        isInstalling: false 
      }));
      onError?.(errorMsg);
    }
  };

  const getCacheStatus = async (registration?: ServiceWorkerRegistration) => {
    const reg = registration || swState.registration;
    if (!reg?.active) return;

    try {
      const messageChannel = new MessageChannel();
      
      const response = await new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => resolve(event.data);
        reg.active!.postMessage({ type: 'GET_CACHE_STATUS' }, [messageChannel.port2]);
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      });

      setCacheStatus(response);
    } catch (error) {
      console.error('Failed to get cache status:', error);
    }
  };

  const updateServiceWorker = () => {
    if (swState.registration?.waiting) {
      swState.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setShowUpdatePrompt(false);
      
      // Reload page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const clearCache = async (cacheType?: string) => {
    if (!swState.registration?.active) return;

    swState.registration.active.postMessage({
      type: 'CLEAR_MOBILE_CACHE',
      cacheType
    });

    // Refresh cache status
    setTimeout(() => getCacheStatus(), 1000);
  };

  const prefetchMobileAssets = (assets: string[]) => {
    if (!swState.registration?.active) return;

    swState.registration.active.postMessage({
      type: 'CACHE_MOBILE_ASSETS',
      assets
    });
  };

  // Don't render if not showing status
  if (!showStatus) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm">
      {/* Service Worker Status */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 mb-2 overflow-hidden">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {swState.isOnline ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-600" />
              )}
              <span className="text-sm font-medium text-gray-900">
                {swState.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {swState.isRegistered && (
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-600">SW Active</span>
              </div>
            )}
          </div>

          {swState.error && (
            <div className="flex items-center space-x-2 text-red-600 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{swState.error}</span>
            </div>
          )}

          {swState.isInstalling && (
            <div className="text-xs text-gray-600 mb-2">
              Installing service worker...
            </div>
          )}

          {enableMobileOptimizations && isMobile && swState.isRegistered && (
            <div className="text-xs text-blue-600 mb-2">
              📱 Mobile optimizations enabled
            </div>
          )}

          {cacheStatus && (
            <div className="text-xs text-gray-600">
              <div className="grid grid-cols-2 gap-1">
                <div>Static: {cacheStatus.caches?.static || 0}</div>
                <div>Images: {cacheStatus.caches?.images || 0}</div>
                <div>API: {cacheStatus.caches?.api || 0}</div>
                <div>Dynamic: {cacheStatus.caches?.dynamic || 0}</div>
              </div>
              {cacheStatus.effectiveType && (
                <div className="mt-1">
                  Connection: {cacheStatus.effectiveType}
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-1 mt-2">
            <button
              onClick={() => getCacheStatus()}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Refresh
            </button>
            <button
              onClick={() => clearCache()}
              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* Update Prompt */}
      {showUpdatePrompt && (
        <div className="bg-blue-600 text-white rounded-lg shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Update Available</span>
            </div>
          </div>
          <p className="text-xs mb-3">A new version is ready to install.</p>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowUpdatePrompt(false)}
              className="flex-1 text-xs px-3 py-1 bg-blue-500 rounded hover:bg-blue-400"
            >
              Later
            </button>
            <button
              onClick={updateServiceWorker}
              className="flex-1 text-xs px-3 py-1 bg-white text-blue-600 rounded hover:bg-gray-100"
            >
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for service worker utilities
export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheStatus, setCacheStatus] = useState<any>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const sendMessage = (message: any) => {
    if (registration?.active) {
      registration.active.postMessage(message);
    } else if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
  };

  const getCacheStatus = async () => {
    if (!registration?.active && !navigator.serviceWorker.controller) return null;

    try {
      const messageChannel = new MessageChannel();
      
      const response = await new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => resolve(event.data);
        
        const sw = registration?.active || navigator.serviceWorker.controller;
        sw!.postMessage({ type: 'GET_CACHE_STATUS' }, [messageChannel.port2]);
        
        setTimeout(() => resolve(null), 5000);
      });

      setCacheStatus(response);
      return response;
    } catch (error) {
      console.error('Failed to get cache status:', error);
      return null;
    }
  };

  const clearCache = (cacheType?: string) => {
    sendMessage({
      type: 'CLEAR_MOBILE_CACHE',
      cacheType
    });
  };

  const prefetchAssets = (assets: string[]) => {
    sendMessage({
      type: 'CACHE_MOBILE_ASSETS',
      assets
    });
  };

  return {
    registration,
    setRegistration,
    isOnline,
    cacheStatus,
    getCacheStatus,
    clearCache,
    prefetchAssets,
    sendMessage
  };
}