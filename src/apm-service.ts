/**
 * Application Performance Monitoring (APM) Service for Pitchey Platform
 * Provides distributed tracing, performance metrics, and database monitoring
 */

import { Toucan } from "toucan-js";

// Enhanced tracing interfaces
interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  service: string;
  component?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'ok' | 'error' | 'timeout';
  tags: Record<string, string>;
  logs: SpanLog[];
  baggage?: Record<string, string>;
}

interface SpanLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  fields?: Record<string, any>;
}

interface Trace {
  traceId: string;
  spans: Span[];
  duration: number;
  startTime: number;
  endTime: number;
  services: string[];
  errorCount: number;
  status: 'success' | 'error' | 'timeout';
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  type: 'timer' | 'counter' | 'gauge' | 'histogram';
  unit?: string;
}

interface DatabaseMetrics {
  connectionPoolSize: number;
  activeConnections: number;
  idleConnections: number;
  queryCount: number;
  slowQueries: number;
  avgQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  errorRate: number;
  deadlocks: number;
  lockWaits: number;
}

interface WebVitals {
  url: string;
  sessionId: string;
  userId?: string;
  timestamp: number;
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  lcp: number; // Largest Contentful Paint
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
  inp: number; // Interaction to Next Paint
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionType: string;
}

export class APMService {
  private sentry: Toucan;
  private kv: any;
  private r2: any;

  constructor(sentry: Toucan, bindings: any) {
    this.sentry = sentry;
    this.kv = bindings.KV;
    this.r2 = bindings.R2_BUCKET;
  }

  /**
   * Start a new trace
   */
  startTrace(operation: string, service: string): string {
    const traceId = this.generateTraceId();
    
    // Store trace metadata
    const traceData = {
      traceId,
      operation,
      service,
      startTime: Date.now(),
      status: 'active'
    };

    this.kv.put(`trace:${traceId}`, JSON.stringify(traceData), { expirationTtl: 86400 });
    
    return traceId;
  }

  /**
   * Create a new span within a trace
   */
  async startSpan(traceId: string, operation: string, service: string, parentSpanId?: string): Promise<Span> {
    const span: Span = {
      traceId,
      spanId: this.generateSpanId(),
      parentSpanId,
      operation,
      service,
      startTime: Date.now(),
      status: 'ok',
      tags: {},
      logs: []
    };

    await this.kv.put(`span:${span.spanId}`, JSON.stringify(span), { expirationTtl: 86400 });
    
    return span;
  }

  /**
   * Finish a span and calculate duration
   */
  async finishSpan(spanId: string, status: 'ok' | 'error' | 'timeout' = 'ok', tags?: Record<string, string>): Promise<void> {
    try {
      const spanData = await this.kv.get(`span:${spanId}`);
      if (!spanData) return;

      const span: Span = JSON.parse(spanData);
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = status;
      if (tags) {
        span.tags = { ...span.tags, ...tags };
      }

      await this.kv.put(`span:${spanId}`, JSON.stringify(span), { expirationTtl: 86400 });

      // Update trace
      await this.updateTrace(span.traceId, span);

      // Record performance metrics
      await this.recordPerformanceMetric({
        name: 'span.duration',
        value: span.duration,
        timestamp: span.endTime!,
        tags: {
          operation: span.operation,
          service: span.service,
          status: span.status
        },
        type: 'timer',
        unit: 'ms'
      });

      // Send to Sentry for performance monitoring
      this.sentry.addBreadcrumb({
        message: `Span completed: ${span.operation}`,
        category: 'performance',
        level: span.status === 'error' ? 'error' : 'info',
        data: {
          spanId: span.spanId,
          traceId: span.traceId,
          duration: span.duration,
          status: span.status
        }
      });

    } catch (error) {
      this.sentry.captureException(error);
    }
  }

  /**
   * Add log to span
   */
  async addSpanLog(spanId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string, fields?: Record<string, any>): Promise<void> {
    try {
      const spanData = await this.kv.get(`span:${spanId}`);
      if (!spanData) return;

      const span: Span = JSON.parse(spanData);
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields
      });

