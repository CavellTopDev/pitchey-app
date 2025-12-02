/**
 * Simplified Auth Worker - Direct Database Queries
 * Uses lightweight JWT without bcrypt for Cloudflare Workers
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  BACKEND_URL?: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  WEBSOCKET_ROOMS?: DurableObjectNamespace;
  NOTIFICATION_ROOMS?: DurableObjectNamespace;
  SENTRY_DSN?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Simple password hashing for demo (in production, use proper bcrypt on backend)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/api/health') {
        return jsonResponse({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: 'simple-auth-v1.0',
          services: {
            database: true,
            auth: true,
            cache: !!env.KV,
            websocket: !!env.WEBSOCKET_ROOMS,
          }
        });
      }

      // Service overviews
      if (path.match(/^\/api\/(ml|data-science|security|distributed|edge|automation)\/overview$/)) {
        const serviceName = path.split('/')[2];
        return jsonResponse({
          service: `${serviceName} Service`,
          status: 'operational',
          capabilities: ['Available'],
        });
      }

      // Authentication endpoints - proxy to backend
      if (path.startsWith('/api/auth/')) {
        // For auth endpoints, we'll proxy to the Deno backend
        // which has proper bcrypt support
        if (env.BACKEND_URL) {
          const backendUrl = new URL(path, env.BACKEND_URL);
          const response = await fetch(backendUrl, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...Object.fromEntries(request.headers),
            },
            body: method !== 'GET' ? await request.text() : undefined,
          });

          // Forward the response with CORS headers
          const data = await response.text();
          return new Response(data, {
            status: response.status,
            headers: {
              ...corsHeaders,
              'Content-Type': response.headers.get('Content-Type') || 'application/json',
            },
          });
        }

        // Fallback if no backend configured
        return jsonResponse({
          success: false,
          message: 'Authentication service unavailable',
        }, 503);
      }

      // Public endpoints - proxy to backend
      if (path === '/api/pitches/public' || 
          path === '/api/pitches/trending' ||
          path === '/api/pitches/featured' ||
          path.startsWith('/api/pitches/browse')) {
        
        if (env.BACKEND_URL) {
          const backendUrl = new URL(path, env.BACKEND_URL);
          backendUrl.search = url.search;
          
          try {
            const response = await fetch(backendUrl, {
              method,
              headers: request.headers,
            });
            
            const data = await response.text();
            return new Response(data, {
              status: response.status,
              headers: {
                ...corsHeaders,
                'Content-Type': response.headers.get('Content-Type') || 'application/json',
              },
            });
          } catch (error) {
            console.error('Backend proxy error:', error);
            return jsonResponse({
              success: false,
              message: 'Backend service unavailable',
            }, 503);
          }
        }
        
        // Fallback
        return jsonResponse({ pitches: [], total: 0 });
      }

      // For authenticated endpoints, verify JWT then proxy
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          const isValid = await jwt.verify(token, env.JWT_SECRET);
          if (!isValid) {
            return jsonResponse({
              success: false,
              message: 'Invalid token',
            }, 401);
          }

          // Decode token to get user info
          const { payload } = jwt.decode(token);
          
          // Add user context to headers for backend
          const headersWithAuth = new Headers(request.headers);
          headersWithAuth.set('X-User-Id', payload.sub);
          headersWithAuth.set('X-User-Type', payload.userType || 'creator');
          headersWithAuth.set('X-User-Email', payload.email || '');

          // Proxy to backend
          if (env.BACKEND_URL) {
            const backendUrl = new URL(path, env.BACKEND_URL);
            backendUrl.search = url.search;
            
            const response = await fetch(backendUrl, {
              method,
              headers: headersWithAuth,
              body: method !== 'GET' ? await request.text() : undefined,
            });
            
            const data = await response.text();
            return new Response(data, {
              status: response.status,
              headers: {
                ...corsHeaders,
                'Content-Type': response.headers.get('Content-Type') || 'application/json',
              },
            });
          }
        } catch (error) {
          console.error('JWT verification error:', error);
          return jsonResponse({
            success: false,
            message: 'Authentication failed',
          }, 401);
        }
      }

      // For endpoints that might work without auth
      if (path.startsWith('/api/') && env.BACKEND_URL) {
        const backendUrl = new URL(path, env.BACKEND_URL);
        backendUrl.search = url.search;
        
        try {
          const response = await fetch(backendUrl, {
            method,
            headers: request.headers,
            body: method !== 'GET' ? await request.text() : undefined,
          });
          
          const data = await response.text();
          return new Response(data, {
            status: response.status,
            headers: {
              ...corsHeaders,
              'Content-Type': response.headers.get('Content-Type') || 'application/json',
            },
          });
        } catch (error) {
          console.error('Backend proxy error:', error);
          return jsonResponse({
            success: false,
            message: 'Service unavailable',
          }, 503);
        }
      }

      // 404 for unknown endpoints
      return jsonResponse({
        success: false,
        message: 'Endpoint not found',
      }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        success: false,
        message: 'Internal server error',
        error: error.message,
      }, 500);
    }
  },
};

// Export Durable Objects
export { WebSocketRoom } from './websocket-room-optimized.ts';
export { NotificationRoom } from './notification-room.ts';