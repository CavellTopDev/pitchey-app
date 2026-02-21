/**
 * Distributed Tracing Service for Pitchey Platform
 * Provides comprehensive observability with Trace Workers and Analytics Engine
 */

import type { UnifiedEnv as Env } from '../types/env.ts';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  service: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'success' | 'error' | 'pending' | 'cancelled';
  attributes: Record<string, any>;
  error?: {
    message: string;
    type: string;
    stack?: string;
  };
  tags: string[];
  events: TraceEvent[];
  links?: TraceLink[];
}

export interface TraceEvent {
  timestamp: number;
  name: string;
  attributes?: Record<string, any>;
}

export interface TraceLink {
  traceId: string;
  spanId: string;
  type: 'parent' | 'child' | 'follows_from';
}

export interface TraceContext {
  traceId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
  sampling?: {
    rate: number;
    priority: number;
  };
}

export interface AuditLogEntry {
  timestamp: number;
  traceId: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'denied';
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export class TraceService {
  private env: Env;
  private activeSpans: Map<string, TraceSpan> = new Map();
  private samplingRate: number;
  private serviceName: string = 'pitchey-api';
  private serviceVersion: string = '2.0';

  constructor(env: Env) {
    this.env = env;
    this.samplingRate = parseFloat(env.TRACE_SAMPLING_RATE || '0.1');
  }

  /**
   * Start a new trace span
   */
  startSpan(
    operation: string,
    attributes: Record<string, any> = {},
    context?: TraceContext
  ): TraceSpan {
    const shouldSample = this.shouldSample(context?.sampling);
    
    const span: TraceSpan = {
      traceId: context?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: context?.parentSpanId,
      operation,
      service: this.serviceName,
      startTime: Date.now(),
      status: 'pending',
      attributes: {
        ...attributes,
        'service.name': this.serviceName,
        'service.version': this.serviceVersion,
        'service.environment': this.env.ENVIRONMENT || 'production',
        'sampling.rate': this.samplingRate,
        'sampling.decision': shouldSample
      },
      tags: this.extractTags(operation, attributes),
      events: []
    };

    if (shouldSample) {
      this.activeSpans.set(span.spanId, span);
    }

    return span;
  }

  /**
   * Start a child span linked to a parent
   */
  startChildSpan(
    parentSpan: TraceSpan,
    operation: string,
    attributes: Record<string, any> = {}
  ): TraceSpan {
    return this.startSpan(operation, attributes, {
      traceId: parentSpan.traceId,
      parentSpanId: parentSpan.spanId
    });
  }

  /**
   * Add an event to a span
   */
  addSpanEvent(spanId: string, name: string, attributes?: Record<string, any>) {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push({
        timestamp: Date.now(),
        name,
        attributes
      });
    }
  }

  /**
   * Finish a span and send to storage
   */
  async finishSpan(
    spanId: string,
    status: 'success' | 'error' | 'cancelled' = 'success',
    error?: Error | string
  ) {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    if (error) {
      span.error = typeof error === 'string'
        ? { message: error, type: 'Error' }
        : {
            message: error.message,
            type: error.name || 'Error',
            stack: error.stack
          };
    }

    // Send to multiple destinations for redundancy
    await Promise.allSettled([
      this.sendToTraceWorkers(span),
      this.sendToAnalyticsEngine(span),
      this.sendToR2Storage(span)
    ]);

    this.activeSpans.delete(spanId);
  }

