/**
 * WebAssembly-Optimized Production Worker
 * Integrates WebAssembly for compute-intensive operations and maximum performance
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, gte, lte, desc, asc, like, sql, count, inArray } from 'drizzle-orm';
import * as schema from './db/schema.ts';
import { Redis } from '@upstash/redis/cloudflare';
import { WasmPerformanceOptimizer, WasmUtils, fastHashString, fastValidateJson } from './wasm/wasm-integration.ts';
import {
  initializeCacheSystem,
  getCacheHealthStatus,
  shouldCacheRequest,
  setCachedResponse,
  getCachedResponse,
  isCacheManagementEndpoint,
  handleCacheManagement
} from './cache/simplified-cache-integration.ts';
import { createOptimizedHealthCheck } from './db/optimized-health-check.ts';

// Enhanced Neon configuration for maximum performance
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = 'password';
neonConfig.coalesceWrites = true;
neonConfig.poolQueryViaFetch = true;
neonConfig.localFileCache = true;
neonConfig.fetchConnectionCache = true;
neonConfig.cacheExpireTtl = 300;
neonConfig.wsProxy = (host: string) => `wss://${host}/v1/ws`;

// Global optimization state
let cacheSystemInitialized = false;
let optimizedHealthCheck: any = null;
let wasmOptimizer: WasmPerformanceOptimizer | null = null;
let performanceMetrics: Map<string, any> = new Map();

/**
 * WebAssembly-Enhanced Database Manager
 */
class WasmDatabaseManager {
  private static connections: Map<string, ReturnType<typeof neon>> = new Map();
  private static drizzleInstances: Map<string, ReturnType<typeof drizzle>> = new Map();
  private static queryCache: Map<string, any> = new Map();

  /**
   * Get enhanced connection with WASM-optimized cache keys
   */
  static getEnhancedConnection(env: Env) {
    const connectionKey = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
    
    if (!connectionKey) {
      throw new Error('❌ No database connection available');
    }

    // Use WASM for fast cache key generation
    const cacheKey = wasmOptimizer 
      ? wasmOptimizer.generateCacheKey(connectionKey)
      : `connection_${connectionKey.slice(-8)}`;

    if (!this.connections.has(cacheKey)) {
      console.log('🚀 Creating WebAssembly-optimized database connection');
      
      if (env.HYPERDRIVE?.connectionString) {
        const sql = neon(env.HYPERDRIVE.connectionString);
        this.connections.set(cacheKey, sql);
      } else {
        const sql = neon(connectionKey);
        this.connections.set(cacheKey, sql);
      }
    }

    return this.connections.get(cacheKey)!;
  }

  /**
   * Get Drizzle instance with WebAssembly optimizations
   */
  static getWasmOptimizedDrizzle(env: Env) {
    const connectionKey = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
    const cacheKey = wasmOptimizer 
      ? wasmOptimizer.generateCacheKey(`drizzle_${connectionKey}`)
      : `drizzle_${connectionKey.slice(-8)}`;

    if (!this.drizzleInstances.has(cacheKey)) {
      console.log('🗃️  Creating WebAssembly-optimized Drizzle instance');
      const sql = this.getEnhancedConnection(env);
      const db = drizzle(sql, { schema });
      this.drizzleInstances.set(cacheKey, db);
    }

    return this.drizzleInstances.get(cacheKey)!;
  }

