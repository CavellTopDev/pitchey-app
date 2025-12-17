/**
 * Cloudflare Worker with Neon Database Integration
 * Example implementation using raw SQL queries for optimal performance
 */

import { createNeonConnection, DatabaseError } from './db/neon-connection';
import DatabaseQueries, { type SearchOptions } from './db/queries';

// Worker Environment Interface
export interface WorkerEnv {
  DATABASE_URL: string;
  NEON_DATABASE_URL?: string;
  JWT_SECRET: string;
  CORS_ORIGINS?: string;
  CACHE_TTL?: string;
}

// CORS Configuration
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// Response Helper Functions
function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...headers,
    },
  });
}

function errorResponse(message: string, status: number = 500, error?: any): Response {
  const errorData = {
    error: message,
    timestamp: new Date().toISOString(),
    details: error?.message || undefined,
  };
  
  console.error('API Error:', errorData);
  return jsonResponse(errorData, status);
}

function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// JWT Helper Functions
async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    // Simple JWT verification - in production use a proper library
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) {
      throw new Error('Invalid token format');
    }

    const decodedPayload = JSON.parse(atob(payload));
    
    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    return decodedPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

async function extractUserFromRequest(request: Request, env: WorkerEnv): Promise<any | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    return await verifyJWT(token, env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Enhanced Browse Endpoint Implementation
async function handleEnhancedBrowse(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Parse query parameters
    const search = searchParams.get('search') || '';
    const genre = searchParams.get('genre') || undefined;
    const budgetRange = searchParams.get('budgetRange') || undefined;
    const targetAudience = searchParams.get('targetAudience') || undefined;
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'DESC';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const tab = searchParams.get('tab') || 'trending';
    const themes = searchParams.get('themes')?.split(',').filter(Boolean) || undefined;

    // Calculate offset
    const offset = (page - 1) * limit;

    // Initialize database connection
    const db = createNeonConnection(env);
    const queries = new DatabaseQueries(db);

    let pitches: any[] = [];
    let total = 0;

    // Handle different tab types
    switch (tab) {
      case 'trending':
        pitches = await queries.getTrendingPitches(limit);
        total = await queries.countPublicPitches();
        break;

      case 'new':
        pitches = await queries.getPublicPitches({
          limit,
          offset,
          orderBy: 'created_at',
          orderDirection: 'DESC' as const,
        });
        total = await queries.countPublicPitches();
        break;

      case 'featured':
        pitches = await queries.getFeaturedPitches(limit);
        total = pitches.length;
        break;

      case 'search':
      default:
        if (search || genre || budgetRange || targetAudience || themes) {
          const searchOptions: SearchOptions = {
            limit,
            offset,
            genre,
            budgetRange,
            themes,
            targetAudience,
            orderBy: sortBy,
            orderDirection: sortOrder as 'ASC' | 'DESC',
          };

          pitches = await queries.searchPitches(search, searchOptions);
          
          // Get total count for pagination
          total = await db.queryFirst<{ count: number }>(`
            SELECT COUNT(*) as count FROM pitches p
            WHERE p.status = 'public'
              ${search ? `AND (
                p.title ILIKE '%${search}%' OR 
                p.logline ILIKE '%${search}%' OR 
                p.synopsis ILIKE '%${search}%' OR
                p.genre ILIKE '%${search}%' OR
                p.themes ILIKE '%${search}%'
              )` : ''}
              ${genre ? `AND p.genre = '${genre}'` : ''}
              ${budgetRange ? `AND p.budget_range = '${budgetRange}'` : ''}
              ${targetAudience ? `AND p.target_audience = '${targetAudience}'` : ''}
          `).then(result => result?.count || 0);
        } else {
          pitches = await queries.getPublicPitches({
            limit,
            offset,
            orderBy: sortBy,
            orderDirection: sortOrder as 'ASC' | 'DESC',
          });
          total = await queries.countPublicPitches();
        }
        break;
    }

    // Get current user to check liked status
    const user = await extractUserFromRequest(request, env);
    
    // Add user-specific data (liked status, view status)
    if (user) {
      for (const pitch of pitches) {
        pitch.isLikedByUser = await queries.isPitchLikedByUser(pitch.id, user.userId);
      }
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Get platform statistics
    const stats = await queries.getPitchStats();

    const response = {
      success: true,
      data: {
        pitches,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
        filters: {
          search,
          genre,
          budgetRange,
          targetAudience,
          themes,
          sortBy,
          sortOrder,
          tab,
        },
        stats: {
          totalPitches: stats.totalPitches,
          publicPitches: stats.publicPitches,
          featuredPitches: stats.featuredPitches,
          totalViews: stats.totalViews,
          totalLikes: stats.totalLikes,
        },
      },
      timestamp: new Date().toISOString(),
    };

    // Add cache headers for performance
    const cacheHeaders = {
      'Cache-Control': `public, max-age=${env.CACHE_TTL || '300'}`,
      'ETag': `"${JSON.stringify(response).length}-${Date.now()}"`,
    };

    return jsonResponse(response, 200, cacheHeaders);

  } catch (error) {
    console.error('Enhanced browse error:', error);
    
    if (error instanceof DatabaseError) {
      return errorResponse('Database operation failed', 500, error);
    }
    
    return errorResponse('Internal server error', 500, error);
  }
}

// Health Check Endpoint
async function handleHealthCheck(env: WorkerEnv): Promise<Response> {
  try {
    const db = createNeonConnection(env);
    const health = await db.healthCheck();
    
    return jsonResponse({
      status: 'healthy',
      timestamp: health.timestamp,
      database: 'connected',
      version: '1.0.0',
    });
  } catch (error) {
    return errorResponse('Health check failed', 503, error);
  }
}

// Pitch Detail Endpoint
async function handlePitchDetail(request: Request, env: WorkerEnv, pitchId: string): Promise<Response> {
  try {
    const db = createNeonConnection(env);
    const queries = new DatabaseQueries(db);
    
    const pitch = await queries.getPitchById(pitchId);
    
    if (!pitch) {
      return errorResponse('Pitch not found', 404);
    }

    // Get current user
    const user = await extractUserFromRequest(request, env);
    
    // Record view if user is authenticated and not the creator
    if (user && user.userId !== pitch.creator_id) {
      await queries.recordPitchView(pitchId, user.userId);
    }

    // Add user-specific data
    if (user) {
      pitch.isLikedByUser = await queries.isPitchLikedByUser(pitchId, user.userId);
    }

    return jsonResponse({
      success: true,
      data: { pitch },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Pitch detail error:', error);
    return errorResponse('Failed to fetch pitch details', 500, error);
  }
}

// Like/Unlike Endpoint
async function handleToggleLike(request: Request, env: WorkerEnv, pitchId: string): Promise<Response> {
  try {
    // Authentication required
    const user = await extractUserFromRequest(request, env);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const db = createNeonConnection(env);
    const queries = new DatabaseQueries(db);
    
    // Check if pitch exists
    const pitch = await queries.getPitchById(pitchId);
    if (!pitch) {
      return errorResponse('Pitch not found', 404);
    }

    // Toggle like
    const result = await queries.togglePitchLike(pitchId, user.userId);

    return jsonResponse({
      success: true,
      data: {
        pitchId,
        liked: result.liked,
        likeCount: result.likeCount,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Toggle like error:', error);
    return errorResponse('Failed to toggle like', 500, error);
  }
}

// Main Worker Handler
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleCORS();
    }

    try {
      // Route handling
      if (pathname === '/api/health') {
        return await handleHealthCheck(env);
      }

      if (pathname === '/api/pitches/browse/enhanced') {
        if (method !== 'GET') {
          return errorResponse('Method not allowed', 405);
        }
        return await handleEnhancedBrowse(request, env);
      }

      // Pitch detail endpoint
      const pitchDetailMatch = pathname.match(/^\/api\/pitches\/([a-zA-Z0-9-]+)$/);
      if (pitchDetailMatch) {
        const pitchId = pitchDetailMatch[1];
        if (method === 'GET') {
          return await handlePitchDetail(request, env, pitchId);
        }
        return errorResponse('Method not allowed', 405);
      }

      // Like/unlike endpoint
      const toggleLikeMatch = pathname.match(/^\/api\/pitches\/([a-zA-Z0-9-]+)\/toggle-like$/);
      if (toggleLikeMatch) {
        const pitchId = toggleLikeMatch[1];
        if (method === 'POST') {
          return await handleToggleLike(request, env, pitchId);
        }
        return errorResponse('Method not allowed', 405);
      }

      // Default 404
      return errorResponse('Endpoint not found', 404);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal server error', 500, error);
    }
  },
};

// Export types for external use
export type { WorkerEnv };
export { createNeonConnection, DatabaseQueries, DatabaseError };