  /**
   * Send trace to Trace Workers API
   */
  private async sendToTraceWorkers(span: TraceSpan) {
    try {
      if (this.env.TRACE_SERVICE) {
        // Using service binding
        const response = await this.env.TRACE_SERVICE.fetch(
          new Request('https://trace-worker/api/traces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(span)
          })
        );

        if (!response.ok) {
          console.error('Failed to send trace to Trace Workers:', response.status);
        }
      }
    } catch (error) {
      console.error('Error sending to Trace Workers:', error);
    }
  }

  /**
   * Send trace to Analytics Engine
   */
  private async sendToAnalyticsEngine(span: TraceSpan) {
    try {
      if (this.env.TRACE_ANALYTICS) {
        await this.env.TRACE_ANALYTICS.writeDataPoint({
          blobs: [
            span.traceId,
            span.spanId,
            span.operation,
            span.status,
            span.service,
            span.error?.message || '',
            JSON.stringify(span.tags)
          ],
          doubles: [
            span.startTime,
            span.duration || 0,
            span.events.length
          ],
          indexes: [
            `${span.service}:${span.operation}`.substring(0, 96)
          ]
        });
      }
    } catch (error) {
      console.error('Error sending to Analytics Engine:', error);
    }
  }

  /**
   * Store trace in R2 for long-term retention
   */
  private async sendToR2Storage(span: TraceSpan) {
    try {
      if (this.env.TRACE_LOGS) {
        const date = new Date(span.startTime);
        const key = `traces/${date.toISOString().split('T')[0]}/${span.traceId}/${span.spanId}.json`;
        
        await this.env.TRACE_LOGS.put(key, JSON.stringify(span, null, 2), {
          httpMetadata: {
            contentType: 'application/json'
          },
          customMetadata: {
            operation: span.operation,
            status: span.status,
            duration: span.duration?.toString() || '0',
            service: span.service
          }
        });
      }
    } catch (error) {
      console.error('Error storing trace in R2:', error);
    }
  }

  /**
   * Log audit trail entry
   */
  async logAuditTrail(entry: AuditLogEntry) {
    try {
      // Store in R2 for compliance
      if (this.env.AUDIT_LOGS) {
        const date = new Date(entry.timestamp);
        const key = `audit/${date.toISOString().split('T')[0]}/${entry.traceId}-${entry.timestamp}.json`;
        
        await this.env.AUDIT_LOGS.put(key, JSON.stringify(entry, null, 2), {
          httpMetadata: {
            contentType: 'application/json'
          },
          customMetadata: {
            action: entry.action,
            resource: entry.resource,
            result: entry.result,
            userId: entry.userId || 'anonymous'
          }
        });
      }

      // Also send to Analytics for real-time monitoring
      if (this.env.PITCHEY_ANALYTICS) {
        await this.env.PITCHEY_ANALYTICS.writeDataPoint({
          blobs: [
            entry.traceId,
            entry.action,
            entry.resource,
            entry.result,
            entry.userId || 'anonymous',
            entry.sessionId || ''
          ],
          doubles: [entry.timestamp],
          // Analytics Engine supports only 1 index per data point
          indexes: [`${entry.action}:${entry.result}`]
        });
      }
    } catch (error) {
      console.error('Error logging audit trail:', error);
    }
  }

  /**
   * Get trace by ID from storage
   */
  async getTrace(traceId: string): Promise<TraceSpan[]> {
    try {
      if (this.env.TRACE_LOGS) {
        // List all spans for this trace
        const prefix = `traces/*/`; 
        const objects = await this.env.TRACE_LOGS.list({ prefix });
        
        const spans: TraceSpan[] = [];
        for (const object of objects.objects) {
          if (object.key.includes(traceId)) {
            const spanData = await this.env.TRACE_LOGS.get(object.key);
            if (spanData) {
              const text = await spanData.text();
              spans.push(JSON.parse(text));
            }
          }
        }
        
        return spans.sort((a, b) => a.startTime - b.startTime);
      }
    } catch (error) {
      console.error('Error retrieving trace:', error);
    }
    return [];
  }

  /**
   * Analyze trace performance
   */
  async analyzeTracePerformance(traceId: string): Promise<{
    totalDuration: number;
    spanCount: number;
    errorCount: number;
    criticalPath: TraceSpan[];
    bottlenecks: Array<{ operation: string; duration: number }>;
  }> {
    const spans = await this.getTrace(traceId);
    
    if (spans.length === 0) {
      return {
        totalDuration: 0,
        spanCount: 0,
        errorCount: 0,
        criticalPath: [],
        bottlenecks: []
      };
    }

    const rootSpan = spans.find(s => !s.parentSpanId);
    const totalDuration = rootSpan?.duration || 0;
    const errorCount = spans.filter(s => s.status === 'error').length;
    
    // Find critical path
    const criticalPath = this.findCriticalPath(spans);
    
    // Identify bottlenecks (operations taking >100ms)
    const bottlenecks = spans
      .filter(s => (s.duration || 0) > 100)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5)
      .map(s => ({
        operation: s.operation,
        duration: s.duration || 0
      }));

    return {
      totalDuration,
      spanCount: spans.length,
      errorCount,
      criticalPath,
      bottlenecks
    };
  }

  /**
   * Extract trace context from request headers
   */
  extractTraceContext(request: Request): TraceContext | undefined {
    const traceHeader = request.headers.get('x-trace-id');
    const parentSpanHeader = request.headers.get('x-parent-span-id');
    const baggageHeader = request.headers.get('baggage');
    
    if (traceHeader) {
      return {
        traceId: traceHeader,
        parentSpanId: parentSpanHeader || undefined,
        baggage: baggageHeader ? this.parseBaggage(baggageHeader) : undefined
      };
    }
    
    return undefined;
  }

  /**
   * Inject trace context into response headers
   * IMPORTANT: WebSocket responses must be returned unchanged to preserve the webSocket property
   */
  injectTraceContext(response: Response, span: TraceSpan): Response {
    // CRITICAL: WebSocket responses (status 101) must not be modified
    // Creating a new Response strips the webSocket property which is required
    // for Cloudflare Workers to handle WebSocket upgrades
    if (response.status === 101 || (response as any).webSocket) {
      console.log('[TraceService] Returning WebSocket response unchanged');
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('x-trace-id', span.traceId);
    headers.set('x-span-id', span.spanId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  // Helper methods
  private generateTraceId(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

  private generateSpanId(): string {
    return crypto.randomUUID().split('-')[0];
  }

  private shouldSample(sampling?: { rate: number; priority: number }): boolean {
    const rate = sampling?.rate ?? this.samplingRate;
    const priority = sampling?.priority ?? 0;
    
    // Always sample high priority traces
    if (priority >= 1) return true;
    
    // Sample based on rate
    return Math.random() < rate;
  }

  private extractTags(operation: string, attributes: Record<string, any>): string[] {
    const tags: string[] = [operation.split('.')[0]];
    
    if (attributes['http.method']) tags.push(`http:${attributes['http.method']}`);
    if (attributes['db.table']) tags.push(`db:${attributes['db.table']}`);
    if (attributes['error']) tags.push('error');
    
    return tags;
  }

  private parseBaggage(baggageHeader: string): Record<string, string> {
    const baggage: Record<string, string> = {};
    const items = baggageHeader.split(',');
    
    for (const item of items) {
      const [key, value] = item.split('=');
      if (key && value) {
        baggage[key.trim()] = value.trim();
      }
    }
    
    return baggage;
  }

  private findCriticalPath(spans: TraceSpan[]): TraceSpan[] {
    // Find the longest path from root to leaf
    const spanMap = new Map(spans.map(s => [s.spanId, s]));
    const rootSpan = spans.find(s => !s.parentSpanId);
    
    if (!rootSpan) return [];
    
    const path: TraceSpan[] = [rootSpan];
    let current = rootSpan;
    
    while (true) {
      const children = spans.filter(s => s.parentSpanId === current.spanId);
      if (children.length === 0) break;
      
      // Choose the child with the longest duration
      const longestChild = children.reduce((a, b) => 
        (a.duration || 0) > (b.duration || 0) ? a : b
      );
      
      path.push(longestChild);
      current = longestChild;
    }
    
    return path;
  }
}

/**
 * Trace-aware database query wrapper
 */
export async function queryWithTracing<T>(
  env: Env,
  query: string,
  params: any[] = [],
  operation: string = 'db.query',
  parentSpan?: TraceSpan
): Promise<T[]> {
  const traceService = new TraceService(env);
  
  const span = parentSpan 
    ? traceService.startChildSpan(parentSpan, operation, {
        'db.statement': query.substring(0, 100),
        'db.params.count': params.length,
        'db.type': 'postgresql'
      })
    : traceService.startSpan(operation, {
        'db.statement': query.substring(0, 100),
        'db.params.count': params.length,
        'db.type': 'postgresql'
      });

  try {
    // Extract table name from query
    const tableMatch = query.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+(\w+)/i);
    if (tableMatch) {
      span.attributes['db.table'] = tableMatch[1];
    }

    const startTime = performance.now();
    const result = await env.DB.prepare(query).bind(...params).all();
    const duration = performance.now() - startTime;
    
    span.attributes['db.rows_affected'] = result.results.length;
    span.attributes['db.duration_ms'] = duration;
    
    await traceService.finishSpan(span.spanId, 'success');
    
    return result.results as T[];
  } catch (error: any) {
    span.attributes['db.error'] = error.message;
    await traceService.finishSpan(span.spanId, 'error', error);
    throw error;
  }
}

/**
 * Trace-aware API handler
 */
export async function handleAPIRequestWithTracing(
  request: Request,
  env: Env,
  handler: (request: Request, span: TraceSpan) => Promise<Response>
): Promise<Response> {
  const traceService = new TraceService(env);
  const url = new URL(request.url);
  
  // Extract existing trace context from headers
  const context = traceService.extractTraceContext(request);
  
  const span = traceService.startSpan('api.request', {
    'http.method': request.method,
    'http.url': url.pathname,
    'http.user_agent': request.headers.get('user-agent'),
    'http.client_ip': request.headers.get('cf-connecting-ip'),
    'http.cf_ray': request.headers.get('cf-ray'),
    'http.country': request.headers.get('cf-ipcountry')
  }, context);

  // Log audit trail for sensitive operations
  if (url.pathname.includes('/auth/') || 
      url.pathname.includes('/nda/') ||
      url.pathname.includes('/financial/')) {
    await traceService.logAuditTrail({
      timestamp: Date.now(),
      traceId: span.traceId,
      action: `${request.method} ${url.pathname}`,
      resource: url.pathname,
      result: 'failure', // 'pending' not in success|failure|denied
      ip: request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });
  }

  try {
    // Add request processing event
    traceService.addSpanEvent(span.spanId, 'request.processing_started');
    
    const response = await handler(request, span);
    
    span.attributes['http.status_code'] = response.status;
    span.attributes['http.response_size'] = response.headers.get('content-length');
    
    await traceService.finishSpan(span.spanId, response.status < 400 ? 'success' : 'error');
    
    // Inject trace context into response
    return traceService.injectTraceContext(response, span);
  } catch (error: any) {
    span.attributes['http.error'] = error.message;
    await traceService.finishSpan(span.spanId, 'error', error);
    
    const errorResponse = new Response(
      JSON.stringify({
        error: 'Internal server error',
        traceId: span.traceId,
        spanId: span.spanId
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-ID': span.traceId,
          'X-Span-ID': span.spanId
        }
      }
    );
    
    return errorResponse;
  }
}