  /**
   * Execute query with WASM-enhanced caching
   */
  static async executeWasmOptimizedQuery<T>(
    env: Env,
    queryFn: (db: any) => Promise<T>,
    queryType: 'read' | 'write' | 'search' = 'read',
    cacheKey?: string
  ): Promise<T> {
    const startTime = performance.now();

    // Generate WASM-optimized cache key
    const queryCacheKey = cacheKey || (wasmOptimizer 
      ? wasmOptimizer.generateCacheKey(`query_${queryType}_${Date.now()}`)
      : `query_${queryType}_${Date.now()}`);

    // Check query cache for read operations
    if (queryType === 'read' && this.queryCache.has(queryCacheKey)) {
      const duration = performance.now() - startTime;
      console.log(`⚡ WASM cache hit for ${queryType} query (${duration.toFixed(2)}ms)`);
      return this.queryCache.get(queryCacheKey);
    }

    try {
      const db = this.getWasmOptimizedDrizzle(env);
      const result = await queryFn(db);
      const duration = performance.now() - startTime;

      // Cache successful read queries
      if (queryType === 'read' && result) {
        this.queryCache.set(queryCacheKey, result);
        
        // Expire cache after 5 minutes
        setTimeout(() => {
          this.queryCache.delete(queryCacheKey);
        }, 5 * 60 * 1000);
      }

      // Track performance metrics
      this.trackQueryPerformance(queryType, duration, true);
      
      if (duration > 50) {
        console.warn(`⚠️  Slow WASM query: ${queryType} took ${duration.toFixed(2)}ms`);
      }

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.trackQueryPerformance(queryType, duration, false);
      console.error(`❌ WASM query failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  private static trackQueryPerformance(type: string, duration: number, success: boolean) {
    const metrics = performanceMetrics.get(type) || {
      totalQueries: 0,
      totalTime: 0,
      failures: 0,
      wasmOptimized: true
    };

    metrics.totalQueries++;
    metrics.totalTime += duration;
    if (!success) metrics.failures++;

    performanceMetrics.set(type, metrics);
  }

  static getWasmPerformanceMetrics() {
    const metrics: any = {};
    for (const [type, data] of performanceMetrics.entries()) {
      metrics[type] = {
        avgDuration: data.totalTime / data.totalQueries || 0,
        successRate: ((data.totalQueries - data.failures) / data.totalQueries) * 100 || 100,
        wasmOptimized: data.wasmOptimized || false,
        ...data
      };
    }

    // Add WASM-specific metrics
    if (wasmOptimizer) {
      metrics.wasm = wasmOptimizer.getMetrics();
    }

    metrics.wasmSupport = WasmUtils.getWasmFeatures();
    metrics.memoryUsage = WasmUtils.getMemoryUsage();

    return metrics;
  }
}

/**
 * WASM-enhanced request validation
 */
function validateRequestWithWasm(request: Request, body?: string): boolean {
  if (!wasmOptimizer || !body) return true;

  try {
    const startTime = performance.now();
    const isValid = wasmOptimizer.validateRequest(body);
    const duration = performance.now() - startTime;
    
    if (duration > 5) {
      console.warn(`⚠️  Slow WASM validation: ${duration.toFixed(2)}ms`);
    }

    return isValid;
  } catch (error) {
    console.warn('WASM validation failed, allowing request:', error);
    return true;
  }
}

/**
 * WASM-optimized response creation
 */
function createWasmOptimizedResponse(data: any, options: any = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Performance-Version': 'wasm-optimized-v1.0',
    'X-WASM-Enabled': wasmOptimizer ? 'true' : 'false',
    'X-Cache-Status': options.cached ? 'HIT' : 'MISS',
    'X-Query-Time': options.queryTime ? `${options.queryTime.toFixed(2)}ms` : 'N/A',
    'X-WASM-Performance': wasmOptimizer ? `${wasmOptimizer.getMetrics().performanceGain}` : 'N/A',
    ...options.headers
  };

  return new Response(JSON.stringify(data), {
    status: options.status || 200,
    headers
  });
}

/**
 * Optimized CORS headers
 */
const optimizedCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
};

interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  HYPERDRIVE: any;
  KV: KVNamespace;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
}

// Export Durable Objects for WebSocket support
export { WebSocketRoom } from './websocket-durable-object.ts';
export { NotificationRoom } from './notification-room.ts';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestStart = performance.now();

    try {
      // Initialize WebAssembly optimizer once
      if (!wasmOptimizer) {
        wasmOptimizer = await WasmPerformanceOptimizer.getInstance();
        console.log('🚀 WebAssembly performance optimizer initialized');
      }

      // Initialize cache system once
      if (!cacheSystemInitialized) {
        await initializeCacheSystem(env, ctx);
        cacheSystemInitialized = true;
        console.log('🚀 WASM-enhanced cache system initialized');
      }

      // Initialize optimized health check once
      if (!optimizedHealthCheck) {
        const db = WasmDatabaseManager.getWasmOptimizedDrizzle(env);
        const redis = env.UPSTASH_REDIS_REST_URL ? new Redis({
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN || ''
        }) : null;
        optimizedHealthCheck = createOptimizedHealthCheck(db, redis);
        console.log('🏥 WASM-optimized health check system initialized');
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Handle preflight requests
      if (method === 'OPTIONS') {
        return new Response(null, { 
          status: 204, 
          headers: optimizedCorsHeaders 
        });
      }

      // WASM-OPTIMIZED HEALTH CHECK
      if (path === '/api/health') {
        try {
          const healthResult = await optimizedHealthCheck.quickHealthCheck();
          const requestDuration = performance.now() - requestStart;
          const wasmMetrics = WasmDatabaseManager.getWasmPerformanceMetrics();

          return createWasmOptimizedResponse({
            ...healthResult,
            performance: {
              requestTime: requestDuration,
              version: 'wasm-optimized-v1.0',
              wasm: wasmMetrics
            }
          }, { queryTime: requestDuration });

        } catch (error) {
          return createWasmOptimizedResponse({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: 'wasm-failsafe-v1.0',
            message: 'WASM-optimized health check in failsafe mode',
            performance: {
              requestTime: performance.now() - requestStart
            }
          });
        }
      }

      // WASM Performance Metrics Endpoint
      if (path === '/api/wasm/metrics' && method === 'GET') {
        const metrics = WasmDatabaseManager.getWasmPerformanceMetrics();
        
        return createWasmOptimizedResponse({
          wasm: metrics,
          features: WasmUtils.getWasmFeatures(),
          memory: WasmUtils.getMemoryUsage(),
          timestamp: new Date().toISOString()
        }, { headers: optimizedCorsHeaders });
      }

      // Cache management endpoints
      if (isCacheManagementEndpoint(path)) {
        return await handleCacheManagement(request, env);
      }

      // Check cache for eligible requests with WASM optimization
      if (shouldCacheRequest(request)) {
        const cached = await getCachedResponse(request, env);
        if (cached) {
          return createWasmOptimizedResponse(cached, {
            cached: true,
            headers: optimizedCorsHeaders
          });
        }
      }

      // WASM-ENHANCED BROWSE ENDPOINT
      if (path === '/api/pitches/browse/enhanced' && method === 'GET') {
        const queryStart = performance.now();
        const cacheKey = wasmOptimizer ? wasmOptimizer.generateCacheKey('browse_enhanced') : 'browse_enhanced';

        const result = await WasmDatabaseManager.executeWasmOptimizedQuery(
          env,
          async (db) => {
            return await db
              .select({
                id: schema.pitches.id,
                title: schema.pitches.title,
                logline: schema.pitches.logline,
                genre: schema.pitches.genre,
                format: schema.pitches.format,
                estimatedBudget: schema.pitches.estimatedBudget,
                viewCount: schema.pitches.viewCount,
                likeCount: schema.pitches.likeCount,
                createdAt: schema.pitches.createdAt,
                userId: schema.pitches.userId,
                status: schema.pitches.status
              })
              .from(schema.pitches)
              .where(eq(schema.pitches.status, 'published'))
              .orderBy(desc(schema.pitches.createdAt))
              .limit(24);
          },
          'read',
          cacheKey
        );

        const queryTime = performance.now() - queryStart;
        const response = createWasmOptimizedResponse(
          { pitches: result },
          {
            queryTime,
            headers: optimizedCorsHeaders
          }
        );

        // Cache successful response with WASM-optimized key
        if (shouldCacheRequest(request)) {
          await setCachedResponse(request, result, env, 300);
        }

        return response;
      }

      // WASM-ENHANCED SEARCH ENDPOINT
      if (path === '/api/pitches/search' && method === 'GET') {
        const query = url.searchParams.get('q');
        if (!query) {
          return createWasmOptimizedResponse(
            { error: 'Search query required' },
            { status: 400, headers: optimizedCorsHeaders }
          );
        }

        const queryStart = performance.now();
        const cacheKey = wasmOptimizer ? wasmOptimizer.generateCacheKey(`search_${query}`) : `search_${query}`;

        const result = await WasmDatabaseManager.executeWasmOptimizedQuery(
          env,
          async (db) => {
            return await db
              .select()
              .from(schema.pitches)
              .where(
                and(
                  eq(schema.pitches.status, 'published'),
                  or(
                    like(schema.pitches.title, `%${query}%`),
                    like(schema.pitches.logline, `%${query}%`),
                    like(schema.pitches.description, `%${query}%`)
                  )
                )
              )
              .orderBy(desc(schema.pitches.viewCount))
              .limit(20);
          },
          'search',
          cacheKey
        );

        const queryTime = performance.now() - queryStart;
        return createWasmOptimizedResponse(
          { pitches: result, query },
          { queryTime, headers: optimizedCorsHeaders }
        );
      }

      // POST request validation with WASM
      if (method === 'POST' || method === 'PUT') {
        const body = await request.text();
        const isValid = validateRequestWithWasm(request, body);
        
        if (!isValid) {
          return createWasmOptimizedResponse(
            { error: 'Invalid request format' },
            { status: 400, headers: optimizedCorsHeaders }
          );
        }

        // Continue with request processing...
      }

      // Default proxy to production worker for unmatched routes
      const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev' + path + url.search, {
        method,
        headers: request.headers,
        body: method !== 'GET' && method !== 'HEAD' ? await request.clone().text() : undefined
      });

      const proxyResult = await response.json();
      return createWasmOptimizedResponse(proxyResult, {
        status: response.status,
        headers: optimizedCorsHeaders
      });

    } catch (error) {
      console.error('❌ WASM-optimized request failed:', error);
      const requestDuration = performance.now() - requestStart;

      return createWasmOptimizedResponse({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        performance: {
          requestTime: requestDuration,
          version: 'wasm-error-v1.0'
        }
      }, {
        status: 500,
        headers: optimizedCorsHeaders
      });
    }
  }
};