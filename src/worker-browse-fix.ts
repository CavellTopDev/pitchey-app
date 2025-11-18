/**
 * Quick Fix for Browse Endpoints - Cloudflare Worker
 * Extends existing worker with missing browse endpoints that frontend needs
 */

import { Toucan } from 'toucan-js';
import { AuthEndpointsHandler } from './worker-modules/auth-endpoints';
import { UserEndpointsHandler } from './worker-modules/user-endpoints';
import { AnalyticsEndpointsHandler } from './worker-modules/analytics-endpoints';
import { NDAEndpointsHandler } from './worker-modules/nda-endpoints';
import { SearchEndpointsHandler } from './worker-modules/search-endpoints';
import { InvestmentEndpointsHandler } from './worker-modules/investment-endpoints';
import { MessagingEndpointsHandler } from './worker-modules/messaging-endpoints';
import { UploadEndpointsHandler } from './worker-modules/upload-endpoints';
import { AdminEndpointsHandler } from './worker-modules/admin-endpoints';
import { dbPool, withDatabase } from './worker-database-pool';

// DEPRECATED FUNCTION REMOVED - Use dbPool.getConnection() instead
// This function was causing "Cannot perform I/O on behalf of a different request" errors
// because it created postgres.js connections instead of using the neon-based pool


export interface Env {
  // Storage  
  R2_BUCKET: R2Bucket;
  CACHE: KVNamespace;
  
  // Database
  HYPERDRIVE: Hyperdrive;
  DATABASE_URL?: string;
  
  // Auth
  JWT_SECRET: string;
  
  // Config
  FRONTEND_URL: string;
  
