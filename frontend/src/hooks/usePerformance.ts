import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  componentName: string;
  timestamp: number;
}

interface UsePerformanceOptions {
  componentName: string;
  logThreshold?: number; // Only log if render time exceeds threshold (ms)
  enableConsoleLog?: boolean;
  onMetrics?: (metrics: PerformanceMetrics) => void;
}

/**
 * Hook for monitoring component performance
 * Tracks component render times and provides performance insights
 */
export const usePerformance = (options: UsePerformanceOptions) => {
  const {
    componentName,
    logThreshold = 16, // 16ms = 60fps threshold
    enableConsoleLog = process.env.NODE_ENV === 'development',
    onMetrics,
  } = options;

  const renderStartTime = useRef<number>(0);
  const mountTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  // Mark render start
  const markRenderStart = useCallback(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;
  }, []);

  // Mark render end and calculate metrics
  const markRenderEnd = useCallback(() => {
    if (renderStartTime.current === 0) return;

    const renderTime = performance.now() - renderStartTime.current;
    const loadTime = performance.now() - mountTime.current;

    const metrics: PerformanceMetrics = {
      renderTime,
      loadTime,
      componentName,
      timestamp: Date.now(),
    };

    // Log if threshold exceeded or in development
    if (enableConsoleLog && (renderTime > logThreshold || process.env.NODE_ENV === 'development')) {
      const level = renderTime > logThreshold ? 'warn' : 'info';
      console[level](`🎭 Performance [${componentName}]:`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        loadTime: `${loadTime.toFixed(2)}ms`,
        renderCount: renderCount.current,
        threshold: `${logThreshold}ms`,
        status: renderTime > logThreshold ? '⚠️ SLOW' : '✅ OK',
      });
    }

    // Call custom metrics handler
    onMetrics?.(metrics);

    renderStartTime.current = 0;
  }, [componentName, logThreshold, enableConsoleLog, onMetrics]);

  // Initialize mount time
  useEffect(() => {
    mountTime.current = performance.now();
    
    return () => {
      // Log final metrics on unmount
      if (enableConsoleLog) {
        console.log(`🔥 Component unmounted [${componentName}]:`, {
          totalRenders: renderCount.current,
          totalLifetime: `${(performance.now() - mountTime.current).toFixed(2)}ms`,
        });
      }
    };
  }, [componentName, enableConsoleLog]);

  return {
    markRenderStart,
    markRenderEnd,
    renderCount: renderCount.current,
  };
};

/**
 * Hook for monitoring Web Vitals and page performance
 */
export const useWebVitals = () => {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry) => {
        // Largest Contentful Paint
        if (entry.entryType === 'largest-contentful-paint') {
          console.log('🎯 LCP:', `${entry.startTime.toFixed(2)}ms`);
        }
        
        // First Input Delay
        if (entry.entryType === 'first-input') {
          const fid = entry.processingStart - entry.startTime;
          console.log('👆 FID:', `${fid.toFixed(2)}ms`);
        }
        
        // Cumulative Layout Shift
        if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
          console.log('📏 CLS:', entry.value);
        }
      });
    });

    // Observe different performance metrics
    try {
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      observer.observe({ entryTypes: ['first-input'] });
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('Performance observation not supported:', error);
    }

    return () => observer.disconnect();
  }, []);

  // Helper to measure custom metrics
  const measureCustomMetric = useCallback((name: string, fn: () => void | Promise<void>) => {
    const start = performance.now();
    
    const result = fn();
    
    if (result instanceof Promise) {
      return result.then(() => {
        const duration = performance.now() - start;
        console.log(`⏱️ ${name}:`, `${duration.toFixed(2)}ms`);
        return duration;
      });
    } else {
      const duration = performance.now() - start;
      console.log(`⏱️ ${name}:`, `${duration.toFixed(2)}ms`);
      return duration;
    }
  }, []);

  return {
    measureCustomMetric,
  };
};

/**
 * Hook for tracking long tasks that block the main thread
 */
export const useLongTaskObserver = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry) => {
        if (entry.entryType === 'longtask') {
          console.warn('🐌 Long Task detected:', {
            duration: `${entry.duration.toFixed(2)}ms`,
            startTime: `${entry.startTime.toFixed(2)}ms`,
            name: entry.name,
          });
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.warn('Long task observation not supported:', error);
    }

    return () => observer.disconnect();
  }, []);
};

/**
 * Hook for memory usage monitoring (Chrome only)
 */
export const useMemoryMonitor = () => {
  const checkMemory = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryInfo = {
        used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
        usage: `${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)}%`,
      };
      
      console.log('🧠 Memory Usage:', memoryInfo);
      return memoryInfo;
    } else {
      console.warn('Memory API not supported in this browser');
      return null;
    }
  }, []);

  useEffect(() => {
    // Log memory usage on mount in development
    if (process.env.NODE_ENV === 'development') {
      checkMemory();
    }
  }, [checkMemory]);

  return {
    checkMemory,
  };
};

/**
 * Performance monitoring component wrapper
 */
export const withPerformanceMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) => {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const PerformanceWrappedComponent = (props: P) => {
    const { markRenderStart, markRenderEnd } = usePerformance({
      componentName: displayName,
    });

    // Mark render start
    markRenderStart();

    useEffect(() => {
      // Mark render end after component updates
      markRenderEnd();
    });

    return <WrappedComponent {...props} />;
  };

  PerformanceWrappedComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  
  return PerformanceWrappedComponent;
};