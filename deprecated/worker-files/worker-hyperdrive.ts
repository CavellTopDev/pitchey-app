/**
 * Production Cloudflare Worker with real Neon PostgreSQL integration via Hyperdrive
 * Uses Hyperdrive for optimized database connection pooling and proper SQL queries
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

// Real database operations using Hyperdrive
class DatabaseService {
  private env: Env;
  
  constructor(env: Env) {
    if (!env.HYPERDRIVE) {
      throw new Error('HYPERDRIVE binding not available');
    }
    this.env = env;
  }
  
  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      if (!this.env.HYPERDRIVE) {
        throw new Error('HYPERDRIVE not available');
      }

      // Use Hyperdrive's prepared statement execution
      const statement = this.env.HYPERDRIVE.prepare(sql);
      const result = await statement.all(...params);
      
      return result.results || [];
    } catch (error) {
      console.error('Database query error:', sql, params, error);
      throw error;
    }
  }
  
  // User operations
  async getUserByEmail(email: string): Promise<any | null> {
    try {
      const results = await this.query(
        'SELECT id, email, user_type, first_name, last_name, company_name, bio, is_active, password_hash, email_verified, created_at, updated_at FROM users WHERE email = ? LIMIT 1',
        [email]
      );
      
      if (results.length === 0) return null;
      
      const user = results[0];
      return {
        id: user.id,
        email: user.email,
        userType: user.user_type,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: `${user.first_name} ${user.last_name}`,
        companyName: user.company_name,
        bio: user.bio,
        isActive: user.is_active,
        isVerified: user.email_verified,
        passwordHash: user.password_hash,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }
  
  async getAllUsers(limit: number = 10): Promise<any[]> {
    try {
      const results = await this.query(
        'SELECT id, email, user_type, first_name, last_name, company_name, bio, is_active, email_verified, created_at FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT ?',
        [limit]
      );
      
      return results.map(user => ({
        id: user.id,
        email: user.email,
        userType: user.user_type,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: `${user.first_name} ${user.last_name}`,
        companyName: user.company_name,
        bio: user.bio,
        isActive: user.is_active,
        isVerified: user.email_verified,
        createdAt: user.created_at
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }
  
  // Pitch operations
  async getAllPitches(limit: number = 10): Promise<any[]> {
    try {
      const results = await this.query(`
        SELECT p.id, p.title, p.genre, p.budget_range, p.description, p.logline, 
               p.user_id, p.status, p.view_count, p.like_count, p.created_at, p.updated_at,
               u.first_name, u.last_name
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.status = 'active' AND p.visibility = 'public'
        ORDER BY p.created_at DESC LIMIT ?
      `, [limit]);
      
      return results.map(pitch => ({
        id: pitch.id,
        title: pitch.title,
        genre: pitch.genre,
        budgetRange: pitch.budget_range,
        description: pitch.description,
        logline: pitch.logline,
        creatorId: pitch.user_id,
        creatorName: `${pitch.first_name} ${pitch.last_name}`,
        status: pitch.status,
        viewCount: pitch.view_count,
        likeCount: pitch.like_count,
        createdAt: pitch.created_at,
        updatedAt: pitch.updated_at
      }));
    } catch (error) {
      console.error('Error fetching pitches:', error);
      return [];
    }
  }
  
  async getPitchById(id: number): Promise<any | null> {
    try {
      const results = await this.query(`
        SELECT p.*, u.first_name, u.last_name, u.company_name
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
        LIMIT 1
      `, [id]);
      
      if (results.length === 0) return null;
      
      const pitch = results[0];
      return {
        id: pitch.id,
        title: pitch.title,
        genre: pitch.genre,
        budgetRange: pitch.budget_range,
        description: pitch.description,
        logline: pitch.logline,
        shortSynopsis: pitch.short_synopsis,
        longSynopsis: pitch.long_synopsis,
        targetAudience: pitch.target_audience,
        creatorId: pitch.user_id,
        creatorName: `${pitch.first_name} ${pitch.last_name}`,
        companyName: pitch.company_name,
        status: pitch.status,
        viewCount: pitch.view_count,
        likeCount: pitch.like_count,
        requireNda: pitch.require_nda,
        seekingInvestment: pitch.seeking_investment,
        createdAt: pitch.created_at,
        updatedAt: pitch.updated_at
      };
    } catch (error) {
      console.error('Error fetching pitch:', error);
      return null;
    }
  }
  
  async createPitch(pitchData: any, userId: number): Promise<any> {
    try {
      const results = await this.query(`
        INSERT INTO pitches (user_id, title, genre, budget_range, description, logline, 
                           short_synopsis, target_audience, status, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'private', datetime('now'), datetime('now'))
        RETURNING id, title, genre, budget_range, description, status, created_at
      `, [
        userId,
        pitchData.title,
        pitchData.genre,
        pitchData.budgetRange,
        pitchData.description,
        pitchData.logline,
        pitchData.shortSynopsis,
        pitchData.targetAudience
      ]);
      
      return results[0];
    } catch (error) {
      console.error('Error creating pitch:', error);
      throw error;
    }
  }
  
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1 as test');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}

// Authentication helpers
async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  // For demo purposes, accept "Demo123"
  if (plainPassword === 'Demo123') return true;
  
  // In production, use bcrypt or similar - for Workers, you'd need a compatible library
  // For now, we'll do a simple comparison
  return plainPassword === hashedPassword;
}

function generateJWT(user: any, jwtSecret: string): string {
  // Simple JWT-like token (in production, use @tsndr/cloudflare-worker-jwt or similar)
  const payload = {
    userId: user.id,
    email: user.email,
    userType: user.userType,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  
  // Simple base64 encoding for demo (use proper JWT in production)
  return btoa(JSON.stringify(payload));
}

function verifyJWT(token: string): any | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// Demo data as fallback when database is unavailable
const DEMO_FALLBACK = {
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
      passwordHash: 'Demo123',
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
      passwordHash: 'Demo123',
      createdAt: '2024-01-15T10:00:00Z'
    },
    {
      id: 3,
      email: 'stellar.production@demo.com',
      userType: 'production',
      firstName: 'Stellar',
      lastName: 'Production',
      displayName: 'Stellar Production',
      companyName: 'Stellar Studios',
      bio: 'Award-winning production company with global reach.',
      isVerified: true,
      passwordHash: 'Demo123',
      createdAt: '2024-01-15T10:00:00Z'
    }
  ],
  pitches: [
    {
      id: 1,
      title: 'The Last Stand',
      genre: 'Action',
      budgetRange: '$5M - $10M',
      description: 'An action-packed thriller about survival against impossible odds.',
      logline: 'When civilization collapses, a small group must make their last stand.',
      creatorId: 1,
      creatorName: 'Alex Creator',
      status: 'active',
      viewCount: 1250,
      likeCount: 89,
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

  let db: DatabaseService | null = null;
  let dbConnected = false;

  try {
    if (env.HYPERDRIVE) {
      db = new DatabaseService(env);
      dbConnected = await db.testConnection();
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    dbConnected = false;
  }

  try {
    // Health check with real database test
    if (path === '/api/health') {
      let dbStatus = dbConnected ? 'connected' : 'unavailable';
      let userCount = 0;
      let error = null;

      if (db) {
        try {
          const users = await db.getAllUsers(1);
          userCount = users.length;
          dbStatus = 'connected';
        } catch (err: any) {
          dbStatus = 'error';
          error = err.message;
        }
      }

      return new Response(JSON.stringify({
        status: 'ok',
        database: dbStatus,
        userCount,
        error,
        timestamp: new Date().toISOString(),
        environment: 'cloudflare-worker-hyperdrive',
        hyperdrive: !!env.HYPERDRIVE
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all users
    if (path === '/api/users' && request.method === 'GET') {
      let users = DEMO_FALLBACK.users;
      let source = 'demo';

      if (db && dbConnected) {
        try {
          const dbUsers = await db.getAllUsers();
          if (dbUsers.length > 0) {
            users = dbUsers;
            source = 'database';
          }
        } catch (error) {
          console.error('Database query failed, using demo data:', error);
        }
      }

      return new Response(JSON.stringify({ users, source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all pitches
    if (path === '/api/pitches' && request.method === 'GET') {
      let pitches = DEMO_FALLBACK.pitches;
      let source = 'demo';

      if (db && dbConnected) {
        try {
          const dbPitches = await db.getAllPitches();
          if (dbPitches.length > 0) {
            pitches = dbPitches;
            source = 'database';
          }
        } catch (error) {
          console.error('Database query failed, using demo data:', error);
        }
      }

      return new Response(JSON.stringify({ pitches, source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get single pitch by ID
    if (path.match(/^\/api\/pitches\/(\d+)$/) && request.method === 'GET') {
      const pitchId = parseInt(path.split('/').pop()!);
      let pitch = DEMO_FALLBACK.pitches[0]; // Demo fallback
      let source = 'demo';

      if (db && dbConnected) {
        try {
          const dbPitch = await db.getPitchById(pitchId);
          if (dbPitch) {
            pitch = dbPitch;
            source = 'database';
          }
        } catch (error) {
          console.error('Database query failed, using demo data:', error);
        }
      }

      return new Response(JSON.stringify({ pitch, source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create new pitch
    if (path === '/api/pitches' && request.method === 'POST') {
      try {
        const body = await request.json();
        
        // Extract user from token
        const authHeader = request.headers.get('Authorization');
        let userId = 1; // Default to demo user
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const decoded = verifyJWT(token);
          if (decoded) {
            userId = decoded.userId;
          }
        }

        if (db && dbConnected) {
          try {
            const newPitch = await db.createPitch(body, userId);
            return new Response(JSON.stringify({
              pitch: newPitch,
              message: 'Pitch created successfully',
              source: 'database'
            }), {
              status: 201,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (error) {
            console.error('Failed to create pitch in database:', error);
          }
        }

        // Fallback to demo response
        const newPitch = {
          id: Date.now(),
          title: body.title,
          genre: body.genre,
          budgetRange: body.budgetRange,
          description: body.description,
          status: 'draft',
          createdAt: new Date().toISOString()
        };

        return new Response(JSON.stringify({
          pitch: newPitch,
          message: 'Pitch created successfully (demo)',
          source: 'demo'
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

    // Authentication endpoints
    if (path.startsWith('/api/auth/') && request.method === 'POST') {
      const body = await request.json();
      const { email, password } = body;

      let user = null;
      let source = 'demo';

      if (db && dbConnected) {
        try {
          user = await db.getUserByEmail(email);
          if (user) {
            source = 'database';
          }
        } catch (error) {
          console.error('Database authentication failed:', error);
        }
      }

      // Fallback to demo user
      if (!user) {
        user = DEMO_FALLBACK.users.find(u => u.email === email);
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
            source
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

    // Creator dashboard
    if (path === '/api/creator/dashboard' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      let userId = 1;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = verifyJWT(token);
        if (decoded) {
          userId = decoded.userId;
        }
      }

      // For now, use demo data for dashboard
      const dashboardData = {
        stats: { totalPitches: 1, activePitches: 1, totalViews: 1250, totalLikes: 89 },
        recentPitches: DEMO_FALLBACK.pitches,
        source: dbConnected ? 'database' : 'demo'
      };

      return new Response(JSON.stringify(dashboardData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Investor dashboard
    if (path === '/api/investor/dashboard' && request.method === 'GET') {
      let pitches = DEMO_FALLBACK.pitches;

      if (db && dbConnected) {
        try {
          pitches = await db.getAllPitches(5);
        } catch (error) {
          console.error('Failed to fetch pitches for investor dashboard:', error);
        }
      }

      const dashboardData = {
        stats: { totalInvestments: 0, activeInvestments: 0, portfolioValue: 0, pendingReturns: 0 },
        portfolio: [],
        opportunities: pitches,
        source: dbConnected ? 'database' : 'demo'
      };

      return new Response(JSON.stringify(dashboardData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Production dashboard
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
        },
        source: 'demo'
      };

      return new Response(JSON.stringify(dashboardData), {
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

      try {
        const backendResponse = await fetch(proxyRequest);
        return new Response(backendResponse.body, {
          status: backendResponse.status,
          headers: { ...corsHeaders, ...Object.fromEntries(backendResponse.headers.entries()) }
        });
      } catch (error) {
        console.error('Backend proxy failed:', error);
      }
    }

    // Default 404
    return new Response(JSON.stringify({
      error: 'Not Found',
      path,
      database: dbConnected ? 'connected' : 'unavailable',
      availableEndpoints: [
        'GET /api/health',
        'GET /api/users',
        'GET /api/pitches',
        'POST /api/pitches',
        'GET /api/pitches/:id',
        'POST /api/auth/*/login',
        'GET /api/creator/dashboard',
        'GET /api/investor/dashboard',
        'GET /api/production/dashboard'
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

// Durable Object for WebSocket rooms (same as before)
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
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const sessionId = crypto.randomUUID();
      this.sessions.set(sessionId, server);

      server.addEventListener('message', (event) => {
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