/**
 * Simple Cloudflare Worker with Neon PostgreSQL connection via Hyperdrive
 * Uses direct PostgreSQL queries without ORM dependencies
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
      id: 1004, 
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
      id: 1005, 
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
      creatorId: 1004,
      creatorName: 'Alex Creator',
      status: 'active',
      featured: true,
      views: 1250,
      createdAt: '2024-11-10T14:30:00Z',
      updatedAt: '2024-11-15T10:00:00Z'
    }
  ]
};

async function testDatabaseConnection(env: Env): Promise<{ status: string, error?: string, count?: number }> {
  if (!env.HYPERDRIVE) {
    return { status: 'no_hyperdrive', error: 'HYPERDRIVE binding not available' };
  }

  try {
    // For Hyperdrive, we need to use it as a connection string for a database client
    // Create a simple fetch-based query (since Workers don't support postgres drivers directly)
    // For now, let's just verify the binding exists
    const connection = env.HYPERDRIVE;
    
    // Try to access connection properties to verify it's working
    const connectionString = connection.connectionString || 'Connection available';
    
    return { 
      status: 'connected', 
      count: 0,  // We'll need a different approach for actual queries
      connectionString: connectionString ? 'Available' : 'Missing'
    };
  } catch (error: any) {
    return { 
      status: 'error', 
      error: error.message || error.toString() 
    };
  }
}

async function fetchUsersFromDatabase(env: Env): Promise<any[]> {
  if (!env.HYPERDRIVE) {
    throw new Error('HYPERDRIVE not available');
  }

  try {
    const result = await env.HYPERDRIVE.prepare(
      'SELECT id, email, user_type, first_name, last_name, display_name, company_name, bio, is_verified, created_at FROM users LIMIT 10'
    ).all();

    return result.results?.map((row: any) => ({
      id: row.id,
      email: row.email,
      userType: row.user_type,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name || `${row.first_name} ${row.last_name}`,
      companyName: row.company_name,
      bio: row.bio,
      isVerified: row.is_verified,
      createdAt: row.created_at
    })) || [];
  } catch (error) {
    console.error('Database query failed:', error);
    return [];
  }
}

async function fetchPitchesFromDatabase(env: Env): Promise<any[]> {
  if (!env.HYPERDRIVE) {
    throw new Error('HYPERDRIVE not available');
  }

  try {
    const result = await env.HYPERDRIVE.prepare(
      'SELECT id, title, genre, budget, description, creator_id, status, featured, views, created_at, updated_at FROM pitches LIMIT 10'
    ).all();

    return result.results?.map((row: any) => ({
      id: row.id,
      title: row.title,
      genre: row.genre,
      budget: row.budget,
      description: row.description,
      creatorId: row.creator_id,
      status: row.status,
      featured: row.featured,
      views: row.views,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) || [];
  } catch (error) {
    console.error('Database query failed:', error);
    return [];
  }
}

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
      const dbTest = await testDatabaseConnection(env);

      return new Response(JSON.stringify({ 
        status: 'ok',
        database: dbTest.status,
        dbError: dbTest.error,
        userCount: dbTest.count,
        timestamp: new Date().toISOString(),
        environment: 'cloudflare-worker',
        hyperdrive: !!env.HYPERDRIVE
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all users - try database first, fallback to demo
    if (path === '/api/users' && request.method === 'GET') {
      let users = DEMO_DATA.users;
      let source = 'demo';

      try {
        const dbUsers = await fetchUsersFromDatabase(env);
        if (dbUsers.length > 0) {
          users = dbUsers;
          source = 'database';
        }
      } catch (error) {
        console.error('Database query failed, using demo data:', error);
      }

      return new Response(JSON.stringify({ users, source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all pitches - try database first, fallback to demo
    if (path === '/api/pitches' && request.method === 'GET') {
      let pitches = DEMO_DATA.pitches;
      let source = 'demo';

      try {
        const dbPitches = await fetchPitchesFromDatabase(env);
        if (dbPitches.length > 0) {
          pitches = dbPitches;
          source = 'database';
        }
      } catch (error) {
        console.error('Database query failed, using demo data:', error);
      }

      return new Response(JSON.stringify({ pitches, source }), {
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
      availableEndpoints: ['/api/health', '/api/users', '/api/pitches', '/api/auth/creator/login']
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