/**
 * Monitoring Middleware for Request Tracking and Observability
 */

import { MonitoringService, PerformanceMonitor } from '../services/monitoring-service';

export interface RequestContext {
  requestId: string;
  userId?: string;
  userType?: string;
  startTime: number;
  path: string;
  method: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Monitoring middleware for Cloudflare Workers
 */
export class MonitoringMiddleware {
  private monitoring: MonitoringService;
  private performanceMonitor: PerformanceMonitor;

  constructor(monitoring: MonitoringService) {
    this.monitoring = monitoring;
    this.performanceMonitor = new PerformanceMonitor(monitoring);
  }

  /**
   * Handle request with monitoring
   */
  async handle(
    request: Request,
    env: any,
    ctx: ExecutionContext,
    next: () => Promise<Response>
  ): Promise<Response> {
    const context = this.createRequestContext(request);
    
    // Start request span
    const span = this.monitoring.startSpan('request', `${context.method} ${context.path}`);
    
    // Add request metadata
    this.monitoring.logEvent('request.start', {
      requestId: context.requestId,
      path: context.path,
      method: context.method,
      ip: context.ip,
      userAgent: context.userAgent
    });

    try {
      // Execute request
      const response = await this.performanceMonitor.measureRequest(request, next);
      
      // Record response metrics
      this.recordResponseMetrics(context, response);
      
      // End span
      this.monitoring.endSpan(span.id, response.ok ? 'ok' : 'error');
      
      // Add monitoring headers
      return this.addMonitoringHeaders(response, context);
      
    } catch (error) {
      // Record error
      this.monitoring.logError(error as Error, {
        requestId: context.requestId,
        path: context.path,
        method: context.method
      });
      
      // End span with error
      this.monitoring.endSpan(span.id, 'error');
      
      // Re-throw error
      throw error;
    }
  }

  /**
   * Create request context
   */
  private createRequestContext(request: Request): RequestContext {
    const url = new URL(request.url);
    
    return {
      requestId: this.generateRequestId(),
      startTime: Date.now(),
      path: url.pathname,
      method: request.method,
      ip: request.headers.get('CF-Connecting-IP') || 
          request.headers.get('X-Forwarded-For') || 
          undefined,
      userAgent: request.headers.get('User-Agent') || undefined
    };
  }

  /**
   * Record response metrics
   */
  private recordResponseMetrics(context: RequestContext, response: Response): void {
    const duration = Date.now() - context.startTime;
    
    // Record timing
    this.monitoring.timing('request.duration', duration, {
      path: context.path,
      method: context.method,
      status: String(response.status)
    });
    
    // Record status codes
    this.monitoring.increment(`request.status.${response.status}`, 1, {
      path: context.path,
      method: context.method
    });
    
    // Record by endpoint
    this.monitoring.increment(`endpoint.${context.method}.${context.path}`, 1);
    
    // Check for slow requests
    if (duration > 1000) {
      this.monitoring.logEvent('slow.request', {
        requestId: context.requestId,
        path: context.path,
        duration,
        status: response.status
      });
    }
    
    // Check for errors
    if (response.status >= 400) {
      this.monitoring.increment('request.errors', 1, {
        path: context.path,
        method: context.method,
        status: String(response.status)
      });
    }
  }

  /**
   * Add monitoring headers to response
   */
  private addMonitoringHeaders(response: Response, context: RequestContext): Response {
    const headers = new Headers(response.headers);
    
    headers.set('X-Request-ID', context.requestId);
    headers.set('X-Response-Time', String(Date.now() - context.startTime));
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Health check endpoint handler
 */
export class HealthCheckHandler {
  private monitoring: MonitoringService;
  private checks: Map<string, () => Promise<boolean>>;

  constructor(monitoring: MonitoringService) {
    this.monitoring = monitoring;
    this.checks = new Map();
    
    this.registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Database health
    this.checks.set('database', async () => {
      try {
        // Simulate database check
        const response = await fetch('https://your-database-endpoint/health');
        return response.ok;
      } catch {
        return false;
      }
    });
    
    // Redis health
    this.checks.set('redis', async () => {
      try {
        // Simulate Redis check
        const response = await fetch('https://your-redis-endpoint/ping');
        return response.ok;
      } catch {
        return false;
      }
    });
    
    // Storage health
    this.checks.set('storage', async () => {
      try {
        // Check R2 availability
        return true; // Simplified
      } catch {
        return false;
      }
    });
  }

  /**
   * Handle health check request
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';
    
    // Run all health checks
    const results: Record<string, any> = {};
    let allHealthy = true;
    
    for (const [name, checker] of this.checks.entries()) {
      try {
        const healthy = await checker();
        results[name] = {
          status: healthy ? 'healthy' : 'unhealthy',
          timestamp: Date.now()
        };
        
        if (!healthy) {
          allHealthy = false;
        }
        
        // Register with monitoring
        this.monitoring.registerHealthCheck(name, async () => ({
          healthy,
          metadata: results[name]
        }));
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: (error as Error).message,
          timestamp: Date.now()
        };
        allHealthy = false;
      }
    }
    
    // Get monitoring metrics
    const metrics = this.monitoring.getMetricsSummary();
    
    const response = {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      checks: detailed ? results : undefined,
      metrics: detailed ? metrics : undefined
    };
    
    return new Response(JSON.stringify(response), {
      status: allHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }

  /**
   * Handle metrics endpoint
   */
  async handleMetrics(request: Request): Promise<Response> {
    const metrics = this.monitoring.getMetricsSummary();
    
    // Format as Prometheus metrics
    const prometheus = this.formatPrometheusMetrics(metrics);
    
    return new Response(prometheus, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache'
      }
    });
  }

  /**
   * Format metrics for Prometheus
   */
  private formatPrometheusMetrics(metrics: Record<string, any>): string {
    const lines: string[] = [];
    
    for (const [name, data] of Object.entries(metrics)) {
      const metricName = name.replace(/\./g, '_');
      
      if (typeof data === 'object' && data !== null) {
        lines.push(`# TYPE ${metricName} gauge`);
        lines.push(`${metricName}_count ${data.count}`);
        lines.push(`${metricName}_sum ${data.sum}`);
        lines.push(`${metricName}_min ${data.min}`);
        lines.push(`${metricName}_max ${data.max}`);
        lines.push(`${metricName}_avg ${data.avg}`);
      } else {
        lines.push(`# TYPE ${metricName} gauge`);
        lines.push(`${metricName} ${data}`);
      }
    }
    
    return lines.join('\n');
  }
}

/**
 * Distributed tracing implementation
 */
export class DistributedTracing {
  /**
   * Extract trace context from headers
   */
  static extractTraceContext(request: Request): {
    traceId?: string;
    parentId?: string;
    sampled?: boolean;
  } {
    const traceparent = request.headers.get('traceparent');
    const tracestate = request.headers.get('tracestate');
    
    if (!traceparent) {
      return {};
    }
    
    // Parse W3C Trace Context format
    const parts = traceparent.split('-');
    if (parts.length !== 4) {
      return {};
    }
    
    return {
      traceId: parts[1],
      parentId: parts[2],
      sampled: parts[3] === '01'
    };
  }

  /**
   * Inject trace context into headers
   */
  static injectTraceContext(
    headers: Headers,
    traceId: string,
    spanId: string,
    sampled: boolean = true
  ): void {
    const flags = sampled ? '01' : '00';
    headers.set('traceparent', `00-${traceId}-${spanId}-${flags}`);
  }

  /**
   * Generate trace ID
   */
  static generateTraceId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate span ID
   */
  static generateSpanId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
}