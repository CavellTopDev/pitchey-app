/**
 * Cache-Optimized Worker Implementation
 * Fixes 0% cache hit rate and implements cache warming
 */

import { EdgeCacheV2, initializeGlobalCache } from './utils/edge-cache-optimized-v2';
import { CacheWarmingService } from './services/cache-warming.service';
import { handleCacheMonitoringRoutes } from './routes/cache-monitoring.routes';

// Enhanced environment interface
export interface CacheOptimizedEnv {
  KV: KVNamespace;
  HYPERDRIVE?: Hyperdrive;
  WEBSOCKET_ROOMS?: DurableObjectNamespace;
  R2_BUCKET?: R2Bucket;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  FRONTEND_URL?: string;
}

// Global cache instance
let globalCache: EdgeCacheV2 | null = null;
let cacheWarmingService: CacheWarmingService | null = null;

/**
 * Initialize cache and warming service
 */
function initializeCacheServices(env: CacheOptimizedEnv): { cache: EdgeCacheV2; warming: CacheWarmingService } {
  if (!globalCache) {
    globalCache = initializeGlobalCache(env.KV);
    console.log('Global cache initialized successfully');
  }
  
  if (!cacheWarmingService) {
    cacheWarmingService = new CacheWarmingService(globalCache, env);
    console.log('Cache warming service initialized');
  }
  
  return { cache: globalCache, warming: cacheWarmingService };
}

/**
 * Cache middleware for automatic caching of GET requests
 */
async function cacheMiddleware(
  request: Request, 
  env: CacheOptimizedEnv,
  handler: () => Promise<Response>
): Promise<Response> {
  const { cache } = initializeCacheServices(env);
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;
  
  // Only cache GET requests
  if (method !== 'GET') {
    return handler();
  }
  
  // Skip caching for certain endpoints
  if (shouldSkipCache(pathname)) {
    const response = await handler();
    return addCacheHeaders(response, 'BYPASS');
  }
  
  // Try to get from cache
  const params = Object.fromEntries(url.searchParams);
  const cacheKey = pathname.replace('/api/', ''); // Normalize cache key
  
  const startTime = Date.now();
  const cached = await cache.get(cacheKey, params);
  
  if (cached) {
    const response = new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
    
    return addCacheHeaders(response, 'HIT', Date.now() - startTime);
  }
  
  // Execute handler and cache result
  const response = await handler();
  
  // Only cache successful responses
  if (response.status === 200 && shouldCacheResponse(pathname, response)) {
    try {
      const cloned = response.clone();
      const data = await cloned.json();
      
      const ttl = getTTLForEndpoint(pathname);
      await cache.set(cacheKey, data, ttl, params);
      
      console.log(`Cached response for ${cacheKey} with TTL ${ttl}s`);
    } catch (error) {
      console.error('Failed to cache response:', error);
    }
  }
  
  return addCacheHeaders(response, 'MISS', Date.now() - startTime);
}

/**
 * Determine if an endpoint should skip caching
 */
function shouldSkipCache(pathname: string): boolean {
  const skipPatterns = [
    '/api/auth/',
    '/api/user/me',
    '/api/session',
    '/api/health',
    '/api/cache/',
    '/ws'
  ];
  
  return skipPatterns.some(pattern => pathname.includes(pattern));
}

/**
 * Determine if a response should be cached
 */
function shouldCacheResponse(pathname: string, response: Response): boolean {
  // Check content type
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return false;
  }
  
  // Cacheable endpoints
  const cacheablePatterns = [
    '/api/pitches',
    '/api/dashboard',
    '/api/config',
    '/api/content',
    '/api/browse'
  ];
  
  return cacheablePatterns.some(pattern => pathname.includes(pattern));
}

/**
 * Get TTL based on endpoint type
 */
function getTTLForEndpoint(pathname: string): number {
  // High-frequency endpoints - shorter TTL
  if (pathname.includes('/browse/enhanced') || pathname.includes('/trending')) {
    return 300; // 5 minutes
  }
  
  // Dashboard and stats - medium TTL
  if (pathname.includes('/dashboard') || pathname.includes('/stats')) {
    return 300; // 5 minutes
  }
  
  // Configuration - longer TTL
  if (pathname.includes('/config')) {
    return 1800; // 30 minutes
  }
  
  // Static content - longest TTL
  if (pathname.includes('/content')) {
    return 3600; // 1 hour
  }
  
  // Default TTL
  return 600; // 10 minutes
}

/**
 * Add cache-related headers to response
 */
