/**
 * Local Development Worker with proper environment variable handling
 * This version is optimized for local development and testing
 */

export interface Env {
  // Core configuration
  JWT_SECRET?: string;
  FRONTEND_URL?: string;
  ORIGIN_URL?: string;
  
  // Optional bindings for local development
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  HYPERDRIVE?: any;
}

// Demo data for local development
const DEMO_DATA = {
  users: [
    { id: 1, email: 'alex.creator@demo.com', userType: 'creator', firstName: 'Alex', lastName: 'Creator' },
    { id: 2, email: 'sarah.investor@demo.com', userType: 'investor', firstName: 'Sarah', lastName: 'Investor' },
    { id: 3, email: 'stellar.production@demo.com', userType: 'production', firstName: 'Stellar', lastName: 'Production' }
  ],
  pitches: [
    { 
      id: 1, 
      title: 'The Last Stand', 
      genre: 'Action', 
      creatorId: 1,
      budget: 5000000,
      description: 'An action-packed thriller about survival.',
      createdAt: new Date().toISOString()
    },
    { 
      id: 2, 
      title: 'Digital Dreams', 
      genre: 'Sci-Fi', 
      creatorId: 1,
      budget: 8000000,
      description: 'A futuristic story about virtual reality.',
      createdAt: new Date().toISOString()
    }
  ]
};

// Demo auth tokens (for local testing only)
const DEMO_TOKENS = {
  'demo-creator': { userId: 1, userType: 'creator', email: 'alex.creator@demo.com' },
  'demo-investor': { userId: 2, userType: 'investor', email: 'sarah.investor@demo.com' },
  'demo-production': { userId: 3, userType: 'production', email: 'stellar.production@demo.com' }
};

function getCorsHeaders(origin: string | null, env: Env): HeadersInit {
  const frontendUrl = env.FRONTEND_URL || 'https://pitchey.pages.dev';
  const allowedOrigin = origin && (
    origin === frontendUrl ||
    origin.includes('.pages.dev') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) ? origin : frontendUrl;
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

function extractAuth(request: Request): { user: any | null; token: string | null } {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, token: null };
  }
  
  const token = authHeader.replace('Bearer ', '').trim();
  
  // Check demo tokens first
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
    
    const proxyRequest = new Request(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    const response = await fetch(proxyRequest);
    const responseBody = await response.text();
    
    return new Response(responseBody, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': response.headers.get('Content-Type') || 'application/json' }
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
      // Health check with environment info
      if (url.pathname === '/health' || url.pathname === '/api/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          environment: {
            hasJwtSecret: !!env.JWT_SECRET,
            frontendUrl: env.FRONTEND_URL,
            originUrl: env.ORIGIN_URL,
            hasCache: !!env.CACHE,
            hasR2: !!env.R2_BUCKET,
            hasHyperdrive: !!env.HYPERDRIVE,
            hasWebSocket: !!env.WEBSOCKET_ROOM
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Demo login endpoints
      if (url.pathname.startsWith('/api/auth/') && url.pathname.endsWith('/login') && method === 'POST') {
        try {
          const loginData = await request.json();
          const { email, password } = loginData;
          
          const user = DEMO_DATA.users.find(u => u.email === email);
          if (!user || password !== 'Demo123!') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid credentials'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Return demo token
          const demoTokenKey = `demo-${user.userType}`;
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              token: demoTokenKey,
              user: {
                id: user.id,
                email: user.email,
                userType: user.userType,
                firstName: user.firstName,
                lastName: user.lastName
              }
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Login failed',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Demo profile endpoint
      if (url.pathname === '/api/user/profile' && method === 'GET') {
        const { user } = extractAuth(request);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          data: user
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Demo pitches endpoint
      if (url.pathname === '/api/pitches' && method === 'GET') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            pitches: DEMO_DATA.pitches,
            pagination: {
              total: DEMO_DATA.pitches.length,
              totalPages: 1,
              currentPage: 1,
              hasMore: false
            }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // For all other requests, proxy to origin if available
      if (env.ORIGIN_URL && env.ORIGIN_URL.trim() !== '') {
        console.log(`Proxying ${method} ${url.pathname} to ${env.ORIGIN_URL}`);
        return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
      }
      
      // Default 404 response
      return new Response(JSON.stringify({
        error: 'Not Found',
        path: url.pathname,
        method: request.method,
        available_endpoints: [
          'GET /health',
          'POST /api/auth/creator/login',
          'POST /api/auth/investor/login', 
          'POST /api/auth/production/login',
          'GET /api/user/profile',
          'GET /api/pitches'
        ]
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5) // Limit stack trace
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Placeholder Durable Object for WebSocket rooms
export class WebSocketRoom {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      error: 'WebSocket rooms not implemented in local development version',
      message: 'Use the full backend server for WebSocket functionality'
    }), { 
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}