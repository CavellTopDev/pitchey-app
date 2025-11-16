/**
 * Simple Cloudflare Worker with Neon PostgreSQL connection via Hyperdrive
 * Focuses on basic functionality without complex ORM dependencies
 */

export interface Env {
  // Storage  
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  
  // Database
  HYPERDRIVE?: Hyperdrive;
  
  // Real-time
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  
  // Configuration
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL?: string;
}

// Demo data as fallback
const DEMO_DATA = {
  users: [
    { 
      id: 1, 
      email: 'alex.creator@demo.com', 
      userType: 'creator',
      firstName: 'Alex',
      lastName: 'Creator',
      displayName: 'Alex Creator',
      companyName: 'Independent Films',
      bio: 'Passionate filmmaker with 10+ years of experience.',
      isVerified: true,
      createdAt: '2024-01-15T10:00:00Z'
    },
    { 
      id: 2, 
      email: 'sarah.investor@demo.com', 
      userType: 'investor',
      firstName: 'Sarah',
      lastName: 'Investor',
      displayName: 'Sarah Investor',
      companyName: 'Capital Ventures',
      bio: 'Angel investor focused on entertainment and media.',
      isVerified: true,
      createdAt: '2024-01-15T10:00:00Z'
    }
  ],
  pitches: [
    {
      id: 1,
      title: 'The Last Stand',
      genre: 'Action',
      budget: 5000000,
      description: 'An action-packed thriller about survival against impossible odds.',
      creatorId: 1,
      creatorName: 'Alex Creator',
      status: 'active',
      featured: true,
      views: 1250,
      createdAt: '2024-11-10T14:30:00Z',
      updatedAt: '2024-11-15T10:00:00Z'
    }
  ]
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.FRONTEND_URL,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Health check with database connection test
    if (path === '/api/health') {
      let dbStatus = 'not_tested';
      let dbInfo = {};

      try {
        if (env.HYPERDRIVE) {
          dbStatus = 'hyperdrive_available';
          dbInfo = {
            connectionString: env.HYPERDRIVE.connectionString ? 'available' : 'missing',
            host: env.HYPERDRIVE.host || 'unknown',
            database: env.HYPERDRIVE.database || 'unknown'
          };
        } else {
          dbStatus = 'hyperdrive_missing';
        }
      } catch (error: any) {
        dbStatus = 'error';
        dbInfo = { error: error.message };
      }

      return new Response(JSON.stringify({ 
        status: 'ok',
        database: dbStatus,
        dbInfo,
        timestamp: new Date().toISOString(),
        environment: 'cloudflare-worker',
        hyperdrive: !!env.HYPERDRIVE
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all users - serve demo data for now
    if (path === '/api/users' && request.method === 'GET') {
      return new Response(JSON.stringify({ 
        users: DEMO_DATA.users, 
        source: 'demo',
        note: 'Database integration in progress - serving demo data'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all pitches - serve demo data for now
    if (path === '/api/pitches' && request.method === 'GET') {
      return new Response(JSON.stringify({ 
        pitches: DEMO_DATA.pitches, 
        source: 'demo',
        note: 'Database integration in progress - serving demo data'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Demo authentication endpoint
    if (path.startsWith('/api/auth/') && request.method === 'POST') {
      const body = await request.json();
      const { email, password } = body;

      // Simple demo authentication
      const user = DEMO_DATA.users.find(u => u.email === email);
      
      if (user && password === 'Demo123') {
        // Generate a simple JWT-like token
        const token = btoa(JSON.stringify({
          userId: user.id,
          email: user.email,
          userType: user.userType,
          exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        }));

        return new Response(JSON.stringify({
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userType: user.userType,
            displayName: user.displayName
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Database test endpoint
    if (path === '/api/db-test' && request.method === 'GET') {
      let result = { status: 'no_connection', message: 'Hyperdrive not available' };
      
      if (env.HYPERDRIVE) {
        try {
          // Try to access Hyperdrive properties
          const hyperdrive = env.HYPERDRIVE;
          result = {
            status: 'connection_available',
            message: 'Hyperdrive binding is accessible',
            properties: {
              hasConnectionString: !!hyperdrive.connectionString,
              host: hyperdrive.host || 'Not available',
              database: hyperdrive.database || 'Not available'
            }
          };
        } catch (error: any) {
          result = {
            status: 'error',
            message: error.message,
            error: error.toString()
          };
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Proxy other requests to backend if available
    if (env.ORIGIN_URL && path.startsWith('/api/')) {
      const backendUrl = `${env.ORIGIN_URL}${path}${url.search}`;
      const proxyRequest = new Request(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' ? request.body : null
      });

      const backendResponse = await fetch(proxyRequest);
      const response = new Response(backendResponse.body, {
        status: backendResponse.status,
        headers: { ...corsHeaders, ...Object.fromEntries(backendResponse.headers.entries()) }
      });
      
      return response;
    }

    // Default 404
    return new Response(JSON.stringify({ 
      error: 'Not Found',
      path,
      availableEndpoints: [
        '/api/health', 
        '/api/users', 
        '/api/pitches', 
        '/api/auth/creator/login',
        '/api/db-test'
      ]
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error.message || error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Durable Object for WebSocket rooms
export class WebSocketRoom {
  private state: DurableObjectState;
  private sessions: Map<string, WebSocket>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/websocket') {
      // WebSocket upgrade
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const sessionId = crypto.randomUUID();
      this.sessions.set(sessionId, server);

      server.addEventListener('message', (event) => {
        console.log('WebSocket message:', event.data);
      });

      server.addEventListener('close', () => {
        this.sessions.delete(sessionId);
      });

      server.accept();
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  }
};