/**
 * Metrics API for Performance Dashboard
 * Provides real-time and historical performance metrics
 */

import { EdgeCacheLayer } from './worker-cache-layer.ts';
import { Toucan } from 'toucan-js';

export class MetricsAPI {
  constructor(
    private kv: KVNamespace | null,
    private analytics: AnalyticsEngineDataset | null,
    private cache: EdgeCacheLayer | null,
    private sentry?: Toucan
  ) {}

  /**
   * Get current real-time metrics
   */
  async getCurrentMetrics(env: any): Promise<Response> {
    try {
      // Collect metrics from various sources
      const metrics = await this.collectCurrentMetrics(env);
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: Date.now(),
        ...metrics
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Failed to get current metrics:', error);
      return this.errorResponse('Failed to fetch metrics', 500);
    }
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(period: string = '24h'): Promise<Response> {
    try {
      const data = await this.fetchHistoricalData(period);
      
      return new Response(JSON.stringify({
        success: true,
        period,
        data,
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=60',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Failed to get historical metrics:', error);
      return this.errorResponse('Failed to fetch historical metrics', 500);
    }
  }

  /**
   * Get endpoint-specific metrics
   */
  async getEndpointMetrics(endpoint: string): Promise<Response> {
    try {
      const metrics = await this.fetchEndpointMetrics(endpoint);
      
      return new Response(JSON.stringify({
        success: true,
        endpoint,
        metrics,
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=30',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Failed to get endpoint metrics:', error);
      return this.errorResponse('Failed to fetch endpoint metrics', 500);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<Response> {
    try {
      const stats = this.cache ? this.cache.getStats() : null;
      
      return new Response(JSON.stringify({
        success: true,
        enabled: !!this.cache,
        stats,
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return this.errorResponse('Failed to fetch cache statistics', 500);
    }
  }

  /**
   * Get database pool statistics
   */
  async getPoolStats(env: any): Promise<Response> {
    try {
      const { dbPool } = await import('./worker-database-pool-enhanced.ts');
      const stats = dbPool.getStats();
      
      return new Response(JSON.stringify({
        success: true,
        stats,
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Failed to get pool stats:', error);
      return this.errorResponse('Failed to fetch pool statistics', 500);
    }
  }

  /**
   * Get alerting status
   */
  async getAlertStatus(): Promise<Response> {
    try {
      const alerts = await this.fetchActiveAlerts();
      
      return new Response(JSON.stringify({
        success: true,
        alerts,
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Failed to get alert status:', error);
      return this.errorResponse('Failed to fetch alert status', 500);
    }
  }

  // Private methods

  private async collectCurrentMetrics(env: any): Promise<any> {
    const metrics: any = {
      responseTime: {
        p50: 0,
        p95: 0,
        p99: 0
      },
      errorRate: 0,
      requestsPerSecond: 0,
      cacheHitRate: 0,
      activeConnections: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };

    // Get response time metrics from KV
    if (this.kv) {
      try {
        const perfData = await this.kv.get('performance_metrics', 'json');
        if (perfData) {
          metrics.responseTime = perfData.responseTime || metrics.responseTime;
        }
      } catch (error) {
        console.error('Failed to get performance metrics from KV:', error);
      }
    }

    // Get cache stats
    if (this.cache) {
      const cacheStats = this.cache.getStats();
      metrics.cacheHitRate = cacheStats.hitRate || 0;
    }

    // Get connection pool stats
    try {
      const { dbPool } = await import('./worker-database-pool-enhanced.ts');
      const poolStats = dbPool.getStats();
      metrics.activeConnections = poolStats.activeConnections || 0;
    } catch (error) {
      console.error('Failed to get pool stats:', error);
    }

    // Calculate error rate from recent requests
    if (this.kv) {
      try {
        const errorData = await this.kv.get('error_metrics', 'json');
        if (errorData) {
          const totalRequests = errorData.total || 1;
          const errorCount = errorData.errors || 0;
          metrics.errorRate = (errorCount / totalRequests) * 100;
        }
      } catch (error) {
        console.error('Failed to calculate error rate:', error);
      }
    }

    // Calculate requests per second
    if (this.kv) {
      try {
        const requestData = await this.kv.get('request_metrics', 'json');
        if (requestData) {
          metrics.requestsPerSecond = requestData.rps || 0;
        }
      } catch (error) {
        console.error('Failed to get request metrics:', error);
      }
    }

    // Simulate CPU and memory usage (in production, get from monitoring service)
    metrics.cpuUsage = 30 + Math.random() * 20;
    metrics.memoryUsage = 40 + Math.random() * 15;

    return metrics;
  }

  private async fetchHistoricalData(period: string): Promise<any[]> {
    const data = [];
    const now = Date.now();
    const periodMs = this.parsePeriod(period);
    const interval = periodMs / 100; // 100 data points

    // Generate sample historical data (in production, fetch from time-series DB)
    for (let i = 0; i < 100; i++) {
      const timestamp = now - periodMs + (i * interval);
      data.push({
        timestamp,
        responseTime: {
          p50: 80 + Math.random() * 40,
          p95: 200 + Math.random() * 100,
          p99: 400 + Math.random() * 200
        },
        errorRate: Math.random() * 2,
        requestsPerSecond: 100 + Math.random() * 50,
        cacheHitRate: 75 + Math.random() * 20,
        activeConnections: 10 + Math.floor(Math.random() * 20)
      });
    }

    return data;
  }

  private async fetchEndpointMetrics(endpoint: string): Promise<any> {
    // In production, fetch from analytics service
    return {
      endpoint,
      totalCalls: Math.floor(Math.random() * 10000),
      avgResponseTime: 100 + Math.random() * 200,
      p50: 80 + Math.random() * 40,
      p95: 200 + Math.random() * 100,
      p99: 400 + Math.random() * 200,
      errorRate: Math.random() * 2,
      successRate: 98 + Math.random() * 2,
      lastHour: {
        calls: Math.floor(Math.random() * 1000),
        errors: Math.floor(Math.random() * 10)
      }
    };
  }

  private async fetchActiveAlerts(): Promise<any[]> {
    const alerts = [];

    // Check for active alerts in KV
    if (this.kv) {
      try {
        const alertData = await this.kv.get('active_alerts', 'json');
        if (alertData && Array.isArray(alertData)) {
          return alertData;
        }
      } catch (error) {
        console.error('Failed to fetch alerts from KV:', error);
      }
    }

    return alerts;
  }

  private parsePeriod(period: string): number {
    const match = period.match(/(\d+)([hdm])/);
    if (!match) return 86400000; // Default 24 hours

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h': return value * 3600000;
      case 'd': return value * 86400000;
      case 'm': return value * 60000;
      default: return 86400000;
    }
  }

  private errorResponse(message: string, status: number): Response {
    return new Response(JSON.stringify({
      success: false,
      error: message,
      timestamp: Date.now()
    }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Metrics collection middleware
export async function collectMetrics(
  request: Request,
  response: Response,
  env: any,
  ctx: ExecutionContext
): Promise<void> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const endpoint = url.pathname;

  // Wait for response to complete
  ctx.waitUntil((async () => {
    const duration = Date.now() - startTime;
    const status = response.status;
    const isError = status >= 400;

    // Store metrics in KV
    if (env.METRICS_KV) {
      try {
        // Update request metrics
        const requestKey = `requests_${Date.now()}`;
        await env.METRICS_KV.put(requestKey, JSON.stringify({
          endpoint,
          duration,
          status,
          isError,
          timestamp: Date.now()
        }), { expirationTtl: 3600 });

        // Update aggregate metrics
        const aggregateKey = `aggregate_${endpoint.replace(/\//g, '_')}`;
        const existing = await env.METRICS_KV.get(aggregateKey, 'json') || {
          total: 0,
          errors: 0,
          totalDuration: 0
        };

        existing.total++;
        if (isError) existing.errors++;
        existing.totalDuration += duration;

        await env.METRICS_KV.put(aggregateKey, JSON.stringify(existing), {
          expirationTtl: 86400
        });

        // Update performance percentiles
        await updatePercentiles(env.METRICS_KV, duration);

      } catch (error) {
        console.error('Failed to store metrics:', error);
      }
    }

    // Send to Analytics Engine if available
    if (env.ANALYTICS) {
      env.ANALYTICS.writeDataPoint({
        doubles: [duration, isError ? 1 : 0],
        blobs: [endpoint, request.method]
      });
    }
  })());
}

async function updatePercentiles(kv: KVNamespace, duration: number): Promise<void> {
  const key = 'performance_metrics';
  const existing = await kv.get(key, 'json') || {
    durations: [],
    responseTime: { p50: 0, p95: 0, p99: 0 }
  };

  // Add new duration
  existing.durations.push(duration);

  // Keep only last 1000 durations
  if (existing.durations.length > 1000) {
    existing.durations = existing.durations.slice(-1000);
  }

  // Calculate percentiles
  const sorted = [...existing.durations].sort((a, b) => a - b);
  const len = sorted.length;

  existing.responseTime = {
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)]
  };

  await kv.put(key, JSON.stringify(existing), { expirationTtl: 3600 });
}