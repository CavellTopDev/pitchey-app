/**
 * Standalone Auth Worker with Demo Users
 * Lightweight implementation for Cloudflare Workers
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

export interface Env {
  JWT_SECRET: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  WEBSOCKET_ROOMS?: DurableObjectNamespace;
  NOTIFICATION_ROOMS?: DurableObjectNamespace;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Demo users (in production, these would be in a database)
const DEMO_USERS = {
  'alex.creator@demo.com': {
    id: 1,
    email: 'alex.creator@demo.com',
    password: 'Demo123', // In production, this would be hashed
    firstName: 'Alex',
    lastName: 'Creator',
    companyName: 'Creative Studios',
    userType: 'creator',
  },
  'sarah.investor@demo.com': {
    id: 2,
    email: 'sarah.investor@demo.com',
    password: 'Demo123',
    firstName: 'Sarah',
    lastName: 'Investor',
    companyName: 'Venture Capital Partners',
    userType: 'investor',
  },
  'stellar.production@demo.com': {
    id: 3,
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    firstName: 'Stellar',
    lastName: 'Production',
    companyName: 'Major Studios Inc',
    userType: 'production',
  },
};

// Demo pitches
const DEMO_PITCHES = [
  {
    id: 1,
    title: 'Echoes of Tomorrow',
    tagline: 'Some memories are worth forgetting',
    genre: 'Sci-Fi Thriller',
    budget: 15000000,
    status: 'seeking_investment',
    creatorId: 1,
    thumbnail: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0',
    views: 1234,
    rating: 4.5,
  },
  {
    id: 2,
    title: 'The Last Horizon',
    tagline: 'Where earth meets the unknown',
    genre: 'Adventure',
    budget: 25000000,
    status: 'in_production',
    creatorId: 1,
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
    views: 856,
    rating: 4.2,
  },
  {
    id: 3,
    title: 'Midnight in Paris Redux',
    tagline: 'A journey through time and art',
    genre: 'Drama',
    budget: 8000000,
    status: 'seeking_investment',
    creatorId: 1,
    thumbnail: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a',
    views: 2341,
    rating: 4.8,
  },
];

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleLogin(request: Request, env: Env, userType: string): Promise<Response> {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Find user in demo users
    const user = DEMO_USERS[email];
    
    if (!user || user.password !== password || user.userType !== userType) {
      return jsonResponse({
        success: false,
        message: 'Invalid credentials',
      }, 401);
    }

    // Create JWT token
    const token = await jwt.sign({
      sub: user.id.toString(),
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    }, env.JWT_SECRET);

    // Store session in KV if available
    if (env.KV) {
      await env.KV.put(
        `session:${user.id}`,
        JSON.stringify({
          userId: user.id,
          userType: user.userType,
          email: user.email,
          loginTime: new Date().toISOString(),
        }),
        { expirationTtl: 604800 } // 7 days
      );
    }

    return jsonResponse({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          userType: user.userType,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({
      success: false,
      message: 'Login failed',
    }, 500);
  }
}

async function verifyToken(token: string, env: Env): Promise<any | null> {
  try {
    const isValid = await jwt.verify(token, env.JWT_SECRET);
    if (!isValid) return null;
    
    const { payload } = jwt.decode(token);
    return payload;
  } catch (error) {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/api/health') {
        return jsonResponse({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: 'standalone-auth-v1.0',
          services: {
            database: false, // Using demo data
            auth: true,
            cache: !!env.KV,
            websocket: !!env.WEBSOCKET_ROOMS,
          },
        });
      }

      // Service overviews
      const serviceMatch = path.match(/^\/api\/(ml|data-science|security|distributed|edge|automation)\/overview$/);
      if (serviceMatch) {
        return jsonResponse({
          service: `${serviceMatch[1]} Service`,
          status: 'operational',
          capabilities: ['Available'],
        });
      }

      // Authentication endpoints
      if (path === '/api/auth/creator/login' && method === 'POST') {
        return handleLogin(request, env, 'creator');
      }
      if (path === '/api/auth/investor/login' && method === 'POST') {
        return handleLogin(request, env, 'investor');
      }
      if (path === '/api/auth/production/login' && method === 'POST') {
        return handleLogin(request, env, 'production');
      }

      // Registration (demo mode - just return error)
      if (path.startsWith('/api/auth/') && path.includes('/register')) {
        return jsonResponse({
          success: false,
          message: 'Registration disabled in demo mode. Use demo accounts.',
        }, 403);
      }

      // Public pitch endpoints
      if (path === '/api/pitches/public' || path === '/api/pitches/trending' || path === '/api/pitches/featured') {
        return jsonResponse({
          pitches: DEMO_PITCHES,
          total: DEMO_PITCHES.length,
        });
      }

      // Browse enhanced endpoint
      if (path === '/api/pitches/browse/enhanced') {
        const searchParams = url.searchParams;
        const genre = searchParams.get('genre');
        const status = searchParams.get('status');
        
        let filteredPitches = [...DEMO_PITCHES];
        
        if (genre) {
          filteredPitches = filteredPitches.filter(p => p.genre.toLowerCase().includes(genre.toLowerCase()));
        }
        if (status) {
          filteredPitches = filteredPitches.filter(p => p.status === status);
        }
        
        return jsonResponse({
          pitches: filteredPitches,
          total: filteredPitches.length,
          genres: ['Sci-Fi Thriller', 'Adventure', 'Drama', 'Action', 'Comedy'],
          statuses: ['seeking_investment', 'in_production', 'completed'],
        });
      }

      // Single pitch endpoint
      const pitchMatch = path.match(/^\/api\/pitches\/(\d+)$/);
      if (pitchMatch && method === 'GET') {
        const pitchId = parseInt(pitchMatch[1]);
        const pitch = DEMO_PITCHES.find(p => p.id === pitchId);
        
        if (pitch) {
          return jsonResponse({
            success: true,
            data: {
              ...pitch,
              synopsis: 'A compelling story that captures the imagination...',
              targetAudience: 'Adults 18-45',
              comparables: ['Inception', 'The Matrix', 'Blade Runner'],
            },
          });
        }
        
        return jsonResponse({
          success: false,
          message: 'Pitch not found',
        }, 404);
      }

      // Protected endpoints - check JWT
      const authHeader = request.headers.get('Authorization');
      let userPayload = null;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        userPayload = await verifyToken(token, env);
        
        if (!userPayload && path.startsWith('/api/creator/')) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
      }

      // Creator dashboard
      if (path === '/api/creator/dashboard' && userPayload?.userType === 'creator') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              totalPitches: 3,
              totalViews: 4431,
              activeInvestors: 12,
              pendingNDAs: 2,
            },
            recentPitches: DEMO_PITCHES.filter(p => p.creatorId === userPayload.sub),
          },
        });
      }

      // Investor dashboard
      if (path === '/api/investor/dashboard' && userPayload?.userType === 'investor') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              portfolioValue: 5000000,
              activeInvestments: 3,
              savedPitches: 8,
              signedNDAs: 5,
            },
            recommendedPitches: DEMO_PITCHES.filter(p => p.status === 'seeking_investment'),
          },
        });
      }

      // Production dashboard
      if (path === '/api/production/dashboard' && userPayload?.userType === 'production') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              activeProjects: 2,
              inDevelopment: 4,
              completed: 10,
              totalBudget: 150000000,
            },
            availablePitches: DEMO_PITCHES,
          },
        });
      }

      // Missing endpoints - return helpful message
      if (path.startsWith('/api/search')) {
        return jsonResponse({
          success: false,
          message: 'Search functionality not yet implemented',
          suggestion: 'Use /api/pitches/browse/enhanced with query parameters',
        }, 501);
      }

      if (path.startsWith('/api/admin')) {
        return jsonResponse({
          success: false,
          message: 'Admin panel not yet implemented',
        }, 501);
      }

      // 404 for unknown endpoints
      return jsonResponse({
        success: false,
        message: `Endpoint ${path} not found`,
      }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        success: false,
        message: 'Internal server error',
        error: error.message,
      }, 500);
    }
  },
};

// Export Durable Objects
export { WebSocketRoom } from './websocket-room-optimized.ts';
export { NotificationRoom } from './notification-room.ts';