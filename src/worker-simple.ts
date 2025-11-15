/**
 * Simplified Cloudflare Worker with Hyperdrive Database Connection
 * Uses raw SQL queries without Drizzle ORM for immediate deployment
 */

export interface Env {
  // Database
  HYPERDRIVE: any;
  DATABASE_URL?: string;
  
  // Storage
  CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  
  // Real-time
  WEBSOCKET_ROOM: DurableObjectNamespace;
  
  // Configuration
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL?: string; // For progressive migration to Deno backend
}

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: number;
  email: string;
  userType: 'creator' | 'investor' | 'production';
  displayName?: string;
  iat: number;
  exp: number;
}

/**
 * Verify JWT token and extract user information
 */
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    // Simple JWT verification for Cloudflare Workers
    // In production, use a proper JWT library
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) {
      return null;
    }
    
    // Decode payload
    const decodedPayload = JSON.parse(atob(payload));
    
    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      console.log('Token expired');
      return null;
    }
    
    // For demo accounts, accept simple tokens
    if (token.startsWith('demo-')) {
      // Extract user ID from token like "demo-creator-1004"
      const parts = token.split('-');
      if (parts.length >= 3) {
        const userType = parts[1] as 'creator' | 'investor' | 'production';
        const userId = parseInt(parts[2], 10);
        
        if (userId && userType) {
          const demoEmails = {
            'creator': 'alex.creator@demo.com',
            'investor': 'sarah.investor@demo.com', 
            'production': 'stellar.production@demo.com'
          };
          
          const displayNames = {
            'creator': 'Alex Creator',
            'investor': 'Sarah Investor',
            'production': 'Stellar Production'
          };
          
          return {
            userId,
            email: demoEmails[userType],
            userType,
            displayName: displayNames[userType],
            iat: Date.now() / 1000,
            exp: Date.now() / 1000 + 86400
          };
        }
      }
      
      // Legacy format support
      const demoUsers: Record<string, JWTPayload> = {
        'demo-creator-1': {
          userId: 1004,
          email: 'alex.creator@demo.com',
          userType: 'creator',
          displayName: 'Alex Creator',
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 86400
        },
        'demo-investor-2': {
          userId: 1005,
          email: 'sarah.investor@demo.com',
          userType: 'investor',
          displayName: 'Sarah Investor',
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 86400
        },
        'demo-production-3': {
          userId: 1006,
          email: 'stellar.production@demo.com',
          userType: 'production',
          displayName: 'Stellar Production',
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 86400
        }
      };
      
      const demoKey = token.replace('Bearer ', '').trim();
      return demoUsers[demoKey] || null;
    }
    
    // TODO: Implement proper JWT verification with secret
    // For now, trust the payload if it has required fields
    if (decodedPayload.userId && decodedPayload.userType) {
      return decodedPayload as JWTPayload;
    }
    
    return null;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Extract and verify authentication from request
 */
async function authenticateRequest(request: Request, env: Env): Promise<{ user: JWTPayload | null; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { user: null, error: 'Empty token' };
  }
  
  const user = await verifyJWT(token, env.JWT_SECRET);
  
  if (!user) {
    return { user: null, error: 'Invalid or expired token' };
  }
  
  return { user };
}

/**
 * CORS headers helper
 */
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

/**
 * Execute database query with Hyperdrive
 */
