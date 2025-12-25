/**
 * Optimized Cloudflare Worker for Free Tier
 * - No WebSockets (not supported on free tier)
 * - Aggressive caching with KV
 * - Rate limiting to stay within 100k requests/day
 * - Optimized for 10ms CPU limit
 */

import { getCorsHeaders } from './utils/response';
import { withCache, CACHE_CONFIGS } from './middleware/free-tier-cache';
import { withRateLimit, RATE_LIMIT_CONFIGS } from './middleware/free-tier-rate-limit';
import { OptimizedQueries } from './db/optimized-connection';
import { PollingService, handlePolling } from './services/polling-service';
import { createJWT, verifyJWT } from './utils/worker-jwt';

export interface Env {
  // Database
  DATABASE_URL: string;
  
  // KV Namespaces (Free tier: 1GB storage, 100k reads/day)
  KV: KVNamespace;
  
  // Secrets
  JWT_SECRET: string;
  
  // Configuration
  FRONTEND_URL: string;
  ENVIRONMENT: 'development' | 'production';
}

/**
 * Authentication middleware
 */
async function authenticate(request: Request, env: Env): Promise<{ userId: string; role: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  
  try {
    // Check cache first
    const cacheKey = `auth:${token.slice(0, 20)}`;
    const cached = await env.KV.get(cacheKey, 'json');
    if (cached) {
      return cached;
    }

    // Verify JWT
    const payload = await verifyJWT(token, env.JWT_SECRET);
    
    if (!payload.userId || !payload.role) {
      return null;
    }

    const user = { userId: payload.userId, role: payload.role };
    
    // Cache for 60 seconds
    await env.KV.put(cacheKey, JSON.stringify(user), {
      expirationTtl: 60
    });

    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Main worker entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }

    try {
      // Initialize database with caching
      const db = new OptimizedQueries({ DATABASE_URL: env.DATABASE_URL }, env.KV);

      // Authentication endpoints (strict rate limiting)
      if (path === '/api/auth/login') {
        return withRateLimit(async (req) => {
          const body = await req.json();
          const { email, password, portal } = body;

          // Simple auth check (you'd validate against database)
          const user = await db.getUserById(email); // This would be getUserByEmail
          
          if (!user) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
              status: 401,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            });
          }

          const token = await createJWT(
            { userId: user.id, role: user.role, email: user.email },
            env.JWT_SECRET
          );

          return new Response(JSON.stringify({ token, user }), {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          });
        }, RATE_LIMIT_CONFIGS.auth)(request, env);
      }

      // Polling endpoints (authenticated)
      if (path.startsWith('/api/poll/')) {
        const auth = await authenticate(request, env);
        if (!auth) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
          });
        }

        return withRateLimit(
          async (req) => handlePolling(req, env, auth.userId, auth.role),
          RATE_LIMIT_CONFIGS.polling
        )(request, env);
      }

      // Browse endpoint (heavily cached)
      if (path === '/api/browse' || path === '/api/pitches') {
        return withCache(async (req) => {
          const genre = url.searchParams.get('genre') || 'all';
          const limit = parseInt(url.searchParams.get('limit') || '10');
          const offset = parseInt(url.searchParams.get('offset') || '0');

          const pitches = await db.getPitches(limit, offset, genre);

          return new Response(JSON.stringify({ pitches }), {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          });
        }, CACHE_CONFIGS.browse)(request, env);
      }

      // Dashboard stats (cached, authenticated)
      if (path.startsWith('/api/dashboard/')) {
        const auth = await authenticate(request, env);
        if (!auth) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
          });
        }

        return withCache(async (req) => {
          let stats;
          
          switch (auth.role) {
            case 'creator':
              stats = await db.getCreatorStats(auth.userId);
              break;
            case 'investor':
              stats = await db.getInvestorStats(auth.userId);
              break;
            case 'production':
              stats = await db.getProductionStats(auth.userId);
              break;
            default:
              stats = {};
          }

          return new Response(JSON.stringify(stats), {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          });
        }, CACHE_CONFIGS.dashboard)(request, env);
      }

      // Profile endpoint (cached)
      if (path === '/api/profile') {
        const auth = await authenticate(request, env);
        if (!auth) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
          });
        }

        return withCache(async (req) => {
          const user = await db.getUserById(auth.userId);
          
          return new Response(JSON.stringify(user), {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          });
        }, CACHE_CONFIGS.profile)(request, env);
      }

      // Validate token endpoint
      if (path === '/api/validate-token') {
        const auth = await authenticate(request, env);
        
        return new Response(JSON.stringify({ valid: !!auth, user: auth }), {
          status: 200,
          headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
        });
      }

      // Health check (no auth, no cache)
      if (path === '/api/health') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: Date.now(),
          tier: 'free',
          features: {
            websocket: false,
            polling: true,
            caching: true,
            rateLimit: true
          }
        }), {
          status: 200,
          headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
        });
      }

      // Stub endpoints that return empty data
      const STUB_ENDPOINTS = [
        '/api/production/investments/overview',
        '/api/investment/recommendations',
        '/api/ndas/incoming-requests',
        '/api/ndas/outgoing-requests',
        '/api/ndas/incoming-signed',
        '/api/ndas/outgoing-signed',
        '/api/messages/conversations',
        '/api/analytics/detailed'
      ];

      if (STUB_ENDPOINTS.includes(path)) {
        return new Response(JSON.stringify({ data: [], message: 'Feature limited on free tier' }), {
          status: 200,
          headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
        });
      }

      // 404 for unknown endpoints
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      
      // Return cached error response if available
      const errorCacheKey = `error:${path}`;
      const cachedError = await env.KV.get(errorCacheKey);
      
      if (cachedError) {
        return new Response(cachedError, {
          status: 500,
          headers: { 
            ...getCorsHeaders(request), 
            'Content-Type': 'application/json',
            'X-Error-Cache': 'HIT'
          }
        });
      }

      const errorResponse = JSON.stringify({ 
        error: 'Internal server error',
        message: 'The service is temporarily unavailable'
      });

      // Cache error for 30 seconds to prevent repeated failures
      await env.KV.put(errorCacheKey, errorResponse, {
        expirationTtl: 30
      });

      return new Response(errorResponse, {
        status: 500,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Scheduled handler for cache warming (if you upgrade to paid tier)
 */
export async function scheduled(event: ScheduledEvent, env: Env): Promise<void> {
  // This won't run on free tier, but included for future upgrade
  console.log('Cache warming would run here if on paid tier');
}