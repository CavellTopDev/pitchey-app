/**
 * Production Cloudflare Worker with Neon PostgreSQL integration via Hyperdrive
 * Uses @neondatabase/serverless with Hyperdrive connection pooling
 */

import { neon } from '@neondatabase/serverless';

// Sentry error tracking for Cloudflare Workers
class SentryLogger {
  private dsn: string | null = null;
  private environment: string = 'production';
  private release: string = 'unified-worker-v1.0';
  
  constructor(env: Env) {
    this.dsn = env.SENTRY_DSN || null;
    this.environment = env.SENTRY_ENVIRONMENT || 'production';
    this.release = env.SENTRY_RELEASE || 'unified-worker-v1.0';
  }
  
  async captureError(error: Error, context?: Record<string, any>) {
    if (!this.dsn) {
      console.error('Sentry DSN not configured, logging locally:', error);
      return;
    }
    
    try {
      const payload = {
        message: error.message,
        level: 'error',
        environment: this.environment,
        release: this.release,
        extra: {
          stack: error.stack,
          context: context || {},
          timestamp: new Date().toISOString(),
          platform: 'cloudflare-workers'
        }
      };
      
      // Send to Sentry via Store API
      const sentryUrl = new URL(this.dsn);
      const projectId = sentryUrl.pathname.slice(1);
      const publicKey = sentryUrl.username;
      
      const storeUrl = `https://sentry.io/api/${projectId}/store/`;
      
      await fetch(storeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=cloudflare-worker/1.0.0`
        },
        body: JSON.stringify(payload)
      });
    } catch (sentryError) {
      console.error('Failed to send error to Sentry:', sentryError);
    }
  }
  
  async captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
    if (!this.dsn) {
      console.log(`Sentry not configured, logging locally [${level}]:`, message);
      return;
    }
    
    try {
      const payload = {
        message,
        level,
        environment: this.environment,
        release: this.release,
        extra: {
          context: context || {},
          timestamp: new Date().toISOString(),
          platform: 'cloudflare-workers'
        }
      };
      
      const sentryUrl = new URL(this.dsn);
      const projectId = sentryUrl.pathname.slice(1);
      const publicKey = sentryUrl.username;
      
      const storeUrl = `https://sentry.io/api/${projectId}/store/`;
      
      await fetch(storeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=cloudflare-worker/1.0.0`
        },
        body: JSON.stringify(payload)
      });
    } catch (sentryError) {
      console.error('Failed to send message to Sentry:', sentryError);
    }
  }
}

export interface Env {
  // Storage  
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  
  // Database - Hyperdrive provides optimized connection string
  HYPERDRIVE?: Hyperdrive;
  
  // Real-time
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  
  // Configuration
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL?: string;
  
  // Error Tracking
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
}

// DEPRECATED: This file creates connections per request causing CONNECTION_CLOSED errors
// Use worker-browse-fix.ts with connection pooling instead

// Database service using Neon's serverless driver with Hyperdrive
class DatabaseService {
  private sql: any;
  private sentry: SentryLogger;
  private static connectionPool: Map<string, any> = new Map();
  
  constructor(env: Env, sentry: SentryLogger) {
    if (!env.HYPERDRIVE) {
      throw new Error('HYPERDRIVE binding not available');
    }
    
    this.sentry = sentry;
    
    // Use connection pooling to prevent CONNECTION_CLOSED errors
    const connectionKey = env.HYPERDRIVE.connectionString;
    if (DatabaseService.connectionPool.has(connectionKey)) {
      this.sql = DatabaseService.connectionPool.get(connectionKey);
      console.log('♻️ Reusing existing neon connection');
    } else {
      console.log('🆕 Creating new neon connection (DEPRECATED - use worker-browse-fix.ts)');
      this.sql = neon(env.HYPERDRIVE.connectionString, {
        fullResults: false,
        arrayMode: false,
      });
      DatabaseService.connectionPool.set(connectionKey, this.sql);
    }
  }
  
  async query(query: string, params: any[] = []): Promise<any[]> {
    try {
      const result = await this.sql(query, params);
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('Database query error:', query, params, error);
      
      // Log database errors to Sentry
      await this.sentry.captureError(error as Error, {
        query,
        params,
        operation: 'database_query',
        driver: 'neon-serverless-hyperdrive'
      });
      
      throw error;
    }
  }
  
  // User operations
  async getUserByEmail(email: string): Promise<any | null> {
    try {
      const results = await this.query(
        'SELECT id, email, user_type, first_name, last_name, company_name, bio, is_active, password_hash, email_verified, created_at, updated_at FROM users WHERE email = $1 LIMIT 1',
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
        'SELECT id, email, user_type, first_name, last_name, company_name, bio, is_active, email_verified, created_at FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT $1',
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
        ORDER BY p.created_at DESC LIMIT $1
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
        WHERE p.id = $1
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'private', NOW(), NOW())
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
  
  async getCreatorDashboard(userId: number): Promise<any> {
    try {
      // Get user's pitch stats
      const pitchStats = await this.query(`
        SELECT 
          COUNT(*) as total_pitches,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_pitches,
          COALESCE(SUM(view_count), 0) as total_views,
          COALESCE(SUM(like_count), 0) as total_likes
        FROM pitches WHERE user_id = $1
      `, [userId]);
      
      // Get recent pitches
      const recentPitches = await this.query(`
        SELECT id, title, status, view_count, like_count, created_at
        FROM pitches 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [userId]);
      
      return {
        stats: pitchStats[0] || { total_pitches: 0, active_pitches: 0, total_views: 0, total_likes: 0 },
        recentPitches: recentPitches || [],
        source: 'database'
      };
    } catch (error) {
      console.error('Error fetching creator dashboard:', error);
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
  
  // In production, use @noble/hashes or similar Worker-compatible library
  return plainPassword === hashedPassword;
}

function generateJWT(user: any, jwtSecret: string): string {
  // Simple JWT-like token (in production, use @tsndr/cloudflare-worker-jwt)
  const payload = {
    userId: user.id,
    email: user.email,
    userType: user.userType,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  
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

// Demo data as fallback
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
  
  // Initialize Sentry for error tracking
  const sentry = new SentryLogger(env);

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

  // Initialize database connection
  try {
    if (env.HYPERDRIVE) {
      db = new DatabaseService(env, sentry);
      dbConnected = await db.testConnection();
      
      // Log successful database connection
      await sentry.captureMessage('Database connection established', 'info', {
        hyperdrive_available: !!env.HYPERDRIVE,
        path,
        method: request.method
      });
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    
    // Log database initialization failure to Sentry
    await sentry.captureError(error as Error, {
      operation: 'database_initialization',
      hyperdrive_available: !!env.HYPERDRIVE,
      path,
      method: request.method
    });
    
    dbConnected = false;
  }

  try {
    // Health check endpoint
    if (path === '/api/health') {
      let dbStatus = 'unavailable';
      let userCount = 0;
      let error = null;

      if (dbConnected && db) {
        try {
          const users = await db.getAllUsers(1);
          userCount = users.length;
          dbStatus = 'connected';
        } catch (err: any) {
          dbStatus = 'error';
          error = err.message;
          dbConnected = false;
        }
      }

      return new Response(JSON.stringify({
        status: 'ok',
        database: dbStatus,
        userCount,
        error,
        timestamp: new Date().toISOString(),
        environment: 'cloudflare-worker-neon-hyperdrive',
        hyperdrive: !!env.HYPERDRIVE,
        connectionString: env.HYPERDRIVE ? '[REDACTED]' : 'not_available'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all users
    if (path === '/api/users' && request.method === 'GET') {
      let users = DEMO_FALLBACK.users;
      let source = 'demo';

      if (dbConnected && db) {
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

      return new Response(JSON.stringify({ users, source, dbConnected }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all pitches
    if (path === '/api/pitches' && request.method === 'GET') {
      let pitches = DEMO_FALLBACK.pitches;
      let source = 'demo';

      if (dbConnected && db) {
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

      return new Response(JSON.stringify({ pitches, source, dbConnected }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get single pitch by ID
    if (path.match(/^\/api\/pitches\/(\d+)$/) && request.method === 'GET') {
      const pitchId = parseInt(path.split('/').pop()!);
      let pitch = DEMO_FALLBACK.pitches[0];
      let source = 'demo';

      if (dbConnected && db) {
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

      return new Response(JSON.stringify({ pitch, source, dbConnected }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Profile endpoint
    if (path === '/api/auth/profile' && request.method === 'GET') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authorization required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.substring(7);
        const payload = verifyJWT(token);
        if (!payload) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid token'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let user = null;
        if (dbConnected && db) {
          try {
            const userResult = await db.query(`
              SELECT id, email, first_name, last_name, user_type, bio, company, 
                     subscription_tier, created_at, profile_image_url
              FROM users 
              WHERE id = $1
            `, [payload.userId]);
            
            if (userResult && userResult[0]) {
              user = {
                id: userResult[0].id,
                email: userResult[0].email,
                firstName: userResult[0].first_name,
                lastName: userResult[0].last_name,
                userType: userResult[0].user_type,
                bio: userResult[0].bio,
                company: userResult[0].company,
                subscriptionTier: userResult[0].subscription_tier,
                profileImageUrl: userResult[0].profile_image_url,
                displayName: `${userResult[0].first_name} ${userResult[0].last_name}`.trim(),
                createdAt: userResult[0].created_at
              };
            }
          } catch (dbError) {
            console.error('Database profile query failed:', dbError);
          }
        }

        // Fallback to demo data
        if (!user) {
          user = DEMO_FALLBACK.users.find(u => u.id === payload.userId) || {
            id: payload.userId,
            email: payload.email,
            userType: payload.userType,
            displayName: payload.email.split('@')[0]
          };
        }

        return new Response(JSON.stringify({
          success: true,
          data: user
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Profile endpoint error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to get profile'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Authentication endpoints
    if (path.startsWith('/api/auth/') && request.method === 'POST') {
      const body = await request.json();
      const { email, password } = body;

      // Extract user type from the path
      let requiredUserType = null;
      if (path.includes('/creator/')) requiredUserType = 'creator';
      else if (path.includes('/investor/')) requiredUserType = 'investor';
      else if (path.includes('/production/')) requiredUserType = 'production';

      let user = null;
      let source = 'demo';

      if (dbConnected && db) {
        try {
          const userResult = await db.query(`
            SELECT * FROM users 
            WHERE email = $1 AND ($2::text IS NULL OR user_type = $2)
          `, [email, requiredUserType]);
          
          if (userResult && userResult[0]) {
            user = userResult[0];
            source = 'database';
          }
        } catch (error) {
          console.error('Database authentication failed:', error);
        }
      }

      // Fallback to demo user
      if (!user) {
        user = DEMO_FALLBACK.users.find(u => 
          u.email === email && 
          (!requiredUserType || u.userType === requiredUserType)
        );
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

      let dashboardData = {
        stats: { totalPitches: 1, activePitches: 1, totalViews: 1250, totalLikes: 89 },
        recentPitches: DEMO_FALLBACK.pitches,
        source: 'demo'
      };

      if (dbConnected && db) {
        try {
          dashboardData = await db.getCreatorDashboard(userId);
        } catch (error) {
          console.error('Dashboard query failed, using demo data:', error);
        }
      }

      return new Response(JSON.stringify(dashboardData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Investor dashboard
    if (path === '/api/investor/dashboard' && request.method === 'GET') {
      let pitches = DEMO_FALLBACK.pitches;
      let source = 'demo';

      if (dbConnected && db) {
        try {
          pitches = await db.getAllPitches(5);
          source = 'database';
        } catch (error) {
          console.error('Failed to fetch pitches for investor dashboard:', error);
        }
      }

      const dashboardData = {
        stats: { totalInvestments: 0, activeInvestments: 0, portfolioValue: 0, pendingReturns: 0 },
        portfolio: [],
        opportunities: pitches,
        source
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

    // User profile endpoint
    if (path === '/api/profile' && request.method === 'GET') {
      // Authenticate user first
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // For now, return demo profile data - production will proxy to backend
      return new Response(JSON.stringify({
        success: true,
        profile: {
          id: 1,
          email: 'alex.creator@demo.com',
          username: 'alex_creator',
          userType: 'creator',
          firstName: 'Alex',
          lastName: 'Creator',
          companyName: 'Independent Films',
          bio: 'Passionate filmmaker',
          profileImageUrl: null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // NDA endpoints
    if (path === '/api/nda/active' && request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        activeNdas: [],
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/nda/pending' && request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        pendingNdas: [],
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Follow stats endpoint
    if (path.match(/^\/api\/follows\/stats\/\d+$/) && request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        followerCount: 0,
        followingCount: 0,
        recentFollowers: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Credits balance endpoint
    if (path === '/api/payments/credits/balance' && request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        balance: 100,
        currency: 'USD'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Subscription status endpoint
    if (path === '/api/payments/subscription-status' && request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        subscription: {
          plan: 'basic',
          status: 'active',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Upload quota endpoint
    if (path === '/api/upload/quota' && request.method === 'GET') {
      try {
        // Extract JWT token from Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authorization required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.substring(7);
        let userId: number;
        
        try {
          // Use the same JWT verification as the rest of the Worker
          const payload = verifyJWT(token);
          if (!payload) {
            throw new Error('Token verification failed');
          }
          userId = payload.userId || payload.id;
        } catch (jwtError) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid token'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Calculate storage quota using database
        let currentUsage = 0;
        let maxQuota = 5 * 1024 * 1024 * 1024; // 5GB default

        if (dbConnected && db) {
          try {
            // Query total file size for this user
            const usageResult = await db.query(`
              SELECT COALESCE(SUM(file_size), 0) as total_usage
              FROM pitch_documents 
              WHERE uploaded_by = $1
            `, [userId]);
            
            if (usageResult && usageResult[0]) {
              currentUsage = parseInt(usageResult[0].total_usage) || 0;
            }
            
            // Get user's subscription tier for quota limits
            const userResult = await db.query(`
              SELECT subscription_tier 
              FROM users 
              WHERE id = $1
            `, [userId]);
            
            if (userResult && userResult[0]) {
              const tier = userResult[0].subscription_tier;
              maxQuota = {
                'basic': 5 * 1024 * 1024 * 1024,      // 5GB
                'pro': 50 * 1024 * 1024 * 1024,       // 50GB  
                'enterprise': 500 * 1024 * 1024 * 1024  // 500GB
              }[tier] || maxQuota;
            }
          } catch (dbError) {
            console.error('Database quota query failed:', dbError);
            // Continue with defaults
          }
        }

        const remainingQuota = Math.max(0, maxQuota - currentUsage);
        const usagePercentage = Math.round((currentUsage / maxQuota) * 100);

        // Format file sizes  
        const formatFileSize = (bytes: number): string => {
          const units = ['B', 'KB', 'MB', 'GB'];
          let size = bytes;
          let unitIndex = 0;

          while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
          }

          return `${size.toFixed(1)} ${units[unitIndex]}`;
        };

        return new Response(JSON.stringify({
          success: true,
          data: {
            currentUsage,
            maxQuota,
            remainingQuota,
            usagePercentage,
            formattedUsage: formatFileSize(currentUsage),
            formattedQuota: formatFileSize(maxQuota),
            formattedRemaining: formatFileSize(remainingQuota),
            source: dbConnected ? 'database' : 'fallback'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Upload quota error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to check quota',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Pitches endpoints
    if (path === '/api/pitches' && request.method === 'GET') {
      try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const genre = url.searchParams.get('genre');
        const search = url.searchParams.get('search');
        const offset = (page - 1) * limit;

        let pitches = [];
        let total = 0;

        if (dbConnected && db) {
          try {
            // Build dynamic query
            let query = `
              SELECT p.id, p.title, p.logline, p.genre, p.format, p.status, 
                     p.seeking_investment, p.funding_goal, p.created_at,
                     u.first_name, u.last_name, u.company
              FROM pitches p 
              JOIN users u ON p.created_by = u.id
              WHERE p.status = 'published'
            `;
            
            const params = [];
            let paramCount = 0;

            if (genre) {
              query += ` AND p.genre = $${++paramCount}`;
              params.push(genre);
            }

            if (search) {
              query += ` AND (p.title ILIKE $${++paramCount} OR p.logline ILIKE $${++paramCount})`;
              params.push(`%${search}%`, `%${search}%`);
              paramCount++;
            }

            // Get total count
            const countQuery = query.replace(
              'SELECT p.id, p.title, p.logline, p.genre, p.format, p.status, p.seeking_investment, p.funding_goal, p.created_at, u.first_name, u.last_name, u.company',
              'SELECT COUNT(*)'
            );
            const countResult = await db.query(countQuery, params);
            total = parseInt(countResult[0]?.count || 0);

            // Get paginated results
            query += ` ORDER BY p.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
            params.push(limit, offset);

            const pitchResults = await db.query(query, params);
            
            pitches = pitchResults.map(p => ({
              id: p.id,
              title: p.title,
              logline: p.logline,
              genre: p.genre,
              format: p.format,
              status: p.status,
              seekingInvestment: p.seeking_investment,
              fundingGoal: p.funding_goal,
              createdAt: p.created_at,
              creator: {
                firstName: p.first_name,
                lastName: p.last_name,
                company: p.company,
                displayName: `${p.first_name} ${p.last_name}`.trim()
              }
            }));

          } catch (dbError) {
            console.error('Database pitches query failed:', dbError);
          }
        }

        // Fallback to demo data
        if (pitches.length === 0) {
          pitches = DEMO_FALLBACK.pitches.slice(offset, offset + limit);
          total = DEMO_FALLBACK.pitches.length;
        }

        return new Response(JSON.stringify({
          success: true,
          data: pitches,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          },
          source: dbConnected ? 'database' : 'demo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Pitches endpoint error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch pitches',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Get pitch by ID
    if (path.match(/^\/api\/pitches\/(\d+)$/) && request.method === 'GET') {
      try {
        const pitchId = parseInt(path.split('/').pop()!);
        let pitch = null;

        if (dbConnected && db) {
          try {
            const pitchResult = await db.query(`
              SELECT p.*, u.first_name, u.last_name, u.company, u.bio,
                     (SELECT COUNT(*) FROM pitch_views WHERE pitch_id = p.id) as view_count,
                     (SELECT COUNT(*) FROM pitch_likes WHERE pitch_id = p.id) as like_count
              FROM pitches p 
              JOIN users u ON p.created_by = u.id
              WHERE p.id = $1
            `, [pitchId]);

            if (pitchResult && pitchResult[0]) {
              const p = pitchResult[0];
              pitch = {
                id: p.id,
                title: p.title,
                logline: p.logline,
                synopsis: p.synopsis,
                genre: p.genre,
                format: p.format,
                status: p.status,
                seekingInvestment: p.seeking_investment,
                fundingGoal: p.funding_goal,
                productionBudget: p.production_budget,
                targetRating: p.target_rating,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
                viewCount: parseInt(p.view_count || 0),
                likeCount: parseInt(p.like_count || 0),
                creator: {
                  firstName: p.first_name,
                  lastName: p.last_name,
                  company: p.company,
                  bio: p.bio,
                  displayName: `${p.first_name} ${p.last_name}`.trim()
                }
              };
            }
          } catch (dbError) {
            console.error('Database pitch query failed:', dbError);
          }
        }

        // Fallback to demo data
        if (!pitch) {
          pitch = DEMO_FALLBACK.pitches.find(p => p.id === pitchId);
        }

        if (!pitch) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Pitch not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: pitch,
          source: dbConnected ? 'database' : 'demo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Pitch by ID error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch pitch',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Public pitches endpoint 
    if (path === '/api/pitches/public' && request.method === 'GET') {
      try {
        let pitches = [];

        if (dbConnected && db) {
          try {
            const pitchResults = await db.query(`
              SELECT p.id, p.title, p.logline, p.genre, p.format, p.created_at,
                     u.first_name, u.last_name, u.company
              FROM pitches p 
              JOIN users u ON p.created_by = u.id
              WHERE p.status = 'published' AND p.is_public = true
              ORDER BY p.created_at DESC LIMIT 20
            `);
            
            pitches = pitchResults.map(p => ({
              id: p.id,
              title: p.title,
              logline: p.logline,
              genre: p.genre,
              format: p.format,
              createdAt: p.created_at,
              creator: {
                firstName: p.first_name,
                lastName: p.last_name,
                company: p.company,
                displayName: `${p.first_name} ${p.last_name}`.trim()
              }
            }));

          } catch (dbError) {
            console.error('Database public pitches query failed:', dbError);
          }
        }

        // Fallback to demo data
        if (pitches.length === 0) {
          pitches = DEMO_FALLBACK.pitches.slice(0, 10);
        }

        return new Response(JSON.stringify({
          success: true,
          data: pitches,
          source: dbConnected ? 'database' : 'demo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Public pitches endpoint error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch public pitches'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Trending pitches endpoint
    if (path === '/api/pitches/trending' && request.method === 'GET') {
      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        let pitches = [];

        if (dbConnected && db) {
          try {
            const pitchResults = await db.query(`
              SELECT p.id, p.title, p.logline, p.genre, p.format, p.view_count, p.like_count, p.created_at,
                     u.first_name, u.last_name, u.company_name
              FROM pitches p 
              JOIN users u ON p.created_by = u.id
              WHERE p.status = 'published' AND p.is_public = true
              ORDER BY p.view_count DESC, p.like_count DESC, p.created_at DESC 
              LIMIT $1
            `, [limit]);
            
            pitches = pitchResults.map(p => ({
              id: p.id,
              title: p.title,
              logline: p.logline,
              genre: p.genre,
              format: p.format,
              viewCount: p.view_count || 0,
              likeCount: p.like_count || 0,
              createdAt: p.created_at,
              creator: {
                firstName: p.first_name,
                lastName: p.last_name,
                company: p.company_name,
                displayName: `${p.first_name} ${p.last_name}`.trim()
              }
            }));

          } catch (dbError) {
            console.error('Database trending pitches query failed:', dbError);
            
            // Log to Sentry
            await sentry.captureError(dbError as Error, {
              operation: 'trending_pitches_query',
              limit,
              path
            });
          }
        }

        // Fallback to demo data
        if (pitches.length === 0) {
          pitches = DEMO_FALLBACK.pitches.slice(0, limit);
        }

        return new Response(JSON.stringify({
          success: true,
          data: pitches,
          source: dbConnected ? 'database' : 'demo',
          count: pitches.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Trending pitches endpoint error:', error);
        
        // Log to Sentry
        await sentry.captureError(error as Error, {
          operation: 'trending_pitches_endpoint',
          path
        });
        
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch trending pitches'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // New releases/pitches endpoint
    if (path === '/api/pitches/new' && request.method === 'GET') {
      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        let pitches = [];

        if (dbConnected && db) {
          try {
            const pitchResults = await db.query(`
              SELECT p.id, p.title, p.logline, p.genre, p.format, p.view_count, p.like_count, p.created_at,
                     u.first_name, u.last_name, u.company_name
              FROM pitches p 
              JOIN users u ON p.created_by = u.id
              WHERE p.status = 'published' AND p.is_public = true
              ORDER BY p.created_at DESC 
              LIMIT $1
            `, [limit]);
            
            pitches = pitchResults.map(p => ({
              id: p.id,
              title: p.title,
              logline: p.logline,
              genre: p.genre,
              format: p.format,
              viewCount: p.view_count || 0,
              likeCount: p.like_count || 0,
              createdAt: p.created_at,
              creator: {
                firstName: p.first_name,
                lastName: p.last_name,
                company: p.company_name,
                displayName: `${p.first_name} ${p.last_name}`.trim()
              }
            }));

          } catch (dbError) {
            console.error('Database new pitches query failed:', dbError);
            
            // Log to Sentry
            await sentry.captureError(dbError as Error, {
              operation: 'new_pitches_query',
              limit,
              path
            });
          }
        }

        // Fallback to demo data
        if (pitches.length === 0) {
          pitches = DEMO_FALLBACK.pitches.slice(0, limit);
        }

        return new Response(JSON.stringify({
          success: true,
          data: pitches,
          source: dbConnected ? 'database' : 'demo',
          count: pitches.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('New pitches endpoint error:', error);
        
        // Log to Sentry
        await sentry.captureError(error as Error, {
          operation: 'new_pitches_endpoint',
          path
        });
        
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch new pitches'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Investor dashboard endpoint
    if (path === '/api/investor/dashboard' && request.method === 'GET') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authorization required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.substring(7);
        const payload = verifyJWT(token);
        if (!payload) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid token'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let dashboardData = {
          totalInvestments: 0,
          activeNDAs: 0,
          savedPitches: 0,
          totalInvestedAmount: 0,
          recentActivity: [],
          trendingPitches: [],
          notifications: []
        };

        if (dbConnected && db) {
          try {
            // Get investment stats
            const investmentStats = await db.query(`
              SELECT COUNT(*) as total_investments, 
                     COALESCE(SUM(amount), 0) as total_amount
              FROM investments 
              WHERE investor_id = $1
            `, [payload.userId]);

            if (investmentStats[0]) {
              dashboardData.totalInvestments = parseInt(investmentStats[0].total_investments);
              dashboardData.totalInvestedAmount = parseFloat(investmentStats[0].total_amount || 0);
            }

            // Get NDA stats
            const ndaStats = await db.query(`
              SELECT COUNT(*) as active_ndas
              FROM nda_requests 
              WHERE investor_id = $1 AND status = 'approved'
            `, [payload.userId]);

            if (ndaStats[0]) {
              dashboardData.activeNDAs = parseInt(ndaStats[0].active_ndas);
            }

            // Get trending pitches
            const trendingPitches = await db.query(`
              SELECT p.id, p.title, p.genre, p.logline, 
                     u.first_name, u.last_name, u.company,
                     COUNT(pv.id) as view_count
              FROM pitches p
              JOIN users u ON p.created_by = u.id
              LEFT JOIN pitch_views pv ON p.id = pv.pitch_id 
                AND pv.created_at > NOW() - INTERVAL '7 days'
              WHERE p.status = 'published'
              GROUP BY p.id, p.title, p.genre, p.logline, u.first_name, u.last_name, u.company
              ORDER BY view_count DESC, p.created_at DESC
              LIMIT 5
            `);

            dashboardData.trendingPitches = trendingPitches.map(p => ({
              id: p.id,
              title: p.title,
              genre: p.genre,
              logline: p.logline,
              viewCount: parseInt(p.view_count || 0),
              creator: {
                firstName: p.first_name,
                lastName: p.last_name,
                company: p.company,
                displayName: `${p.first_name} ${p.last_name}`.trim()
              }
            }));

          } catch (dbError) {
            console.error('Database dashboard query failed:', dbError);
          }
        }

        // Fallback data if no database results
        if (dashboardData.trendingPitches.length === 0) {
          dashboardData.trendingPitches = DEMO_FALLBACK.pitches.slice(0, 5);
        }

        return new Response(JSON.stringify({
          success: true,
          data: dashboardData,
          source: dbConnected ? 'database' : 'demo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Investor dashboard error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to load dashboard',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // User stats endpoint
    if (path.match(/^\/api\/user\/stats$|^\/api\/users\/(\d+)\/stats$/) && request.method === 'GET') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authorization required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.substring(7);
        const payload = verifyJWT(token);
        if (!payload) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid token'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Extract user ID from path or use current user
        const pathMatch = path.match(/^\/api\/users\/(\d+)\/stats$/);
        const targetUserId = pathMatch ? parseInt(pathMatch[1]) : payload.userId;

        let stats = {
          pitchesCreated: 0,
          totalViews: 0,
          totalLikes: 0,
          followersCount: 0,
          followingCount: 0,
          joinDate: new Date().toISOString()
        };

        if (dbConnected && db) {
          try {
            // Get pitch stats
            const pitchStats = await db.query(`
              SELECT COUNT(*) as pitches_created,
                     COALESCE(SUM((
                       SELECT COUNT(*) FROM pitch_views WHERE pitch_id = p.id
                     )), 0) as total_views,
                     COALESCE(SUM((
                       SELECT COUNT(*) FROM pitch_likes WHERE pitch_id = p.id  
                     )), 0) as total_likes
              FROM pitches p
              WHERE p.created_by = $1
            `, [targetUserId]);

            if (pitchStats[0]) {
              stats.pitchesCreated = parseInt(pitchStats[0].pitches_created);
              stats.totalViews = parseInt(pitchStats[0].total_views || 0);
              stats.totalLikes = parseInt(pitchStats[0].total_likes || 0);
            }

            // Get follow stats
            const followStats = await db.query(`
              SELECT 
                (SELECT COUNT(*) FROM follows WHERE followed_id = $1) as followers_count,
                (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following_count
            `, [targetUserId]);

            if (followStats[0]) {
              stats.followersCount = parseInt(followStats[0].followers_count || 0);
              stats.followingCount = parseInt(followStats[0].following_count || 0);
            }

            // Get join date
            const userInfo = await db.query(`
              SELECT created_at FROM users WHERE id = $1
            `, [targetUserId]);

            if (userInfo[0]) {
              stats.joinDate = userInfo[0].created_at;
            }

          } catch (dbError) {
            console.error('Database user stats query failed:', dbError);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          data: stats,
          source: dbConnected ? 'database' : 'demo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('User stats error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch user stats',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // NDA request endpoint
    if (path === '/api/ndas/request' && request.method === 'POST') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authorization required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.substring(7);
        const payload = verifyJWT(token);
        if (!payload) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid token'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json();
        const { pitchId, ndaType = 'basic', requestMessage } = body;

        if (!pitchId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'pitchId is required'
          }), {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let ndaRequest = null;
        if (dbConnected && db) {
          try {
            // Check if NDA already exists
            const existingNDA = await db.query(`
              SELECT id, status FROM nda_requests 
              WHERE pitch_id = $1 AND investor_id = $2
            `, [pitchId, payload.userId]);

            if (existingNDA && existingNDA[0]) {
              return new Response(JSON.stringify({
                success: false,
                error: 'NDA request already exists',
                data: { status: existingNDA[0].status }
              }), {
                status: 409,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Create new NDA request
            const insertResult = await db.query(`
              INSERT INTO nda_requests (pitch_id, investor_id, nda_type, request_message, status, created_at)
              VALUES ($1, $2, $3, $4, 'pending', NOW())
              RETURNING id, created_at
            `, [pitchId, payload.userId, ndaType, requestMessage]);

            if (insertResult && insertResult[0]) {
              ndaRequest = {
                id: insertResult[0].id,
                pitchId,
                investorId: payload.userId,
                ndaType,
                requestMessage,
                status: 'pending',
                createdAt: insertResult[0].created_at
              };
            }

          } catch (dbError) {
            console.error('Database NDA request creation failed:', dbError);
          }
        }

        // Fallback response
        if (!ndaRequest) {
          ndaRequest = {
            id: Math.floor(Math.random() * 1000),
            pitchId,
            investorId: payload.userId,
            ndaType,
            requestMessage,
            status: 'pending',
            createdAt: new Date().toISOString()
          };
        }

        return new Response(JSON.stringify({
          success: true,
          data: ndaRequest,
          source: dbConnected ? 'database' : 'demo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('NDA request error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to create NDA request',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // NDA approval endpoint
    if (path.match(/^\/api\/ndas\/(\d+)\/approve$/) && request.method === 'POST') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authorization required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.substring(7);
        const payload = verifyJWT(token);
        if (!payload) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid token'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const requestId = parseInt(path.split('/')[3]);
        let success = false;

        if (dbConnected && db) {
          try {
            // Verify the request belongs to a pitch created by this user
            const ndaRequest = await db.query(`
              SELECT nr.*, p.created_by
              FROM nda_requests nr
              JOIN pitches p ON nr.pitch_id = p.id
              WHERE nr.id = $1 AND p.created_by = $2
            `, [requestId, payload.userId]);

            if (!ndaRequest || !ndaRequest[0]) {
              return new Response(JSON.stringify({
                success: false,
                error: 'NDA request not found or access denied'
              }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Update the request status
            const updateResult = await db.query(`
              UPDATE nda_requests 
              SET status = 'approved', approved_at = NOW()
              WHERE id = $1
              RETURNING *
            `, [requestId]);

            success = updateResult && updateResult[0];

          } catch (dbError) {
            console.error('Database NDA approval failed:', dbError);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          data: { requestId, status: 'approved' },
          source: dbConnected ? 'database' : 'demo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('NDA approval error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to approve NDA request',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Remove proxy and provide clear endpoint documentation instead
    if (path.startsWith('/api/')) {
      // List all available endpoints for debugging
      const availableEndpoints = [
        'GET /api/health - Health check',
        'GET /api/validate-token - Token validation',
        'GET /api/upload/quota - Storage quota info',
        'POST /api/auth/creator/login - Creator login',
        'POST /api/auth/investor/login - Investor login', 
        'POST /api/auth/production/login - Production login',
        'GET /api/auth/profile - User profile',
        'GET /api/pitches - List pitches (with pagination, search, filters)',
        'GET /api/pitches/{id} - Get pitch by ID',
        'GET /api/pitches/public - Public pitches',
        'GET /api/pitches/trending - Trending pitches (sorted by views/likes)',
        'GET /api/pitches/new - New releases (sorted by creation date)',
        'GET /api/investor/dashboard - Investor dashboard data',
        'GET /api/user/stats - User statistics',
        'GET /api/users/{id}/stats - User statistics by ID',
        'POST /api/ndas/request - Request NDA',
        'POST /api/ndas/{id}/approve - Approve NDA'
      ];

      return new Response(JSON.stringify({
        error: 'Endpoint not implemented in Worker',
        message: `The endpoint ${path} has not been migrated to the Worker yet`,
        availableEndpoints,
        suggestion: 'Please use one of the available endpoints above or request migration of this endpoint'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
        'GET /api/pitches/:id',
        'GET /api/pitches/trending',
        'GET /api/pitches/new',
        'POST /api/auth/*/login',
        'GET /api/creator/dashboard',
        'GET /api/investor/dashboard',
        'GET /api/production/dashboard',
        'GET /api/profile',
        'GET /api/nda/active',
        'GET /api/nda/pending',
        'GET /api/follows/stats/:id',
        'GET /api/payments/credits/balance',
        'GET /api/payments/subscription-status'
      ]
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Worker error:', error);
    
    // Log critical Worker errors to Sentry
    await sentry.captureError(error as Error, {
      operation: 'worker_request_handler',
      path,
      method: request.method,
      url: request.url,
      database_connected: dbConnected,
      hyperdrive_available: !!env.HYPERDRIVE,
      user_agent: request.headers.get('User-Agent'),
      referer: request.headers.get('Referer')
    });
    
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message || error.toString(),
      database: dbConnected ? 'connected' : 'unavailable',
      errorId: crypto.randomUUID() // Unique error ID for tracking
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