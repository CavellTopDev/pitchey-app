/**
 * Performance Monitoring System
 * Tracks and reports on application performance metrics
 */

interface PerformanceMetrics {
  pageLoad: number;
  apiLatency: Map<string, number[]>;
  renderTime: Map<string, number>;
  memoryUsage: number;
  errorRate: number;
  userInteractions: Map<string, number>;
}

interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private observers: Map<string, PerformanceObserver>;
  private thresholds: Map<string, PerformanceThreshold>;
  private reportInterval: number = 60000; // 1 minute
  private reportTimer?: NodeJS.Timeout;

  constructor() {
    this.metrics = {
      pageLoad: 0,
      apiLatency: new Map(),
      renderTime: new Map(),
      memoryUsage: 0,
      errorRate: 0,
      userInteractions: new Map(),
    };
    
    this.observers = new Map();
    this.thresholds = new Map();
    
    this.initializeThresholds();
    this.setupObservers();
    this.startReporting();
  }

  private initializeThresholds(): void {
    // Page load thresholds
    this.thresholds.set('pageLoad', {
      metric: 'pageLoad',
      warning: 3000, // 3 seconds
      critical: 5000, // 5 seconds
    });

    // API latency thresholds
    this.thresholds.set('apiLatency', {
      metric: 'apiLatency',
      warning: 1000, // 1 second
      critical: 3000, // 3 seconds
    });

    // Memory usage thresholds (in MB)
    this.thresholds.set('memoryUsage', {
      metric: 'memoryUsage',
      warning: 100, // 100MB
      critical: 200, // 200MB
    });

    // Error rate thresholds (errors per minute)
    this.thresholds.set('errorRate', {
      metric: 'errorRate',
      warning: 5,
      critical: 10,
    });
  }

  private setupObservers(): void {
    // Navigation timing observer
    if ('PerformanceObserver' in window) {
      // Navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const nav = entry as PerformanceNavigationTiming;
            this.metrics.pageLoad = nav.loadEventEnd - nav.fetchStart;
            this.checkThreshold('pageLoad', this.metrics.pageLoad);
          }
        });
      });

      try {
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.set('navigation', navigationObserver);
      } catch (e) {
        console.warn('Navigation observer not supported');
      }

      // Resource timing observer
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name.includes('/api/')) {
            const endpoint = this.extractEndpoint(entry.name);
            const latency = entry.duration;
            
            if (!this.metrics.apiLatency.has(endpoint)) {
              this.metrics.apiLatency.set(endpoint, []);
            }
            
            const latencies = this.metrics.apiLatency.get(endpoint)!;
            latencies.push(latency);
            
            // Keep only last 100 measurements
            if (latencies.length > 100) {
              latencies.shift();
            }
            
            this.checkThreshold('apiLatency', latency);
          }
        });
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);
      } catch (e) {
        console.warn('Resource observer not supported');
      }

      // Long task observer
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          console.warn(`Long task detected: ${entry.duration}ms`, {
            name: entry.name,
            startTime: entry.startTime,
          });
        });
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }

      // Layout shift observer
      const layoutShiftObserver = new PerformanceObserver((list) => {
        let cls = 0;
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        });
        
        if (cls > 0.1) {
          console.warn(`High CLS detected: ${cls}`);
        }
      });

      try {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layout-shift', layoutShiftObserver);
      } catch (e) {
        console.warn('Layout shift observer not supported');
      }
    }

    // Memory monitoring
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.metrics.memoryUsage = memory.usedJSHeapSize / 1048576; // Convert to MB
        this.checkThreshold('memoryUsage', this.metrics.memoryUsage);
      }, 10000); // Check every 10 seconds
    }
  }

  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  private checkThreshold(metric: string, value: number): void {
    const threshold = this.thresholds.get(metric);
    if (!threshold) return;

    if (value >= threshold.critical) {
      console.error(`Critical performance issue: ${metric} = ${value}ms (threshold: ${threshold.critical}ms)`);
      this.sendAlert('critical', metric, value);
    } else if (value >= threshold.warning) {
      console.warn(`Performance warning: ${metric} = ${value}ms (threshold: ${threshold.warning}ms)`);
      this.sendAlert('warning', metric, value);
    }
  }

  private sendAlert(level: 'warning' | 'critical', metric: string, value: number): void {
    // Send to monitoring service
    fetch('/api/monitoring/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        metric,
        value,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    }).catch(console.error);
  }

  private startReporting(): void {
    this.reportTimer = setInterval(() => {
      this.generateReport();
    }, this.reportInterval);
  }

  private generateReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      pageLoad: this.metrics.pageLoad,
      apiLatency: this.calculateAverageLatency(),
      memoryUsage: this.metrics.memoryUsage,
      errorRate: this.metrics.errorRate,
      topInteractions: this.getTopInteractions(),
      webVitals: this.getWebVitals(),
    };

    // Send to analytics
    this.sendReport(report);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance Report:', report);
    }
  }

  private calculateAverageLatency(): Record<string, number> {
    const averages: Record<string, number> = {};
    
    this.metrics.apiLatency.forEach((latencies, endpoint) => {
      if (latencies.length > 0) {
        const sum = latencies.reduce((a, b) => a + b, 0);
        averages[endpoint] = Math.round(sum / latencies.length);
      }
    });

    return averages;
  }

  private getTopInteractions(): Array<{ action: string; count: number }> {
    const interactions = Array.from(this.metrics.userInteractions.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return interactions;
  }

  private getWebVitals(): Record<string, number> {
    const vitals: Record<string, number> = {};

    // First Contentful Paint
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcp) {
      vitals.FCP = Math.round(fcp.startTime);
    }

    // Largest Contentful Paint
    const lcp = performance.getEntriesByType('largest-contentful-paint');
    if (lcp.length > 0) {
      const lastEntry = lcp[lcp.length - 1] as any;
      vitals.LCP = Math.round(lastEntry.renderTime || lastEntry.loadTime);
    }

    // Time to Interactive
    const tti = performance.getEntriesByName('time-to-interactive')[0];
    if (tti) {
      vitals.TTI = Math.round(tti.startTime);
    }

    return vitals;
  }

  private sendReport(report: any): void {
    // Send to analytics service
    fetch('/api/monitoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    }).catch(console.error);
  }

  // Public methods
  public trackInteraction(action: string): void {
    const count = this.metrics.userInteractions.get(action) || 0;
    this.metrics.userInteractions.set(action, count + 1);
  }

  public trackError(error: Error): void {
    this.metrics.errorRate++;
    
    // Send error to monitoring
    fetch('/api/monitoring/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      }),
    }).catch(console.error);
  }

  public trackApiCall(endpoint: string, duration: number): void {
    if (!this.metrics.apiLatency.has(endpoint)) {
      this.metrics.apiLatency.set(endpoint, []);
    }
    
    const latencies = this.metrics.apiLatency.get(endpoint)!;
    latencies.push(duration);
    
    if (latencies.length > 100) {
      latencies.shift();
    }
    
    this.checkThreshold('apiLatency', duration);
  }

  public trackRenderTime(component: string, duration: number): void {
    this.metrics.renderTime.set(component, duration);
    
    if (duration > 16) { // More than one frame (60fps)
      console.warn(`Slow render detected: ${component} took ${duration}ms`);
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public destroy(): void {
    // Clean up observers
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();

    // Clear report timer
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export function initializePerformanceMonitoring(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
}

export function getPerformanceMonitor(): PerformanceMonitor | null {
  return performanceMonitor;
}

// React hook for performance tracking
export function usePerformanceTracking(componentName: string) {
  const startTime = performance.now();

  return {
    trackRender: () => {
      const duration = performance.now() - startTime;
      performanceMonitor?.trackRenderTime(componentName, duration);
    },
    trackInteraction: (action: string) => {
      performanceMonitor?.trackInteraction(`${componentName}.${action}`);
    },
  };
}

// Higher-order component for automatic performance tracking
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return (props: P) => {
    const { trackRender } = usePerformanceTracking(componentName);
    
    React.useEffect(() => {
      trackRender();
    });

    return React.createElement(Component, props);
  };
}

export default PerformanceMonitor;