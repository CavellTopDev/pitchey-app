/**
 * Optimized Worker with Modular Service Architecture
 * Implements Phase 2 service bindings pattern within single Worker
 */

import { dbPool, withDatabase, Env } from './worker-database-pool.ts';
import { CachingService } from './caching-strategy.ts';
import { ServiceRouter } from './services/service-router.ts';
import { WebSocketRoom } from './websocket-room-optimized.ts';
import { Toucan } from 'toucan-js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry for error tracking
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: ctx,
      request,
      environment: env.SENTRY_ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE || 'phase2-services-v1.0'
    });

    try {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Initialize database pool and caching
      dbPool.initialize(env, sentry);
      const cache = new CachingService(env);

      // Initialize service router
      const router = new ServiceRouter(env, cache);

      // Route request through service architecture
      const response = await withDatabase(env, async (sql) => {
        return await router.route(request, sql);
      }, sentry);

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      // Add service architecture headers
      response.headers.set('X-Service-Architecture', 'modular');
      response.headers.set('X-Phase', '2-services');

      return response;

    } catch (error) {
      console.error('Worker error:', error);
      
      sentry.captureException(error as Error, {
        tags: {
          component: 'worker-main',
          phase: 'phase2-services'
        }
      });

      return new Response(JSON.stringify({
        success: false,
        error: { 
          message: 'Internal server error', 
          code: 'WORKER_ERROR' 
        }
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

// Export Durable Object class for Wrangler
export { WebSocketRoom };
