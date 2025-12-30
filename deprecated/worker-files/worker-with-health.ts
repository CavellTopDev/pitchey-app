/**
 * Production Worker with Health Monitoring Integration
 * Includes comprehensive health checks and monitoring endpoints
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Redis } from '@upstash/redis/cloudflare';
import healthRoutes from './routes/health.routes';
import featureFlagRoutes from './routes/feature-flags.routes';
import { getFeatureFlagService } from './services/feature-flags';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Configure Neon for edge
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = 'password';
neonConfig.coalesceWrites = true;
neonConfig.poolQueryViaFetch = true;

export interface Env {
  // KV Namespaces
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  
  // Durable Objects
  WEBSOCKET_ROOMS: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;
  
  // R2 Bucket
  STORAGE: R2Bucket;
  
  // Database
  DATABASE_URL: string;
  HYPERDRIVE?: any;
  
  // Redis
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  
  // Secrets
  JWT_SECRET: string;
  SENTRY_DSN?: string;
  
  // Environment
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://pitchey-5o8.pages.dev',
      /https:\/\/.*\.pitchey\.pages\.dev$/
    ];
    
    if (!origin) return null;
    
    const isAllowed = allowed.some(pattern => {
      if (typeof pattern === 'string') return pattern === origin;
      return pattern.test(origin);
    });
    
    return isAllowed ? origin : null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// Request ID middleware
app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
});

// Error handling middleware
app.onError((err, c) => {
  console.error(`Error in request ${c.get('requestId')}:`, err);
  
  // Report to Sentry if configured
  if (c.env.SENTRY_DSN) {
    // Sentry reporting would go here
  }
  
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    requestId: c.get('requestId')
  }, 500);
});

// Mount health routes
app.route('/health', healthRoutes);
app.route('/api/health', healthRoutes);

// Mount feature flag routes
app.route('/api/feature-flags', featureFlagRoutes);

// Initialize feature flags on first request
let flagsInitialized = false;
app.use('/api/*', async (c, next) => {
  if (!flagsInitialized && c.env.UPSTASH_REDIS_REST_URL) {
    try {
      const redis = new Redis({
        url: c.env.UPSTASH_REDIS_REST_URL,
        token: c.env.UPSTASH_REDIS_REST_TOKEN
      });
      
      const flagService = getFeatureFlagService(redis);
      await flagService.initialize();
      flagsInitialized = true;
    } catch (error) {
      console.error('Failed to initialize feature flags:', error);
    }
  }
  await next();
});

// Main health check endpoint
app.get('/', (c) => {
  return c.json({
    service: 'Pitchey API',
    version: '3.0.0',
    status: 'healthy',
    environment: c.env.ENVIRONMENT || 'production',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint for monitoring
app.get('/metrics', async (c) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'production',
    cache: {
      available: !!c.env.CACHE
    },
    database: {
      configured: !!c.env.DATABASE_URL
    },
    redis: {
      configured: !!c.env.UPSTASH_REDIS_REST_URL
    },
    storage: {
      available: !!c.env.STORAGE
    }
  };
  
  return c.json(metrics);
});

// Database health check
app.get('/api/health/database', async (c) => {
  try {
    if (!c.env.DATABASE_URL) {
      return c.json({ 
        status: 'unhealthy', 
        error: 'Database not configured' 
      }, 503);
    }
    
    // Use Hyperdrive if available
    const dbUrl = c.env.HYPERDRIVE?.connectionString || c.env.DATABASE_URL;
    const sql = neon(dbUrl);
    
    const startTime = Date.now();
    const result = await sql`SELECT 1 as health_check`;
    const latency = Date.now() - startTime;
    
    return c.json({
      status: 'healthy',
      latency: `${latency}ms`,
      hyperdrive: !!c.env.HYPERDRIVE
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message
    }, 503);
  }
});

// Redis health check
app.get('/api/health/redis', async (c) => {
  try {
    if (!c.env.UPSTASH_REDIS_REST_URL) {
      return c.json({ 
        status: 'unhealthy', 
        error: 'Redis not configured' 
      }, 503);
    }
    
    const redis = new Redis({
      url: c.env.UPSTASH_REDIS_REST_URL,
      token: c.env.UPSTASH_REDIS_REST_TOKEN
    });
    
    const startTime = Date.now();
    await redis.ping();
    const latency = Date.now() - startTime;
    
    return c.json({
      status: 'healthy',
      latency: `${latency}ms`
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message
    }, 503);
  }
});

// Storage health check
app.get('/api/health/storage', async (c) => {
  try {
    if (!c.env.STORAGE) {
      return c.json({ 
        status: 'unhealthy', 
        error: 'Storage not configured' 
      }, 503);
    }
    
    // Try to list a single object to verify access
    const startTime = Date.now();
    const list = await c.env.STORAGE.list({ limit: 1 });
    const latency = Date.now() - startTime;
    
    return c.json({
      status: 'healthy',
      latency: `${latency}ms`,
      objects: list.objects.length
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message
    }, 503);
  }
});

// Cache health check
app.get('/api/health/cache', async (c) => {
  try {
    if (!c.env.CACHE) {
      return c.json({ 
        status: 'unhealthy', 
        error: 'Cache not configured' 
      }, 503);
    }
    
    const testKey = `health_check_${Date.now()}`;
    const testValue = 'healthy';
    
    const startTime = Date.now();
    await c.env.CACHE.put(testKey, testValue, { expirationTtl: 60 });
    const retrieved = await c.env.CACHE.get(testKey);
    await c.env.CACHE.delete(testKey);
    const latency = Date.now() - startTime;
    
    if (retrieved !== testValue) {
      throw new Error('Cache read/write mismatch');
    }
    
    return c.json({
      status: 'healthy',
      latency: `${latency}ms`
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message
    }, 503);
  }
});

// Comprehensive health check
app.get('/api/health/ready', async (c) => {
  const checks = await Promise.allSettled([
    fetch(`${c.req.url.replace('/ready', '/database')}`).then(r => r.json()),
    fetch(`${c.req.url.replace('/ready', '/redis')}`).then(r => r.json()),
    fetch(`${c.req.url.replace('/ready', '/storage')}`).then(r => r.json()),
    fetch(`${c.req.url.replace('/ready', '/cache')}`).then(r => r.json())
  ]);
  
  const results = {
    database: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'unhealthy', error: 'Check failed' },
    redis: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'unhealthy', error: 'Check failed' },
    storage: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'unhealthy', error: 'Check failed' },
    cache: checks[3].status === 'fulfilled' ? checks[3].value : { status: 'unhealthy', error: 'Check failed' }
  };
  
  const allHealthy = Object.values(results).every(r => r.status === 'healthy');
  
  return c.json({
    status: allHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: results
  }, allHealthy ? 200 : 503);
});

// Import existing API routes here
// This would include all your existing routes from the production worker
// For now, we'll add a placeholder
app.all('/api/*', async (c) => {
  // Proxy to existing backend or handle with existing routes
  return c.json({
    message: 'API endpoint',
    path: c.req.path,
    method: c.req.method
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    requestId: c.get('requestId')
  }, 404);
});

export default {
  fetch: app.fetch,
  
  // Scheduled handler for cron jobs
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    switch (event.cron) {
      case '*/5 * * * *': // Every 5 minutes
        // Health check monitoring
        await this.performHealthChecks(env);
        break;
      case '0 * * * *': // Every hour
        // Cleanup old cache entries
        await this.cleanupCache(env);
        break;
      case '0 2 * * *': // Daily at 2 AM
        // Daily maintenance tasks
        await this.performMaintenance(env);
        break;
    }
  },
  
  async performHealthChecks(env: Env) {
    try {
      const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/ready');
      const data = await response.json();
      
      if (data.status !== 'ready' && env.UPSTASH_REDIS_REST_URL) {
        // Alert on degraded status
        const redis = new Redis({
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN
        });
        
        await redis.lpush('health_alerts', JSON.stringify({
          timestamp: new Date().toISOString(),
          status: data.status,
          checks: data.checks
        }));
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  },
  
  async cleanupCache(env: Env) {
    // Implement cache cleanup logic
    console.log('Performing cache cleanup');
  },
  
  async performMaintenance(env: Env) {
    // Implement maintenance tasks
    console.log('Performing daily maintenance');
  }
};