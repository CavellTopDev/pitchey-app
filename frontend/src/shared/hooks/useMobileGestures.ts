/**
 * Mobile Gesture Hooks for Touch Interactions
 * Provides swipe, pinch, pull-to-refresh and other mobile gestures
 */

import { useRef, useCallback, useEffect } from 'react';

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
  duration: number;
}

export interface PinchGesture {
  scale: number;
  center: { x: number; y: number };
}

export interface GestureOptions {
  swipeThreshold?: number;
  swipeVelocityThreshold?: number;
  pinchThreshold?: number;
  preventDefaultTouch?: boolean;
  enablePullToRefresh?: boolean;
  pullToRefreshThreshold?: number;
}

const defaultOptions: GestureOptions = {
  swipeThreshold: 50,
  swipeVelocityThreshold: 0.5,
  pinchThreshold: 0.1,
  preventDefaultTouch: true,
  enablePullToRefresh: false,
  pullToRefreshThreshold: 100
};

export function useMobileGestures(
  onSwipe?: (gesture: SwipeGesture) => void,
  onPinch?: (gesture: PinchGesture) => void,
  onPullToRefresh?: () => void,
  options: GestureOptions = {}
) {
  const opts = { ...defaultOptions, ...options };
  
  const touchStartRef = useRef<TouchPoint[]>([]);
  const touchMoveRef = useRef<TouchPoint[]>([]);
  const lastPinchRef = useRef<number>(1);
  const isPinchingRef = useRef<boolean>(false);
  const pullStartYRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);

  const getDistance = useCallback((p1: TouchPoint, p2: TouchPoint): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }, []);

  const getCenter = useCallback((p1: TouchPoint, p2: TouchPoint): { x: number; y: number } => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (opts.preventDefaultTouch) {
      event.preventDefault();
    }

    const touches = Array.from(event.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    }));

    touchStartRef.current = touches;
    touchMoveRef.current = touches;
    
    // Reset states
    isPinchingRef.current = false;
    lastPinchRef.current = 1;
    
    // Initialize pull-to-refresh
    if (opts.enablePullToRefresh && touches.length === 1) {
      pullStartYRef.current = touches[0].y;
      isPullingRef.current = window.scrollY === 0; // Only enable if at top of page
    }
  }, [opts.preventDefaultTouch, opts.enablePullToRefresh]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (opts.preventDefaultTouch) {
      event.preventDefault();
    }

    const touches = Array.from(event.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    }));

    touchMoveRef.current = touches;

    // Handle pinch gesture
    if (touches.length === 2 && touchStartRef.current.length === 2) {
      const currentDistance = getDistance(touches[0], touches[1]);
      const startDistance = getDistance(touchStartRef.current[0], touchStartRef.current[1]);
      
      if (startDistance > 0) {
        const scale = currentDistance / startDistance;
        const scaleDiff = Math.abs(scale - lastPinchRef.current);
        
        if (scaleDiff > opts.pinchThreshold!) {
          isPinchingRef.current = true;
          const center = getCenter(touches[0], touches[1]);
          
          onPinch?.({
            scale,
            center
          });
          
          lastPinchRef.current = scale;
        }
      }
    }

    // Handle pull-to-refresh
    if (opts.enablePullToRefresh && isPullingRef.current && touches.length === 1) {
      const currentY = touches[0].y;
      const pullDistance = currentY - pullStartYRef.current;
      
      if (pullDistance > opts.pullToRefreshThreshold! && window.scrollY === 0) {
        // Trigger pull-to-refresh
        isPullingRef.current = false;
        onPullToRefresh?.();
      }
    }
  }, [opts.preventDefaultTouch, opts.enablePullToRefresh, opts.pinchThreshold, opts.pullToRefreshThreshold, getDistance, getCenter, onPinch, onPullToRefresh]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (opts.preventDefaultTouch) {
      event.preventDefault();
    }

    const touchEnd = Array.from(event.changedTouches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    }))[0];

    // Only process swipe if it wasn't a pinch gesture and we have start/end points
    if (!isPinchingRef.current && touchStartRef.current.length === 1 && touchEnd) {
      const touchStart = touchStartRef.current[0];
      const deltaX = touchEnd.x - touchStart.x;
      const deltaY = touchEnd.y - touchStart.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const duration = touchEnd.timestamp - touchStart.timestamp;
      const velocity = distance / duration;

      if (distance > opts.swipeThreshold! && velocity > opts.swipeVelocityThreshold!) {
        let direction: SwipeGesture['direction'];
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          direction = deltaY > 0 ? 'down' : 'up';
        }

        onSwipe?.({
          direction,
          distance,
          velocity,
          duration
        });
      }
    }

    // Reset pull-to-refresh state
    isPullingRef.current = false;
    
    // Clear touch data
    touchStartRef.current = [];
    touchMoveRef.current = [];
  }, [opts.preventDefaultTouch, opts.swipeThreshold, opts.swipeVelocityThreshold, onSwipe]);

  const bindGestures = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: !opts.preventDefaultTouch });
    element.addEventListener('touchmove', handleTouchMove, { passive: !opts.preventDefaultTouch });
    element.addEventListener('touchend', handleTouchEnd, { passive: !opts.preventDefaultTouch });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, opts.preventDefaultTouch]);

  return { bindGestures };
}