  // Monitoring
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Demo pitch data for browse endpoints
function generateBrowsePitches(browseType?: string, genre?: string, status?: string): any[] {
  const basePitches = [
    {
      id: 1,
      title: 'Cyberpunk Noir Detective Story',
      description: 'A futuristic detective thriller set in neo-Tokyo with cutting-edge visuals and compelling characters.',
      genre: 'Thriller',
      budget_range: '$1M-$5M',
      status: 'seeking_funding',
      creator_id: 1,
      creator_name: 'Alex Creator',
      creator_avatar: '/api/uploads/demo/alex-avatar.jpg',
      view_count: 2847,
      like_count: 284,
      comment_count: 47,
      created_at: '2024-11-01T10:00:00Z',
      updated_at: '2024-11-01T15:30:00Z',
      thumbnail: '/api/uploads/demo/cyberpunk-thumb.jpg',
      featured: true,
      trending: true,
      tags: ['cyberpunk', 'noir', 'detective', 'sci-fi', 'thriller']
    },
    {
      id: 2,
      title: 'Romantic Comedy in Paris',
      description: 'A heartwarming romantic comedy set against the backdrop of modern Paris with charming characters.',
      genre: 'Romance',
      budget_range: '$500K-$1M',
      status: 'in_development',
      creator_id: 4,
      creator_name: 'Marie Dubois',
      creator_avatar: '/api/uploads/demo/marie-avatar.jpg',
      view_count: 1923,
      like_count: 156,
      comment_count: 32,
      created_at: '2024-10-15T14:30:00Z',
      updated_at: '2024-10-20T09:15:00Z',
      thumbnail: '/api/uploads/demo/paris-thumb.jpg',
      featured: false,
      trending: false,
      tags: ['romance', 'comedy', 'paris', 'love', 'heartwarming']
    },
    {
      id: 3,
      title: 'Space Opera Epic: Starbound',
      description: 'An ambitious space opera following a crew of rebels fighting against an intergalactic empire.',
      genre: 'Sci-Fi',
      budget_range: '$5M-$10M',
      status: 'seeking_funding',
      creator_id: 5,
      creator_name: 'Luna Starr',
      creator_avatar: '/api/uploads/demo/luna-avatar.jpg',
      view_count: 3156,
      like_count: 412,
      comment_count: 68,
      created_at: '2024-10-28T16:45:00Z',
      updated_at: '2024-11-02T11:20:00Z',
      thumbnail: '/api/uploads/demo/starbound-thumb.jpg',
      featured: true,
      trending: true,
      tags: ['space', 'opera', 'epic', 'rebels', 'empire', 'sci-fi']
    },
    {
      id: 4,
      title: 'The Underground',
      description: 'A gritty urban drama about street artists fighting gentrification in Brooklyn.',
      genre: 'Drama',
      budget_range: '$500K-$1M',
      status: 'pre_production',
      creator_id: 6,
      creator_name: 'Marcus Chen',
      creator_avatar: '/api/uploads/demo/marcus-avatar.jpg',
      view_count: 1478,
      like_count: 189,
      comment_count: 43,
      created_at: '2024-10-05T12:30:00Z',
      updated_at: '2024-10-25T14:45:00Z',
      thumbnail: '/api/uploads/demo/underground-thumb.jpg',
      featured: false,
      trending: false,
      tags: ['urban', 'drama', 'street-art', 'brooklyn', 'gentrification']
    },
    {
      id: 5,
      title: 'Horror in the Hills',
      description: 'A supernatural horror film set in the remote Appalachian mountains where ancient evils awaken.',
      genre: 'Horror',
      budget_range: '$1M-$5M',
      status: 'seeking_funding',
      creator_id: 7,
      creator_name: 'Sarah Mitchell',
      creator_avatar: '/api/uploads/demo/sarah-mitchell-avatar.jpg',
      view_count: 2234,
      like_count: 298,
      comment_count: 56,
      created_at: '2024-09-20T08:15:00Z',
      updated_at: '2024-10-30T16:30:00Z',
      thumbnail: '/api/uploads/demo/horror-hills-thumb.jpg',
      featured: false,
      trending: true,
      tags: ['horror', 'supernatural', 'appalachian', 'mountains', 'ancient-evil']
    },
    {
      id: 6,
      title: 'Action Hero Legacy',
      description: 'A high-octane action film about a retired special forces operative pulled back for one last mission.',
      genre: 'Action',
      budget_range: '$10M+',
      status: 'seeking_funding',
      creator_id: 8,
      creator_name: 'Jake Morrison',
      creator_avatar: '/api/uploads/demo/jake-avatar.jpg',
      view_count: 4567,
      like_count: 623,
      comment_count: 89,
      created_at: '2024-11-03T14:20:00Z',
      updated_at: '2024-11-03T14:20:00Z',
      thumbnail: '/api/uploads/demo/action-hero-thumb.jpg',
      featured: true,
      trending: true,
      tags: ['action', 'special-forces', 'mission', 'high-octane', 'legacy']
    }
  ];

  let filteredPitches = basePitches;

  // Apply browse type filtering
  if (browseType === 'enhanced') {
    // Show featured and trending content
    filteredPitches = basePitches.filter(p => p.featured || p.trending);
  } else if (browseType === 'general') {
    // Show all content
    filteredPitches = basePitches;
  } else if (browseType === 'trending') {
    filteredPitches = basePitches.filter(p => p.trending);
  } else if (browseType === 'featured') {
    filteredPitches = basePitches.filter(p => p.featured);
  }

  // Apply genre filter
  if (genre) {
    filteredPitches = filteredPitches.filter(p => 
      p.genre.toLowerCase() === genre.toLowerCase()
    );
  }

  // Apply status filter
  if (status) {
    filteredPitches = filteredPitches.filter(p => p.status === status);
  }

  return filteredPitches;
}

// Handle authentication endpoints
async function handleAuthEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Use the full auth module for all auth endpoints
    try {
      // Initialize database connection using pool
      let db = null;
      if (env.HYPERDRIVE) {
        db = dbPool.getConnection(env);
      }
      
      const authHandler = new AuthEndpointsHandler(db, sentry, env);
      const response = await authHandler.handleAuthEndpoints(request, path, corsHeaders);
      
      if (response) {
        sentry.captureMessage('Auth endpoint handled successfully', 'info', { path, method: request.method });
        return response;
      }
      
      // If auth handler returns null, continue to 404
      sentry.captureMessage('Auth endpoint not found in handler', 'info', { path });
      
    } catch (authError) {
      sentry.captureException(authError as Error, { context: 'auth_handler_error', path, method: request.method });
      
      // Return specific error response for debugging
      return new Response(JSON.stringify({ 
        success: false, 
        error: { 
          message: 'Authentication handler error', 
          code: 'AUTH_HANDLER_ERROR',
          details: (authError as Error).message,
          path: path 
        } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Simple debug endpoint for token validation
    if (path === '/api/debug-token' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No Authorization header'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const token = authHeader.substring(7);
      const parts = token.split('.');
      
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return new Response(JSON.stringify({
          success: true,
          debug: {
            tokenParts: parts.length,
            payload: payload,
            currentTime: Math.floor(Date.now() / 1000),
            expired: payload.exp < Math.floor(Date.now() / 1000)
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (decodeError) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Token decode failed',
          details: (decodeError as Error).message
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // If no handler found, return 404
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Auth endpoint not found', code: 'NOT_FOUND', path: path } 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'auth', path: request.url });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Auth service error', code: 'AUTH_ERROR', details: (error as Error).message } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle pitches endpoints
async function handlePitchesEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Expected: /api/pitches/{type}
    const pitchType = pathSegments[2]; // 'browse', 'new', 'trending', 'public', etc.
    
    if (pitchType === 'browse') {
      return await handleBrowseEndpoint(request, sentry);
    }
    
    if (pitchType === 'new') {
      return await handleNewPitchesEndpoint(request, sentry, env);
    }
    
    if (pitchType === 'trending') {
      return await handleTrendingPitchesEndpoint(request, sentry, env);
    }
    
    if (pitchType === 'public' || pathSegments.length === 2) {
      return await handlePublicPitchesEndpoint(request, sentry, env);
    }
    
    if (pitchType === 'following') {
      return await handleFollowingPitchesEndpoint(request, sentry, env);
    }
    
    // If it's a specific pitch ID, handle individual pitch
    if (pathSegments.length === 3 && !isNaN(Number(pitchType))) {
      return await handleIndividualPitch(request, sentry, env, Number(pitchType));
    }
    
    // Fallback to proxy
    throw new Error('Unhandled pitches endpoint');
    
  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'pitches' });
    throw error;
  }
}

// Handle browse endpoints
async function handleBrowseEndpoint(request: Request, sentry: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Expected: /api/pitches/browse/{type}
    const browseType = pathSegments[3]; // 'enhanced', 'general', etc.
    
    // Parse query parameters
    const sort = url.searchParams.get('sort') || 'date';
    const order = url.searchParams.get('order') || 'desc';
    const limit = parseInt(url.searchParams.get('limit') || '24');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const genre = url.searchParams.get('genre');
    const status = url.searchParams.get('status');

    // Generate demo pitches based on browse type
    let pitches = generateBrowsePitches(browseType, genre, status);

    // Apply sorting
    if (sort === 'date') {
      pitches.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return order === 'desc' ? dateB - dateA : dateA - dateB;
      });
    } else if (sort === 'popularity') {
      pitches.sort((a, b) => {
        return order === 'desc' ? b.view_count - a.view_count : a.view_count - b.view_count;
      });
    } else if (sort === 'likes') {
      pitches.sort((a, b) => {
        return order === 'desc' ? b.like_count - a.like_count : a.like_count - b.like_count;
      });
    }

    // Apply pagination
    const total = pitches.length;
    const paginatedPitches = pitches.slice(offset, offset + limit);

    sentry.captureMessage('Browse endpoint accessed', 'info', {
      browseType,
      total,
      offset,
      limit,
      genre,
      status,
      sort,
      order
    });

    return new Response(JSON.stringify({
      success: true,
      pitches: paginatedPitches,
      pagination: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        offset,
        has_next: offset + limit < total,
        has_prev: offset > 0
      },
      filters: {
        sort,
        order,
        genre,
        status,
        browse_type: browseType
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'browse' });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Browse service error', code: 'BROWSE_ERROR' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle new pitches endpoint
async function handleNewPitchesEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '4');
    
    // Try database first, fallback to demo data
    let pitches = [];
    
    if (env.HYPERDRIVE) {
      try {
        const result = await withDatabase(env, async (sql) => {
          return await sql`
            SELECT id, title, description, genre, budget_range, status, 
                   creator_id, view_count, like_count, created_at, updated_at, thumbnail
            FROM pitches 
            WHERE status = 'published'
            ORDER BY created_at DESC 
            LIMIT ${limit}
          `;
        }, sentry);
        
        if (result.length > 0) {
          pitches = result.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            genre: row.genre || 'Drama',
            budget_range: row.budget_range || 'TBD',
            status: row.status,
            creator_id: row.creator_id,
            creator_name: `Creator ${row.creator_id}`,
            view_count: row.view_count || 0,
            like_count: row.like_count || 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
            thumbnail: row.thumbnail || '/api/uploads/demo/default-thumb.jpg'
          }));
        }
      } catch (dbError) {
        sentry.captureException(dbError as Error, { context: 'new_pitches_db' });
      }
    }
    
