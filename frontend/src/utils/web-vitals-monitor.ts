/**
 * Web Vitals and Performance Monitoring for Pitchey Platform
 * Collects Core Web Vitals and performance metrics from the frontend
 */

import { onCLS, onFID, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals';

interface ExtendedWebVitals {
  cls: number;
  fid: number;
  fcp: number;
  lcp: number;
  ttfb: number;
  inp: number;
  sessionId: string;
  userId?: string;
  url: string;
  timestamp: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionType: string;
  pageLoadTime: number;
  domContentLoadedTime: number;
  resourceTimings: ResourceTiming[];
  navigationTiming: NavigationTiming;
  customMetrics?: Record<string, number>;
}

interface ResourceTiming {
  name: string;
  duration: number;
  size: number;
  type: string;
  cached: boolean;
}

interface NavigationTiming {
  dnsLookup: number;
  tcpConnect: number;
  tlsConnect: number;
  requestTime: number;
  responseTime: number;
  domProcessing: number;
  loadComplete: number;
}

interface PerformanceAlert {
  type: 'cls' | 'fid' | 'lcp' | 'fcp' | 'ttfb' | 'inp' | 'custom';
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  url: string;
  timestamp: number;
}

class WebVitalsMonitor {
  private sessionId: string;
  private userId?: string;
  private vitalsData: Partial<ExtendedWebVitals> = {};
  private customMetrics: Record<string, number> = {};
  private performanceObserver: PerformanceObserver | null = null;
  private isMonitoring = false;
  private apiEndpoint = import.meta.env.VITE_API_URL || 'http://localhost:8001';

  // Web Vitals thresholds (Google recommended)
  private thresholds = {
    cls: { good: 0.1, poor: 0.25 },
    fid: { good: 100, poor: 300 },
    lcp: { good: 2500, poor: 4000 },
    fcp: { good: 1800, poor: 3000 },
    ttfb: { good: 800, poor: 1800 },
    inp: { good: 200, poor: 500 }
  };

  constructor(userId?: string) {
    this.sessionId = this.generateSessionId();
    this.userId = userId;
    this.initializeMonitoring();
  }

  /**
   * Initialize Web Vitals monitoring
   */
  public initializeMonitoring(): void {
    if (this.isMonitoring) return;

    try {
      // Collect Core Web Vitals
      this.collectCoreWebVitals();
      
      // Collect additional performance metrics
      this.collectNavigationTiming();
      this.collectResourceTiming();
      this.collectCustomMetrics();
      
      // Set up performance observer for ongoing monitoring
      this.setupPerformanceObserver();
      
      // Send initial page load metrics
      this.scheduleInitialReport();
      
      // Set up periodic reporting
      this.setupPeriodicReporting();
      
      this.isMonitoring = true;
      
      console.log('Web Vitals monitoring initialized');
      
    } catch (error) {
      console.error('Failed to initialize Web Vitals monitoring:', error);
    }
  }

  /**
   * Collect Core Web Vitals metrics
   */
  private collectCoreWebVitals(): void {
    // Cumulative Layout Shift
    onCLS((metric: Metric) => {
      this.vitalsData.cls = metric.value;
      this.checkThreshold('cls', metric.value);
    });

    // First Input Delay
    onFID((metric: Metric) => {
      this.vitalsData.fid = metric.value;
      this.checkThreshold('fid', metric.value);
    });

    // First Contentful Paint
    onFCP((metric: Metric) => {
      this.vitalsData.fcp = metric.value;
      this.checkThreshold('fcp', metric.value);
    });

    // Largest Contentful Paint
    onLCP((metric: Metric) => {
      this.vitalsData.lcp = metric.value;
      this.checkThreshold('lcp', metric.value);
    });

    // Time to First Byte
    onTTFB((metric: Metric) => {
      this.vitalsData.ttfb = metric.value;
      this.checkThreshold('ttfb', metric.value);
    });

    // Interaction to Next Paint
    onINP((metric: Metric) => {
      this.vitalsData.inp = metric.value;
      this.checkThreshold('inp', metric.value);
    });
  }

  /**
   * Collect navigation timing metrics
   */
  private collectNavigationTiming(): void {
    if (!performance.getEntriesByType) return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return;

    this.vitalsData.navigationTiming = {
      dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcpConnect: navigation.connectEnd - navigation.connectStart,
      tlsConnect: navigation.secureConnectionStart > 0 ? 
        navigation.connectEnd - navigation.secureConnectionStart : 0,
      requestTime: navigation.responseStart - navigation.requestStart,
      responseTime: navigation.responseEnd - navigation.responseStart,
      domProcessing: navigation.domContentLoadedEventEnd - navigation.responseEnd,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart
    };

    this.vitalsData.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
    this.vitalsData.domContentLoadedTime = navigation.domContentLoadedEventEnd - navigation.fetchStart;
  }

  /**
   * Collect resource timing metrics
   */
  private collectResourceTiming(): void {
    if (!performance.getEntriesByType) return;

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    this.vitalsData.resourceTimings = resources.map(resource => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize || 0,
      type: this.getResourceType(resource.name),
      cached: resource.transferSize === 0 && resource.decodedBodySize > 0
    })).filter(resource => resource.duration > 0);
  }

  /**
   * Collect custom performance metrics
   */
  private collectCustomMetrics(): void {
    // Time to Interactive (TTI) estimation
    this.customMetrics.tti = this.estimateTimeToInteractive();
    
    // Memory usage (if available)
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      this.customMetrics.memoryUsed = memory.usedJSHeapSize;
      this.customMetrics.memoryLimit = memory.jsHeapSizeLimit;
      this.customMetrics.memoryUtilization = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    }

    // Connection information
    if ((navigator as any).connection) {
      const connection = (navigator as any).connection;
      this.vitalsData.connectionType = connection.effectiveType || 'unknown';
    } else {
      this.vitalsData.connectionType = 'unknown';
    }

    // Device type detection
    this.vitalsData.deviceType = this.detectDeviceType();
  }

  /**
   * Set up Performance Observer for ongoing monitoring
   */
  private setupPerformanceObserver(): void {
    if (!PerformanceObserver) return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });

      // Observe different types of performance entries
      this.performanceObserver.observe({ 
        entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'navigation', 'resource']
      });

    } catch (error) {
      console.warn('Performance Observer not supported or failed to setup:', error);
    }
  }

  /**
   * Process individual performance entries
   */
  private processPerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'largest-contentful-paint':
        this.trackLargestContentfulPaint(entry as PerformanceEntry & { startTime: number });
        break;
      case 'first-input':
        this.trackFirstInputDelay(entry as PerformanceEventTiming);
        break;
      case 'layout-shift':
        this.trackLayoutShift(entry as PerformanceEntry & { value: number });
        break;
    }
  }

  /**
   * Track Largest Contentful Paint updates
   */
  private trackLargestContentfulPaint(entry: PerformanceEntry & { startTime: number }): void {
    this.customMetrics.lcpUpdates = (this.customMetrics.lcpUpdates || 0) + 1;
    this.customMetrics.latestLCP = entry.startTime;
  }

  /**
   * Track First Input Delay
   */
  private trackFirstInputDelay(entry: PerformanceEventTiming): void {
    this.customMetrics.firstInputDelay = entry.processingStart - entry.startTime;
  }

  /**
   * Track Layout Shifts
   */
  private trackLayoutShift(entry: PerformanceEntry & { value: number }): void {
    this.customMetrics.layoutShifts = (this.customMetrics.layoutShifts || 0) + 1;
    this.customMetrics.totalLayoutShift = (this.customMetrics.totalLayoutShift || 0) + entry.value;
  }

  /**
   * Send metrics to monitoring backend
   */
  public async sendMetrics(): Promise<void> {
    try {
      const vitalsData: ExtendedWebVitals = {
        cls: this.vitalsData.cls || 0,
        fid: this.vitalsData.fid || 0,
        fcp: this.vitalsData.fcp || 0,
        lcp: this.vitalsData.lcp || 0,
        ttfb: this.vitalsData.ttfb || 0,
        inp: this.vitalsData.inp || 0,
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
        timestamp: Date.now(),
        deviceType: this.vitalsData.deviceType || 'desktop',
        connectionType: this.vitalsData.connectionType || 'unknown',
        pageLoadTime: this.vitalsData.pageLoadTime || 0,
        domContentLoadedTime: this.vitalsData.domContentLoadedTime || 0,
        resourceTimings: this.vitalsData.resourceTimings || [],
        navigationTiming: this.vitalsData.navigationTiming || {
          dnsLookup: 0, tcpConnect: 0, tlsConnect: 0,
          requestTime: 0, responseTime: 0, domProcessing: 0, loadComplete: 0
        },
        customMetrics: this.customMetrics
      };

      await 
      credentials: 'include', // Send cookies for Better Auth session
      
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vitalsData),
      });

      console.log('Web Vitals sent successfully');

    } catch (error) {
      console.error('Failed to send Web Vitals:', error);
    }
  }

  /**
   * Record custom metric
   */
  public recordCustomMetric(name: string, value: number): void {
    this.customMetrics[name] = value;
    
    // Check if this is a performance-critical metric
    if (value > 1000) { // Example threshold
      this.triggerPerformanceAlert('custom', name, value, 1000);
    }
  }

  /**
   * Start performance measurement
   */
  public startMeasurement(name: string): void {
    performance.mark(`${name}-start`);
  }

  /**
   * End performance measurement
   */
  public endMeasurement(name: string): number {
    try {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name, 'measure')[0];
      const duration = measure.duration;
      
      this.recordCustomMetric(name, duration);
      
      // Clean up marks and measures
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);
      performance.clearMeasures(name);
      
      return duration;
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error);
      return 0;
    }
  }

  /**
   * Get current Web Vitals summary
   */
  public getVitalsSummary(): Record<string, any> {
    return {
      cls: this.vitalsData.cls,
      fid: this.vitalsData.fid,
      fcp: this.vitalsData.fcp,
      lcp: this.vitalsData.lcp,
      ttfb: this.vitalsData.ttfb,
      inp: this.vitalsData.inp,
      customMetrics: this.customMetrics,
      ratings: this.getVitalsRatings()
    };
  }

  /**
   * Get vitals ratings (good/needs-improvement/poor)
   */
  private getVitalsRatings(): Record<string, string> {
    const ratings: Record<string, string> = {};
    
    Object.keys(this.thresholds).forEach(vital => {
      const value = this.vitalsData[vital as keyof typeof this.vitalsData] as number;
      if (value !== undefined) {
        const threshold = this.thresholds[vital as keyof typeof this.thresholds];
        if (value <= threshold.good) {
          ratings[vital] = 'good';
        } else if (value <= threshold.poor) {
          ratings[vital] = 'needs-improvement';
        } else {
          ratings[vital] = 'poor';
        }
      }
    });
    
    return ratings;
  }

  /**
   * Check threshold and trigger alerts
   */
  private checkThreshold(vital: string, value: number): void {
    const threshold = this.thresholds[vital as keyof typeof this.thresholds];
    if (!threshold) return;

    let severity: 'warning' | 'critical' | null = null;
    
    if (value > threshold.poor) {
      severity = 'critical';
    } else if (value > threshold.good) {
      severity = 'warning';
    }

    if (severity) {
      this.triggerPerformanceAlert(vital as any, vital, value, threshold.good);
    }
  }

  /**
   * Trigger performance alert
   */
  private async triggerPerformanceAlert(
    type: PerformanceAlert['type'], 
    metric: string,
    value: number, 
    threshold: number
  ): Promise<void> {
    try {
      const alert: PerformanceAlert = {
        type,
        value,
        threshold,
        severity: value > threshold * 2 ? 'critical' : 'warning',
        url: window.location.href,
        timestamp: Date.now()
      };

      await 
      credentials: 'include', // Send cookies for Better Auth session
      
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
          type: alert.severity,
          title: `Performance Alert: ${metric.toUpperCase()}`,
          message: `${metric} threshold exceeded: ${value.toFixed(2)}ms (threshold: ${threshold}ms)`,
          source: 'web-vitals',
          component: 'frontend',
          context: {
            metric,
            value,
            threshold,
            url: window.location.href,
            sessionId: this.sessionId,
            userId: this.userId
          },
          tags: {
            type: 'performance',
            metric,
            severity: alert.severity
          }
        })
      });

    } catch (error) {
      console.error('Failed to send performance alert:', error);
    }
  }

  // Private helper methods

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateTimeToInteractive(): number {
    if (!performance.timing) return 0;
    
    // Simple TTI estimation based on load events
    return performance.timing.domInteractive - performance.timing.navigationStart;
  }

  private getResourceType(url: string): string {
    if (url.match(/\.(css)$/i)) return 'stylesheet';
    if (url.match(/\.(js)$/i)) return 'script';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
    if (url.includes('/api/')) return 'xhr';
    return 'other';
  }

  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private scheduleInitialReport(): void {
    // Send initial metrics after page load is complete
    setTimeout(() => {
      this.sendMetrics();
    }, 2000);
  }

  private setupPeriodicReporting(): void {
    // Send metrics periodically (every 30 seconds while user is active)
    let lastActivity = Date.now();
    
    // Track user activity
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        lastActivity = Date.now();
      }, { passive: true });
    });

    // Periodic reporting
    setInterval(() => {
      // Only send if user has been active in the last minute
      if (Date.now() - lastActivity < 60000) {
        this.sendMetrics();
      }
    }, 30000);

    // Send metrics before page unload
    window.addEventListener('beforeunload', () => {
      this.sendMetrics();
    });

    // Send metrics when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendMetrics();
      }
    });
  }

  /**
   * Cleanup monitoring
   */
  public cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    this.isMonitoring = false;
  }
}

// Create singleton instance
export const webVitalsMonitor = new WebVitalsMonitor();

// Initialize on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    webVitalsMonitor.initializeMonitoring();
  });
}

export default webVitalsMonitor;