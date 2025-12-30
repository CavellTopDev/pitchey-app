/**
 * Custom Domain Optimized Worker
 * Supports custom domain configuration with proper CORS handling
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

// Allowed origins configuration - supports custom domains
const ALLOWED_ORIGINS = [
  'https://pitchey-5o8.pages.dev',
  'https://pitchey.com',
  'https://www.pitchey.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8787'
];

export interface Env {
  JWT_SECRET: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  DATABASE_URL?: string;
  HYPERDRIVE?: Hyperdrive;
  CACHE?: KVNamespace;
  METRICS?: KVNamespace;
  FRONTEND_URL?: string; // Custom domain URL
}

// Import the existing RequestHandler from optimized performance worker
import { RequestHandler } from './worker-optimized-performance';

// Enhanced CORS handler with custom domain support
class CorsHandler {
  private origin: string | null;
  private env: Env;

  constructor(request: Request, env: Env) {
    this.origin = request.headers.get('Origin');
    this.env = env;
  }

  getAllowedOrigin(): string {
    // If custom domain is configured, use it
    if (this.env.FRONTEND_URL) {
      ALLOWED_ORIGINS.push(this.env.FRONTEND_URL);
    }

    // Check if origin is in allowed list
    if (this.origin && ALLOWED_ORIGINS.includes(this.origin)) {
      return this.origin;
    }

    // Default to custom domain if configured, otherwise Pages domain
    return this.env.FRONTEND_URL || 'https://pitchey-5o8.pages.dev';
  }

  getHeaders(): Record<string, string> {
    const allowedOrigin = this.getAllowedOrigin();
    
    return {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin' // Important for proper caching with CORS
    };
  }
}

// Performance monitoring with custom domain tracking
class DomainMetrics {
  private env: Env;
  private domain: string;

  constructor(env: Env, request: Request) {
    this.env = env;
    const url = new URL(request.url);
    this.domain = url.hostname;
  }

  async trackRequest(duration: number, cacheHit: boolean) {
    if (!this.env.METRICS) return;

    const key = `metrics:${this.domain}:${new Date().toISOString().slice(0, 10)}`;
    const metrics = await this.env.METRICS.get(key, 'json') || {
      requests: 0,
      cacheHits: 0,
      totalDuration: 0,
      domains: {}
    };

    metrics.requests++;
    if (cacheHit) metrics.cacheHits++;
    metrics.totalDuration += duration;
    
    // Track per-domain metrics
    if (!metrics.domains[this.domain]) {
      metrics.domains[this.domain] = { requests: 0, duration: 0 };
    }
    metrics.domains[this.domain].requests++;
    metrics.domains[this.domain].duration += duration;

    await this.env.METRICS.put(key, JSON.stringify(metrics), {
      expirationTtl: 7 * 24 * 60 * 60 // Keep for 7 days
    });
  }
}

// Main worker with custom domain support
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = performance.now();
    
    // Initialize CORS handler with custom domain support
    const corsHandler = new CorsHandler(request, env);
    const corsHeaders = corsHandler.getHeaders();

    // Handle OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }

    // Initialize domain metrics
    const metrics = new DomainMetrics(env, request);

    try {
      // Create optimized request handler
      const handler = new RequestHandler(request, env);
      const response = await handler.handle();

      // Track metrics
      const duration = performance.now() - startTime;
      const cacheHit = response.headers.get('X-Cache') === 'HIT';
      ctx.waitUntil(metrics.trackRequest(duration, cacheHit));

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      // Add performance and debugging headers
      response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      response.headers.set('X-Edge-Location', request.cf?.colo as string || 'unknown');
      response.headers.set('X-Cache-Status', response.headers.get('X-Cache') || 'BYPASS');
      response.headers.set('X-Custom-Domain', new URL(request.url).hostname);

      // Security headers
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // HSTS for custom domain
      if (new URL(request.url).hostname.includes('pitchey.com')) {
        response.headers.set(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload'
        );
      }

      return response;
    } catch (error) {
      console.error('Worker error:', error);
      
      // Return error response with CORS headers
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Internal server error',
          domain: new URL(request.url).hostname
        }), 
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  },

  // Scheduled tasks handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    switch (event.cron) {
      case '*/5 * * * *': // Every 5 minutes
        await this.aggregateMetrics(env);
        break;
      case '*/15 * * * *': // Every 15 minutes
        await this.cleanupCache(env);
        break;
      case '0 * * * *': // Every hour
        await this.generateReport(env);
        break;
    }
  },

  // Aggregate metrics across domains
  async aggregateMetrics(env: Env) {
    if (!env.METRICS) return;

    const date = new Date().toISOString().slice(0, 10);
    const hourlyKey = `metrics:hourly:${date}:${new Date().getHours()}`;
    
    // Aggregate all domain metrics for the current hour
    const list = await env.METRICS.list({ prefix: `metrics:` });
    const aggregated = {
      totalRequests: 0,
      totalCacheHits: 0,
      averageDuration: 0,
      domains: {} as Record<string, any>
    };

    for (const key of list.keys) {
      const metrics = await env.METRICS.get(key.name, 'json');
      if (metrics) {
        aggregated.totalRequests += metrics.requests;
        aggregated.totalCacheHits += metrics.cacheHits;
        
        // Merge domain-specific data
        for (const [domain, data] of Object.entries(metrics.domains || {})) {
          if (!aggregated.domains[domain]) {
            aggregated.domains[domain] = { requests: 0, duration: 0 };
          }
          aggregated.domains[domain].requests += data.requests;
          aggregated.domains[domain].duration += data.duration;
        }
      }
    }

    if (aggregated.totalRequests > 0) {
      aggregated.averageDuration = aggregated.totalDuration / aggregated.totalRequests;
    }

    await env.METRICS.put(hourlyKey, JSON.stringify(aggregated), {
      expirationTtl: 30 * 24 * 60 * 60 // Keep for 30 days
    });
  },

  // Clean up expired cache entries
  async cleanupCache(env: Env) {
    if (!env.KV) return;

    const list = await env.KV.list();
    const now = Date.now();

    for (const key of list.keys) {
      // Check if it's a cache key
      if (key.name.startsWith('cache:')) {
        const metadata = key.metadata as { expires?: number } | undefined;
        if (metadata?.expires && metadata.expires < now) {
          await env.KV.delete(key.name);
        }
      }
    }
  },

  // Generate performance report
  async generateReport(env: Env) {
    if (!env.METRICS) return;

    const date = new Date().toISOString().slice(0, 10);
    const reportKey = `report:daily:${date}`;
    
    // Collect hourly metrics for the day
    const hourlyMetrics = [];
    for (let hour = 0; hour < 24; hour++) {
      const key = `metrics:hourly:${date}:${hour}`;
      const data = await env.METRICS.get(key, 'json');
      if (data) {
        hourlyMetrics.push(data);
      }
    }

    const report = {
      date,
      summary: {
        totalRequests: hourlyMetrics.reduce((sum, h) => sum + h.totalRequests, 0),
        totalCacheHits: hourlyMetrics.reduce((sum, h) => sum + h.totalCacheHits, 0),
        cacheHitRate: 0,
        averageResponseTime: 0,
        peakHour: null as number | null,
        domains: {} as Record<string, any>
      },
      hourly: hourlyMetrics
    };

    // Calculate summary statistics
    if (report.summary.totalRequests > 0) {
      report.summary.cacheHitRate = 
        (report.summary.totalCacheHits / report.summary.totalRequests) * 100;
      
      const totalDuration = hourlyMetrics.reduce((sum, h) => 
        sum + (h.averageDuration * h.totalRequests), 0);
      report.summary.averageResponseTime = totalDuration / report.summary.totalRequests;
    }

    // Find peak hour
    let maxRequests = 0;
    hourlyMetrics.forEach((h, hour) => {
      if (h.totalRequests > maxRequests) {
        maxRequests = h.totalRequests;
        report.summary.peakHour = hour;
      }
      
      // Aggregate domain statistics
      for (const [domain, data] of Object.entries(h.domains || {})) {
        if (!report.summary.domains[domain]) {
          report.summary.domains[domain] = { 
            requests: 0, 
            averageDuration: 0,
            percentage: 0 
          };
        }
        report.summary.domains[domain].requests += data.requests;
      }
    });

    // Calculate domain percentages
    for (const [domain, data] of Object.entries(report.summary.domains)) {
      data.percentage = (data.requests / report.summary.totalRequests) * 100;
    }

    await env.METRICS.put(reportKey, JSON.stringify(report), {
      expirationTtl: 90 * 24 * 60 * 60 // Keep for 90 days
    });

    console.log(`Daily report generated for ${date}:`, report.summary);
  }
};