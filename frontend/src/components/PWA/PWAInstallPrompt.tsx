import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function PWAInstallPrompt({ onInstall, onDismiss, className = '' }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSource, setInstallSource] = useState<'browser' | 'ios' | 'android' | 'desktop'>('browser');

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Detect if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                     (window.navigator as any).standalone;
    setIsStandalone(standalone);

    // Detect platform for install source
    if (iOS) {
      setInstallSource('ios');
    } else if (/Android/.test(navigator.userAgent)) {
      setInstallSource('android');
    } else if (window.innerWidth > 1024) {
      setInstallSource('desktop');
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user has already dismissed the prompt recently
      const lastDismissed = localStorage.getItem('pwa-install-dismissed');
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000; // 24 hours
      
      if (!lastDismissed || now - parseInt(lastDismissed) > dayInMs * 7) { // Show again after 7 days
        setShowPrompt(true);
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      onInstall?.();
      
      // Track installation
      if (typeof gtag !== 'undefined') {
        gtag('event', 'pwa_installed', {
          method: installSource
        });
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show iOS install prompt if on iOS and not already installed
    if (iOS && !standalone && !localStorage.getItem('ios-install-dismissed')) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds on iOS
      
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [installSource, onInstall]);

  const handleInstallClick = async () => {
    if (!deferredPrompt && !isIOS) {
      return;
    }

    if (deferredPrompt) {
      // Standard PWA install
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
      } else {
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    const now = Date.now();
    
    if (isIOS) {
      localStorage.setItem('ios-install-dismissed', now.toString());
    } else {
      localStorage.setItem('pwa-install-dismissed', now.toString());
    }
    
    onDismiss?.();
  };

  // Don't show if already installed
  if (isStandalone || !showPrompt) {
    return null;
  }

  const getInstallInstructions = () => {
    switch (installSource) {
      case 'ios':
        return {
          icon: <Smartphone className="w-6 h-6" />,
          title: 'Install Pitchey App',
          description: 'Add Pitchey to your home screen for the best experience',
          instructions: [
            'Tap the Share button',
            'Scroll down and tap "Add to Home Screen"',
            'Tap "Add" to confirm'
          ],
          buttonText: 'Install Instructions'
        };
      case 'android':
        return {
          icon: <Download className="w-6 h-6" />,
          title: 'Install Pitchey App',
          description: 'Get the app for faster access and offline support',
          instructions: [],
          buttonText: 'Install App'
        };
      case 'desktop':
        return {
          icon: <Monitor className="w-6 h-6" />,
          title: 'Install Pitchey',
          description: 'Install as a desktop app for quick access',
          instructions: [],
          buttonText: 'Install'
        };
      default:
        return {
          icon: <Download className="w-6 h-6" />,
          title: 'Install Pitchey',
          description: 'Install for a better experience',
          instructions: [],
          buttonText: 'Install'
        };
    }
  };

  const installInfo = getInstallInstructions();

  if (isIOS && installInfo.instructions.length > 0) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 ${className}`}>
        <div className="p-4 max-w-md mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              {installInfo.icon}
              <div>
                <h3 className="font-semibold text-gray-900">{installInfo.title}</h3>
                <p className="text-sm text-gray-600">{installInfo.description}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <p className="text-sm text-gray-700 mb-2">How to install:</p>
            <ol className="text-sm text-gray-600 space-y-1">
              {installInfo.instructions.map((instruction, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-5 h-5 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center justify-center mr-2">
                    {index + 1}
                  </span>
                  {instruction}
                </li>
              ))}
            </ol>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={() => {
                // For iOS, just show the instructions and let user do it manually
                setShowPrompt(false);
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 z-50 ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {installInfo.icon}
            <div>
              <h3 className="font-semibold text-gray-900">{installInfo.title}</h3>
              <p className="text-sm text-gray-600">{installInfo.description}</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleInstallClick}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{installInfo.buttonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for PWA detection and utilities
export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if PWA is already installed
    const checkInstalled = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone ||
                       document.referrer.includes('android-app://');
      setIsInstalled(standalone);
    };

    checkInstalled();

    // Listen for install prompt availability
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      return outcome === 'accepted';
    } catch (error) {
      console.error('Install failed:', error);
      return false;
    }
  };

  return {
    isInstalled,
    isInstallable,
    install
  };
}