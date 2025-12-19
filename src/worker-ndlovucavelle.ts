/**
 * Pitchey API Worker for ndlovucavelle account
 * Simple, working API with proper CORS support
 */

export interface Env {
  // Database
  DATABASE_URL?: string;
  
  // Cache
  KV?: KVNamespace;
  CACHE?: KVNamespace;
  
  // Storage
  R2_BUCKET?: R2Bucket;
  
  // Configuration
  FRONTEND_URL?: string;
  ENVIRONMENT?: 'development' | 'staging' | 'production';
  
  // Auth
  JWT_SECRET?: string;
}

// CORS configuration
const ALLOWED_ORIGINS = [
  'https://pitchey.pages.dev',
  'http://localhost:5173',
  'http://localhost:3000'
];

function getCorsHeaders(origin?: string | null): Record<string, string> {
  const requestOrigin = origin;
  const isAllowed = requestOrigin && ALLOWED_ORIGINS.some(allowed => 
    requestOrigin === allowed || requestOrigin.endsWith('.pitchey.pages.dev')
  );
  
  return {
    "Access-Control-Allow-Origin": isAllowed ? requestOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

class PitcheyAPIHandler {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Health check
    if (path === '/health') {
      return jsonResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: this.env.ENVIRONMENT || 'production',
        service: 'pitchey-api',
        version: '1.0.0'
      }, 200, corsHeaders);
    }

    // API routes
    if (path.startsWith('/api/')) {
      
      // Auth endpoints - Support all portal-specific login endpoints
      if ((path === '/api/auth/login' || 
           path === '/api/auth/creator/login' || 
           path === '/api/auth/investor/login' || 
           path === '/api/auth/production/login') && method === 'POST') {
        const body = await request.json();
        
        // Determine user type from path
        let userType = 'creator';
        if (path.includes('/investor/')) {
          userType = 'investor';
        } else if (path.includes('/production/')) {
          userType = 'production';
        }
        
        // Demo accounts for testing
        const demoAccounts: Record<string, any> = {
          'alex.creator@demo.com': { id: '1', name: 'Alex Chen', userType: 'creator' },
          'sarah.investor@demo.com': { id: '2', name: 'Sarah Johnson', userType: 'investor' },
          'stellar.production@demo.com': { id: '3', name: 'Stellar Studios', userType: 'production' }
        };
        
        const user = demoAccounts[body.email] || {
          id: Date.now().toString(),
          email: body.email,
          name: body.email?.split('@')[0] || 'User',
          userType
        };
        
        return jsonResponse({
          success: true,
          data: {
            token: 'mock-jwt-' + Date.now(),
            user: {
              ...user,
              email: body.email
            }
          }
        }, 200, corsHeaders);
      }
      
      // Logout endpoint
      if ((path === '/api/auth/logout' || 
           path === '/api/auth/creator/logout' ||
           path === '/api/auth/investor/logout' ||
           path === '/api/auth/production/logout') && method === 'POST') {
        return jsonResponse({
          success: true,
          message: 'Logged out successfully'
        }, 200, corsHeaders);
      }
      
      // Register endpoints
      if ((path === '/api/auth/register' ||
           path === '/api/auth/creator/register' ||
           path === '/api/auth/investor/register' ||
           path === '/api/auth/production/register') && method === 'POST') {
        const body = await request.json();
        
        // Determine user type from path
        let userType = 'creator';
        if (path.includes('/investor/')) {
          userType = 'investor';
        } else if (path.includes('/production/')) {
          userType = 'production';
        }
        
        return jsonResponse({
          success: true,
          data: {
            token: 'mock-jwt-' + Date.now(),
            user: {
              id: Date.now().toString(),
              email: body.email,
              name: body.name || body.email?.split('@')[0] || 'User',
              userType
            }
          }
        }, 200, corsHeaders);
      }

      if (path === '/api/auth/session' && method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return jsonResponse({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'No auth token' }
          }, 401, corsHeaders);
        }
        
        return jsonResponse({
          success: true,
          data: {
            user: {
              id: '1',
              email: 'user@example.com',
              name: 'Test User',
              userType: 'creator'
            }
          }
        }, 200, corsHeaders);
      }

      // User profile
      if (path === '/api/users/profile' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            id: '1',
            email: 'user@example.com',
            name: 'Test User',
            userType: 'creator',
            profile: {
              bio: 'Creator profile',
              avatar: null,
              createdAt: new Date().toISOString()
            }
          }
        }, 200, corsHeaders);
      }
      
      // Dashboard endpoints for different user types
      if (path === '/api/dashboard/creator' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              totalPitches: 5,
              activePitches: 3,
              draftPitches: 2,
              totalViews: 1250,
              totalNDAs: 8,
              totalInvestments: 2
            },
            recentActivity: [
              { type: 'view', pitch: 'The Next Blockbuster', timestamp: new Date().toISOString() },
              { type: 'nda_request', pitch: 'Epic Adventure', timestamp: new Date(Date.now() - 3600000).toISOString() }
            ],
            trendingPitches: []
          }
        }, 200, corsHeaders);
      }
      
      if (path === '/api/dashboard/investor' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              savedPitches: 12,
              activeNDAs: 5,
              totalInvestments: 3,
              portfolioValue: 250000
            },
            recentActivity: [
              { type: 'saved', pitch: 'Trending Drama', timestamp: new Date().toISOString() },
              { type: 'nda_approved', pitch: 'The Next Blockbuster', timestamp: new Date(Date.now() - 7200000).toISOString() }
            ],
            savedPitches: []
          }
        }, 200, corsHeaders);
      }
      
      if (path === '/api/dashboard/production' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              activeProjects: 4,
              inProduction: 2,
              inDevelopment: 2,
              totalBudget: 45000000
            },
            recentActivity: [
              { type: 'project_update', project: 'Summer Blockbuster', timestamp: new Date().toISOString() },
              { type: 'script_review', project: 'Holiday Special', timestamp: new Date(Date.now() - 10800000).toISOString() }
            ],
            projects: []
          }
        }, 200, corsHeaders);
      }
      
      // Creator's pitches endpoint
      if (path === '/api/pitches/my' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              title: 'My Amazing Script',
              logline: 'A creators masterpiece in the making',
              genre: 'Drama',
              status: 'draft',
              visibility: 'private',
              created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
              views: 0
            },
            {
              id: '2',
              title: 'The Next Big Thing',
              logline: 'Revolutionary story that will change cinema',
              genre: 'Sci-Fi',
              status: 'published',
              visibility: 'public',
              created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              views: 342
            }
          ]
        }, 200, corsHeaders);
      }

      // Public pitches
      if (path === '/api/pitches/public' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              title: 'The Last Algorithm',
              logline: 'An AI discovers the meaning of life',
              genre: 'Sci-Fi',
              status: 'published',
              visibility: 'public',
              creator_name: 'Alex Chen',
              created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: '2', 
              title: 'Midnight in Montana',
              logline: 'A thriller set in the wilderness',
              genre: 'Thriller',
              status: 'published',
              visibility: 'public',
              creator_name: 'Sarah Johnson',
              created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
          ]
        }, 200, corsHeaders);
      }

      // Trending pitches - FIXED ENDPOINT
      if (path === '/api/pitches/trending' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        return jsonResponse({
          success: true,
          data: [
            {
              id: 1,
              title: "The Next Blockbuster",
              genre: "Action",
              budget_range: "$10M - $50M",
              logline: "A trending action-packed adventure that captivates global audiences",
              creator_name: "John Director",
              creator_email: "john@example.com",
              status: "published",
              visibility: "public",
              views: 1250,
              created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 2,
              title: "Trending Drama",
              genre: "Drama", 
              budget_range: "$5M - $20M",
              logline: "An emotional journey that captivates audiences worldwide",
              creator_name: "Sarah Writer",
              creator_email: "sarah@example.com",
              status: "published",
              visibility: "public",
              views: 980,
              created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 3,
              title: "Epic Adventure",
              genre: "Adventure",
              budget_range: "$15M - $75M",
              logline: "A thrilling quest that redefines modern cinema",
              creator_name: "Mike Adventure",
              creator_email: "mike@example.com",
              status: "published",
              visibility: "public",
              views: 750,
              created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
            }
          ]
        }, 200, corsHeaders);
      }

      // New pitches - FIXED ENDPOINT
      if (path === '/api/pitches/new' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        return jsonResponse({
          success: true,
          data: [
            {
              id: 4,
              title: "Fresh New Comedy",
              genre: "Comedy",
              budget_range: "$2M - $10M",
              logline: "A hilarious take on modern life that will have you laughing",
              creator_name: "Mike Funny",
              creator_email: "mike@example.com",
              status: "published",
              visibility: "public",
              created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 5,
              title: "New Sci-Fi Thriller",
              genre: "Sci-Fi",
              budget_range: "$20M - $100M",
              logline: "The future is closer than we think - and more dangerous",
              creator_name: "Alex Future",
              creator_email: "alex@example.com",
              status: "published",
              visibility: "public",
              created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 6,
              title: "Romantic Mystery",
              genre: "Romance",
              budget_range: "$8M - $25M",
              logline: "Love and mystery intertwine in unexpected ways",
              creator_name: "Emma Romance",
              creator_email: "emma@example.com",
              status: "published",
              visibility: "public",
              created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            }
          ]
        }, 200, corsHeaders);
      }

      // Analytics endpoints
      if (path === '/api/analytics/dashboard' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            totalViews: 1250,
            totalPitches: 12,
            totalInvestments: 3,
            recentActivity: [
              { type: 'view', pitch: 'The Next Blockbuster', timestamp: new Date().toISOString() },
              { type: 'like', pitch: 'Trending Drama', timestamp: new Date(Date.now() - 60000).toISOString() }
            ]
          }
        }, 200, corsHeaders);
      }

      // NDA stats
      if (path === '/api/ndas/stats' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            pending: 2,
            approved: 5,
            rejected: 1,
            total: 8
          }
        }, 200, corsHeaders);
      }

      // Default API response
      return jsonResponse({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${path} not implemented yet`
        }
      }, 404, corsHeaders);
    }

    return new Response('Not Found', { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const handler = new PitcheyAPIHandler(env);
      return await handler.handleRequest(request);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
};