    // Fallback to demo data if no database results
    if (pitches.length === 0) {
      const allPitches = generateBrowsePitches();
      pitches = allPitches
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    }

    sentry.captureMessage('New pitches endpoint accessed', 'info', { count: pitches.length, limit });

    return new Response(JSON.stringify({
      success: true,
      pitches
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'new_pitches' });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'New pitches service error', code: 'NEW_PITCHES_ERROR' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle trending pitches endpoint  
async function handleTrendingPitchesEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '4');
    
    // Try database first, fallback to demo data
    let pitches = [];
    
    if (env.HYPERDRIVE) {
      try {
        const result = await withDatabase(env, async (sql) => {
          return await sql`
            SELECT id, title, description, genre, budget_range, status, 
                   creator_id, view_count, like_count, created_at, updated_at, thumbnail
            FROM pitches 
            WHERE status = 'published' AND view_count > 100
            ORDER BY (view_count + like_count * 5) DESC, created_at DESC
            LIMIT ${limit}
          `;
        }, sentry);
        
        if (result.length > 0) {
          pitches = result.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            genre: row.genre || 'Drama',
            budget_range: row.budget_range || 'TBD',
            status: row.status,
            creator_id: row.creator_id,
            creator_name: `Creator ${row.creator_id}`,
            view_count: row.view_count || 0,
            like_count: row.like_count || 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
            thumbnail: row.thumbnail || '/api/uploads/demo/default-thumb.jpg',
            trending: true
          }));
        }
      } catch (dbError) {
        sentry.captureException(dbError as Error, { context: 'trending_pitches_db' });
      }
    }
    
    // Fallback to demo data if no database results
    if (pitches.length === 0) {
      pitches = generateBrowsePitches('trending').slice(0, limit);
    }

    sentry.captureMessage('Trending pitches endpoint accessed', 'info', { count: pitches.length, limit });

    return new Response(JSON.stringify({
      success: true,
      pitches
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'trending_pitches' });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Trending pitches service error', code: 'TRENDING_PITCHES_ERROR' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle public pitches endpoint
async function handlePublicPitchesEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const genre = url.searchParams.get('genre');
    const status = url.searchParams.get('status');
    
    // Try database first, fallback to demo data
    let pitches = [];
    let total = 0;
    
    if (env.HYPERDRIVE) {
      try {
        const [result, countResult] = await withDatabase(env, async (sql) => {
          // Build dynamic query based on filters
          let baseQuery = `
            SELECT id, title, description, genre, budget_range, status, 
                   creator_id, view_count, like_count, created_at, updated_at, thumbnail
            FROM pitches 
            WHERE status = 'published'
          `;
          
          let countQuery = `SELECT COUNT(*) as count FROM pitches WHERE status = 'published'`;
          let queryParams: any[] = [];
          let paramIndex = 1;
          
          if (genre) {
            baseQuery += ` AND genre = $${paramIndex}`;
            countQuery += ` AND genre = $${paramIndex}`;
            queryParams.push(genre);
            paramIndex++;
          }
          
          if (status) {
            baseQuery += ` AND status = $${paramIndex}`;
            countQuery += ` AND status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
          }
          
          baseQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
          queryParams.push(limit, offset);
          
          return await Promise.all([
            sql(baseQuery, queryParams),
            sql(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
          ]);
        }, sentry);
        
        if (result.length > 0) {
          pitches = result.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            genre: row.genre || 'Drama',
            budget_range: row.budget_range || 'TBD',
            status: row.status,
            creator_id: row.creator_id,
            creator_name: `Creator ${row.creator_id}`,
            view_count: row.view_count || 0,
            like_count: row.like_count || 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
            thumbnail: row.thumbnail || '/api/uploads/demo/default-thumb.jpg'
          }));
          total = countResult[0]?.count || 0;
        }
      } catch (dbError) {
        sentry.captureException(dbError as Error, { context: 'public_pitches_db' });
      }
    }
    
    // Fallback to demo data if no database results
    if (pitches.length === 0) {
      const allPitches = generateBrowsePitches('general', genre, status);
      total = allPitches.length;
      pitches = allPitches.slice(offset, offset + limit);
    }

    sentry.captureMessage('Public pitches endpoint accessed', 'info', { 
      count: pitches.length, 
      total, 
      limit, 
      offset, 
      genre, 
      status 
    });

    return new Response(JSON.stringify({
      success: true,
      pitches,
      pagination: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        offset,
        has_next: offset + limit < total,
        has_prev: offset > 0
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'public_pitches' });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Public pitches service error', code: 'PUBLIC_PITCHES_ERROR' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle individual pitch endpoint
async function handleIndividualPitch(request: Request, sentry: any, env: Env, pitchId: number): Promise<Response> {
  try {
    // Try database first, fallback to demo data
    let pitch = null;
    
    if (env.HYPERDRIVE) {
      try {
        const result = await withDatabase(env, async (sql) => {
          return await sql`
            SELECT id, title, description, genre, budget_range, status, 
                   creator_id, view_count, like_count, created_at, updated_at, 
                   thumbnail, full_description, tags, target_audience, 
                   production_timeline, funding_goal, current_funding
            FROM pitches 
            WHERE id = ${pitchId} AND status = 'published'
          `;
        }, sentry);
        
        if (result.length > 0) {
          const row = result[0];
          pitch = {
            id: row.id,
            title: row.title,
            description: row.description,
            genre: row.genre || 'Drama',
            budget_range: row.budget_range || 'TBD',
            status: row.status,
            creator_id: row.creator_id,
            creator_name: `Creator ${row.creator_id}`,
            view_count: row.view_count || 0,
            like_count: row.like_count || 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
            thumbnail: row.thumbnail || '/api/uploads/demo/default-thumb.jpg',
            full_description: row.full_description || row.description,
            tags: row.tags || [],
            target_audience: row.target_audience || 'General Audience',
            production_timeline: row.production_timeline || '12-18 months',
            funding_goal: row.funding_goal || 1000000,
            current_funding: row.current_funding || 0,
            media: [
              { type: 'image', url: row.thumbnail || '/api/uploads/demo/default-thumb.jpg' }
            ]
          };
        }
      } catch (dbError) {
        sentry.captureException(dbError as Error, { context: 'individual_pitch_db', pitchId });
      }
    }
    
    // Fallback to demo data if no database result
    if (!pitch) {
      const demoPitches = generateBrowsePitches();
      const demoPitch = demoPitches.find(p => p.id === pitchId);
      
      if (demoPitch) {
        pitch = {
          ...demoPitch,
          full_description: `${demoPitch.description} This is an expanded description with more details about the plot, characters, and production vision.`,
          target_audience: 'Adults 18-45',
          production_timeline: '18 months',
          funding_goal: 2500000,
          current_funding: 450000,
          media: [
            { type: 'image', url: demoPitch.thumbnail },
            { type: 'video', url: '/api/uploads/demo/trailer.mp4' }
          ]
        };
      }
    }

    if (!pitch) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Pitch not found', code: 'PITCH_NOT_FOUND' } 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    sentry.captureMessage('Individual pitch endpoint accessed', 'info', { pitchId });

    return new Response(JSON.stringify({
      success: true,
      pitch
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'individual_pitch', pitchId });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Individual pitch service error', code: 'INDIVIDUAL_PITCH_ERROR' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle following pitches endpoint
async function handleFollowingPitchesEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // Extract auth payload to get user info
    const authPayload = await extractAuthPayload(request, env);
    
    if (!authPayload) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);
    const limit = parseInt(params.get('limit') || '20');
    const offset = parseInt(params.get('offset') || '0');

    // Demo data for following pitches (pitches from creators the user follows)
    const demoPitches = [
      {
        id: 1,
        title: "Cyberpunk Noir Detective Story",
        description: "A futuristic detective thriller set in neo-Tokyo with cutting-edge visuals and compelling characters.",
        genre: "Thriller",
        budget_range: "$1M-$5M",
        status: "seeking_funding",
        creator_id: 1,
        creator_name: "Alex Creator",
        creator_avatar: "/api/uploads/demo/alex-avatar.jpg",
        view_count: 2847,
        like_count: 284,
        comment_count: 47,
        created_at: "2024-11-01T10:00:00Z",
        updated_at: "2024-11-01T15:30:00Z",
        thumbnail: "/api/uploads/demo/cyberpunk-thumb.jpg",
        featured: true,
        trending: true,
        following: true,
        tags: ["cyberpunk", "noir", "detective", "sci-fi", "thriller"]
      },
      {
        id: 7,
        title: "Indie Romance Drama",
        description: "A heartfelt independent romance exploring modern relationships in the digital age.",
        genre: "Romance",
        budget_range: "$500K-$1M",
        status: "seeking_funding",
        creator_id: 9,
        creator_name: "Emma Stone", 
        creator_avatar: "/api/uploads/demo/emma-avatar.jpg",
        view_count: 1234,
        like_count: 156,
        comment_count: 23,
        created_at: "2024-10-25T16:45:00Z",
        updated_at: "2024-11-01T12:30:00Z",
        thumbnail: "/api/uploads/demo/indie-romance-thumb.jpg",
        featured: false,
        trending: false,
        following: true,
        tags: ["romance", "indie", "drama", "relationships", "modern"]
      }
    ];

    // Apply pagination
    const paginatedPitches = demoPitches.slice(offset, offset + limit);

    sentry.captureMessage('Following pitches endpoint accessed', 'info', { 
      userId: authPayload.userId,
      count: paginatedPitches.length, 
      limit, 
      offset 
    });

    return new Response(JSON.stringify({
      success: true,
      pitches: paginatedPitches,
      pagination: {
        total: demoPitches.length,
        page: Math.floor(offset / limit) + 1,
        limit,
        offset,
        has_next: offset + limit < demoPitches.length,
        has_prev: offset > 0
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'following_pitches' });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Following pitches service error', code: 'FOLLOWING_PITCHES_ERROR' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Proxy to existing backend for unhandled routes
async function proxyToBackend(request: Request, sentry: any): Promise<Response> {
  try {
    // Proxy to Deno Deploy backend
    const backendUrl = 'https://pitchey-backend-fresh.deno.dev';
    const url = new URL(request.url);
    const proxiedUrl = backendUrl + url.pathname + url.search;
    
    const response = await fetch(proxiedUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    
    // Add CORS headers to proxied response
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    responseHeaders.set('X-Proxied-From', 'cloudflare-worker');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    sentry.captureException(error as Error, { 
      endpoint: 'proxy',
      url: request.url 
    });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Proxy service error', code: 'PROXY_ERROR' } 
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle user endpoints
async function handleUserEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    // Initialize database connection using pool
    let db = null;
    if (env.HYPERDRIVE) {
      db = dbPool.getConnection(env);
    }
    
    const userHandler = new UserEndpointsHandler(env, db, sentry);
    
    // Extract user auth if present (simplified for now)
    let userAuth = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.exp > Math.floor(Date.now() / 1000)) {
            userAuth = {
              userId: payload.userId,
              email: payload.email,
              userType: payload.userType
            };
          }
        }
      } catch (e) {
        // Invalid token, continue without auth
      }
    }
    
    const response = await userHandler.handleUserRequest(
      request, 
      new URL(request.url).pathname, 
      request.method,
      userAuth
    );
    
    return response;
    
  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'user', error: (error as Error).message });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'User service error', code: 'USER_ERROR', details: (error as Error).message } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle analytics endpoints (including dashboards)  
async function handleAnalyticsEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    let db = null;
    if (env.HYPERDRIVE) {
      db = dbPool.getConnection(env);
    }
    
    const analyticsHandler = new AnalyticsEndpointsHandler(env, db, sentry);
    
    // Extract user auth if present (same pattern as user endpoints)
    let userAuth = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.exp > Math.floor(Date.now() / 1000)) {
            userAuth = {
              userId: payload.userId,
              email: payload.email,
              userType: payload.userType
            };
          }
        }
      } catch (e) {
        // Invalid token, continue without auth
      }
    }
    
    const response = await analyticsHandler.handleAnalyticsRequest(
      request, 
      new URL(request.url).pathname, 
      request.method,
      userAuth
    );
    
    return response;
    
  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'analytics', error: (error as Error).message });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Analytics service error', code: 'ANALYTICS_ERROR', details: (error as Error).message } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle NDA endpoints
async function handleNDAEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
    if (!authPayload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Authentication required' } 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Handle specific NDA endpoints
    // pathSegments: ['api', 'nda', 'pending'] or ['api', 'nda', 'active'] etc.
    const ndaAction = pathSegments[2]; // 'pending', 'active', 'stats', etc.

    switch (ndaAction) {
      case 'pending':
        return new Response(JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              pitchId: 1,
              pitchTitle: "Cyberpunk Detective",
              requestorEmail: "investor@demo.com",
              requestorName: "Demo Investor",
              requestDate: "2024-11-15T10:30:00Z",
              status: "pending"
            },
            {
              id: 2,
              pitchId: 2,
              pitchTitle: "Space Opera Epic",
              requestorEmail: "production@demo.com", 
              requestorName: "Demo Production",
              requestDate: "2024-11-14T14:20:00Z",
              status: "pending"
            }
          ]
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      case 'active':
        return new Response(JSON.stringify({
          success: true,
          data: [
            {
              id: 3,
              pitchId: 3,
              pitchTitle: "Historical Drama",
              requestorEmail: "bigstudio@demo.com",
              requestorName: "Big Studio Productions",
              signedDate: "2024-11-10T16:45:00Z",
              expiryDate: "2025-11-10T16:45:00Z",
              status: "active"
            }
          ]
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      case 'stats':
        return new Response(JSON.stringify({
          success: true,
          data: {
            totalRequests: 15,
            pendingRequests: 2,
            activeNDAs: 1,
            expiredNDAs: 3,
            rejectedRequests: 9
          }
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'NDA endpoint not found', code: 'NOT_FOUND' } 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
    
  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'nda' });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'NDA service error', code: 'NDA_ERROR' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle search endpoints
async function handleSearchEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    let db = null;
    if (env.HYPERDRIVE) {
      db = dbPool.getConnection(env);
    }
    
    const searchHandler = new SearchEndpointsHandler(env, db, sentry);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
    const response = await searchHandler.handleSearchEndpoints(request, new URL(request.url).pathname, corsHeaders);
    
    if (response) {
      return response;
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Search endpoint not found', code: 'NOT_FOUND' } 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    sentry.captureException(error as Error, { endpoint: 'search' });
    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Search service error', code: 'SEARCH_ERROR' } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleInvestmentEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const path = '/' + pathSegments.slice(1).join('/'); // Remove 'api' prefix
    const method = request.method;

    const db = dbPool.getConnection(env);
    const handler = new InvestmentEndpointsHandler(env, db, sentry);
    return await handler.handleInvestmentRequest(request, path, method, authPayload);
  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleInvestmentEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleMessagingEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const path = '/' + pathSegments.slice(1).join('/'); // Remove 'api' prefix
    const method = request.method;

    const db = dbPool.getConnection(env);
    const handler = new MessagingEndpointsHandler(env, db, sentry);
    return await handler.handleMessagingRequest(request, path, method, authPayload);
  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleMessagingEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleUploadEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const path = '/' + pathSegments.slice(1).join('/'); // Remove 'api' prefix
    const method = request.method;

    const db = dbPool.getConnection(env);
    const handler = new UploadEndpointsHandler(env, db, sentry);
    return await handler.handleUploadRequest(request, path, method, authPayload);
  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleUploadEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleAdminEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    const db = dbPool.getConnection(env);
    const handler = new AdminEndpointsHandler(env, db, sentry);
    return await handler.handleRequest(request, corsHeaders, authPayload);
  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleAdminEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Helper function to extract and validate auth payload from JWT token
async function extractAuthPayload(request: Request, env: Env): Promise<any> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check if token is expired
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Return the payload data
    return {
      userId: payload.userId || 1,
      email: payload.email || 'demo@example.com',
      userType: payload.userType || 'creator',
      firstName: payload.firstName || (payload.userType === 'creator' ? 'Alex' : payload.userType === 'investor' ? 'Sarah' : 'Stellar'),
      lastName: payload.lastName || (payload.userType === 'creator' ? 'Creator' : payload.userType === 'investor' ? 'Investor' : 'Production'),
      companyName: payload.companyName || (payload.userType === 'creator' ? 'Indie Film Works' : payload.userType === 'investor' ? 'Capital Ventures' : 'Stellar Studios'),
      exp: payload.exp
    };

  } catch (error) {
    return null;
  }
}

// Handle profile endpoints
async function handleProfileEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (!authPayload || !authPayload.userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Authentication required' }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (request.method === 'GET') {
      // Return current user profile
      const user = {
        id: authPayload.userId,
        email: authPayload.email || 'user@demo.com',
        userType: authPayload.userType || 'creator',
        firstName: authPayload.userType === 'creator' ? 'Alex' : 
                   authPayload.userType === 'investor' ? 'Sarah' : 'Stellar',
        lastName: authPayload.userType === 'creator' ? 'Creator' : 
                  authPayload.userType === 'investor' ? 'Investor' : 'Productions',
        companyName: authPayload.userType === 'creator' ? 'Indie Film Works' :
                     authPayload.userType === 'investor' ? 'Capital Ventures' : 'Stellar Productions',
        displayName: authPayload.userType === 'creator' ? 'Alex Creator' : 
                     authPayload.userType === 'investor' ? 'Sarah Investor' : 'Stellar Productions',
        isActive: true,
        isVerified: true,
        followersCount: 147,
        followingCount: 23,
        subscriptionTier: 'premium'
      };
      
      return new Response(JSON.stringify({
        success: true,
        user: user
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } else if (request.method === 'PUT') {
      // Update profile
      const updateData = await request.json();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Profile updated successfully',
        user: { 
          ...updateData, 
          id: authPayload.userId,
          email: authPayload.email 
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: { message: 'Method not allowed' }
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleProfileEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle follows endpoints
async function handleFollowsEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (!authPayload || !authPayload.userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Authentication required' }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Handle /api/follows/stats/:userId
    if (pathSegments[2] === 'stats' && pathSegments[3]) {
      const userId = parseInt(pathSegments[3]);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          followersCount: 147,
          followingCount: 23,
          mutualFollowsCount: 5,
          isFollowing: userId !== authPayload.userId
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Handle basic follows endpoints
    return new Response(JSON.stringify({
      success: true,
      data: {
        followers: [],
        following: [],
        stats: {
          followersCount: 147,
          followingCount: 23
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleFollowsEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle payments endpoints
async function handlePaymentsEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (!authPayload || !authPayload.userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Authentication required' }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Handle subscription status
    if (pathSegments[2] === 'subscription-status') {
      return new Response(JSON.stringify({
        success: true,
        data: {
          tier: 'premium',
          status: 'active',
          renewalDate: '2025-01-01',
          features: ['unlimited_pitches', 'analytics', 'priority_support']
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Handle credits balance
    if (pathSegments[2] === 'credits' && pathSegments[3] === 'balance') {
      return new Response(JSON.stringify({
        success: true,
        data: {
          balance: 250,
          currency: 'USD',
          lastUpdated: new Date().toISOString()
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Default payment info
    return new Response(JSON.stringify({
      success: true,
      data: {
        paymentMethods: [],
        transactions: [],
        subscription: {
          tier: 'premium',
          status: 'active'
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handlePaymentsEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle notifications endpoints
async function handleNotificationsEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (!authPayload || !authPayload.userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Authentication required' }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Handle unread notifications count
    if (pathSegments[2] === 'unread') {
      return new Response(JSON.stringify({
        success: true,
        data: {
          count: 3,
          notifications: [
            {
              id: 1,
              type: 'nda_request',
              message: 'New NDA request for "Space Adventure"',
              timestamp: new Date().toISOString(),
              read: false
            },
            {
              id: 2,
              type: 'pitch_comment',
              message: 'New comment on your pitch',
              timestamp: new Date().toISOString(),
              read: false
            },
            {
              id: 3,
              type: 'follow',
              message: 'Someone started following you',
              timestamp: new Date().toISOString(),
              read: false
            }
          ]
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Default notifications
    return new Response(JSON.stringify({
      success: true,
      data: {
        notifications: [],
        unreadCount: 0,
        total: 0
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleNotificationsEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle creator dashboard endpoints
async function handleCreatorDashboardEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (!authPayload || !authPayload.userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Authentication required' }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (authPayload.userType !== 'creator') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Access denied: Creator role required' }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Return creator dashboard data
    return new Response(JSON.stringify({
      success: true,
      data: {
        stats: {
          totalPitches: 12,
          activePitches: 8,
          viewsThisMonth: 2456,
          likesThisMonth: 89,
          pendingNDAs: 3,
          signedNDAs: 15
        },
        recentActivity: [
          {
            type: 'pitch_view',
            message: 'Your pitch "Space Adventure" received 5 new views',
            timestamp: new Date().toISOString()
          },
          {
            type: 'nda_request',
            message: 'New NDA request for "Mystery Thriller"',
            timestamp: new Date().toISOString()
          }
        ],
        pitches: [
          {
            id: 1,
            title: 'Space Adventure',
            status: 'published',
            views: 1234,
            likes: 45,
            ndaRequests: 8
          },
          {
            id: 2,
            title: 'Mystery Thriller',
            status: 'published', 
            views: 987,
            likes: 32,
            ndaRequests: 5
          }
        ]
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleCreatorDashboardEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleInvestorDashboardEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (!authPayload || !authPayload.userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Authentication required' }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (authPayload.userType !== 'investor') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Access denied: Investor role required' }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Return investor dashboard data
    return new Response(JSON.stringify({
      success: true,
      data: {
        data: {
          portfolio: {
            totalInvestments: 5,
            activeDeals: 3,
            totalInvested: 150000,
            pendingOpportunities: 7
          },
          watchlist: [
            {
              id: 1,
              title: 'Cyberpunk Detective',
              creator: 'Alex Chen',
              status: 'seeking_funding',
              budget: '$1M-$5M'
            },
            {
              id: 3,
              title: 'Space Opera Epic',
              creator: 'Luna Starr', 
              status: 'seeking_funding',
              budget: '$5M-$10M'
            }
          ],
          recommendations: [
            {
              id: 4,
              title: 'Historical Drama',
              creator: 'Emma Wilson',
              genre: 'Drama',
              budget: '$2M-$5M',
              match_score: 92
            }
          ]
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleInvestorDashboardEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleProductionDashboardEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const authPayload = await extractAuthPayload(request, env);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (!authPayload || !authPayload.userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Authentication required' }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (authPayload.userType !== 'production') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Access denied: Production role required' }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Return production company dashboard data
    return new Response(JSON.stringify({
      success: true,
      data: {
        stats: {
          activeProjects: 4,
          inDevelopment: 2,
          inProduction: 1,
          completed: 1,
          totalBudget: 25000000,
          availableBudget: 8000000
        },
        projects: [
          {
            id: 1,
            title: 'Cyberpunk Detective',
            status: 'in_production',
            budget: 3500000,
            startDate: '2024-09-01',
            expectedCompletion: '2025-03-15'
          },
          {
            id: 2, 
            title: 'Space Opera Epic',
            status: 'in_development',
            budget: 8500000,
            startDate: '2025-01-15',
            expectedCompletion: '2025-12-01'
          }
        ],
        pipeline: [
          {
            id: 5,
            title: 'Historical Romance',
            creator: 'Sarah Johnson',
            genre: 'Romance',
            budget: 2200000,
            status: 'under_review'
          }
        ]
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleProductionDashboardEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle alerts endpoints
async function handleAlertsEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Handle /api/alerts/email
    if (pathSegments.length >= 3 && pathSegments[2] === 'email' && request.method === 'GET') {
      
      // Return mock email alerts data
      return new Response(JSON.stringify({
        success: true,
        data: {
          alerts: [
            {
              id: 1,
              type: 'new_pitch',
              title: 'New Pitch Alert',
              message: 'You have 3 new pitches matching your preferences',
              frequency: 'daily',
              enabled: true,
              created_at: '2024-11-15T10:00:00Z'
            },
            {
              id: 2,
              type: 'investment_update',
              title: 'Investment Update Alert',
              message: 'Updates on your portfolio investments',
              frequency: 'weekly',
              enabled: true,
              created_at: '2024-11-15T10:00:00Z'
            },
            {
              id: 3,
              type: 'nda_request',
              title: 'NDA Request Alert',
              message: 'New NDA requests require your attention',
              frequency: 'immediate',
              enabled: false,
              created_at: '2024-11-15T10:00:00Z'
            }
          ],
          totalCount: 3,
          unreadCount: 1
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Handle other alert endpoints
    return new Response(JSON.stringify({
      success: false,
      error: { message: 'Alert endpoint not found', code: 'ALERT_NOT_FOUND' }
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleAlertsEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Handle filters endpoints
async function handleFiltersEndpoint(request: Request, sentry: any, env: Env): Promise<Response> {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Handle /api/filters/saved
    if (pathSegments.length >= 3 && pathSegments[2] === 'saved' && request.method === 'GET') {
      
      // Return mock saved filters data
      return new Response(JSON.stringify({
        success: true,
        data: {
          filters: [
            {
              id: 1,
              name: 'Drama Films',
              criteria: {
                genre: 'Drama',
                budgetRange: '$1M-$5M',
                status: 'seeking_funding'
              },
              created_at: '2024-11-10T14:30:00Z',
              lastUsed: '2024-11-16T09:15:00Z'
            },
            {
              id: 2,
              name: 'High Budget Action',
              criteria: {
                genre: 'Action',
                budgetRange: '$10M+',
                featured: true
              },
              created_at: '2024-11-05T16:20:00Z',
              lastUsed: '2024-11-15T11:45:00Z'
            },
            {
              id: 3,
              name: 'Trending Horror',
              criteria: {
                genre: 'Horror',
                trending: true,
                viewCount: '>1000'
              },
              created_at: '2024-11-01T12:00:00Z',
              lastUsed: '2024-11-14T18:30:00Z'
            }
          ],
          totalCount: 3
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Handle other filter endpoints
    return new Response(JSON.stringify({
      success: false,
      error: { message: 'Filter endpoint not found', code: 'FILTER_NOT_FOUND' }
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    sentry.captureException(error as Error, { context: 'handleFiltersEndpoint' });
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Main Worker
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry with Toucan
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: ctx,
      request,
      environment: env.SENTRY_ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE || 'unified-worker-v1.6-connection-pool',
      tracesSampleRate: 1.0,
    });
    
    // Initialize database pool (singleton pattern - only happens once per Worker lifetime)
    try {
      dbPool.initialize(env, sentry);
    } catch (initError) {
      console.error('Failed to initialize database pool:', initError);
      sentry.captureException(initError as Error, {
        tags: { operation: 'database-pool-init' }
      });
    }
    
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }

      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);

      // Handle health check endpoint
      if (url.pathname === '/api/health') {
        try {
          // Test database connection via pooled connection
          const isConnected = await dbPool.testConnection(env);
          
          // Use withDatabase pattern for proper tagged template literal syntax
          const userCount = await withDatabase(env, async (sql) => {
            const result = await sql`SELECT COUNT(*) as count FROM users`;
            return parseInt(result[0]?.count || '0');
          }, sentry);
          
          return new Response(JSON.stringify({
            status: 'healthy',
            database: isConnected ? 'connected' : 'disconnected',
            users: userCount,
            timestamp: new Date().toISOString(),
            environment: 'cloudflare-worker',
            hyperdrive: true,
            poolStats: dbPool.getStats()
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error) {
          // Log to Sentry with proper context
          sentry.captureException(error, {
            tags: { endpoint: 'health-check' },
            extra: { 
              hyperdriveAvailable: !!env.HYPERDRIVE,
              errorMessage: (error as Error).message,
              timestamp: new Date().toISOString()
            }
          });
          
          return new Response(JSON.stringify({
            status: 'error',
            database: 'disconnected',
            error: (error as Error).message,
            timestamp: new Date().toISOString(),
            environment: 'cloudflare-worker',
            sentryReported: true
          }), {
            status: 503,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      // Check for special auth endpoints that don't follow /api/auth/ pattern
      if (pathSegments[0] === 'api' && (pathSegments[1] === 'validate-token' || pathSegments[1] === 'refresh-token')) {
        
        sentry.captureMessage('Handling auth validation endpoint through auth module', 'info', {
          path: url.pathname,
          method: request.method
        });
        
        return await handleAuthEndpoint(request, sentry, env);
      }

      // Check if this is an auth endpoint that we need to handle
      if (pathSegments[0] === 'api' && pathSegments[1] === 'auth') {
        
        sentry.captureMessage('Handling auth endpoint locally', 'info', {
          path: url.pathname,
          method: request.method
        });
        
        return await handleAuthEndpoint(request, sentry, env);
      }

      // Check if this is a pitches endpoint that we need to handle
      if (pathSegments[0] === 'api' && pathSegments[1] === 'pitches') {
        
        sentry.captureMessage('Handling pitches endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handlePitchesEndpoint(request, sentry, env);
      }

      // Check if this is a user endpoint that we need to handle
      if (pathSegments[0] === 'api' && (pathSegments[1] === 'user' || pathSegments[1] === 'users')) {
        
        sentry.captureMessage('Handling user endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleUserEndpoint(request, sentry, env);
      }

      // Check if this is a dashboard endpoint (analytics) - but not creator/investor/production specific ones
      if (pathSegments[0] === 'api' && pathSegments[2] === 'dashboard' && 
          pathSegments[1] !== 'creator' && pathSegments[1] !== 'investor' && pathSegments[1] !== 'production') {
        
        sentry.captureMessage('Handling dashboard endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleAnalyticsEndpoint(request, sentry, env);
      }

      // Check if this is an analytics endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'analytics') {
        
        sentry.captureMessage('Handling analytics endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleAnalyticsEndpoint(request, sentry, env);
      }

      // Check if this is an NDA endpoint
      if (pathSegments[0] === 'api' && (pathSegments[1] === 'nda' || pathSegments[1] === 'ndas')) {
        
        sentry.captureMessage('Handling NDA endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleNDAEndpoint(request, sentry, env);
      }

      // Check if this is a search endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'search') {
        
        sentry.captureMessage('Handling search endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleSearchEndpoint(request, sentry, env);
      }

      // Check if this is an investment endpoint
      if (pathSegments[0] === 'api' && (pathSegments[1] === 'investment' || pathSegments[1] === 'investments' || pathSegments[1] === 'investor')) {
        
        sentry.captureMessage('Handling investment endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleInvestmentEndpoint(request, sentry, env);
      }

      // Check if this is a messaging endpoint
      if (pathSegments[0] === 'api' && (pathSegments[1] === 'messages' || pathSegments[1] === 'messaging' || pathSegments[1] === 'conversations')) {
        
        sentry.captureMessage('Handling messaging endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleMessagingEndpoint(request, sentry, env);
      }

      // Check if this is an upload/file endpoint
      if (pathSegments[0] === 'api' && (pathSegments[1] === 'upload' || pathSegments[1] === 'uploads' || pathSegments[1] === 'files')) {
        
        sentry.captureMessage('Handling upload endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleUploadEndpoint(request, sentry, env);
      }

      // Check if this is an admin endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'admin') {
        
        sentry.captureMessage('Handling admin endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleAdminEndpoint(request, sentry, env);
      }

      // Check if this is a profile endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'profile') {
        
        sentry.captureMessage('Handling profile endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleProfileEndpoint(request, sentry, env);
      }

      // Check if this is a follows endpoint
      if (pathSegments[0] === 'api' && (pathSegments[1] === 'follows' || pathSegments[1] === 'follow')) {
        
        sentry.captureMessage('Handling follows endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleFollowsEndpoint(request, sentry, env);
      }

      // Check if this is a payments endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'payments') {
        
        sentry.captureMessage('Handling payments endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handlePaymentsEndpoint(request, sentry, env);
      }

      // Check if this is a notifications endpoint
      if (pathSegments[0] === 'api' && (pathSegments[1] === 'notifications' || pathSegments[1] === 'notification')) {
        
        sentry.captureMessage('Handling notifications endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleNotificationsEndpoint(request, sentry, env);
      }

      // Check if this is an alerts endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'alerts') {
        
        sentry.captureMessage('Handling alerts endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleAlertsEndpoint(request, sentry, env);
      }

      // Check if this is a filters endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'filters') {
        
        sentry.captureMessage('Handling filters endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleFiltersEndpoint(request, sentry, env);
      }

      // Check if this is a creator-specific dashboard endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'creator' && pathSegments[2] === 'dashboard') {
        
        sentry.captureMessage('Handling creator dashboard endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleCreatorDashboardEndpoint(request, sentry, env);
      }

      // Check if this is an investor-specific dashboard endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'investor' && pathSegments[2] === 'dashboard') {
        
        sentry.captureMessage('Handling investor dashboard endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleInvestorDashboardEndpoint(request, sentry, env);
      }

      // Check if this is a production-specific dashboard endpoint
      if (pathSegments[0] === 'api' && pathSegments[1] === 'production' && pathSegments[2] === 'dashboard') {
        
        sentry.captureMessage('Handling production dashboard endpoint locally', 'info', {
          path: url.pathname,
          method: request.method,
          segments: pathSegments
        });
        
        return await handleProductionDashboardEndpoint(request, sentry, env);
      }

      // Handle non-API requests with a proper default response
      if (!url.pathname.startsWith('/api/')) {
        
        sentry.captureMessage('Non-API request received', 'info', {
          path: url.pathname,
          method: request.method,
          userAgent: request.headers.get('User-Agent') || 'unknown'
        });
        
        // Return a helpful default response for root and non-API paths
        if (url.pathname === '/' || url.pathname === '') {
          return new Response(JSON.stringify({
            service: 'Pitchey API Gateway',
            status: 'operational',
            version: 'v3.0',
            description: 'Movie pitch platform API - Use /api/ endpoints for data access',
            endpoints: {
              health: '/api/health',
              pitches: '/api/pitches',
              auth: '/api/auth/*',
              users: '/api/users/*'
            },
            frontend: 'https://pitchey.pages.dev',
            documentation: 'https://docs.pitchey.com',
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
              ...corsHeaders 
            }
          });
        }
        
        // For other non-API paths, return a 404 with helpful info
        return new Response(JSON.stringify({
          success: false,
          error: {
            message: 'Route not found',
            code: 'NOT_FOUND',
            path: url.pathname,
            suggestion: 'This is an API-only service. Use /api/ endpoints or visit https://pitchey.pages.dev for the web application.',
            availableEndpoints: [
              '/api/health',
              '/api/pitches',
              '/api/auth/creator/login',
              '/api/auth/investor/login'
            ]
          },
          timestamp: new Date().toISOString()
        }), {
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
      
      // For API endpoints that aren't handled above, proxy to existing backend
      sentry.captureMessage('Proxying API request to backend', 'info', {
        path: url.pathname,
        method: request.method
      });
      
      return await proxyToBackend(request, sentry);
      
    } catch (error) {
      sentry.captureException(error as Error, { 
        url: request.url,
        method: request.method 
      });
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: { 
          message: 'Worker service error', 
          code: 'WORKER_ERROR',
          timestamp: new Date().toISOString()
        } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};