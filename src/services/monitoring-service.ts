/**
 * Comprehensive Monitoring and Observability Service
 * Integrates with Sentry, Cloudflare Analytics, and custom metrics
 */

import * as Sentry from '@sentry/browser';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  unit?: string;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  parentId?: string;
  operation: string;
  description?: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error' | 'cancelled';
  tags?: Record<string, any>;
  data?: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: number;
  metadata?: Record<string, any>;
}

/**
 * Main monitoring service
 */
export class MonitoringService {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private traces: Map<string, TraceSpan> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private analyticsQueue: any[] = [];
  private flushInterval: number = 10000; // 10 seconds
  private flushTimer?: number;

  constructor(private config: {
    sentryDsn?: string;
    environment?: string;
    analyticsEndpoint?: string;
    enableTracing?: boolean;
    sampleRate?: number;
  }) {
    this.initialize();
  }

  /**
   * Initialize monitoring services
   */
  private initialize() {
    // Initialize Sentry
    if (this.config.sentryDsn) {
      Sentry.init({
        dsn: this.config.sentryDsn,
        environment: this.config.environment || 'production',
        tracesSampleRate: this.config.sampleRate || 0.1,
        integrations: [
          new Sentry.BrowserTracing(),
        ],
      });
    }

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    unit?: string
  ): void {
    const metric: MetricPoint = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      unit
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push(metric);

    // Keep only last 1000 points per metric
    const points = this.metrics.get(name)!;
    if (points.length > 1000) {
      points.shift();
    }
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.recordMetric(name, value, tags, 'count');
  }

  /**
   * Record a timing metric
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.recordMetric(name, duration, tags, 'milliseconds');
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, tags, 'gauge');
  }

  /**
   * Start a trace span
   */
  startSpan(operation: string, description?: string): TraceSpan {
    const span: TraceSpan = {
      id: this.generateId(),
      traceId: this.generateId(),
      operation,
      description,
      startTime: Date.now(),
      status: 'ok'
    };

    this.traces.set(span.id, span);
    
    // Sentry integration
    if (this.config.enableTracing) {
      const transaction = Sentry.startTransaction({
        op: operation,
        name: description || operation,
      });
      (span as any).sentrySpan = transaction;
    }

    return span;
  }

  /**
   * End a trace span
   */
  endSpan(spanId: string, status?: 'ok' | 'error' | 'cancelled'): void {
    const span = this.traces.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    if (status) span.status = status;

    // Calculate duration
    const duration = span.endTime - span.startTime;
    this.timing(`span.duration.${span.operation}`, duration, span.tags);

    // Sentry integration
    if ((span as any).sentrySpan) {
      (span as any).sentrySpan.finish();
    }
  }