function addCacheHeaders(response: Response, status: 'HIT' | 'MISS' | 'BYPASS', duration?: number): Response {
  const headers = new Headers(response.headers);
  
  headers.set('X-Cache-Status', status);
  headers.set('X-Powered-By', 'Cloudflare Workers + EdgeCacheV2');
  
  if (duration !== undefined) {
    headers.set('X-Response-Time', `${duration}ms`);
  }
  
  // Add appropriate cache control headers
  if (status === 'HIT') {
    headers.set('Cache-Control', 'public, max-age=60');
  } else if (status === 'MISS') {
    headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  } else {
    headers.set('Cache-Control', 'no-cache, no-store');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Handle cache warming on startup
 */
async function handleStartupCacheWarming(env: CacheOptimizedEnv, ctx: ExecutionContext): Promise<void> {
  try {
    const { warming } = initializeCacheServices(env);
    
    // Warm high priority cache asynchronously
    ctx.waitUntil(
      warming.warmHighPriorityCache()
        .then(results => {
          const successful = results.filter(r => r.success).length;
          console.log(`Startup cache warming completed: ${successful}/${results.length} successful`);
        })
        .catch(error => {
          console.error('Startup cache warming failed:', error);
        })
    );
  } catch (error) {
    console.error('Failed to initialize cache warming:', error);
  }
}

/**
 * Main fetch handler with cache optimization
 */
export default {
  async fetch(request: Request, env: CacheOptimizedEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      // Initialize cache services
      const { cache } = initializeCacheServices(env);
      
      // Trigger startup cache warming (async)
      handleStartupCacheWarming(env, ctx);
      
      const url = new URL(request.url);
      const pathname = url.pathname;
      
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
          }
        });
      }
      
      // Handle cache monitoring routes
      const cacheResponse = await handleCacheMonitoringRoutes(request, env, pathname);
      if (cacheResponse) {
        return cacheResponse;
      }
      
      // Handle WebSocket upgrade
      if (pathname === '/ws') {
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader?.toLowerCase() === 'websocket') {
          // Handle WebSocket connection
          return new Response('WebSocket endpoint', { status: 426 });
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'WebSocket endpoint ready'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Handle API routes with cache middleware
      if (pathname.startsWith('/api/')) {
        return cacheMiddleware(request, env, async () => {
          // This would normally call your existing API handlers
          // For now, return mock data to test caching
          return handleMockAPIResponse(pathname, request);
        });
      }
      
      // Default response for non-API routes
      return new Response(JSON.stringify({
        success: true,
        message: 'Cache-optimized worker is running',
        cache_stats: cache.getStats(),
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Mock API response handler for testing cache functionality
 */
async function handleMockAPIResponse(pathname: string, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  
  // Simulate different endpoints
  let responseData;
  
  switch (true) {
    case pathname.includes('/pitches/browse/enhanced'):
      responseData = {
        success: true,
        data: {
          trending: [
            { id: 1, title: 'AI Horror Film', genre: 'Horror', status: 'active' },
            { id: 2, title: 'Space Adventure', genre: 'Sci-Fi', status: 'active' }
          ],
          new_releases: [
            { id: 3, title: 'Romantic Comedy', genre: 'Romance', status: 'new' }
          ],
          featured: [
            { id: 4, title: 'Documentary Project', genre: 'Documentary', status: 'featured' }
          ],
          total_count: 4,
          cache_enabled: true
        },
        meta: {
          endpoint: pathname,
          params,
          timestamp: new Date().toISOString(),
          cache_test: true
        }
      };
      break;
      
    case pathname.includes('/dashboard/stats'):
      responseData = {
        success: true,
        data: {
          total_pitches: 150,
          active_users: 75,
          recent_activity: [
            { action: 'pitch_created', user: 'John Doe', time: '2 minutes ago' },
            { action: 'pitch_viewed', user: 'Jane Smith', time: '5 minutes ago' }
          ],
          performance: {
            cache_hit_rate: '85%',
            response_time: '120ms'
          }
        },
        meta: {
          endpoint: pathname,
          timestamp: new Date().toISOString()
        }
      };
      break;
      
    case pathname.includes('/config'):
      responseData = {
        success: true,
        data: {
          app_name: 'Pitchey',
          version: '1.0.0',
          features: {
            cache_enabled: true,
            realtime_enabled: true,
            upload_enabled: true
          },
          limits: {
            max_file_size: '10MB',
            max_pitches_per_user: 50
          }
        },
        meta: {
          endpoint: pathname,
          timestamp: new Date().toISOString()
        }
      };
      break;
      
    default:
      responseData = {
        success: true,
        data: {
          message: 'Mock API response',
          endpoint: pathname,
          method: request.method,
          timestamp: Date.now()
        },
        meta: {
          cache_test: true
        }
      };
  }
  
  // Add a small delay to simulate API processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
  
  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}