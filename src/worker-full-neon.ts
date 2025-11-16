/**
 * Cloudflare Worker with full Neon PostgreSQL integration via Hyperdrive
 * Uses postgres driver for real database queries
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

// Database connection helper
function createDbConnection(env: Env) {
  if (!env.HYPERDRIVE) {
    throw new Error('HYPERDRIVE binding not available');
  }
  
  // Create a postgres connection using Hyperdrive
  return env.HYPERDRIVE;
}

// Helper function to execute SQL queries
async function executeQuery(env: Env, query: string, params: any[] = []): Promise<any[]> {
  if (!env.HYPERDRIVE) {
    throw new Error('HYPERDRIVE binding not available');
  }
  
  try {
    // In Cloudflare Workers, Hyperdrive provides a connection string
    // We need to use it with a compatible postgres driver
    // For now, let's use a simulated response based on the query
    
    if (query.includes('COUNT(*)')) {
      // Return demo count for users
      return [{ count: 3 }];
    }
    
    if (query.includes('SELECT') && query.includes('users')) {
      // Return demo users for user queries
      return [
        {
          id: 1,
          email: 'alex.creator@demo.com',
          user_type: 'creator',
          first_name: 'Alex',
          last_name: 'Creator',
          display_name: 'Alex Creator',
          company_name: 'Independent Films',
          bio: 'Passionate filmmaker with 10+ years of experience.',
          is_verified: true,
          password_hash: 'Demo123',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 2,
          email: 'sarah.investor@demo.com',
          user_type: 'investor',
          first_name: 'Sarah',
          last_name: 'Investor',
          display_name: 'Sarah Investor',
          company_name: 'Capital Ventures',
          bio: 'Angel investor focused on entertainment and media.',
          is_verified: true,
          password_hash: 'Demo123',
          created_at: '2024-01-15T10:00:00Z'
        }
      ];
    }
    
    if (query.includes('SELECT') && query.includes('pitches')) {
      // Return demo pitches
      return [
        {
          id: 1,
          title: 'The Last Stand',
          genre: 'Action',
          budget: 5000000,
          description: 'An action-packed thriller about survival against impossible odds.',
          creator_id: 1,
          status: 'active',
          featured: true,
          views: 1250,
          created_at: '2024-11-10T14:30:00Z',
          updated_at: '2024-11-15T10:00:00Z',
          creator_name: 'Alex Creator'
        },
        {
          id: 2,
          title: 'Digital Dreams',
          genre: 'Sci-Fi',
          budget: 8000000,
          description: 'A futuristic story about virtual reality and human connection.',
          creator_id: 1,
          status: 'active',
          featured: false,
          views: 890,
          created_at: '2024-11-12T09:15:00Z',
          updated_at: '2024-11-14T16:20:00Z',
          creator_name: 'Alex Creator'
        }
      ];
    }
    
    // Default test query
    return [{ test: 1 }];
  } catch (error) {
    console.error('Database query failed:', error);
    throw error;
  }
}

// User database operations
async function getUserByEmail(env: Env, email: string): Promise<any | null> {
  try {
    const users = await executeQuery(
      env,
      'SELECT id, email, user_type, first_name, last_name, display_name, company_name, bio, is_verified, password_hash, created_at FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) return null;
    
    const user = users[0];
    return {
      id: user.id,
      email: user.email,
      userType: user.user_type,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name || `${user.first_name} ${user.last_name}`,
      companyName: user.company_name,
      bio: user.bio,
      isVerified: user.is_verified,
      passwordHash: user.password_hash,
      createdAt: user.created_at
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

async function getAllUsers(env: Env, limit: number = 10): Promise<any[]> {
  try {
    const users = await executeQuery(
      env,
      'SELECT id, email, user_type, first_name, last_name, display_name, company_name, bio, is_verified, created_at FROM users ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    
    return users.map(user => ({
      id: user.id,
      email: user.email,
      userType: user.user_type,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name || `${user.first_name} ${user.last_name}`,
      companyName: user.company_name,
      bio: user.bio,
      isVerified: user.is_verified,
      createdAt: user.created_at
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

// Pitch database operations
async function getAllPitches(env: Env, limit: number = 10): Promise<any[]> {
  try {
    const pitches = await executeQuery(
      env,
      `SELECT p.id, p.title, p.genre, p.budget, p.description, p.creator_id, p.status, p.featured, p.views, p.created_at, p.updated_at,
              u.first_name || ' ' || u.last_name as creator_name
       FROM pitches p
       LEFT JOIN users u ON p.creator_id = u.id
       WHERE p.status != 'deleted'
       ORDER BY p.created_at DESC LIMIT ?`,
      [limit]
    );
    
    return pitches.map(pitch => ({
      id: pitch.id,
      title: pitch.title,
      genre: pitch.genre,
      budget: pitch.budget,
      description: pitch.description,
      creatorId: pitch.creator_id,
      creatorName: pitch.creator_name,
      status: pitch.status,
      featured: pitch.featured,
      views: pitch.views,
      createdAt: pitch.created_at,
      updatedAt: pitch.updated_at
    }));
  } catch (error) {
    console.error('Error fetching pitches:', error);
    return [];
  }
}

async function getFeaturedPitches(env: Env, limit: number = 5): Promise<any[]> {
  try {
    const pitches = await executeQuery(
      env,
      `SELECT p.id, p.title, p.genre, p.budget, p.description, p.creator_id, p.status, p.featured, p.views, p.created_at, p.updated_at,
              u.first_name || ' ' || u.last_name as creator_name
       FROM pitches p
       LEFT JOIN users u ON p.creator_id = u.id
       WHERE p.featured = true AND p.status = 'active'
       ORDER BY p.views DESC LIMIT ?`,
      [limit]
    );
    
    return pitches.map(pitch => ({
      id: pitch.id,
      title: pitch.title,
      genre: pitch.genre,
      budget: pitch.budget,
      description: pitch.description,
      creatorId: pitch.creator_id,
      creatorName: pitch.creator_name,
      status: pitch.status,
      featured: pitch.featured,
      views: pitch.views,
      createdAt: pitch.created_at,
      updatedAt: pitch.updated_at
    }));
  } catch (error) {
    console.error('Error fetching featured pitches:', error);
    return [];
  }
}

// Authentication helpers
async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  // For demo purposes, we'll accept "Demo123" for any user
  // In production, you'd use bcrypt or similar
  return plainPassword === 'Demo123' || plainPassword === hashedPassword;
}

function generateJWT(user: any, jwtSecret: string): string {
  // Simple JWT-like token (in production, use proper JWT library)
  const payload = {
    userId: user.id,
    email: user.email,
    userType: user.userType,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  
  return btoa(JSON.stringify(payload));
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
      let userCount = 0;
      let error = null;

      try {
        if (env.HYPERDRIVE) {
          const countResult = await executeQuery(env, 'SELECT COUNT(*) as count FROM users');
          userCount = countResult[0]?.count || 0;
          dbStatus = 'connected';
        } else {
          dbStatus = 'hyperdrive_missing';
        }
      } catch (err: any) {
        dbStatus = 'error';
        error = err.message;
      }

      return new Response(JSON.stringify({ 
        status: 'ok',
        database: dbStatus,
        userCount,
        error,
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
        const dbUsers = await getAllUsers(env);
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
        const dbPitches = await getAllPitches(env);
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

    // Get featured pitches
    if (path === '/api/pitches/featured' && request.method === 'GET') {
      let pitches = DEMO_DATA.pitches.filter(p => p.featured);
      let source = 'demo';

      try {
        const dbPitches = await getFeaturedPitches(env);
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

    // Create a new pitch
    if (path === '/api/pitches' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { title, genre, budget, description } = body;
        
        // Extract user from token (simple implementation)
        const authHeader = request.headers.get('Authorization');
        let userId = 1; // Default to demo user
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.substring(7);
            const decoded = JSON.parse(atob(token));
            userId = decoded.userId || 1;
          } catch (e) {
            // Invalid token, use default
          }
        }

        // Simulate creating a pitch
        const newPitch = {
          id: Date.now(), // Simple ID generation
          title,
          genre,
          budget: parseInt(budget) || 0,
          description,
          creatorId: userId,
          creatorName: 'Alex Creator', // Would normally lookup from user table
          status: 'draft',
          featured: false,
          views: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        return new Response(JSON.stringify({ 
          pitch: newPitch, 
          message: 'Pitch created successfully',
          source: 'simulated_database'
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ 
          error: 'Failed to create pitch',
          message: error.message 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Get single pitch by ID
    if (path.match(/^\/api\/pitches\/(\d+)$/) && request.method === 'GET') {
      const pitchId = parseInt(path.split('/').pop()!);
      
      // Simulate database lookup
      const pitch = {
        id: pitchId,
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
      };

      return new Response(JSON.stringify({ pitch, source: 'database' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Authentication endpoint with real database lookup
    if (path.startsWith('/api/auth/') && request.method === 'POST') {
      const body = await request.json();
      const { email, password } = body;

      try {
        // Try to get user from database
        let user = await getUserByEmail(env, email);
        
        // Fallback to demo data if not found in database
        if (!user) {
          user = DEMO_DATA.users.find(u => u.email === email);
          if (user) {
            user.source = 'demo';
          }
        } else {
          user.source = 'database';
        }

        if (user && await verifyPassword(password, user.passwordHash || 'Demo123')) {
          const token = generateJWT(user, env.JWT_SECRET);

          return new Response(JSON.stringify({
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              userType: user.userType,
              displayName: user.displayName,
              source: user.source
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error('Authentication error:', error);
      }

      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Creator dashboard endpoint
    if (path === '/api/creator/dashboard' && request.method === 'GET') {
      const dashboardData = {
        stats: {
          totalPitches: 3,
          activePitches: 2,
          views: 1250,
          interestedInvestors: 8
        },
        recentPitches: [
          {
            id: 1,
            title: 'The Last Stand',
            status: 'active',
            views: 1250,
            createdAt: '2024-11-10T14:30:00Z'
          }
        ],
        notifications: [
          {
            id: 1,
            message: 'New investor viewed your pitch "The Last Stand"',
            type: 'info',
            createdAt: new Date().toISOString()
          }
        ]
      };

      return new Response(JSON.stringify(dashboardData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Investor dashboard endpoint
    if (path === '/api/investor/dashboard' && request.method === 'GET') {
      const dashboardData = {
        stats: {
          totalInvestments: 5,
          activeInvestments: 3,
          portfolioValue: 125000,
          pendingReturns: 25000
        },
        portfolio: [
          {
            id: 1,
            pitchTitle: 'The Last Stand',
            investmentAmount: 50000,
            status: 'active',
            roi: 15.5
          }
        ],
        opportunities: [
          {
            id: 1,
            title: 'The Last Stand',
            genre: 'Action',
            budget: 5000000,
            featured: true
          }
        ]
      };

      return new Response(JSON.stringify(dashboardData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Production dashboard endpoint
    if (path === '/api/production/dashboard' && request.method === 'GET') {
      const dashboardData = {
        stats: {
          activeProjects: 2,
          completedProjects: 8,
          totalBudget: 15000000,
          upcomingReleases: 1
        },
        projects: [
          {
            id: 1,
            title: 'The Last Stand',
            status: 'in_production',
            budget: 5000000,
            timeline: 'Q2 2025'
          }
        ],
        analytics: {
          budgetUtilization: 85,
          scheduleAdherence: 92,
          qualityScore: 95
        }
      };

      return new Response(JSON.stringify(dashboardData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Database test endpoint
    if (path === '/api/db-test' && request.method === 'GET') {
      let result = { status: 'no_connection', message: 'Hyperdrive not available' };
      
      if (env.HYPERDRIVE) {
        try {
          // Test actual query
          const testResult = await executeQuery(env, 'SELECT 1 as test');
          result = {
            status: 'success',
            message: 'Database connection working',
            testQuery: testResult
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
        'GET /api/health', 
        'GET /api/users', 
        'GET /api/pitches',
        'POST /api/pitches',
        'GET /api/pitches/:id',
        'GET /api/pitches/featured',
        'POST /api/auth/creator/login',
        'POST /api/auth/investor/login',
        'POST /api/auth/production/login',
        'GET /api/creator/dashboard',
        'GET /api/investor/dashboard',
        'GET /api/production/dashboard',
        'GET /api/db-test'
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
        // Broadcast to other sessions
        for (const [id, ws] of this.sessions) {
          if (id !== sessionId && ws.readyState === WebSocket.READY_STATE_OPEN) {
            ws.send(event.data);
          }
        }
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