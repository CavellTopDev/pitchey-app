/**
 * Debug version of the Cloudflare Worker
 * This version includes extensive error handling to identify startup issues
 */

export interface Env {
  // Database
  HYPERDRIVE?: any;
  DATABASE_URL?: string;
  
  // Storage
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  
  // Real-time
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  
  // Configuration
  JWT_SECRET?: string;
  FRONTEND_URL?: string;
  ORIGIN_URL?: string;
}

function getCorsHeaders(origin: string | null, env: Env): HeadersInit {
  try {
    const frontendUrl = env.FRONTEND_URL || 'https://pitchey.pages.dev';
    const allowedOrigin = origin && (
      origin === frontendUrl ||
      origin.includes('.pages.dev') ||
      origin.includes('localhost')
    ) ? origin : frontendUrl;
    
    return {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    };
  } catch (error: any) {
    console.error('Error in getCorsHeaders:', error);
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let corsHeaders: HeadersInit = {};
    
    try {
      const url = new URL(request.url);
      const method = request.method;
      const origin = request.headers.get('Origin');
      
      // Try to get CORS headers
      try {
        corsHeaders = getCorsHeaders(origin, env);
      } catch (error: any) {
        console.error('Failed to get CORS headers:', error);
        corsHeaders = { 'Access-Control-Allow-Origin': '*' };
      }
      
      // CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }
      
      // Debug health check
      if (url.pathname === '/health' || url.pathname === '/api/health') {
        try {
          const debugInfo = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            path: url.pathname,
            method: method,
            environment: {
              hasJwtSecret: !!env.JWT_SECRET,
              jwtSecretLength: env.JWT_SECRET ? env.JWT_SECRET.length : 0,
              frontendUrl: env.FRONTEND_URL,
              originUrl: env.ORIGIN_URL,
              hasHyperdrive: !!env.HYPERDRIVE,
              hasCache: !!env.CACHE,
              hasR2: !!env.R2_BUCKET,
              hasWebSocket: !!env.WEBSOCKET_ROOM,
              hyperdriveType: env.HYPERDRIVE ? typeof env.HYPERDRIVE : 'undefined',
            },
            headers: {
              origin: origin,
              userAgent: request.headers.get('User-Agent'),
              authorization: request.headers.get('Authorization') ? 'present' : 'missing'
            }
          };
          
          return new Response(JSON.stringify(debugInfo, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (debugError: any) {
          console.error('Error in debug health check:', debugError);
          return new Response(JSON.stringify({
            error: 'Debug health check failed',
            message: debugError.message,
            stack: debugError.stack
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Test database connectivity
      if (url.pathname === '/api/debug/database' && method === 'GET') {
        try {
          if (!env.HYPERDRIVE) {
            return new Response(JSON.stringify({
              error: 'No Hyperdrive configuration found',
              hasDatabase: false
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Try to execute a simple query
          const query = 'SELECT 1 as test';
          const result = await env.HYPERDRIVE.prepare(query).all();
          
          return new Response(JSON.stringify({
            success: true,
            database: 'connected',
            testQuery: result,
            hyperdriveInfo: {
              type: typeof env.HYPERDRIVE,
              methods: Object.getOwnPropertyNames(env.HYPERDRIVE)
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (dbError: any) {
          console.error('Database test error:', dbError);
          return new Response(JSON.stringify({
            error: 'Database connection failed',
            message: dbError.message,
            stack: dbError.stack
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // For all other paths, return a helpful message
      return new Response(JSON.stringify({
        message: 'Debug Worker is running',
        availableEndpoints: [
          'GET /health - Basic health check',
          'GET /api/health - Detailed health check',
          'GET /api/debug/database - Test database connectivity'
        ],
        requestInfo: {
          path: url.pathname,
          method: method,
          origin: origin
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (mainError: any) {
      console.error('Main request error:', mainError);
      
      try {
        return new Response(JSON.stringify({
          error: 'Worker runtime error',
          message: mainError.message,
          stack: mainError.stack,
          name: mainError.name,
          cause: mainError.cause
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (responseError: any) {
        // Last resort error response
        return new Response(`FATAL ERROR: ${mainError.message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
  }
};

// Simplified Durable Object for debugging
export class WebSocketRoom {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      message: 'WebSocket room debug endpoint',
      state: 'initialized'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}