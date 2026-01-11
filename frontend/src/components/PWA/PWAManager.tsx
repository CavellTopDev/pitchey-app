/**
 * PWA Manager Component
 * Handles service worker registration, PWA install prompt, and mobile optimizations
 */

import React, { useEffect } from 'react';
import PWAInstallPrompt from './PWAInstallPrompt';
import ServiceWorkerManager from './ServiceWorkerManager';
import { useMobileCapabilities, useMobileViewport } from '../../hooks/useMobileGestures';

interface PWAManagerProps {
  enableInstallPrompt?: boolean;
  showServiceWorkerStatus?: boolean;
  enableMobileOptimizations?: boolean;
  children?: React.ReactNode;
}

export default function PWAManager({ 
  enableInstallPrompt = true,
  showServiceWorkerStatus = false,
  enableMobileOptimizations = true,
  children
}: PWAManagerProps) {
  const capabilities = useMobileCapabilities();
  const { setViewportHeight } = useMobileViewport();

  useEffect(() => {
    // Initialize PWA features
    initializePWA();
    
    // Set up mobile optimizations
    if (enableMobileOptimizations) {
      setupMobileOptimizations();
    }
  }, [enableMobileOptimizations]);

  const initializePWA = async () => {
    // Register manifest
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);
    }

    // Add meta tags for mobile
    if (!document.querySelector('meta[name="theme-color"]')) {
      const themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      themeColorMeta.content = '#1f2937';
      document.head.appendChild(themeColorMeta);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const appleCapableMeta = document.createElement('meta');
      appleCapableMeta.name = 'apple-mobile-web-app-capable';
      appleCapableMeta.content = 'yes';
      document.head.appendChild(appleCapableMeta);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const appleStatusMeta = document.createElement('meta');
      appleStatusMeta.name = 'apple-mobile-web-app-status-bar-style';
      appleStatusMeta.content = 'default';
      document.head.appendChild(appleStatusMeta);
    }

    // Add apple touch icons
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleTouchIcon = document.createElement('link');
      appleTouchIcon.rel = 'apple-touch-icon';
      appleTouchIcon.href = '/icons/icon-192x192.png';
      document.head.appendChild(appleTouchIcon);
    }

    // Add splash screen meta tags for iOS
    addIOSSplashScreens();
  };

  const setupMobileOptimizations = () => {
    // Prevent zoom on input focus (iOS)
    if (capabilities.isIOS) {
      const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
      if (viewportMeta) {
        viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
      }
    }

    // Add CSS custom properties for mobile
    document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
    document.documentElement.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left)');
    document.documentElement.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right)');

    // Add touch-action CSS for better touch performance
    document.body.style.touchAction = 'manipulation';

    // Optimize scrolling on iOS
    if (capabilities.isIOS) {
      document.body.style.webkitOverflowScrolling = 'touch';
    }

    // Add performance observer for mobile metrics
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              // Log navigation performance
            }
          }
        });
        observer.observe({ entryTypes: ['navigation'] });
      } catch (error) {
        console.warn('Performance observer not supported:', error);
      }
    }
  };

  const addIOSSplashScreens = () => {
    const splashScreens = [
      // iPhone X/XS/11 Pro
      {
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
        href: '/icons/splash-1125x2436.png'
      },
      // iPhone XS Max/11 Pro Max
      {
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)',
        href: '/icons/splash-1242x2688.png'
      },
      // iPhone XR/11
      {
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
        href: '/icons/splash-828x1792.png'
      },
      // iPhone 12/13 mini
      {
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
        href: '/icons/splash-1080x2340.png'
      },
      // iPhone 12/13/14
      {
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
        href: '/icons/splash-1170x2532.png'
      },
      // iPhone 12/13/14 Pro Max
      {
        media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)',
        href: '/icons/splash-1284x2778.png'
      },
      // iPad Mini
      {
        media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
        href: '/icons/splash-1536x2048.png'
      },
      // iPad Air/Pro 11"
      {
        media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)',
        href: '/icons/splash-1668x2388.png'
      },
      // iPad Pro 12.9"
      {
        media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
        href: '/icons/splash-2048x2732.png'
      }
    ];

    splashScreens.forEach((splash) => {
      if (!document.querySelector(`link[href="${splash.href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'apple-touch-startup-image';
        link.href = splash.href;
        link.media = splash.media;
        document.head.appendChild(link);
      }
    });
  };

  const handlePWAInstall = () => {
    // Track PWA installation
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_install_prompted', {
        platform: capabilities.isIOS ? 'ios' : capabilities.isAndroid ? 'android' : 'desktop'
      });
    }
  };

  const handlePWADismiss = () => {
    // Track PWA dismissal
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_install_dismissed', {
        platform: capabilities.isIOS ? 'ios' : capabilities.isAndroid ? 'android' : 'desktop'
      });
    }
  };

  return (
    <>
      {children}
      
      {/* Service Worker Manager */}
      <ServiceWorkerManager
        onRegistration={(registration) => {
        }}
        onError={(error) => {
          console.error('Service Worker error:', error);
        }}
        showStatus={showServiceWorkerStatus}
        enableMobileOptimizations={enableMobileOptimizations && capabilities.isMobile}
      />
      
      {/* PWA Install Prompt */}
      {enableInstallPrompt && !capabilities.isStandalone && (
        <PWAInstallPrompt
          onInstall={handlePWAInstall}
          onDismiss={handlePWADismiss}
        />
      )}
    </>
  );
}

// Hook for PWA status
export function usePWAStatus() {
  const capabilities = useMobileCapabilities();
  
  return {
    isInstalled: capabilities.isStandalone,
    isInstallable: capabilities.hasInstallPrompt,
    isMobile: capabilities.isMobile,
    isIOS: capabilities.isIOS,
    isAndroid: capabilities.isAndroid,
    hasServiceWorker: capabilities.hasServiceWorker,
    hasNotifications: capabilities.hasNotifications,
    hasTouch: capabilities.hasTouch
  };
}