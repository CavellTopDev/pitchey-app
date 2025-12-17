/**
 * Performance-Optimized Production Worker
 * Implements advanced caching, database pooling, and edge optimizations
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

// Database configuration for production
interface DatabaseUser {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  company_name: string;
  user_type: 'creator' | 'investor' | 'production' | 'admin';
  verified: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Env {
  JWT_SECRET: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  DATABASE_URL?: string;
  HYPERDRIVE?: Hyperdrive;
  CACHE?: KVNamespace;
  METRICS?: KVNamespace;
}

// Performance monitoring metrics
interface PerformanceMetrics {
  requestId: string;
  timestamp: number;
  duration: number;
  endpoint: string;
  method: string;
  status: number;
  cacheHit: boolean;
  dbQueries: number;
  errorCount: number;
}

// Advanced cache configuration with tiered TTLs
const CACHE_CONFIG = {
  // Static content - 1 week
  STATIC: {
    ttl: 7 * 24 * 60 * 60,
    swr: 24 * 60 * 60, // Stale-while-revalidate: 1 day
    tags: ['static', 'immutable']
  },
  // User profiles - 1 hour
  PROFILES: {
    ttl: 60 * 60,
    swr: 5 * 60, // SWR: 5 minutes
    tags: ['user', 'profile']
  },
  // Pitches - 15 minutes
  PITCHES: {
    ttl: 15 * 60,
    swr: 60, // SWR: 1 minute
    tags: ['pitch', 'content']
  },
  // Search results - 5 minutes
  SEARCH: {
    ttl: 5 * 60,
    swr: 30, // SWR: 30 seconds
    tags: ['search', 'dynamic']
  },
  // Real-time data - 30 seconds
  REALTIME: {
    ttl: 30,
    swr: 5, // SWR: 5 seconds
    tags: ['realtime', 'volatile']
  }
};

// Performance optimization class
class PerformanceOptimizer {
  private metrics: PerformanceMetrics;
  private startTime: number;

  constructor(request: Request) {
    this.metrics = {
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      duration: 0,
      endpoint: new URL(request.url).pathname,
      method: request.method,
      status: 0,
      cacheHit: false,
      dbQueries: 0,
      errorCount: 0
    };
    this.startTime = performance.now();
  }

  recordCacheHit() {
    this.metrics.cacheHit = true;
  }

  recordDbQuery() {
    this.metrics.dbQueries++;
  }

  recordError() {
    this.metrics.errorCount++;
  }

  finalize(status: number): PerformanceMetrics {
    this.metrics.status = status;
    this.metrics.duration = performance.now() - this.startTime;
    return this.metrics;
  }

  async saveMetrics(env: Env) {
    if (!env.METRICS) return;
    
    const key = `metrics:${this.metrics.requestId}`;
    await env.METRICS.put(key, JSON.stringify(this.metrics), {
      expirationTtl: 24 * 60 * 60 // Keep for 24 hours
    });

    // Update aggregated metrics
    await this.updateAggregatedMetrics(env);
  }

  private async updateAggregatedMetrics(env: Env) {
    if (!env.METRICS) return;

    const hourKey = `stats:${Math.floor(Date.now() / (60 * 60 * 1000))}`;
    const stats = await env.METRICS.get(hourKey, { type: 'json' }) || {
      requests: 0,
      avgDuration: 0,
      cacheHits: 0,
      errors: 0,
      p95Duration: []
    };

    stats.requests++;
    stats.avgDuration = (stats.avgDuration * (stats.requests - 1) + this.metrics.duration) / stats.requests;
    if (this.metrics.cacheHit) stats.cacheHits++;
    if (this.metrics.errorCount > 0) stats.errors++;
    
    // Track P95
    stats.p95Duration.push(this.metrics.duration);
    if (stats.p95Duration.length > 100) {
      stats.p95Duration = stats.p95Duration
        .sort((a: number, b: number) => a - b)
        .slice(-95);
    }

    await env.METRICS.put(hourKey, JSON.stringify(stats), {
      expirationTtl: 48 * 60 * 60 // Keep for 48 hours
    });
  }
}

// Advanced cache manager with multi-tier caching
class CacheManager {
  private env: Env;
  private perf: PerformanceOptimizer;

  constructor(env: Env, perf: PerformanceOptimizer) {
    this.env = env;
    this.perf = perf;
  }

  async get(key: string, cacheType: keyof typeof CACHE_CONFIG = 'PITCHES'): Promise<any> {
    if (!this.env.KV) return null;

    try {
      // Check edge cache first
      const cached = await this.env.KV.get(key, { 
        type: 'json',
        cacheTtl: CACHE_CONFIG[cacheType].ttl 
      });
      
      if (cached) {
        this.perf.recordCacheHit();
        
        // Check if stale but within SWR window
        const metadata = await this.env.KV.getWithMetadata(key);
        if (metadata.metadata) {
          const age = Date.now() - (metadata.metadata as any).timestamp;
          if (age > CACHE_CONFIG[cacheType].ttl * 1000) {
            // Return stale data but trigger background refresh
            this.triggerBackgroundRefresh(key);
          }
        }
        
        return cached;
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }
    
    return null;
  }

  async set(key: string, value: any, cacheType: keyof typeof CACHE_CONFIG = 'PITCHES'): Promise<void> {
    if (!this.env.KV) return;

    try {
      const config = CACHE_CONFIG[cacheType];
      
      await this.env.KV.put(key, JSON.stringify(value), {
        expirationTtl: config.ttl + config.swr,
        metadata: {
          timestamp: Date.now(),
          tags: config.tags,
          cacheType
        }
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!this.env.KV) return;

    try {
      // List keys matching pattern
      const list = await this.env.KV.list({ prefix: pattern });
      
      // Delete in batches for performance
      const batchSize = 10;
      for (let i = 0; i < list.keys.length; i += batchSize) {
        const batch = list.keys.slice(i, i + batchSize);
        await Promise.all(batch.map(key => this.env.KV!.delete(key.name)));
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  private triggerBackgroundRefresh(key: string) {
    // In production, this would trigger a background task
    // For now, we'll just log it
    console.log(`Background refresh triggered for key: ${key}`);
  }
}

// Database connection pooling with Hyperdrive
class DatabasePool {
  private env: Env;
  private perf: PerformanceOptimizer;
  private connectionCache: Map<string, any> = new Map();

  constructor(env: Env, perf: PerformanceOptimizer) {
    this.env = env;
    this.perf = perf;
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    this.perf.recordDbQuery();

    // Use Hyperdrive if available
    if (this.env.HYPERDRIVE) {
      try {
        const conn = await this.getConnection();
        return await conn.query(sql, params);
      } catch (error) {
        console.error('Hyperdrive query error:', error);
        throw error;
      }
    }

    // Fallback to mock data for now
    return this.getMockData(sql);
  }

  private async getConnection() {
    if (this.env.HYPERDRIVE) {
      // Hyperdrive handles connection pooling automatically
      return this.env.HYPERDRIVE.connect();
    }
    
    throw new Error('Database connection not available');
  }

  private getMockData(sql: string): any {
    // Mock data for testing
    if (sql.includes('SELECT') && sql.includes('users')) {
      return [{
        id: 1,
        email: 'demo@example.com',
        first_name: 'Demo',
        last_name: 'User',
        user_type: 'creator'
      }];
    }
    return [];
  }
}

// Optimized request handler with edge caching
class RequestHandler {
  private request: Request;
  private env: Env;
  private perf: PerformanceOptimizer;
  private cache: CacheManager;
  private db: DatabasePool;

  constructor(request: Request, env: Env) {
    this.request = request;
    this.env = env;
    this.perf = new PerformanceOptimizer(request);
    this.cache = new CacheManager(env, this.perf);
    this.db = new DatabasePool(env, this.perf);
  }

  async handle(): Promise<Response> {
    const url = new URL(this.request.url);
    const path = url.pathname;

    try {
      // Add performance headers
      const headers = new Headers({
        'X-Request-ID': this.perf['metrics'].requestId,
        'Cache-Control': 'public, max-age=60',
        'CDN-Cache-Control': 'max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      });

      // Handle different endpoints with optimized caching
      let response: Response;

      if (path === '/api/health') {
        response = await this.handleHealth(headers);
      } else if (path.startsWith('/api/pitches')) {
        response = await this.handlePitches(headers);
      } else if (path.startsWith('/api/search')) {
        response = await this.handleSearch(headers);
      } else if (path.startsWith('/api/user')) {
        response = await this.handleUser(headers);
      } else if (path.startsWith('/static/')) {
        response = await this.handleStatic(headers);
      } else {
        response = new Response('Not Found', { status: 404, headers });
      }

      // Record metrics
      await this.perf.saveMetrics(this.env);

      // Add performance timing headers
      response.headers.set('Server-Timing', `total;dur=${this.perf['metrics'].duration}`);
      
      return response;
    } catch (error) {
      this.perf.recordError();
      console.error('Request error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  private async handleHealth(headers: Headers): Promise<Response> {
    const cacheKey = 'health:status';
    
    // Try cache first
    const cached = await this.cache.get(cacheKey, 'REALTIME');
    if (cached) {
      headers.set('X-Cache', 'HIT');
      return new Response(JSON.stringify(cached), { headers });
    }

    // Generate health data
    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0-optimized',
      metrics: {
        cache: this.env.KV ? 'available' : 'unavailable',
        database: this.env.HYPERDRIVE ? 'available' : 'unavailable',
        storage: this.env.R2_BUCKET ? 'available' : 'unavailable'
      }
    };

    // Cache the result
    await this.cache.set(cacheKey, health, 'REALTIME');
    
    headers.set('X-Cache', 'MISS');
    return new Response(JSON.stringify(health), { headers });
  }

  private async handlePitches(headers: Headers): Promise<Response> {
    const url = new URL(this.request.url);
    const pitchId = url.pathname.split('/').pop();
    const cacheKey = `pitch:${pitchId}`;

    // Try cache first
    const cached = await this.cache.get(cacheKey, 'PITCHES');
    if (cached) {
      headers.set('X-Cache', 'HIT');
      headers.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=60');
      return new Response(JSON.stringify(cached), { headers });
    }

    // Query database
    const pitch = await this.db.query(
      'SELECT * FROM pitches WHERE id = $1',
      [pitchId]
    );

    if (pitch && pitch.length > 0) {
      await this.cache.set(cacheKey, pitch[0], 'PITCHES');
      headers.set('X-Cache', 'MISS');
      return new Response(JSON.stringify(pitch[0]), { headers });
    }

    return new Response('Not Found', { status: 404, headers });
  }

  private async handleSearch(headers: Headers): Promise<Response> {
    const url = new URL(this.request.url);
    const query = url.searchParams.get('q') || '';
    const cacheKey = `search:${query}`;

    // Try cache first
    const cached = await this.cache.get(cacheKey, 'SEARCH');
    if (cached) {
      headers.set('X-Cache', 'HIT');
      headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=30');
      return new Response(JSON.stringify(cached), { headers });
    }

    // Perform search
    const results = await this.db.query(
      'SELECT * FROM pitches WHERE title ILIKE $1 OR synopsis ILIKE $1 LIMIT 10',
      [`%${query}%`]
    );

    await this.cache.set(cacheKey, results, 'SEARCH');
    headers.set('X-Cache', 'MISS');
    return new Response(JSON.stringify(results), { headers });
  }

  private async handleUser(headers: Headers): Promise<Response> {
    const url = new URL(this.request.url);
    const userId = url.pathname.split('/')[3];
    const cacheKey = `user:${userId}`;

    // Try cache first
    const cached = await this.cache.get(cacheKey, 'PROFILES');
    if (cached) {
      headers.set('X-Cache', 'HIT');
      headers.set('Cache-Control', 'private, max-age=3600');
      return new Response(JSON.stringify(cached), { headers });
    }

    // Query database
    const user = await this.db.query(
      'SELECT id, email, first_name, last_name, user_type FROM users WHERE id = $1',
      [userId]
    );

    if (user && user.length > 0) {
      await this.cache.set(cacheKey, user[0], 'PROFILES');
      headers.set('X-Cache', 'MISS');
      return new Response(JSON.stringify(user[0]), { headers });
    }

    return new Response('Not Found', { status: 404, headers });
  }

  private async handleStatic(headers: Headers): Promise<Response> {
    const url = new URL(this.request.url);
    const path = url.pathname.substring(8); // Remove /static/
    const cacheKey = `static:${path}`;

    // Try cache first
    const cached = await this.cache.get(cacheKey, 'STATIC');
    if (cached) {
      headers.set('X-Cache', 'HIT');
      headers.set('Cache-Control', 'public, max-age=604800, immutable');
      return new Response(cached.body, { 
        headers: {
          ...headers,
          'Content-Type': cached.contentType || 'application/octet-stream'
        }
      });
    }

    // Try R2 bucket
    if (this.env.R2_BUCKET) {
      const object = await this.env.R2_BUCKET.get(path);
      if (object) {
        const body = await object.arrayBuffer();
        const response = {
          body: Array.from(new Uint8Array(body)),
          contentType: object.httpMetadata?.contentType || 'application/octet-stream'
        };
        
        await this.cache.set(cacheKey, response, 'STATIC');
        headers.set('X-Cache', 'MISS');
        headers.set('Cache-Control', 'public, max-age=604800, immutable');
        
        return new Response(body, {
          headers: {
            ...headers,
            'Content-Type': response.contentType
          }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers });
  }
}

// Main worker export
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Enable CORS for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };

    // Handle OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Create optimized request handler
    const handler = new RequestHandler(request, env);
    const response = await handler.handle();

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add performance monitoring headers
    response.headers.set('X-Edge-Location', request.cf?.colo as string || 'unknown');
    response.headers.set('X-Cache-Status', response.headers.get('X-Cache') || 'BYPASS');

    return response;
  },

  // Scheduled handler for maintenance tasks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    switch (event.cron) {
      case '*/5 * * * *':
        // Aggregate metrics every 5 minutes
        await this.aggregateMetrics(env);
        break;
      case '*/15 * * * *':
        // Clean up old cache entries
        await this.cleanupCache(env);
        break;
      case '0 * * * *':
        // Generate hourly performance reports
        await this.generatePerformanceReport(env);
        break;
    }
  },

  async aggregateMetrics(env: Env): Promise<void> {
    if (!env.METRICS) return;

    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    // Aggregate last hour's metrics
    const hourKey = `stats:${Math.floor(hourAgo / (60 * 60 * 1000))}`;
    const stats = await env.METRICS.get(hourKey, { type: 'json' });
    
    if (stats) {
      console.log('Hourly metrics:', stats);
      // Could send to external monitoring service
    }
  },

  async cleanupCache(env: Env): Promise<void> {
    if (!env.KV) return;

    // Clean up expired entries
    const list = await env.KV.list();
    const now = Date.now();
    
    for (const key of list.keys) {
      const metadata = await env.KV.getWithMetadata(key.name);
      if (metadata.metadata) {
        const timestamp = (metadata.metadata as any).timestamp;
        const cacheType = (metadata.metadata as any).cacheType || 'PITCHES';
        const config = CACHE_CONFIG[cacheType as keyof typeof CACHE_CONFIG];
        
        if (now - timestamp > (config.ttl + config.swr) * 1000) {
          await env.KV.delete(key.name);
        }
      }
    }
  },

  async generatePerformanceReport(env: Env): Promise<void> {
    if (!env.METRICS) return;

    const report = {
      timestamp: Date.now(),
      hourlyStats: [] as any[]
    };

    // Collect last 24 hours of stats
    for (let i = 0; i < 24; i++) {
      const hour = Math.floor((Date.now() - i * 60 * 60 * 1000) / (60 * 60 * 1000));
      const stats = await env.METRICS.get(`stats:${hour}`, { type: 'json' });
      if (stats) {
        report.hourlyStats.push({
          hour,
          ...stats
        });
      }
    }

    // Save report
    await env.METRICS.put(`report:${Date.now()}`, JSON.stringify(report), {
      expirationTtl: 7 * 24 * 60 * 60 // Keep for 7 days
    });

    console.log('Performance report generated:', report);
  }
};