  /**
   * Log an error
   */
  logError(error: Error, context?: Record<string, any>): void {
    console.error('Error:', error, context);

    // Record error metric
    this.increment('errors', 1, {
      name: error.name,
      message: error.message.substring(0, 100)
    });

    // Send to Sentry
    if (this.config.sentryDsn) {
      Sentry.captureException(error, {
        extra: context
      });
    }

    // Add to analytics queue
    this.analyticsQueue.push({
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Log a custom event
   */
  logEvent(name: string, data?: Record<string, any>): void {
    this.increment('events.' + name, 1);

    // Send to analytics
    this.analyticsQueue.push({
      type: 'event',
      name,
      data,
      timestamp: Date.now()
    });

    // Send to Sentry as breadcrumb
    if (this.config.sentryDsn) {
      Sentry.addBreadcrumb({
        type: 'default',
        category: 'custom',
        message: name,
        data
      });
    }
  }

  /**
   * Register a health check
   */
  registerHealthCheck(
    name: string,
    checker: () => Promise<{ healthy: boolean; message?: string; metadata?: any }>
  ): void {
    // Run the health check immediately
    checker().then(result => {
      this.healthChecks.set(name, {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        message: result.message,
        lastCheck: Date.now(),
        metadata: result.metadata
      });
    }).catch(error => {
      this.healthChecks.set(name, {
        name,
        status: 'unhealthy',
        message: error.message,
        lastCheck: Date.now()
      });
    });
  }

  /**
   * Get all health checks
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get overall health status
   */
  getHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const checks = this.getHealthChecks();
    
    if (checks.some(c => c.status === 'unhealthy')) {
      return 'unhealthy';
    }
    
    if (checks.some(c => c.status === 'degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    for (const [name, points] of this.metrics.entries()) {
      if (points.length === 0) continue;

      const values = points.map(p => p.value);
      summary[name] = {
        count: points.length,
        sum: values.reduce((a, b) => a + b, 0),
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        latest: points[points.length - 1].value
      };
    }

    return summary;
  }

  /**
   * Flush metrics and analytics
   */
  async flush(): Promise<void> {
    if (this.analyticsQueue.length === 0) return;

    try {
      if (this.config.analyticsEndpoint) {
        const response = await fetch(this.config.analyticsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            events: this.analyticsQueue,
            metrics: this.getMetricsSummary(),
            health: this.getHealthStatus()
          })
        });

        if (response.ok) {
          this.analyticsQueue = [];
        }
      }
    } catch (error) {
      console.error('Failed to flush analytics:', error);
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval) as any;
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Final flush
    this.flush().catch(console.error);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

/**
 * Performance monitoring wrapper
 */
export class PerformanceMonitor {
  constructor(private monitoring: MonitoringService) {}

  /**
   * Measure async function performance
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = performance.now();
    const span = this.monitoring.startSpan('function', name);
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      this.monitoring.timing(`function.${name}`, duration, tags);
      this.monitoring.endSpan(span.id, 'ok');
      
      return result;
    } catch (error) {
      this.monitoring.endSpan(span.id, 'error');
      this.monitoring.logError(error as Error, { function: name, tags });
      throw error;
    }
  }

  /**
   * Measure HTTP request
   */
  async measureRequest(
    request: Request,
    handler: () => Promise<Response>
  ): Promise<Response> {
    const url = new URL(request.url);
    const tags = {
      method: request.method,
      path: url.pathname
    };

    const start = performance.now();
    const span = this.monitoring.startSpan('http.request', `${request.method} ${url.pathname}`);

    try {
      const response = await handler();
      const duration = performance.now() - start;

      this.monitoring.timing('http.request.duration', duration, {
        ...tags,
        status: String(response.status)
      });

      this.monitoring.increment('http.requests', 1, {
        ...tags,
        status: String(response.status)
      });

      this.monitoring.endSpan(span.id, response.ok ? 'ok' : 'error');

      return response;
    } catch (error) {
      this.monitoring.endSpan(span.id, 'error');
      this.monitoring.logError(error as Error, tags);
      throw error;
    }
  }
}

/**
 * Cloudflare Analytics Integration
 */
export class CloudflareAnalytics {
  constructor(private accountId: string, private apiToken: string) {}

  /**
   * Get analytics data
   */
  async getAnalytics(zone: string, since: Date, until: Date): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `
            SELECT 
              timestamp,
              avg(double1) as avg_response_time,
              sum(double2) as total_requests,
              sum(double3) as error_count
            FROM analytics_engine_data
            WHERE 
              zone = '${zone}' AND
              timestamp >= '${since.toISOString()}' AND
              timestamp <= '${until.toISOString()}'
            GROUP BY timestamp
            ORDER BY timestamp DESC
          `
        })
      }
    );

    return response.json();
  }

  /**
   * Log custom analytics event
   */
  async logEvent(data: Record<string, any>): Promise<void> {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/analytics_engine/write`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          events: [{
            ...data,
            timestamp: new Date().toISOString()
          }]
        })
      }
    );
  }
}