/**
 * Enhanced Cloudflare Worker with Hyperdrive Database Integration
 * 
 * This worker demonstrates the complete integration of:
 * - Hyperdrive for Neon PostgreSQL connectivity
 * - Service layer with caching
 * - Error handling and retry logic
 * - Performance monitoring
 * - Progressive migration support
 */

import { createWorkerDbClient, HealthCheck, QueryCache } from './db/worker-client';
import { createUserService } from './services/worker/user.service';
import { corsHeaders } from './utils/response';

export interface Env {
  // Database
  HYPERDRIVE: Hyperdrive;
  DATABASE_URL?: string; // Fallback
  
  // Storage
  CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  
  // Real-time
  WEBSOCKET_ROOM: DurableObjectNamespace;
  
  // Configuration
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL?: string; // For progressive migration
  
  // Monitoring
  ANALYTICS?: AnalyticsEngineDataset;
}

/**
 * Request context for dependency injection
 */
interface RequestContext {
  db: ReturnType<typeof createWorkerDbClient>;
  cache: QueryCache;
  userService: ReturnType<typeof createUserService>;
  env: Env;
}

/**
 * Initialize request context with all services
 */
async function initializeContext(env: Env): Promise<RequestContext> {
  // Initialize database with Hyperdrive
  const db = createWorkerDbClient(env);
  
  // Initialize cache
  const cache = new QueryCache(env.CACHE);
  
  // Initialize services
  const userService = createUserService(db, env.CACHE);
  
  return {
    db,
    cache,
    userService,
    env
  };
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request.headers.get('Origin'), env)
      });
    }
    
    // Initialize context
    let context: RequestContext;
    try {
      context = await initializeContext(env);
    } catch (error) {
      console.error('Failed to initialize context:', error);
      return new Response(
        JSON.stringify({ error: 'Service initialization failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return handleHealthCheck(context);
    }
    
    // Database test endpoint
    if (url.pathname === '/api/db-test') {
      return handleDatabaseTest(context);
    }
    
    // API Routes
    try {
      // User routes
      if (url.pathname.startsWith('/api/users')) {
        return await handleUserRoutes(request, url, context);
      }
      
      // Auth routes
      if (url.pathname.startsWith('/api/auth')) {
        return await handleAuthRoutes(request, url, context);
      }
      
      // Pitch routes
      if (url.pathname.startsWith('/api/pitches')) {
        return await handlePitchRoutes(request, url, context);
      }
      
      // WebSocket upgrade
      if (url.pathname === '/ws') {
        return handleWebSocketUpgrade(request, env);
      }
      
      // Progressive migration: proxy to Deno for unimplemented routes
      if (env.ORIGIN_URL) {
        return proxyToOrigin(request, env.ORIGIN_URL);
      }
      
      // 404 for unmatched routes
      return new Response(
        JSON.stringify({ error: 'Route not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
      
    } catch (error) {
      return handleError(error, context);
    }
  }
};

/**
 * Health check handler
 */
async function handleHealthCheck(context: RequestContext): Promise<Response> {
  const healthCheck = new HealthCheck(context.db);
  
  try {
    const [dbHealth, poolStats] = await Promise.all([
      healthCheck.isHealthy(),
      healthCheck.getPoolStats()
    ]);
    
    const status = {
      status: dbHealth ? 'healthy' : 'unhealthy',
      database: dbHealth ? 'connected' : 'disconnected',
      hyperdrive: true,
      pool: poolStats,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(status), {
      status: dbHealth ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'unhealthy', 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Database test endpoint
 */
async function handleDatabaseTest(context: RequestContext): Promise<Response> {
  const tests: any = {
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  // Test 1: Basic connectivity
  try {
    const result = await context.db.execute('SELECT 1 as test');
    tests.tests.push({
      name: 'Basic connectivity',
      passed: result.rows[0]?.test === 1,
      duration: 0
    });
  } catch (error) {
    tests.tests.push({
      name: 'Basic connectivity',
      passed: false,
      error: error.message
    });
  }
  
  // Test 2: Table access
  try {
    const start = Date.now();
    const result = await context.db.execute('SELECT COUNT(*) as count FROM users');
    const duration = Date.now() - start;
    
    tests.tests.push({
      name: 'Table access',
      passed: true,
      userCount: result.rows[0]?.count,
      duration: `${duration}ms`
    });
  } catch (error) {
    tests.tests.push({
      name: 'Table access',
      passed: false,
      error: error.message
    });
  }
  
  // Test 3: Complex query
  try {
    const start = Date.now();
    const result = await context.db.execute(`
      SELECT 
        u.user_type,
        COUNT(*) as count,
        MAX(u.created_at) as latest
      FROM users u
      GROUP BY u.user_type
      ORDER BY count DESC
    `);
    const duration = Date.now() - start;
    
    tests.tests.push({
      name: 'Complex query',
      passed: true,
      results: result.rows,
      duration: `${duration}ms`
    });
  } catch (error) {
    tests.tests.push({
      name: 'Complex query',
      passed: false,
      error: error.message
    });
  }
  
  // Test 4: Cache functionality
  try {
    const key = 'test:cache';
    const value = { test: true, timestamp: Date.now() };
    
    await context.cache.set(key, value);
    const retrieved = await context.cache.get(key);
    
    tests.tests.push({
      name: 'Cache functionality',
      passed: JSON.stringify(retrieved) === JSON.stringify(value),
      cached: retrieved
    });
  } catch (error) {
    tests.tests.push({
      name: 'Cache functionality',
      passed: false,
      error: error.message
    });
  }
  
  // Summary
  tests.summary = {
    total: tests.tests.length,
    passed: tests.tests.filter((t: any) => t.passed).length,
    failed: tests.tests.filter((t: any) => !t.passed).length
  };
  
  return new Response(JSON.stringify(tests, null, 2), {
    status: tests.summary.failed > 0 ? 500 : 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * User routes handler
 */
async function handleUserRoutes(
  request: Request,
  url: URL,
  context: RequestContext
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  
  // GET /api/users - List users
  if (path === '/api/users' && method === 'GET') {
    const filters: any = {};
    const options: any = {
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '20')
    };
    
    // Parse filters from query params
    if (url.searchParams.has('userType')) {
      filters.userType = url.searchParams.get('userType');
    }
    if (url.searchParams.has('search')) {
      filters.search = url.searchParams.get('search');
    }
    
    const result = await context.userService.getUsers(filters, options);
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // GET /api/users/:id - Get user by ID
  const userMatch = path.match(/^\/api\/users\/(\d+)$/);
  if (userMatch && method === 'GET') {
    const userId = parseInt(userMatch[1]);
    const user = await context.userService.findById(userId);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // GET /api/users/stats - Get user statistics
  if (path === '/api/users/stats' && method === 'GET') {
    const stats = await context.userService.getUserStats();
    
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // POST /api/users - Create user
  if (path === '/api/users' && method === 'POST') {
    const body = await request.json();
    const user = await context.userService.createUser(body);
    
    return new Response(JSON.stringify(user), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Not implemented yet
  return new Response(
    JSON.stringify({ error: 'User route not implemented' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Auth routes handler (placeholder)
 */
async function handleAuthRoutes(
  request: Request,
  url: URL,
  context: RequestContext
): Promise<Response> {
  // To be implemented with JWT handling
  return new Response(
    JSON.stringify({ error: 'Auth routes not yet implemented' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Pitch routes handler (placeholder)
 */
async function handlePitchRoutes(
  request: Request,
  url: URL,
  context: RequestContext
): Promise<Response> {
  // To be implemented
  return new Response(
    JSON.stringify({ error: 'Pitch routes not yet implemented' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * WebSocket upgrade handler
 */
function handleWebSocketUpgrade(request: Request, env: Env): Response {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }
  
  // Create a new WebSocket pair
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  
  // Get or create durable object instance
  const id = env.WEBSOCKET_ROOM.idFromName('main-room');
  const room = env.WEBSOCKET_ROOM.get(id);
  
  // Forward the WebSocket to the durable object
  room.fetch(new Request('https://fake-host/', {
    method: 'GET',
    headers: { 'Upgrade': 'websocket' },
    // @ts-ignore
    webSocket: server
  }));
  
  return new Response(null, {
    status: 101,
    // @ts-ignore
    webSocket: client
  });
}

/**
 * Proxy to origin for progressive migration
 */
async function proxyToOrigin(request: Request, originUrl: string): Promise<Response> {
  const url = new URL(request.url);
  const proxiedUrl = originUrl + url.pathname + url.search;
  
  // Forward the request
  const response = await fetch(proxiedUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  // Add CORS headers to proxied response
  const headers = new Headers(response.headers);
  headers.set('X-Proxied-From', 'cloudflare-workers');
  
  return new Response(response.body, {
    status: response.status,
    headers
  });
}

/**
 * Error handler
 */
function handleError(error: any, context: RequestContext): Response {
  console.error('Request error:', error);
  
  // Log to analytics if available
  if (context.env.ANALYTICS) {
    context.env.ANALYTICS.writeDataPoint({
      blobs: ['error'],
      doubles: [1],
      indexes: [error.message || 'unknown']
    });
  }
  
  // Determine error type and status
  let status = 500;
  let message = 'Internal server error';
  
  if (error.message?.includes('timeout')) {
    status = 504;
    message = 'Database timeout';
  } else if (error.message?.includes('connection')) {
    status = 503;
    message = 'Database connection error';
  } else if (error.message?.includes('validation')) {
    status = 400;
    message = error.message;
  }
  
  return new Response(
    JSON.stringify({ 
      error: message,
      timestamp: new Date().toISOString()
    }),
    { 
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Utility: CORS headers
 */
function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowedOrigin = origin && isAllowedOrigin(origin, env) 
    ? origin 
    : env.FRONTEND_URL || '*';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * Check if origin is allowed
 */
function isAllowedOrigin(origin: string, env: Env): boolean {
  if (!origin) return false;
  
  // Allow configured frontend
  if (origin === env.FRONTEND_URL) return true;
  
  // Allow Cloudflare Pages domains
  if (origin.includes('.pages.dev')) return true;
  
  // Allow localhost for development
  if (origin.includes('localhost')) return true;
  
  return false;
}