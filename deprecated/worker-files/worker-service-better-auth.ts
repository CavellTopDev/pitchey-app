/**
 * Worker Service with Better Auth Integration
 * This is a patched version of worker-service-optimized.ts that uses Better Auth
 */

import { Toucan } from 'toucan-js';
import { WebSocketRoom } from './websocket-room-optimized.ts';
import { 
  createAuth, 
  handleAuthRoute, 
  verifySession 
} from './auth/better-auth-worker-integration';
import { handleHealthEndpoints } from './worker-health-endpoints';

// Import the existing worker service to maintain all functionality
// import existingWorker from './worker-service-optimized.ts';

// Enhanced environment interface
interface Env {
  // Database
  DATABASE_URL: string;
  HYPERDRIVE?: any;
  
  // Auth
  JWT_SECRET: string;
  
  // Services
  WEBSOCKET_ROOMS: DurableObjectNamespace;
  KV?: KVNamespace;
  R2?: R2Bucket;
  
  // Configuration
  FRONTEND_URL?: string;
  SENTRY_DSN?: string;
  NODE_ENV?: string;
  DENO_ENV?: string;
  
  // OAuth (optional)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  
  // Email (optional)
  SENDGRID_API_KEY?: string;
  
  // Redis cache (optional)
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: ctx,
      environment: env.NODE_ENV || 'production',
      release: 'worker-better-auth-v1.0',
      request
    });

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { 
          status: 204,
          headers: corsHeaders 
        });
      }

      // PRIORITY 1: Handle health and monitoring endpoints
      const healthResponse = await handleHealthEndpoints(pathname, env);
      if (healthResponse) {
        return healthResponse;
      }

      // PRIORITY 2: Handle Better Auth routes
      if (pathname.startsWith('/api/auth')) {
        try {
          const authResponse = await handleAuthRoute(request, pathname, env);
          if (authResponse) {
            // Add CORS headers to auth responses
            const headers = new Headers(authResponse.headers);
            Object.entries(corsHeaders).forEach(([key, value]) => {
              headers.set(key, value);
            });
            return new Response(authResponse.body, {
              status: authResponse.status,
              headers
            });
          }
        } catch (error) {
          sentry.captureException(error);
          console.error('Better Auth error:', error);
          return new Response(JSON.stringify({
            error: 'Authentication service error'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // PRIORITY 3: Handle all other routes directly
      // Since we're replacing the worker entirely, we'll handle routes here
      
      // Patch the request with Better Auth session verification
      let patchedRequest = new Proxy(request, {
        get(target, prop) {
          if (prop === 'betterAuthUser') {
            // This will be set if the route requires authentication
            return null;
          }
          return target[prop as keyof Request];
        }
      });

      // For protected routes, verify session with Better Auth
      const protectedRoutes = [
        '/api/creator/',
        '/api/investor/',
        '/api/production/',
        '/api/pitches/create',
        '/api/pitches/update',
        '/api/pitches/delete',
        '/api/nda/',
        '/api/investments/',
        '/api/follows/',
        '/api/notifications/',
        '/api/analytics/',
        '/api/profile',
        '/api/payments/'
      ];

      const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
      
      if (isProtectedRoute) {
        const auth = createAuth(env);
        const sessionResult = await verifySession(request, auth);
        
        if (!sessionResult.success) {
          return sessionResult.error!;
        }

        // Inject user into the request for the existing worker to use
        // We'll modify the Authorization header to include user data
        const modifiedHeaders = new Headers(request.headers);
        modifiedHeaders.set('X-Better-Auth-User', JSON.stringify(sessionResult.user));
        modifiedHeaders.set('X-Better-Auth-Session', JSON.stringify(sessionResult.session));
        
        patchedRequest = new Request(request.url, {
          method: request.method,
          headers: modifiedHeaders,
          body: request.body
        }) as any;
      }

      // PRIORITY 4: Handle WebSocket with Better Auth
      if (pathname.startsWith('/ws') || pathname.startsWith('/websocket')) {
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
          return new Response('Expected Upgrade: websocket', { status: 426 });
        }

        // Extract token and verify with Better Auth
        const token = url.searchParams.get('token');
        if (!token) {
          return new Response('Unauthorized: No token provided', { status: 401 });
        }

        const auth = createAuth(env);
        const sessionResult = await verifySession(
          new Request(request.url, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }),
          auth
        );

        if (!sessionResult.success) {
          return new Response('Unauthorized: Invalid token', { status: 401 });
        }

        // Get or create WebSocket room
        const roomName = `room-${sessionResult.user.id}`;
        const id = env.WEBSOCKET_ROOMS.idFromName(roomName);
        const room = env.WEBSOCKET_ROOMS.get(id);

        // Forward to Durable Object with user context
        const roomUrl = new URL(request.url);
        roomUrl.searchParams.set('userId', sessionResult.user.id.toString());
        roomUrl.searchParams.set('userType', sessionResult.user.userType);
        
        return room.fetch(new Request(roomUrl, request));
      }

      // PRIORITY 5: Pass all other routes to the backend
      // For now, return a 404 for unhandled routes but with proper structure
      const response = new Response(JSON.stringify({
        success: false,
        error: 'Route not implemented',
        message: `The route ${pathname} is not yet implemented in the Better Auth worker`,
        path: pathname,
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
      
      // Add CORS headers to all responses
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });

    } catch (error) {
      sentry.captureException(error);
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
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

// Export the WebSocketRoom Durable Object
export { WebSocketRoom };

// Export NotificationRoom as a placeholder (if not implemented yet)
export class NotificationRoom {
  async fetch(request: Request) {
    return new Response('NotificationRoom not implemented', { status: 501 });
  }
}