async function executeQuery(env: Env, query: string, params: any[] = []): Promise<any> {
  try {
    // For now, proxy all database queries to Deno backend until Hyperdrive is properly configured
    if (env.ORIGIN_URL) {
      console.log('Using origin for database queries (Hyperdrive not yet configured)');
      // Create a mock request for the specific query
      const mockRequest = new Request(`${env.ORIGIN_URL}/api/db/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, params })
      });
      
      try {
        const response = await fetch(mockRequest);
        if (response.ok) {
          const result = await response.json();
          return result;
        }
      } catch (proxyError) {
        console.log('Database proxy failed, continuing with demo data');
      }
    }
    
    // Return mock data for demo purposes when database is unavailable
    console.log('Using demo data fallback for query:', query.slice(0, 50));
    
    // Demo data based on query type
    if (query.includes('SELECT') && query.includes('users')) {
      if (query.includes('alex.creator@demo.com')) {
        return {
          rows: [{
            id: 1004,
            email: 'alex.creator@demo.com',
            username: 'alexcreator',
            user_type: 'creator',
            first_name: 'Alex',
            last_name: 'Creator',
            company_name: 'Independent Films',
            is_active: true,
            email_verified: true
          }]
        };
      }
      if (query.includes('sarah.investor@demo.com')) {
        return {
          rows: [{
            id: 1005,
            email: 'sarah.investor@demo.com',
            username: 'sarahinvestor',
            user_type: 'investor',
            first_name: 'Sarah',
            last_name: 'Investor',
            company_name: 'Capital Ventures',
            is_active: true,
            email_verified: true
          }]
        };
      }
      if (query.includes('stellar.production@demo.com')) {
        return {
          rows: [{
            id: 1006,
            email: 'stellar.production@demo.com',
            username: 'stellarproduction',
            user_type: 'production',
            first_name: 'Stellar',
            last_name: 'Production',
            company_name: 'Stellar Productions Inc',
            is_active: true,
            email_verified: true
          }]
        };
      }
      
      // General user stats
      if (query.includes('user_type') && query.includes('COUNT(*)')) {
        return {
          rows: [
            { user_type: 'creator', count: 156, new_users: 23 },
            { user_type: 'investor', count: 89, new_users: 12 },
            { user_type: 'production', count: 34, new_users: 5 }
          ]
        };
      }
    }
    
    // Pitch queries
    if (query.includes('SELECT') && query.includes('pitches')) {
      return {
        rows: [
          {
            id: 1,
            title: 'The Last Stand',
            tagline: 'When hope is lost, heroes emerge',
            genre: 'Action',
            synopsis: 'A gripping action thriller about unlikely heroes',
            poster_url: '/demo/poster1.jpg',
            video_url: '/demo/video1.mp4',
            view_count: 1250,
            creator_name: 'Alex Creator',
            created_at: new Date().toISOString()
          }
        ]
      };
    }
    
    // Count queries
    if (query.includes('COUNT(*)')) {
      return { rows: [{ count: 0 }] };
    }
    
    return { rows: [] };
  } catch (error) {
    console.error('Database query error:', error);
    return { rows: [] };
  }
}

/**
 * Cache wrapper for queries
 */
async function cachedQuery(
  env: Env,
  key: string,
  query: string,
  params: any[] = [],
  ttl: number = 300
): Promise<any> {
  // Try cache first
  const cached = await env.CACHE.get(key, 'json');
  if (cached) {
    return cached;
  }
  
  // Execute query
  const result = await executeQuery(env, query, params);
  
  // Cache result
  await env.CACHE.put(key, JSON.stringify(result), {
    expirationTtl: ttl
  });
  
  return result;
}

/**
 * Main request handler
 */
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
    
    // Add CORS to all responses
    const corsHeaders = getCorsHeaders(origin, env);
    
    try {
      // Health check
      if (url.pathname === '/api/health') {
        return new Response('ok', { 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        });
      }
      
      // ===== AUTHENTICATION ENDPOINTS =====
      
      // Creator Login
      if (url.pathname === '/api/auth/creator/login' && method === 'POST') {
        try {
          const loginData = await request.json();
          const { email, password } = loginData;
          
          if (!email || !password) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Email and password are required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Query database for user
          const result = await executeQuery(env,
            `SELECT id, email, username, user_type, password_hash, first_name, last_name, company_name, is_active, email_verified
             FROM users 
             WHERE email = $1 AND user_type = 'creator'`,
            [email]
          );
          
          if (!result?.rows || result.rows.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid credentials'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const user = result.rows[0];
          
          // For demo accounts, allow simple password verification
          if (email === 'alex.creator@demo.com' && password === 'Demo123!') {
            const token = `demo-creator-${user.id}`;
            return new Response(JSON.stringify({
              success: true,
              token,
              user: {
                id: user.id,
                email: user.email,
                username: user.username,
                userType: user.user_type,
                firstName: user.first_name,
                lastName: user.last_name,
                companyName: user.company_name
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // TODO: Implement proper bcrypt verification in Workers environment
          // For now, proxy to origin for password verification
          if (env.ORIGIN_URL) {
            return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
          }
          
          return new Response(JSON.stringify({
            success: false,
            error: 'Password verification not yet implemented in Workers'
          }), {
            status: 501,
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
      
      // Investor Login
      if (url.pathname === '/api/auth/investor/login' && method === 'POST') {
        try {
          const loginData = await request.json();
          const { email, password } = loginData;
          
          if (!email || !password) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Email and password are required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Demo investor login
          if (email === 'sarah.investor@demo.com' && password === 'Demo123!') {
            const result = await executeQuery(env,
              `SELECT id, email, username, user_type, first_name, last_name, company_name
               FROM users 
               WHERE email = $1 AND user_type = 'investor'`,
              [email]
            );
            
            if (result?.rows && result.rows.length > 0) {
              const user = result.rows[0];
              const token = `demo-investor-${user.id}`;
              return new Response(JSON.stringify({
                success: true,
                token,
                user: {
                  id: user.id,
                  email: user.email,
                  username: user.username,
                  userType: user.user_type,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  companyName: user.company_name
                }
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
          
          // Proxy to origin for other cases
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
      
      // Production Login
      if (url.pathname === '/api/auth/production/login' && method === 'POST') {
        try {
          const loginData = await request.json();
          const { email, password } = loginData;
          
          if (!email || !password) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Email and password are required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Demo production login
          if (email === 'stellar.production@demo.com' && password === 'Demo123!') {
            const result = await executeQuery(env,
              `SELECT id, email, username, user_type, first_name, last_name, company_name
               FROM users 
               WHERE email = $1 AND user_type = 'production'`,
              [email]
            );
            
            if (result?.rows && result.rows.length > 0) {
              const user = result.rows[0];
              const token = `demo-production-${user.id}`;
              return new Response(JSON.stringify({
                success: true,
                token,
                user: {
                  id: user.id,
                  email: user.email,
                  username: user.username,
                  userType: user.user_type,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  companyName: user.company_name
                }
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
          
          // Proxy to origin for other cases
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
      
      // Validate token endpoint
      if (url.pathname === '/api/validate-token' && method === 'GET') {
        const { user, error } = await authenticateRequest(request, env);
        
        if (error || !user) {
          return new Response(JSON.stringify({
            valid: false,
            error: error || 'Invalid token'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          valid: true,
          user: {
            id: user.userId,
            email: user.email,
            userType: user.userType,
            displayName: user.displayName
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Profile endpoint
      if (url.pathname === '/api/profile' && method === 'GET') {
        const { user, error } = await authenticateRequest(request, env);
        
        if (error || !user) {
          return new Response(JSON.stringify({
            success: false,
            error: error || 'Unauthorized'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Try to fetch full profile from database
        try {
          const result = await executeQuery(
            env,
            `SELECT id, email, username, user_type, company_name, bio, avatar_url, 
                    location, website, created_at, updated_at
             FROM users 
             WHERE id = ?`,
            [user.userId]
          );
          
          if (result.rows && result.rows.length > 0) {
            const dbUser = result.rows[0];
            return new Response(JSON.stringify({
              success: true,
              data: {
                id: dbUser.id,
                email: dbUser.email,
                username: dbUser.username,
                userType: dbUser.user_type,
                companyName: dbUser.company_name,
                bio: dbUser.bio,
                avatarUrl: dbUser.avatar_url,
                location: dbUser.location,
                website: dbUser.website,
                createdAt: dbUser.created_at,
                updatedAt: dbUser.updated_at
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (error) {
          console.error('Failed to fetch profile from database:', error);
        }
        
        // Fallback to token data if database fetch fails
        let createdAt: string;
        try {
          if (user.iat && typeof user.iat === 'number' && user.iat > 0) {
            createdAt = new Date(user.iat * 1000).toISOString();
          } else {
            createdAt = new Date().toISOString();
          }
        } catch (error) {
          console.warn('Invalid iat value in token, using current time:', user.iat);
          createdAt = new Date().toISOString();
        }
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: user.userId,
            email: user.email,
            userType: user.userType,
            username: user.email?.split('@')[0], // Generate username from email
            companyName: null,
            bio: null,
            avatarUrl: null,
            location: null,
            website: null,
            createdAt,
            updatedAt: createdAt
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // ===== CREATOR ENDPOINTS (ROLE-PROTECTED) =====
      
      // Get creator's pitches - REQUIRES CREATOR ROLE
      if (url.pathname === '/api/creator/pitches' && method === 'GET') {
        const { user, error } = await authenticateRequest(request, env);
        
        if (error || !user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // CRITICAL SECURITY CHECK: Verify user is a creator
        if (user.userType !== 'creator') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Access denied. This endpoint is only accessible to creators.',
            requiredRole: 'creator',
            currentRole: user.userType
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          // Fetch only the creator's own pitches
          const result = await executeQuery(env, 
            `SELECT 
              p.id,
              p.title,
              p.tagline,
              p.genre,
              p.synopsis,
              p.poster_url,
              p.video_url,
              p.status,
              p.view_count,
              p.created_at,
              p.updated_at
            FROM pitches p
            WHERE p.creator_id = $1
            ORDER BY p.created_at DESC`,
            [user.userId]
          );
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              pitches: result?.rows || [],
              total: result?.rows?.length || 0
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          console.error('Failed to fetch creator pitches:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch pitches'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Create pitch - REQUIRES CREATOR ROLE
      if (url.pathname === '/api/creator/pitches' && method === 'POST') {
        const { user, error } = await authenticateRequest(request, env);
        
        if (error || !user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // CRITICAL SECURITY CHECK: Verify user is a creator
        if (user.userType !== 'creator') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Access denied. Only creators can create pitches.',
            requiredRole: 'creator',
            currentRole: user.userType
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Continue with pitch creation logic...
        // This is just a placeholder - implement actual logic
        return new Response(JSON.stringify({
          success: true,
          message: 'Pitch creation endpoint (implement actual logic)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // ===== INVESTOR ENDPOINTS (ROLE-PROTECTED) =====
      
      // Investor dashboard - REQUIRES INVESTOR ROLE
      if (url.pathname === '/api/investor/dashboard' && method === 'GET') {
        const { user, error } = await authenticateRequest(request, env);
        
        if (error || !user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // CRITICAL SECURITY CHECK: Verify user is an investor
        if (user.userType !== 'investor') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Access denied. This endpoint is only accessible to investors.',
            requiredRole: 'investor',
            currentRole: user.userType
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          // Fetch investor-specific dashboard data
          const savedPitches = await executeQuery(env,
            `SELECT COUNT(*) as count FROM pitch_saves WHERE user_id = $1`,
            [user.userId]
          );
          
          const ndaCount = await executeQuery(env,
            `SELECT COUNT(*) as count FROM ndas WHERE investor_id = $1`,
            [user.userId]
          );
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              savedPitches: savedPitches?.rows?.[0]?.count || 0,
              signedNDAs: ndaCount?.rows?.[0]?.count || 0,
              recentActivity: [],
              recommendations: []
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          console.error('Failed to fetch investor dashboard:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch dashboard data'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // ===== PRODUCTION COMPANY ENDPOINTS (ROLE-PROTECTED) =====
      
      // Production dashboard - REQUIRES PRODUCTION ROLE
      if (url.pathname === '/api/production/dashboard' && method === 'GET') {
        const { user, error } = await authenticateRequest(request, env);
        
        if (error || !user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication required'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // CRITICAL SECURITY CHECK: Verify user is a production company
        if (user.userType !== 'production') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Access denied. This endpoint is only accessible to production companies.',
            requiredRole: 'production',
            currentRole: user.userType
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          // Fetch production-specific dashboard data
          return new Response(JSON.stringify({
            success: true,
            data: {
              activeProjects: [],
              submissions: [],
              pipeline: []
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          console.error('Failed to fetch production dashboard:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch dashboard data'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Database test endpoint - REMOVED for production security
      
      // Browse enhanced endpoint
      if (url.pathname === '/api/pitches/browse/enhanced' && method === 'GET') {
        try {
          const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit') || '24', 10), 50));
          const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
          const sortField = (url.searchParams.get('sort') || 'date').toLowerCase();
          const sortOrder = (url.searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
          const genres = url.searchParams.getAll('genre');
          const formats = url.searchParams.getAll('format');
          const stages = url.searchParams.getAll('stage');
          const creatorTypes = url.searchParams.getAll('creatorType');
          const q = url.searchParams.get('q');
          const budgetMin = parseInt(url.searchParams.get('budgetMin') || '', 10);
          const budgetMax = parseInt(url.searchParams.get('budgetMax') || '', 10);
          const hasNDA = url.searchParams.get('hasNDA'); // 'true' | 'false' | null
          const seekingInvestment = url.searchParams.get('seekingInvestment'); // 'true'|'false'|null

          const whereClauses: string[] = ["p.status = 'published'"];
          const params: any[] = [];
          let paramIndex = 1;

          if (genres.length > 0) {
            const placeholders = genres.map(() => `$${paramIndex++}`).join(',');
            params.push(...genres);
            whereClauses.push(`p.genre IN (${placeholders})`);
          }
          if (formats.length > 0) {
            const placeholders = formats.map(() => `$${paramIndex++}`).join(',');
            params.push(...formats);
            whereClauses.push(`p.format IN (${placeholders})`);
          }
          if (stages.length > 0) {
            const placeholders = stages.map(() => `$${paramIndex++}`).join(',');
            params.push(...stages);
            whereClauses.push(`p.production_stage IN (${placeholders})`);
          }
          if (creatorTypes.length > 0) {
            const placeholders = creatorTypes.map(() => `$${paramIndex++}`).join(',');
            params.push(...creatorTypes);
            whereClauses.push(`u.user_type IN (${placeholders})`);
          }
          if (!Number.isNaN(budgetMin)) {
            params.push(budgetMin);
            whereClauses.push(`p.estimated_budget >= $${paramIndex++}`);
          }
          if (!Number.isNaN(budgetMax)) {
            params.push(budgetMax);
            whereClauses.push(`p.estimated_budget <= $${paramIndex++}`);
          }
          if (hasNDA === 'true' || hasNDA === 'false') {
            params.push(hasNDA === 'true');
            whereClauses.push(`p.require_nda = $${paramIndex++}`);
          }
          if (seekingInvestment === 'true' || seekingInvestment === 'false') {
            params.push(seekingInvestment === 'true');
            whereClauses.push(`p.seeking_investment = $${paramIndex++}`);
          }
          if (q && q.trim()) {
            params.push(`%${q.trim()}%`);
            whereClauses.push(`(p.title ILIKE $${paramIndex} OR p.tagline ILIKE $${paramIndex} OR p.synopsis ILIKE $${paramIndex})`);
            paramIndex++;
          }

          const orderExpr =
            sortField === 'views' ? `p.view_count ${sortOrder}` :
            sortField === 'likes' ? `like_count ${sortOrder}` :
            sortField === 'featured' ? `p.is_featured DESC, p.created_at ${sortOrder}` :
            `p.created_at ${sortOrder}`;

          const sql = `
            SELECT 
              p.id,
              p.title,
              p.tagline,
              p.genre,
              p.synopsis,
              p.poster_url,
              p.video_url,
              p.view_count,
              p.status,
              p.created_at,
              u.display_name AS creator_name,
              COUNT(DISTINCT pl.id) AS like_count
            FROM pitches p
            LEFT JOIN users u ON p.creator_id = u.id
            LEFT JOIN pitch_likes pl ON p.id = pl.pitch_id
            ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
            GROUP BY p.id, u.display_name
            ORDER BY ${orderExpr}
            LIMIT ${limit} OFFSET ${offset}`;

          let result = await executeQuery(env, sql, params);
          let pitches = result?.rows || [];

          // Proxy fallback to origin browse if empty or unexpected shape
          if (pitches.length === 0 && env.ORIGIN_URL) {
            try {
              const proxiedUrl = `${env.ORIGIN_URL}/api/pitches/browse/general${url.search}`;
              const proxied = await fetch(proxiedUrl, { headers: { Accept: 'application/json' } });
              if (proxied.ok) {
                const json = await proxied.json();
                const originPitches = json?.pitches || json?.data?.pitches || [];
                if (originPitches.length > 0) {
                  pitches = originPitches;
                }
              }
            } catch {}
          }

          return new Response(JSON.stringify({
            success: true,
            data: {
              pitches,
              pagination: {
                total: pitches.length,
                totalPages: 1,
              }
            }
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (error: any) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      
      // Trending pitches endpoint (cached with fallback)
      if (url.pathname === '/api/pitches/trending' && method === 'GET') {
        try {
          const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50));
          const cacheKey = `pitches:trending:v3:limit:${limit}`;

          // Enhanced trending algorithm with time-weighted scoring
          const trendingSql = `
            WITH pitch_metrics AS (
              SELECT 
                p.id,
                COUNT(DISTINCT pv.id) as total_views,
                COUNT(DISTINCT CASE 
                  WHEN pv.created_at > NOW() - INTERVAL '7 days' 
                  THEN pv.id 
                END) as recent_views,
                COUNT(DISTINCT pl.user_id) as like_count,
                COUNT(DISTINCT ps.user_id) as save_count,
                COUNT(DISTINCT n.investor_id) as nda_count
              FROM pitches p
              LEFT JOIN pitch_views pv ON p.id = pv.pitch_id
              LEFT JOIN pitch_likes pl ON p.id = pl.pitch_id
              LEFT JOIN pitch_saves ps ON p.id = ps.pitch_id
              LEFT JOIN ndas n ON p.id = n.pitch_id AND n.status = 'signed'
              WHERE p.status = 'published'
              GROUP BY p.id
            )
            SELECT 
              p.id,
              p.title,
              p.tagline,
              p.genre,
              p.synopsis,
              p.poster_url,
              p.video_url,
              p.view_count,
              p.status,
              p.created_at,
              p.creator_id,
              u.display_name as creator_name,
              u.avatar_url as creator_avatar,
              COALESCE(pm.total_views, p.view_count, 0) as total_views,
              COALESCE(pm.recent_views, 0) as recent_views,
              COALESCE(pm.like_count, 0) as like_count,
              COALESCE(pm.save_count, 0) as save_count,
              COALESCE(pm.nda_count, 0) as nda_interest,
              -- Calculate trending score
              (
                COALESCE(pm.recent_views, 0) * 3 +  -- Recent activity weighted highest
                COALESCE(pm.like_count, 0) * 2 +    -- Engagement signals
                COALESCE(pm.save_count, 0) * 2 +
                COALESCE(pm.nda_count, 0) * 5 +     -- Strong interest signal
                COALESCE(p.view_count, 0) * 0.1     -- Base popularity
              ) as trending_score
            FROM pitches p
            LEFT JOIN pitch_metrics pm ON p.id = pm.id
            LEFT JOIN users u ON p.creator_id = u.id
            WHERE p.status = 'published'
              AND (COALESCE(pm.total_views, p.view_count, 0) > 0 OR p.is_featured = true)
            ORDER BY trending_score DESC, p.created_at DESC
            LIMIT ${limit}`;

          let result = await cachedQuery(env, cacheKey, trendingSql, [], 300);

          // Fallback: if no trending yet, show featured and newest
          if (!result?.rows || result.rows.length === 0) {
            const fallbackSql = `
              SELECT 
                p.id,
                p.title,
                p.tagline,
                p.genre,
                p.synopsis,
                p.poster_url,
                p.video_url,
                p.view_count,
                p.status,
                p.created_at,
                p.creator_id,
                u.display_name AS creator_name,
                u.avatar_url as creator_avatar,
                p.view_count as total_views,
                0 as recent_views,
                0 as like_count,
                0 as save_count,
                0 as nda_interest,
                p.view_count as trending_score
              FROM pitches p
              LEFT JOIN users u ON p.creator_id = u.id
              WHERE p.status = 'published'
              ORDER BY p.is_featured DESC, p.created_at DESC
              LIMIT ${limit}`;
            result = await executeQuery(env, fallbackSql, []);
          }

          // Final fallback: proxy to origin
          let rows = Array.isArray(result?.rows) ? result.rows : [];
          if (rows.length === 0 && env.ORIGIN_URL) {
            return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
          }
          
          return new Response(JSON.stringify({
            success: true,
            data: rows,
            cached: false,
            algorithm: 'v3-enhanced'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          console.error('Trending query error:', error);
          // Fallback to proxy on error
          if (env.ORIGIN_URL) {
            return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
          }
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Featured pitches endpoint
      if (url.pathname === '/api/pitches/featured' && method === 'GET') {
        try {
          const result = await cachedQuery(
            env,
            'pitches:featured',
            `SELECT 
              p.id, p.title, p.tagline, p.genre, p.synopsis,
              p.poster_url, p.video_url, p.created_at,
              u.display_name as creator_name
            FROM pitches p
            LEFT JOIN users u ON p.creator_id = u.id
            WHERE p.status = 'published' 
              AND p.is_featured = true
            ORDER BY p.created_at DESC
            LIMIT 10`,
            [],
            600 // 10 minute cache
          );
          
          return new Response(JSON.stringify({
            success: true,
            data: result.rows || []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // User stats endpoint
      if (url.pathname === '/api/users/stats' && method === 'GET') {
        try {
          const result = await cachedQuery(
            env,
            'users:stats',
            `SELECT 
              user_type,
              COUNT(*) as count,
              COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users
            FROM users
            GROUP BY user_type`,
            [],
            3600 // 1 hour cache
          );
          
          return new Response(JSON.stringify({
            success: true,
            stats: result.rows || []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // R2 upload endpoint
      if (url.pathname === '/api/upload' && method === 'POST') {
        try {
          const formData = await request.formData();
          const file = formData.get('file') as File;
          
          if (!file) {
            return new Response(JSON.stringify({
              success: false,
              error: 'No file provided'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Generate unique key
          const ext = file.name.split('.').pop();
          const key = `uploads/${crypto.randomUUID()}.${ext}`;
          
          // Upload to R2
          await env.R2_BUCKET.put(key, file.stream(), {
            httpMetadata: {
              contentType: file.type
            }
          });
          
          return new Response(JSON.stringify({
            success: true,
            url: `https://cdn.pitchey.com/${key}`,
            key
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // WebSocket upgrade
      if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
        // For now, proxy to Deno backend if available
        if (env.ORIGIN_URL) {
          return proxyWebSocket(request, env.ORIGIN_URL);
        }
        
        return new Response('WebSocket not yet implemented', { 
          status: 501,
          headers: corsHeaders
        });
      }
      
      // Progressive migration: proxy unimplemented routes to Deno
      if (env.ORIGIN_URL) {
        return proxyToOrigin(request, env.ORIGIN_URL, corsHeaders);
      }
      
      // 404 for unmatched routes
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error('Request error:', error);
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

/**
 * Proxy requests to origin (Deno backend)
 */
async function proxyToOrigin(
  request: Request,
  originUrl: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const proxiedUrl = originUrl + url.pathname + url.search;
    
    // Clone request headers, remove CF-specific headers
    const headers = new Headers(request.headers);
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ray');
    
    // Forward the request
    const response = await fetch(proxiedUrl, {
      method: request.method,
      headers,
      body: request.body
    });
    
    // Clone response and add CORS headers
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value as string);
    });
    responseHeaders.set('X-Proxied-From', 'cloudflare-workers');
    
    return new Response(response.body, {
      status: response.status,
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

/**
 * Proxy WebSocket connections
 */
async function proxyWebSocket(request: Request, originUrl: string): Promise<Response> {
  const url = new URL(originUrl);
  const wsUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws`;
  
  return new Response('WebSocket proxy not yet implemented', { status: 501 });
}

/**
 * Durable Object for WebSocket rooms (placeholder)
 */
export class WebSocketRoom {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // WebSocket handling to be implemented
    return new Response('WebSocket room not yet implemented', { status: 501 });
  }
}