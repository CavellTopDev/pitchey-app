/**
 * Production Cloudflare Worker with graceful fallbacks
 * Routes API requests with database fallback to Deno backend proxy
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
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL: string; // Required for proxy fallback
}

function getCorsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowedOrigin = origin && (
    origin === env.FRONTEND_URL ||
    origin.includes('.pages.dev') ||
    origin.includes('localhost')
  ) ? origin : env.FRONTEND_URL || '*';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

// Demo auth for quick testing (remove in full production)
const DEMO_TOKENS = {
  'demo-creator': { 
    userId: 1004, 
    email: 'alex.creator@demo.com', 
    userType: 'creator',
    displayName: 'Alex Creator' 
  },
  'demo-investor': { 
    userId: 1005, 
    email: 'sarah.investor@demo.com', 
    userType: 'investor',
    displayName: 'Sarah Investor' 
  },
  'demo-production': { 
    userId: 1006, 
    email: 'stellar.production@demo.com', 
    userType: 'production',
    displayName: 'Stellar Production' 
  }
};

function extractAuth(request: Request): { user: any | null; token: string | null } {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, token: null };
  }
  
  const token = authHeader.replace('Bearer ', '').trim();
  
  // Check demo tokens first for testing
  if (DEMO_TOKENS[token as keyof typeof DEMO_TOKENS]) {
    return { 
      user: DEMO_TOKENS[token as keyof typeof DEMO_TOKENS], 
      token 
    };
  }
  
  return { user: null, token };
}

async function proxyToOrigin(request: Request, originUrl: string, corsHeaders: HeadersInit): Promise<Response> {
  try {
    const url = new URL(request.url);
    const proxyUrl = `${originUrl}${url.pathname}${url.search}`;
    
    console.log(`Proxying ${request.method} ${url.pathname} to ${proxyUrl}`);
    
    // Clone the request to avoid body already read issues
    const proxyRequest = new Request(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.clone().body : null,
    });
    
    const response = await fetch(proxyRequest);
    const responseHeaders = new Headers(corsHeaders);
    
    // Copy important response headers
    const importantHeaders = ['content-type', 'cache-control', 'x-total-count'];
    for (const header of importantHeaders) {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({
      error: 'Proxy error',
      message: error.message
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const origin = request.headers.get('Origin');
    
    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin, env)
      });
    }
    
    const corsHeaders = getCorsHeaders(origin, env);
    
    try {
      // Worker health check (don't proxy this)
      if (url.pathname === '/api/health' || url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          worker: 'pitchey-api-production',
          version: '1.0.0',
          environment: {
            hasOriginUrl: !!env.ORIGIN_URL,
            originUrl: env.ORIGIN_URL,
            frontendUrl: env.FRONTEND_URL
          }
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      // =============================================================================
      // FILE UPLOAD ENDPOINTS FOR R2
      // =============================================================================

      // R2 presigned upload URL endpoint
      if (url.pathname === '/api/upload/r2/presigned' && method === 'POST') {
        try {
          const { user } = extractAuth(request);
          if (!user) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Authentication required'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const body = await request.json();
          const { fileName, contentType, folder = 'uploads' } = body;

          if (!fileName || !contentType) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing fileName or contentType'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!env.R2_BUCKET) {
            return new Response(JSON.stringify({
              success: false,
              error: 'R2 storage not configured'
            }), {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Generate unique key
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 8);
          const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const key = `${folder}/${sanitized}_${timestamp}_${random}`;

          // Generate presigned URL for R2
          const uploadUrl = await env.R2_BUCKET.sign(key, {
            method: 'PUT',
            expiresIn: 3600, // 1 hour
            httpMetadata: {
              contentType,
            },
            customMetadata: {
              userId: user.userId.toString(),
              originalName: fileName,
              uploadedBy: user.email,
              uploadedAt: new Date().toISOString()
            }
          });

          return new Response(JSON.stringify({
            success: true,
            data: {
              uploadUrl,
              key,
              expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (error: any) {
          console.error('R2 presigned URL error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to generate upload URL',
            message: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // R2 file deletion endpoint
      if (url.pathname.startsWith('/api/upload/r2/delete/') && method === 'DELETE') {
        try {
          const { user } = extractAuth(request);
          if (!user) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Authentication required'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const key = url.pathname.split('/api/upload/r2/delete/')[1];
          if (!key) {
            return new Response(JSON.stringify({
              success: false,
              error: 'File key required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!env.R2_BUCKET) {
            return new Response(JSON.stringify({
              success: false,
              error: 'R2 storage not configured'
            }), {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          await env.R2_BUCKET.delete(key);

          return new Response(JSON.stringify({
            success: true,
            message: 'File deleted successfully'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (error: any) {
          console.error('R2 delete error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to delete file',
            message: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // R2 file info endpoint
      if (url.pathname.startsWith('/api/upload/r2/info/') && method === 'GET') {
        try {
          const { user } = extractAuth(request);
          if (!user) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Authentication required'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const key = url.pathname.split('/api/upload/r2/info/')[1];
          if (!key) {
            return new Response(JSON.stringify({
              success: false,
              error: 'File key required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!env.R2_BUCKET) {
            return new Response(JSON.stringify({
              success: false,
              error: 'R2 storage not configured'
            }), {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const object = await env.R2_BUCKET.head(key);
          
          if (!object) {
            return new Response(JSON.stringify({
              success: false,
              error: 'File not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({
            success: true,
            data: {
              key,
              size: object.size,
              lastModified: object.uploaded.toISOString(),
              contentType: object.httpMetadata?.contentType,
              metadata: object.customMetadata
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (error: any) {
          console.error('R2 file info error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to get file info',
            message: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // R2 presigned download URL endpoint
      if (url.pathname.startsWith('/api/upload/r2/download/') && method === 'GET') {
        try {
          const { user } = extractAuth(request);
          if (!user) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Authentication required'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const key = url.pathname.split('/api/upload/r2/download/')[1];
          if (!key) {
            return new Response(JSON.stringify({
              success: false,
              error: 'File key required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!env.R2_BUCKET) {
            return new Response(JSON.stringify({
              success: false,
              error: 'R2 storage not configured'
            }), {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const urlParams = new URL(request.url).searchParams;
          const expiresIn = parseInt(urlParams.get('expires') || '3600'); // 1 hour default

          const downloadUrl = await env.R2_BUCKET.sign(key, {
            method: 'GET',
            expiresIn
          });

          return new Response(JSON.stringify({
            success: true,
            data: {
              downloadUrl,
              expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (error: any) {
          console.error('R2 presigned download URL error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to generate download URL',
            message: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Quick demo auth endpoints for testing
      if (url.pathname.startsWith('/api/auth/') && url.pathname.endsWith('/login') && method === 'POST') {
        try {
          // Clone the request first to avoid body consumption issues
          const clonedRequest = request.clone();
          const loginData = await clonedRequest.json();
          const { email, password } = loginData;
          
          // Demo login logic (replace with real auth later)
          if (email === 'alex.creator@demo.com' && password === 'Demo123!') {
            return new Response(JSON.stringify({
              success: true,
              data: {
                token: 'demo-creator',
                user: DEMO_TOKENS['demo-creator']
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else if (email === 'sarah.investor@demo.com' && password === 'Demo123!') {
            return new Response(JSON.stringify({
              success: true,
              data: {
                token: 'demo-investor',
                user: DEMO_TOKENS['demo-investor']
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else if (email === 'stellar.production@demo.com' && password === 'Demo123!') {
            return new Response(JSON.stringify({
              success: true,
              data: {
                token: 'demo-production',
                user: DEMO_TOKENS['demo-production']
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // For all other cases, proxy to origin
          if (env.ORIGIN_URL) {
            return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
          }
          
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid credentials'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (authError: any) {
          console.error('Auth error:', authError);
          // Fall back to proxy for auth failures
          if (env.ORIGIN_URL) {
            return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
          }
          throw authError;
        }
      }
      
      // For all other API requests, proxy to Deno backend
      if (url.pathname.startsWith('/api/')) {
        if (!env.ORIGIN_URL) {
          return new Response(JSON.stringify({
            error: 'Service Unavailable',
            message: 'Backend service not configured'
          }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
      }
      
      // For WebSocket upgrades, proxy to origin
      if (request.headers.get('upgrade') === 'websocket') {
        if (!env.ORIGIN_URL) {
          return new Response('WebSocket service unavailable', { status: 503 });
        }
        return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
      }
      
      // Default response for non-API paths
      return new Response(JSON.stringify({
        message: 'Pitchey API Gateway',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          auth: '/api/auth/{creator|investor|production}/login',
          proxy: 'All other /api/* requests are proxied to backend'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error('Request error:', error);
      
      // Last resort: try to proxy to origin
      if (env.ORIGIN_URL && url.pathname.startsWith('/api/')) {
        try {
          return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
        } catch (proxyError) {
          console.error('Proxy fallback also failed:', proxyError);
        }
      }
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Minimal WebSocket Room for completeness
export class WebSocketRoom {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      error: 'WebSocket rooms handled by backend service',
      message: 'Use the Deno backend for WebSocket functionality'
    }), { 
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}