// Hook for swipe navigation
export function useSwipeNavigation(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  options: GestureOptions = {}
) {
  const handleSwipe = useCallback((gesture: SwipeGesture) => {
    switch (gesture.direction) {
      case 'left':
        onSwipeLeft?.();
        break;
      case 'right':
        onSwipeRight?.();
        break;
      case 'up':
        onSwipeUp?.();
        break;
      case 'down':
        onSwipeDown?.();
        break;
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return useMobileGestures(handleSwipe, undefined, undefined, options);
}

// Hook for pull-to-refresh
export function usePullToRefresh(
  onRefresh: () => void,
  options: Omit<GestureOptions, 'enablePullToRefresh'> = {}
) {
  return useMobileGestures(
    undefined,
    undefined,
    onRefresh,
    { ...options, enablePullToRefresh: true }
  );
}

// Hook for pinch-to-zoom
export function usePinchToZoom(
  onPinch: (scale: number, center: { x: number; y: number }) => void,
  options: GestureOptions = {}
) {
  const handlePinch = useCallback((gesture: PinchGesture) => {
    onPinch(gesture.scale, gesture.center);
  }, [onPinch]);

  return useMobileGestures(undefined, handlePinch, undefined, options);
}

// Hook for detecting long press
export function useLongPress(
  onLongPress: (event: { x: number; y: number }) => void,
  delay: number = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };

    timeoutRef.current = setTimeout(() => {
      if (touchStartRef.current) {
        onLongPress(touchStartRef.current);
      }
    }, delay);
  }, [onLongPress, delay]);

  const handleTouchEnd = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    touchStartRef.current = null;
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = event.touches[0];
    const distance = Math.sqrt(
      Math.pow(touch.clientX - touchStartRef.current.x, 2) +
      Math.pow(touch.clientY - touchStartRef.current.y, 2)
    );

    // Cancel long press if finger moves too much
    if (distance > 10) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, []);

  const bindLongPress = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchStart, handleTouchEnd, handleTouchMove]);

  return { bindLongPress };
}

// Hook for mobile viewport handling
export function useMobileViewport() {
  const setViewportHeight = useCallback(() => {
    // Set CSS custom property for actual viewport height
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }, []);

  useEffect(() => {
    setViewportHeight();
    
    const handleResize = () => {
      setViewportHeight();
    };

    const handleOrientationChange = () => {
      // Delay to ensure the viewport has updated
      setTimeout(setViewportHeight, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [setViewportHeight]);

  return { setViewportHeight };
}

// Hook for detecting mobile device capabilities
export function useMobileCapabilities() {
  const capabilities = {
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hasOrientation: 'orientation' in window,
    hasMotion: 'DeviceMotionEvent' in window,
    hasVibration: 'vibrate' in navigator,
    hasInstallPrompt: 'onbeforeinstallprompt' in window,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasNotifications: 'Notification' in window,
    hasGeolocation: 'geolocation' in navigator,
    hasCamera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
  };

  return capabilities;
}