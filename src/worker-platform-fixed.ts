/**
 * Fixed Platform Worker with All Features
 * Addresses all endpoint issues from testing
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

// Demo users with admin
const DEMO_USERS = {
  'alex.creator@demo.com': {
    id: 1,
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    firstName: 'Alex',
    lastName: 'Creator',
    companyName: 'Creative Studios',
    userType: 'creator',
    verified: true,
    isAdmin: false,
  },
  'sarah.investor@demo.com': {
    id: 2,
    email: 'sarah.investor@demo.com',
    password: 'Demo123',
    firstName: 'Sarah',
    lastName: 'Investor',
    companyName: 'Venture Capital Partners',
    userType: 'investor',
    verified: true,
    isAdmin: false,
  },
  'stellar.production@demo.com': {
    id: 3,
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    firstName: 'Stellar',
    lastName: 'Production',
    companyName: 'Major Studios Inc',
    userType: 'production',
    verified: true,
    isAdmin: false,
  },
  'admin@demo.com': {
    id: 99,
    email: 'admin@demo.com',
    password: 'Admin123!',
    firstName: 'System',
    lastName: 'Admin',
    companyName: 'Pitchey Platform',
    userType: 'admin',
    verified: true,
    isAdmin: true,
  },
};

// Demo pitches with more fields
const DEMO_PITCHES = [
  {
    id: 1,
    title: 'Echoes of Tomorrow',
    tagline: 'Some memories are worth forgetting',
    genre: 'Sci-Fi Thriller',
    format: 'Feature Film',
    budget: 15000000,
    status: 'seeking_investment',
    creatorId: 1,
    creatorName: 'Alex Creator',
    thumbnail: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0',
    views: 1234,
    rating: 4.5,
    featured: true,
    synopsis: 'In a world where memories can be extracted and sold, a memory thief discovers a conspiracy that could unravel the fabric of society.',
    targetAudience: 'Adults 18-45',
    comparables: ['Inception', 'The Matrix', 'Total Recall'],
  },
  {
    id: 2,
    title: 'The Last Horizon',
    tagline: 'Where earth meets the unknown',
    genre: 'Adventure',
    format: 'Limited Series',
    budget: 25000000,
    status: 'in_production',
    creatorId: 1,
    creatorName: 'Alex Creator',
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
    views: 856,
    rating: 4.2,
    featured: false,
    synopsis: 'A team of explorers ventures beyond the known world to discover what lies at the edge of reality.',
    targetAudience: 'All ages',
    comparables: ['Lost', 'The 100', 'Terra Nova'],
  },
  {
    id: 3,
    title: 'Midnight in Paris Redux',
    tagline: 'A journey through time and art',
    genre: 'Drama',
    format: 'Feature Film',
    budget: 8000000,
    status: 'seeking_investment',
    creatorId: 1,
    creatorName: 'Alex Creator',
    thumbnail: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a',
    views: 2341,
    rating: 4.8,
    featured: true,
    synopsis: 'An artist finds herself transported to different eras of Parisian history, meeting the masters who shaped art.',
    targetAudience: 'Art enthusiasts, Adults 25+',
    comparables: ['Midnight in Paris', 'The French Dispatch', 'Amélie'],
  },
  {
    id: 4,
    title: 'Quantum Break',
    tagline: 'Time is not on your side',
    genre: 'Sci-Fi',
    format: 'Feature Film',
    budget: 12000000,
    status: 'seeking_investment',
    creatorId: 2,
    creatorName: 'Jane Doe',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
    views: 1567,
    rating: 4.3,
    featured: false,
    synopsis: 'When a time manipulation experiment goes wrong, a scientist must fix the timeline before reality collapses.',
    targetAudience: 'Sci-fi fans, Gamers',
    comparables: ['Tenet', 'Looper', 'Edge of Tomorrow'],
  },
];

// In-memory storage for demo
const PITCH_STORAGE = [...DEMO_PITCHES];
let NEXT_PITCH_ID = 5;

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
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

async function handleLogin(request: Request, env: Env, userType: string): Promise<Response> {
  try {
    const body = await request.json();
    const { email, password } = body;

    const user = DEMO_USERS[email];
    
    if (!user || user.password !== password) {
      return jsonResponse({
        success: false,
        message: 'Invalid credentials',
      }, 401);
    }
    
    // For admin login, check admin flag
    if (userType === 'admin' && !user.isAdmin) {
      return jsonResponse({
        success: false,
        message: 'Invalid admin credentials',
      }, 401);
    }
    
    // For portal-specific login, check userType (unless admin)
    if (userType !== 'admin' && !user.isAdmin && user.userType !== userType) {
      return jsonResponse({
        success: false,
        message: `Invalid ${userType} credentials`,
      }, 401);
    }

    const token = await jwt.sign({
      sub: user.id.toString(),
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      isAdmin: user.isAdmin,
      verified: user.verified,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    }, env.JWT_SECRET);

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
          verified: user.verified,
          isAdmin: user.isAdmin,
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
          version: 'platform-fixed-v1.0',
          services: {
            database: false,
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
      if (path === '/api/auth/admin/login' && method === 'POST') {
        return handleLogin(request, env, 'admin');
      }

      // Password reset request (both endpoints for compatibility)
      if ((path === '/api/auth/request-reset' || path === '/api/auth/forgot-password') && method === 'POST') {
        const body = await request.json();
        const { email } = body;
        
        if (!email) {
          return jsonResponse({
            success: false,
            message: 'Email is required',
          }, 400);
        }
        
        const user = DEMO_USERS[email];
        if (!user) {
          // Don't reveal if email exists
          return jsonResponse({
            success: true,
            message: 'If that email exists, we sent password reset instructions',
            resetToken: null,
          });
        }
        
        const resetToken = generateToken();
        
        // Store in KV if available
        if (env.KV) {
          await env.KV.put(
            `reset:${resetToken}`,
            JSON.stringify({ email, createdAt: Date.now() }),
            { expirationTtl: 3600 }
          );
        }
        
        // In demo mode, return token
        return jsonResponse({
          success: true,
          message: 'Password reset instructions sent',
          resetToken, // Only in demo mode
        });
      }

      // Reset password
      if (path === '/api/auth/reset-password' && method === 'POST') {
        const body = await request.json();
        const { token, newPassword } = body;
        
        if (!token || !newPassword) {
          return jsonResponse({
            success: false,
            message: 'Token and new password are required',
          }, 400);
        }
        
        if (newPassword.length < 8) {
          return jsonResponse({
            success: false,
            message: 'Password must be at least 8 characters',
          }, 400);
        }
        
        // In demo mode, just accept any token
        return jsonResponse({
          success: true,
          message: 'Password has been reset successfully',
        });
      }

      // Email verification request
      if (path === '/api/auth/request-verification' && method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const token = authHeader.substring(7);
        const userPayload = await verifyToken(token, env);
        
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Invalid token',
          }, 401);
        }
        
        const verificationToken = generateToken();
        
        // Store in KV if available
        if (env.KV) {
          await env.KV.put(
            `verify:${verificationToken}`,
            JSON.stringify({ userId: userPayload.sub, email: userPayload.email }),
            { expirationTtl: 86400 } // 24 hours
          );
        }
        
        // In demo mode, return token
        return jsonResponse({
          success: true,
          message: 'Verification email sent',
          verificationToken, // Only in demo mode
        });
      }

      // Verify email
      if (path === '/api/auth/verify-email' && method === 'POST') {
        const body = await request.json();
        const { token } = body;
        
        if (!token) {
          return jsonResponse({
            success: false,
            message: 'Verification token is required',
          }, 400);
        }
        
        // In demo mode, accept any token
        return jsonResponse({
          success: true,
          message: 'Email verified successfully',
        });
      }

      // Public endpoints
      if (path === '/api/pitches/public' || path === '/api/pitches/trending' || path === '/api/pitches/featured') {
        const filteredPitches = path.includes('featured') 
          ? PITCH_STORAGE.filter(p => p.featured)
          : path.includes('trending')
          ? [...PITCH_STORAGE].sort((a, b) => b.views - a.views)
          : PITCH_STORAGE;
          
        return jsonResponse({
          pitches: filteredPitches,
          total: filteredPitches.length,
        });
      }

      // Search endpoint
      if (path === '/api/search') {
        const searchParams = url.searchParams;
        const q = searchParams.get('q')?.toLowerCase();
        const genre = searchParams.get('genre')?.toLowerCase();
        const status = searchParams.get('status');
        const minBudget = parseInt(searchParams.get('minBudget') || '0');
        const maxBudget = parseInt(searchParams.get('maxBudget') || '999999999');
        const sortBy = searchParams.get('sortBy') || 'relevance';
        
        let results = [...PITCH_STORAGE];
        
        // Apply filters
        if (q) {
          results = results.filter(p => 
            p.title.toLowerCase().includes(q) ||
            p.tagline.toLowerCase().includes(q) ||
            p.synopsis.toLowerCase().includes(q) ||
            p.genre.toLowerCase().includes(q)
          );
        }
        
        if (genre) {
          results = results.filter(p => p.genre.toLowerCase().includes(genre));
        }
        
        if (status) {
          results = results.filter(p => p.status === status);
        }
        
        if (minBudget || maxBudget < 999999999) {
          results = results.filter(p => p.budget >= minBudget && p.budget <= maxBudget);
        }
        
        // Sort results
        switch (sortBy) {
          case 'budget':
            results.sort((a, b) => b.budget - a.budget);
            break;
          case 'views':
            results.sort((a, b) => b.views - a.views);
            break;
          case 'rating':
            results.sort((a, b) => b.rating - a.rating);
            break;
          case 'newest':
            results.sort((a, b) => b.id - a.id);
            break;
        }
        
        return jsonResponse({
          success: true,
          results,
          total: results.length,
          filters: {
            query: q,
            genre,
            status,
            budget: { min: minBudget, max: maxBudget },
            sortBy,
          },
        });
      }

      // Browse enhanced
      if (path === '/api/pitches/browse/enhanced') {
        const searchParams = url.searchParams;
        const genre = searchParams.get('genre')?.toLowerCase();
        const status = searchParams.get('status');
        const minBudget = parseInt(searchParams.get('minBudget') || '0');
        const maxBudget = parseInt(searchParams.get('maxBudget') || '999999999');
        const sortBy = searchParams.get('sortBy') || 'newest';
        const order = searchParams.get('order') || 'desc';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '12');
        
        let filteredPitches = [...PITCH_STORAGE];
        
        if (genre) {
          filteredPitches = filteredPitches.filter(p => p.genre.toLowerCase().includes(genre));
        }
        if (status) {
          filteredPitches = filteredPitches.filter(p => p.status === status);
        }
        if (minBudget || maxBudget < 999999999) {
          filteredPitches = filteredPitches.filter(p => p.budget >= minBudget && p.budget <= maxBudget);
        }
        
        // Sort
        switch (sortBy) {
          case 'views':
            filteredPitches.sort((a, b) => order === 'desc' ? b.views - a.views : a.views - b.views);
            break;
          case 'rating':
            filteredPitches.sort((a, b) => order === 'desc' ? b.rating - a.rating : a.rating - b.rating);
            break;
          case 'budget':
            filteredPitches.sort((a, b) => order === 'desc' ? b.budget - a.budget : a.budget - b.budget);
            break;
          default:
            filteredPitches.sort((a, b) => order === 'desc' ? b.id - a.id : a.id - b.id);
        }
        
        // Pagination
        const start = (page - 1) * limit;
        const paginatedPitches = filteredPitches.slice(start, start + limit);
        const totalPages = Math.ceil(filteredPitches.length / limit);
        
        return jsonResponse({
          pitches: paginatedPitches,
          total: filteredPitches.length,
          page,
          limit,
          totalPages,
          genres: ['Sci-Fi', 'Sci-Fi Thriller', 'Adventure', 'Drama', 'Action', 'Comedy', 'Horror'],
          statuses: ['seeking_investment', 'in_production', 'completed'],
        });
      }

      // Single pitch
      const pitchMatch = path.match(/^\/api\/pitches\/(\d+)$/);
      if (pitchMatch && method === 'GET') {
        const pitchId = parseInt(pitchMatch[1]);
        const pitch = PITCH_STORAGE.find(p => p.id === pitchId);
        
        if (pitch) {
          return jsonResponse({
            success: true,
            data: pitch,
          });
        }
        
        return jsonResponse({
          success: false,
          message: 'Pitch not found',
        }, 404);
      }

      // Protected endpoints - verify JWT
      const authHeader = request.headers.get('Authorization');
      let userPayload = null;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        userPayload = await verifyToken(token, env);
      }

      // Create pitch
      if (path === '/api/pitches' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return jsonResponse({
            success: false,
            message: 'Only creators can create pitches',
          }, 403);
        }
        
        const body = await request.json();
        const newPitch = {
          id: NEXT_PITCH_ID++,
          ...body,
          creatorId: parseInt(userPayload.sub),
          creatorName: `${userPayload.firstName} ${userPayload.lastName}`,
          views: 0,
          rating: 0,
          featured: false,
          thumbnail: body.thumbnail || 'https://images.unsplash.com/photo-1478720568477-152d9b164e26',
        };
        
        PITCH_STORAGE.push(newPitch);
        
        return jsonResponse({
          success: true,
          message: 'Pitch created successfully',
          data: newPitch,
        }, 201);
      }

      // Update pitch
      if (pitchMatch && method === 'PUT') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(pitchMatch[1]);
        const pitchIndex = PITCH_STORAGE.findIndex(p => p.id === pitchId);
        
        if (pitchIndex === -1) {
          return jsonResponse({
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        // Check ownership (unless admin)
        if (!userPayload.isAdmin && PITCH_STORAGE[pitchIndex].creatorId !== parseInt(userPayload.sub)) {
          return jsonResponse({
            success: false,
            message: 'You can only edit your own pitches',
          }, 403);
        }
        
        const body = await request.json();
        PITCH_STORAGE[pitchIndex] = {
          ...PITCH_STORAGE[pitchIndex],
          ...body,
        };
        
        return jsonResponse({
          success: true,
          message: 'Pitch updated successfully',
          data: PITCH_STORAGE[pitchIndex],
        });
      }

      // Delete pitch
      if (pitchMatch && method === 'DELETE') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(pitchMatch[1]);
        const pitchIndex = PITCH_STORAGE.findIndex(p => p.id === pitchId);
        
        if (pitchIndex === -1) {
          return jsonResponse({
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        // Check ownership (unless admin)
        if (!userPayload.isAdmin && PITCH_STORAGE[pitchIndex].creatorId !== parseInt(userPayload.sub)) {
          return jsonResponse({
            success: false,
            message: 'You can only delete your own pitches',
          }, 403);
        }
        
        PITCH_STORAGE.splice(pitchIndex, 1);
        
        return jsonResponse({
          success: true,
          message: 'Pitch deleted successfully',
        });
      }

      // Dashboard endpoints
      if (path === '/api/creator/dashboard' && userPayload?.userType === 'creator') {
        const userPitches = PITCH_STORAGE.filter(p => p.creatorId === parseInt(userPayload.sub));
        return jsonResponse({
          success: true,
          data: {
            stats: {
              totalPitches: userPitches.length,
              totalViews: userPitches.reduce((sum, p) => sum + p.views, 0),
              activeInvestors: 12,
              pendingNDAs: 2,
            },
            recentPitches: userPitches.slice(0, 5),
          },
        });
      }

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
            recommendedPitches: PITCH_STORAGE.filter(p => p.status === 'seeking_investment').slice(0, 5),
          },
        });
      }

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
            availablePitches: PITCH_STORAGE,
          },
        });
      }

      // Admin endpoints
      if (path === '/api/admin/stats' && userPayload?.isAdmin) {
        return jsonResponse({
          success: true,
          stats: {
            totalUsers: Object.keys(DEMO_USERS).length,
            totalPitches: PITCH_STORAGE.length,
            totalViews: PITCH_STORAGE.reduce((sum, p) => sum + p.views, 0),
            avgRating: (PITCH_STORAGE.reduce((sum, p) => sum + p.rating, 0) / PITCH_STORAGE.length).toFixed(1),
          },
        });
      }

      if (path === '/api/admin/users' && userPayload?.isAdmin) {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const users = Object.values(DEMO_USERS).map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          userType: u.userType,
          verified: u.verified,
        }));
        
        const start = (page - 1) * limit;
        const paginatedUsers = users.slice(start, start + limit);
        
        return jsonResponse({
          success: true,
          users: paginatedUsers,
          total: users.length,
          page,
          limit,
        });
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