      await this.kv.put(`span:${spanId}`, JSON.stringify(span), { expirationTtl: 86400 });

    } catch (error) {
      this.sentry.captureException(error);
    }
  }

  /**
   * Get complete trace with all spans
   */
  async getTrace(traceId: string): Promise<Trace | null> {
    try {
      const traceData = await this.kv.get(`trace:${traceId}`);
      if (!traceData) return null;

      const trace = JSON.parse(traceData);
      
      // Get all spans for this trace
      const spanKeys = await this.kv.list({ prefix: `span:` });
      const spans: Span[] = [];

      for (const key of spanKeys.keys) {
        const spanData = await this.kv.get(key.name);
        if (spanData) {
          const span: Span = JSON.parse(spanData);
          if (span.traceId === traceId) {
            spans.push(span);
          }
        }
      }

      // Calculate trace metrics
      const services = [...new Set(spans.map(s => s.service))];
      const errorCount = spans.filter(s => s.status === 'error').length;
      const startTime = Math.min(...spans.map(s => s.startTime));
      const endTime = Math.max(...spans.map(s => s.endTime || s.startTime));

      return {
        traceId,
        spans,
        duration: endTime - startTime,
        startTime,
        endTime,
        services,
        errorCount,
        status: errorCount > 0 ? 'error' : 'success'
      };

    } catch (error) {
      this.sentry.captureException(error);
      return null;
    }
  }

  /**
   * Record performance metric
   */
  async recordPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const key = `metrics:${metric.name}:${metric.timestamp}`;
      await this.kv.put(key, JSON.stringify(metric), { expirationTtl: 86400 * 7 });

      // Update aggregated metrics
      await this.updateAggregatedMetrics(metric);

    } catch (error) {
      this.sentry.captureException(error);
    }
  }

  /**
   * Record database metrics
   */
  async recordDatabaseMetrics(metrics: DatabaseMetrics): Promise<void> {
    try {
      const timestamp = Date.now();
      const key = `db-metrics:${timestamp}`;
      
      const dbMetricsData = {
        ...metrics,
        timestamp
      };

      await this.kv.put(key, JSON.stringify(dbMetricsData), { expirationTtl: 86400 * 7 });

      // Record individual metrics
      const metricPromises = [
        this.recordPerformanceMetric({
          name: 'db.connection_pool_size',
          value: metrics.connectionPoolSize,
          timestamp,
          tags: { component: 'database' },
          type: 'gauge'
        }),
        this.recordPerformanceMetric({
          name: 'db.active_connections',
          value: metrics.activeConnections,
          timestamp,
          tags: { component: 'database' },
          type: 'gauge'
        }),
        this.recordPerformanceMetric({
          name: 'db.query_time.avg',
          value: metrics.avgQueryTime,
          timestamp,
          tags: { component: 'database' },
          type: 'timer',
          unit: 'ms'
        }),
        this.recordPerformanceMetric({
          name: 'db.error_rate',
          value: metrics.errorRate,
          timestamp,
          tags: { component: 'database' },
          type: 'gauge'
        })
      ];

      await Promise.all(metricPromises);

    } catch (error) {
      this.sentry.captureException(error);
    }
  }

  /**
   * Record Web Vitals metrics
   */
  async recordWebVitals(vitals: WebVitals): Promise<void> {
    try {
      const key = `web-vitals:${vitals.sessionId}:${vitals.timestamp}`;
      await this.kv.put(key, JSON.stringify(vitals), { expirationTtl: 86400 * 30 });

      // Record individual Web Vitals metrics
      const metricPromises = [
        this.recordPerformanceMetric({
          name: 'web.cls',
          value: vitals.cls,
          timestamp: vitals.timestamp,
          tags: { 
            url: new URL(vitals.url).pathname,
            deviceType: vitals.deviceType,
            connection: vitals.connectionType
          },
          type: 'gauge'
        }),
        this.recordPerformanceMetric({
          name: 'web.fid',
          value: vitals.fid,
          timestamp: vitals.timestamp,
          tags: { 
            url: new URL(vitals.url).pathname,
            deviceType: vitals.deviceType
          },
          type: 'timer',
          unit: 'ms'
        }),
        this.recordPerformanceMetric({
          name: 'web.lcp',
          value: vitals.lcp,
          timestamp: vitals.timestamp,
          tags: { 
            url: new URL(vitals.url).pathname,
            deviceType: vitals.deviceType
          },
          type: 'timer',
          unit: 'ms'
        }),
        this.recordPerformanceMetric({
          name: 'web.ttfb',
          value: vitals.ttfb,
          timestamp: vitals.timestamp,
          tags: { 
            url: new URL(vitals.url).pathname,
            connection: vitals.connectionType
          },
          type: 'timer',
          unit: 'ms'
        })
      ];

      await Promise.all(metricPromises);

      // Send to Sentry
      this.sentry.addBreadcrumb({
        message: 'Web Vitals recorded',
        category: 'performance',
        level: 'info',
        data: {
          url: vitals.url,
          cls: vitals.cls,
          fid: vitals.fid,
          lcp: vitals.lcp,
          deviceType: vitals.deviceType
        }
      });

    } catch (error) {
      this.sentry.captureException(error);
    }
  }

  /**
   * Get performance metrics for a time range
   */
  async getPerformanceMetrics(metricName: string, startTime: number, endTime: number): Promise<PerformanceMetric[]> {
    try {
      const metrics: PerformanceMetric[] = [];
      const keys = await this.kv.list({ prefix: `metrics:${metricName}:` });

      for (const key of keys.keys) {
        const metricData = await this.kv.get(key.name);
        if (metricData) {
          const metric: PerformanceMetric = JSON.parse(metricData);
          if (metric.timestamp >= startTime && metric.timestamp <= endTime) {
            metrics.push(metric);
          }
        }
      }

      return metrics.sort((a, b) => a.timestamp - b.timestamp);

    } catch (error) {
      this.sentry.captureException(error);
      return [];
    }
  }

  /**
   * Get performance summary for dashboard
   */
  async getPerformanceSummary(timeWindow: number = 3600000): Promise<any> {
    try {
      const endTime = Date.now();
      const startTime = endTime - timeWindow;

      const [
        responseTimeMetrics,
        errorRateMetrics,
        dbMetrics,
        webVitals
      ] = await Promise.all([
        this.getPerformanceMetrics('response_time', startTime, endTime),
        this.getPerformanceMetrics('error_rate', startTime, endTime),
        this.getLatestDatabaseMetrics(),
        this.getWebVitalsSummary(startTime, endTime)
      ]);

      return {
        timeRange: { start: startTime, end: endTime },
        responseTime: {
          average: this.calculateAverage(responseTimeMetrics.map(m => m.value)),
          p95: this.calculatePercentile(responseTimeMetrics.map(m => m.value), 0.95),
          p99: this.calculatePercentile(responseTimeMetrics.map(m => m.value), 0.99)
        },
        errorRate: {
          current: errorRateMetrics.length > 0 ? errorRateMetrics[errorRateMetrics.length - 1].value : 0,
          average: this.calculateAverage(errorRateMetrics.map(m => m.value))
        },
        database: dbMetrics,
        webVitals: webVitals,
        timestamp: Date.now()
      };

    } catch (error) {
      this.sentry.captureException(error);
      return {
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Private helper methods

  private generateTraceId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  private async updateTrace(traceId: string, span: Span): Promise<void> {
    try {
      const traceData = await this.kv.get(`trace:${traceId}`);
      if (traceData) {
        const trace = JSON.parse(traceData);
        trace.lastUpdated = Date.now();
        if (span.status === 'error') {
          trace.hasErrors = true;
        }
        await this.kv.put(`trace:${traceId}`, JSON.stringify(trace), { expirationTtl: 86400 });
      }
    } catch (error) {
      console.warn('Failed to update trace:', error.message);
    }
  }

  private async updateAggregatedMetrics(metric: PerformanceMetric): Promise<void> {
    try {
      // Update 5-minute aggregation bucket
      const bucketStart = Math.floor(metric.timestamp / 300000) * 300000; // 5-minute buckets
      const bucketKey = `agg-metrics:${metric.name}:${bucketStart}`;
      
      let bucketData = await this.kv.get(bucketKey);
      const bucket = bucketData ? JSON.parse(bucketData) : {
        count: 0,
        sum: 0,
        min: Number.MAX_SAFE_INTEGER,
        max: Number.MIN_SAFE_INTEGER,
        values: []
      };

      bucket.count++;
      bucket.sum += metric.value;
      bucket.min = Math.min(bucket.min, metric.value);
      bucket.max = Math.max(bucket.max, metric.value);
      bucket.values.push(metric.value);
      bucket.lastUpdated = Date.now();

      await this.kv.put(bucketKey, JSON.stringify(bucket), { expirationTtl: 86400 });

    } catch (error) {
      console.warn('Failed to update aggregated metrics:', error.message);
    }
  }

  private async getLatestDatabaseMetrics(): Promise<DatabaseMetrics | null> {
    try {
      const keys = await this.kv.list({ prefix: 'db-metrics:' });
      if (keys.keys.length === 0) return null;

      // Get the latest metrics
      const latestKey = keys.keys.sort((a, b) => b.name.localeCompare(a.name))[0];
      const metricsData = await this.kv.get(latestKey.name);
      
      return metricsData ? JSON.parse(metricsData) : null;

    } catch (error) {
      this.sentry.captureException(error);
      return null;
    }
  }

  private async getWebVitalsSummary(startTime: number, endTime: number): Promise<any> {
    try {
      const keys = await this.kv.list({ prefix: 'web-vitals:' });
      const vitals: WebVitals[] = [];

      for (const key of keys.keys.slice(0, 100)) { // Limit for performance
        const vitalData = await this.kv.get(key.name);
        if (vitalData) {
          const vital: WebVitals = JSON.parse(vitalData);
          if (vital.timestamp >= startTime && vital.timestamp <= endTime) {
            vitals.push(vital);
          }
        }
      }

      if (vitals.length === 0) {
        return { cls: 0, fid: 0, lcp: 0, fcp: 0, ttfb: 0, sampleSize: 0 };
      }

      return {
        cls: this.calculatePercentile(vitals.map(v => v.cls), 0.75),
        fid: this.calculatePercentile(vitals.map(v => v.fid), 0.75),
        lcp: this.calculatePercentile(vitals.map(v => v.lcp), 0.75),
        fcp: this.calculatePercentile(vitals.map(v => v.fcp), 0.75),
        ttfb: this.calculatePercentile(vitals.map(v => v.ttfb), 0.75),
        sampleSize: vitals.length
      };

    } catch (error) {
      this.sentry.captureException(error);
      return { cls: 0, fid: 0, lcp: 0, fcp: 0, ttfb: 0, sampleSize: 0 };
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    return sorted[Math.min(index, sorted.length - 1)];
  }
}

/**
 * APM Worker
 * Handles HTTP requests for performance monitoring
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: {
        waitUntil: (promise: Promise<any>) => promise,
        request,
      },
      environment: env.ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE,
    });

    const apmService = new APMService(sentry, env);
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/apm/trace':
          if (request.method === 'POST') {
            const { operation, service } = await request.json();
            const traceId = apmService.startTrace(operation, service);
            return new Response(JSON.stringify({ traceId }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            const traceId = url.searchParams.get('traceId');
            if (!traceId) {
              return new Response('Missing traceId', { status: 400 });
            }
            const trace = await apmService.getTrace(traceId);
            return new Response(JSON.stringify(trace), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

        case '/apm/span':
          if (request.method === 'POST') {
            const spanData = await request.json();
            const span = await apmService.startSpan(
              spanData.traceId,
              spanData.operation,
              spanData.service,
              spanData.parentSpanId
            );
            return new Response(JSON.stringify(span), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/apm/span/finish':
          if (request.method === 'POST') {
            const { spanId, status, tags } = await request.json();
            await apmService.finishSpan(spanId, status, tags);
            return new Response('Span finished', { status: 200 });
          }
          break;

        case '/apm/metrics':
          if (request.method === 'POST') {
            const metric = await request.json();
            await apmService.recordPerformanceMetric(metric);
            return new Response('Metric recorded', { status: 201 });
          } else {
            const metricName = url.searchParams.get('name');
            const startTime = parseInt(url.searchParams.get('start') || '0');
            const endTime = parseInt(url.searchParams.get('end') || Date.now().toString());
            
            if (!metricName) {
              return new Response('Missing metric name', { status: 400 });
            }
            
            const metrics = await apmService.getPerformanceMetrics(metricName, startTime, endTime);
            return new Response(JSON.stringify(metrics), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

        case '/apm/web-vitals':
          if (request.method === 'POST') {
            const vitals = await request.json();
            await apmService.recordWebVitals(vitals);
            return new Response('Web Vitals recorded', { status: 201 });
          }
          break;

        case '/apm/db-metrics':
          if (request.method === 'POST') {
            const dbMetrics = await request.json();
            await apmService.recordDatabaseMetrics(dbMetrics);
            return new Response('Database metrics recorded', { status: 201 });
          }
          break;

        case '/apm/summary':
          const timeWindow = parseInt(url.searchParams.get('timeWindow') || '3600000');
          const summary = await apmService.getPerformanceSummary(timeWindow);
          return new Response(JSON.stringify(summary), {
            headers: { 'Content-Type': 'application/json' }
          });

        default:
          return new Response('APM endpoint not found', { status: 404 });
      }

    } catch (error) {
      sentry.captureException(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};