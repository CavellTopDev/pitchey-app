/**
 * Optimized Worker with Modular Service Architecture
 * Implements Phase 2 service bindings pattern within single Worker
 */

import { Toucan } from 'toucan-js';
import { WebSocketRoom } from './websocket-room-optimized.ts';
// Simple JWT creation using Web Crypto API
async function createSimpleJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerStr = btoa(JSON.stringify(header));
  const payloadStr = btoa(JSON.stringify(payload));
  
  const message = `${headerStr}.${payloadStr}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureStr = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${message}.${signatureStr}`;
}

async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerStr, payloadStr, signatureStr] = parts;
    const message = `${headerStr}.${payloadStr}`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(message));
    
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(atob(payloadStr));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

async function authenticateRequest(request: Request, env: Env): Promise<{success: boolean, user?: any, error?: Response}> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: new Response(JSON.stringify({
          success: false,
          message: 'Missing or invalid authorization header'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      };
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = env.JWT_SECRET || 'fallback-secret-key';
    const payload = await verifyJWT(token, JWT_SECRET);

    // Return demo account data based on user type
    let user;
    if (payload.userType === 'creator') {
      user = demoAccounts.creator;
    } else if (payload.userType === 'investor') {
      user = demoAccounts.investor;
    } else if (payload.userType === 'production') {
      user = demoAccounts.production;
    } else {
      throw new Error('Invalid user type');
    }

    return { success: true, user: { ...user, ...payload } };
  } catch (error) {
    return {
      success: false,
      error: new Response(JSON.stringify({
        success: false,
        message: 'Invalid token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
}

interface Env {
  HYPERDRIVE?: Hyperdrive;
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  FRONTEND_URL?: string;
  JWT_SECRET?: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
}

// Demo accounts for testing
const demoAccounts = {
  creator: {
    id: 1,
    email: "alex.creator@demo.com",
    username: "alexcreator",
    password: "Demo123",
    userType: "creator",
    companyName: "Independent Films"
  },
  investor: {
    id: 2,
    email: "sarah.investor@demo.com",
    username: "sarahinvestor",
    password: "Demo123",
    userType: "investor",
    companyName: "Johnson Ventures"
  },
  production: {
    id: 16,
    email: "stellar.production@demo.com",
    username: "stellarproduction",
    password: "Demo123",
    userType: "production",
    companyName: "Stellar Productions"
  }
};

// Helper functions
async function validateRequest(request: Request, requiredFields: string[]) {
  try {
    const body = await request.json();
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return {
          success: false,
          error: new Response(JSON.stringify({
            success: false,
            message: `Missing required field: ${field}`
          }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' }
          })
        };
      }
    }
    
    return { success: true, data: body };
  } catch (error) {
    return {
      success: false,
      error: new Response(JSON.stringify({
        success: false,
        message: "Invalid JSON in request body"
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

function authErrorResponse(message: string) {
  return jsonResponse({
    success: false,
    message: message || "Authentication failed"
  }, 401);
}

function serverErrorResponse(message: string) {
  return jsonResponse({
    success: false,
    message: message || "Internal server error"
  }, 500);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry for error tracking
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: ctx,
      request,
      environment: env.SENTRY_ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE || 'phase2-services-v1.0'
    });

    try {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const pathname = url.pathname;

      // Simple test endpoint first
      if (pathname === '/api/simple-test') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Simple test working',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Database test with fallback to direct connection
      if (pathname === '/api/db-test') {
        console.log('Testing database connection...');
        
        // Test 1: Try Hyperdrive connection
        if (env.HYPERDRIVE) {
          try {
            console.log('Testing Hyperdrive connection...');
            const { neon } = await import('@neondatabase/serverless');
            const sql = neon(env.HYPERDRIVE.connectionString);
            const result = await sql`SELECT 1 as test_hyperdrive, 'hyperdrive' as connection_type`;
            
            return new Response(JSON.stringify({
              success: true,
              message: 'Hyperdrive connection working!',
              testResult: result[0] || null,
              connection_type: 'hyperdrive'
            }), {
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          } catch (hyperdriveError) {
            console.error('Hyperdrive failed, trying direct connection...', hyperdriveError);
            
            // Test 2: Try direct Neon connection as fallback
            try {
              console.log('Testing direct Neon connection...');
              const { neon } = await import('@neondatabase/serverless');
              const directConnectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
              const sql = neon(directConnectionString);
              const result = await sql`SELECT 1 as test_direct, 'direct' as connection_type`;
              
              return new Response(JSON.stringify({
                success: true,
                message: 'Direct connection working! (Hyperdrive failed)',
                testResult: result[0] || null,
                connection_type: 'direct',
                hyperdrive_error: hyperdriveError.message
              }), {
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              });
            } catch (directError) {
              console.error('Both Hyperdrive and direct connections failed');
              return new Response(JSON.stringify({
                success: false,
                error: 'Both database connections failed',
                hyperdrive_error: hyperdriveError.message,
                direct_error: directError.message,
                available_bindings: Object.keys(env)
              }), {
                status: 500,
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              });
            }
          }
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'HYPERDRIVE binding not available',
            available_bindings: Object.keys(env)
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle trending pitches directly with direct database access
      if (pathname === '/api/pitches/trending') {
        try {
          console.log('Loading trending pitches...');
          const limit = url.searchParams.get('limit') || '10';
          
          // Use direct connection (Hyperdrive has issues)
          const { neon } = await import('@neondatabase/serverless');
          const connectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          const sql = neon(connectionString);
          
          console.log('Executing trending pitches query...');
          const results = await sql`
            SELECT 
              p.id, p.title, p.logline, p.genre, p.format,
              p.view_count as "viewCount", p.like_count as "likeCount", 
              p.poster_url as "posterUrl", p.created_at as "createdAt",
              u.username as creator_username, u.id as creator_id
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
            ORDER BY p.view_count DESC
            LIMIT ${parseInt(limit, 10)}
          `;
          
          console.log('Query executed, mapping results...');
          const pitches = results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount || 0,
            likeCount: pitch.likeCount || 0,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username
            }
          }));

          console.log(`Successfully loaded ${pitches.length} trending pitches`);
          return new Response(JSON.stringify({
            success: true,
            items: pitches,
            message: `Found ${pitches.length} trending pitches`
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Trending pitches error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'trending-pitches' }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load trending pitches',
            error_name: error instanceof Error ? error.name : 'Unknown'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle new releases directly with direct database access
      if (pathname === '/api/pitches/new') {
        try {
          console.log('Loading new releases...');
          const limit = url.searchParams.get('limit') || '10';
          
          // Use direct connection (Hyperdrive has issues)
          const { neon } = await import('@neondatabase/serverless');
          const connectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          const sql = neon(connectionString);
          
          console.log('Executing new releases query...');
          const results = await sql`
            SELECT 
              p.id, p.title, p.logline, p.genre, p.format,
              p.view_count as "viewCount", p.poster_url as "posterUrl", 
              p.created_at as "createdAt",
              u.username as creator_username, u.id as creator_id
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
            ORDER BY p.created_at DESC
            LIMIT ${parseInt(limit, 10)}
          `;
          
          console.log('Query executed, mapping results...');
          const pitches = results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount || 0,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username
            }
          }));

          console.log(`Successfully loaded ${pitches.length} new releases`);
          return new Response(JSON.stringify({
            success: true,
            items: pitches,
            message: `Found ${pitches.length} new releases`
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('New releases error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'new-releases' }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load new releases',
            error_name: error instanceof Error ? error.name : 'Unknown'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle public pitches (both list and individual)
      if (pathname.startsWith('/api/pitches/public')) {
        try {
          // Check if this is a request for a specific pitch (e.g., /api/pitches/public/162)
          const pathParts = pathname.split('/');
          const pitchId = pathParts[pathParts.length - 1];
          
          // Use direct connection (Hyperdrive has issues)
          const { neon } = await import('@neondatabase/serverless');
          const connectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          const sql = neon(connectionString);
          
          // If pitchId is a number, fetch individual pitch
          if (pitchId && !isNaN(parseInt(pitchId)) && pitchId !== 'public') {
            console.log(`Loading individual pitch: ${pitchId}`);
            
            const results = await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.format,
                p.view_count as "viewCount", p.like_count as "likeCount",
                p.poster_url as "posterUrl", p.created_at as "createdAt",
                p.status, p.visibility,
                u.username as creator_username, u.id as creator_id
              FROM pitches p
              LEFT JOIN users u ON p.user_id = u.id
              WHERE p.id = ${parseInt(pitchId)} 
                AND p.status IN ('published', 'active') 
                AND p.visibility = 'public'
            `;
            
            if (results.length === 0) {
              return new Response(JSON.stringify({
                success: false,
                error: 'Pitch not found or not accessible',
                pitch_id: pitchId
              }), {
                status: 404,
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              });
            }
            
            const pitch = results[0];
            const pitchDetail = {
              id: pitch.id,
              title: pitch.title,
              logline: pitch.logline,
              genre: pitch.genre,
              format: pitch.format,
              viewCount: pitch.viewCount || 0,
              likeCount: pitch.likeCount || 0,
              posterUrl: pitch.posterUrl,
              createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
              status: pitch.status,
              visibility: pitch.visibility,
              creator: {
                id: pitch.creator_id,
                username: pitch.creator_username
              }
            };

            console.log(`Successfully loaded pitch ${pitchId}`);
            return new Response(JSON.stringify({
              success: true,
              pitch: pitchDetail,
              message: `Pitch ${pitchId} loaded successfully`
            }), {
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
            
          } else {
            // List all public pitches
            console.log('Loading public pitches list...');
            const limit = url.searchParams.get('limit') || '10';
            
            console.log('Executing public pitches query...');
            const results = await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.format,
                p.view_count as "viewCount", p.poster_url as "posterUrl", 
                p.created_at as "createdAt",
                u.username as creator_username, u.id as creator_id
              FROM pitches p
              LEFT JOIN users u ON p.user_id = u.id
              WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
              ORDER BY p.created_at DESC
              LIMIT ${parseInt(limit, 10)}
            `;
            
            console.log('Query executed, mapping results...');
            const pitches = results.map(pitch => ({
              id: pitch.id,
              title: pitch.title,
              logline: pitch.logline,
              genre: pitch.genre,
              format: pitch.format,
              viewCount: pitch.viewCount || 0,
              posterUrl: pitch.posterUrl,
              createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
              creator: {
                id: pitch.creator_id,
                username: pitch.creator_username
              }
            }));

            console.log(`Successfully loaded ${pitches.length} public pitches`);
            return new Response(JSON.stringify({
              success: true,
              items: pitches,
              message: `Found ${pitches.length} public pitches`
            }), {
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }
        } catch (error) {
          console.error('Public pitches error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'public-pitches' }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load public pitches',
            error_name: error instanceof Error ? error.name : 'Unknown'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle individual pitch details with comprehensive business data - /api/pitches/:id
      if (pathname.match(/^\/api\/pitches\/\d+$/) || pathname.match(/^\/api\/pitches\/[a-zA-Z0-9-]+$/)) {
        try {
          const pitchIdentifier = pathname.split('/').pop();
          console.log(`Loading comprehensive pitch details: ${pitchIdentifier}`);
          
          // Authentication and access control
          const authHeader = request.headers.get('Authorization');
          let currentUser = null;
          let hasNdaAccess = false;
          
          // Use direct connection (Hyperdrive has issues)
          const { neon } = await import('@neondatabase/serverless');
          const connectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          const sql = neon(connectionString);
          
          // Check for authentication if provided
          if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
              const token = authHeader.replace('Bearer ', '');
              // Simple JWT validation (in production, use proper JWT library)
              const tokenParts = token.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                if (payload.userId && payload.exp > Date.now() / 1000) {
                  const userResults = await sql`
                    SELECT id, username, user_type, email 
                    FROM users 
                    WHERE id = ${payload.userId} AND is_active = true
                  `;
                  if (userResults.length > 0) {
                    currentUser = userResults[0];
                    console.log(`Authenticated user: ${currentUser.username} (${currentUser.user_type})`);
                  }
                }
              }
            } catch (authError) {
              console.warn('Authentication error:', authError.message);
              // Continue as unauthenticated user
            }
          }
          
          // Determine if identifier is numeric ID or slug
          const isNumericId = !isNaN(parseInt(pitchIdentifier));
          let pitchResults;
          
          if (isNumericId) {
            const pitchId = parseInt(pitchIdentifier);
            
            // Check NDA access for authenticated user
            if (currentUser) {
              const ndaAccessResults = await sql`
                SELECT nr.status, nr.pitch_id, p.user_id as pitch_owner_id
                FROM nda_requests nr
                JOIN pitches p ON p.id = nr.pitch_id
                WHERE nr.pitch_id = ${pitchId} 
                  AND nr.requester_id = ${currentUser.id} 
                  AND nr.status = 'approved'
                UNION
                SELECT 'owner' as status, p.id as pitch_id, p.user_id as pitch_owner_id
                FROM pitches p
                WHERE p.id = ${pitchId} AND p.user_id = ${currentUser.id}
              `;
              
              if (ndaAccessResults.length > 0) {
                hasNdaAccess = true;
                console.log(`User has NDA access to pitch ${pitchId}`);
              }
            }
            
            // Modify query based on access level
            let visibilityCondition = "p.status IN ('published', 'active') AND p.visibility = 'public'";
            if (hasNdaAccess) {
              // Full access with NDA or owner
              visibilityCondition = "p.status IN ('published', 'active', 'private', 'nda_required')";
            }
            
            // Comprehensive pitch query with all business-relevant fields (numeric ID)
            if (hasNdaAccess) {
              pitchResults = await sql`
                SELECT 
                  p.id, p.title, p.logline, p.short_synopsis, p.long_synopsis, 
                  p.genre, p.format, p.format_category, p.format_subtype, p.custom_format,
                  p.opener, p.premise, p.target_audience, p.characters, p.themes, p.world_description,
                  p.episode_breakdown, p.budget_range, p.budget_bracket, p.estimated_budget,
                  p.stage, p.production_stage, p.production_timeline,
                  p.view_count as "viewCount", p.like_count as "likeCount", p.comment_count as "commentCount",
                  p.share_count as "shareCount", p.nda_count as "ndaCount",
                  p.poster_url as "posterUrl", p.video_url as "videoUrl", 
                  p.pitch_deck_url as "pitchDeckUrl", p.title_image as "titleImage",
                  p.lookbook_url as "lookbookUrl", p.script_url as "scriptUrl", p.trailer_url as "trailerUrl",
                  p.additional_materials, p.additional_media, p.visibility_settings,
                  p.status, p.visibility, p.require_nda as "requireNda", 
                  p.seeking_investment as "seekingInvestment",
                  p.ai_used as "aiUsed", p.ai_tools as "aiTools", p.ai_disclosure as "aiDisclosure",
                  p.feedback, p.tags, p.metadata,
                  p.created_at as "createdAt", p.updated_at as "updatedAt", p.published_at as "publishedAt",
                  u.id as creator_id, u.username as creator_username, u.first_name, u.last_name,
                  u.bio as creator_bio, u.location as creator_location, u.website as creator_website,
                  u.profile_image_url as "creatorProfileImage", u.company_name as "creatorCompany"
                FROM pitches p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.id = ${pitchId} AND p.status IN ('published', 'active', 'private', 'nda_required')
              `;
            } else {
              pitchResults = await sql`
                SELECT 
                  p.id, p.title, p.logline, p.short_synopsis, p.long_synopsis, 
                  p.genre, p.format, p.format_category, p.format_subtype, p.custom_format,
                  p.opener, p.premise, p.target_audience, p.characters, p.themes, p.world_description,
                  p.episode_breakdown, p.budget_range, p.budget_bracket, p.estimated_budget,
                  p.stage, p.production_stage, p.production_timeline,
                  p.view_count as "viewCount", p.like_count as "likeCount", p.comment_count as "commentCount",
                  p.share_count as "shareCount", p.nda_count as "ndaCount",
                  p.poster_url as "posterUrl", p.video_url as "videoUrl", 
                  p.pitch_deck_url as "pitchDeckUrl", p.title_image as "titleImage",
                  p.lookbook_url as "lookbookUrl", p.script_url as "scriptUrl", p.trailer_url as "trailerUrl",
                  p.additional_materials, p.additional_media, p.visibility_settings,
                  p.status, p.visibility, p.require_nda as "requireNda", 
                  p.seeking_investment as "seekingInvestment",
                  p.ai_used as "aiUsed", p.ai_tools as "aiTools", p.ai_disclosure as "aiDisclosure",
                  p.feedback, p.tags, p.metadata,
                  p.created_at as "createdAt", p.updated_at as "updatedAt", p.published_at as "publishedAt",
                  u.id as creator_id, u.username as creator_username, u.first_name, u.last_name,
                  u.bio as creator_bio, u.location as creator_location, u.website as creator_website,
                  u.profile_image_url as "creatorProfileImage", u.company_name as "creatorCompany"
                FROM pitches p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.id = ${pitchId} AND p.status IN ('published', 'active') AND p.visibility = 'public'
              `;
            }
          } else {
            // Support slug-based lookup (title-based slug) - only public pitches for slug access
            const slugTitle = pitchIdentifier.replace(/-/g, ' ');
            pitchResults = await sql`
              SELECT 
                p.id, p.title, p.logline, p.short_synopsis, p.long_synopsis, 
                p.genre, p.format, p.format_category, p.format_subtype, p.custom_format,
                p.opener, p.premise, p.target_audience, p.characters, p.themes, p.world_description,
                p.episode_breakdown, p.budget_range, p.budget_bracket, p.estimated_budget,
                p.stage, p.production_stage, p.production_timeline,
                p.view_count as "viewCount", p.like_count as "likeCount", p.comment_count as "commentCount",
                p.share_count as "shareCount", p.nda_count as "ndaCount",
                p.poster_url as "posterUrl", p.video_url as "videoUrl", 
                p.pitch_deck_url as "pitchDeckUrl", p.title_image as "titleImage",
                p.lookbook_url as "lookbookUrl", p.script_url as "scriptUrl", p.trailer_url as "trailerUrl",
                p.additional_materials, p.additional_media, p.visibility_settings,
                p.status, p.visibility, p.require_nda as "requireNda", 
                p.seeking_investment as "seekingInvestment",
                p.ai_used as "aiUsed", p.ai_tools as "aiTools", p.ai_disclosure as "aiDisclosure",
                p.feedback, p.tags, p.metadata,
                p.created_at as "createdAt", p.updated_at as "updatedAt", p.published_at as "publishedAt",
                u.id as creator_id, u.username as creator_username, u.first_name, u.last_name,
                u.bio as creator_bio, u.location as creator_location, u.website as creator_website,
                u.profile_image_url as "creatorProfileImage", u.company_name as "creatorCompany"
              FROM pitches p
              LEFT JOIN users u ON p.user_id = u.id
              WHERE LOWER(REPLACE(p.title, ' ', '-')) = LOWER(${pitchIdentifier}) 
                AND p.status IN ('published', 'active') AND p.visibility = 'public'
            `;
          }
          
          if (pitchResults.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pitch not found or not accessible',
              pitch_identifier: pitchIdentifier
            }), {
              status: 404,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }
          
          const pitch = pitchResults[0];
          
          // Get pitch characters (fallback to characters field in pitch if table doesn't exist)
          let charactersResults = [];
          try {
            charactersResults = await sql`
              SELECT 
                pc.id, pc.name, pc.description, pc.age, pc.gender, 
                pc.actor, pc.role, pc.relationship, pc.display_order
              FROM pitch_characters pc
              WHERE pc.pitch_id = ${pitch.id}
              ORDER BY pc.display_order ASC, pc.name ASC
            `;
          } catch (error) {
            // Table doesn't exist, characters info is stored in pitch.characters text field
            console.log('pitch_characters table not available, using characters text field');
            charactersResults = [];
          }
          
          // Get pitch documents (based on access level)
          let documentsResults;
          if (hasNdaAccess) {
            // Full document access with NDA
            documentsResults = await sql`
              SELECT 
                pd.id, pd.file_name, pd.original_file_name, pd.file_type, 
                pd.document_type, pd.file_size, pd.is_public, pd.requires_nda,
                pd.uploaded_at, pd.download_count, pd.file_url
              FROM pitch_documents pd
              WHERE pd.pitch_id = ${pitch.id}
              ORDER BY pd.document_type, pd.uploaded_at DESC
            `;
          } else {
            // Public documents only
            documentsResults = await sql`
              SELECT 
                pd.id, pd.file_name, pd.original_file_name, pd.file_type, 
                pd.document_type, pd.file_size, pd.is_public, pd.requires_nda,
                pd.uploaded_at, pd.download_count
              FROM pitch_documents pd
              WHERE pd.pitch_id = ${pitch.id} AND pd.is_public = true
              ORDER BY pd.document_type, pd.uploaded_at DESC
            `;
          }
          
          // Get pitch analytics (basic view tracking)
          const analyticsResults = await sql`
            SELECT 
              COUNT(DISTINCT pv.viewer_id) as unique_viewers,
              COUNT(pv.id) as total_views,
              AVG(pv.view_duration) as avg_view_duration,
              COUNT(CASE WHEN pv.clicked_watch_this = true THEN 1 END) as watch_clicks
            FROM pitch_views pv
            WHERE pv.pitch_id = ${pitch.id} AND pv.viewed_at > NOW() - INTERVAL '30 days'
          `;
          
          // Get NDA status summary (without revealing private info)
          const ndaResults = await sql`
            SELECT 
              COUNT(*) as total_nda_requests,
              COUNT(CASE WHEN nr.status = 'approved' THEN 1 END) as approved_ndas,
              COUNT(CASE WHEN nr.status = 'pending' THEN 1 END) as pending_ndas
            FROM nda_requests nr
            WHERE nr.pitch_id = ${pitch.id}
          `;
          
          // Get investment interest indicators (basic metrics only)
          const investmentResults = await sql`
            SELECT 
              (SELECT COUNT(DISTINCT investor_id) FROM investments WHERE pitch_id = ${pitch.id}) as interested_investors,
              (SELECT COUNT(*) FROM watchlist WHERE pitch_id = ${pitch.id}) as watchlist_adds
          `;
          
          // Get related pitches by same creator (public only)
          const relatedResults = await sql`
            SELECT 
              p2.id, p2.title, p2.logline, p2.genre, p2.poster_url as "posterUrl",
              p2.view_count as "viewCount"
            FROM pitches p2
            WHERE p2.user_id = ${pitch.creator_id} 
              AND p2.id != ${pitch.id} 
              AND p2.status IN ('published', 'active') 
              AND p2.visibility = 'public'
            ORDER BY p2.view_count DESC
            LIMIT 5
          `;
          
          // Track view analytics for authenticated users and increment view count
          const viewerInfo = {
            ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown',
            userAgent: request.headers.get('User-Agent') || 'unknown',
            referrer: request.headers.get('Referer') || null
          };
          
          // Increment view count (fire and forget)
          sql`UPDATE pitches SET view_count = view_count + 1 WHERE id = ${pitch.id}`.catch(console.error);
          
          // Track detailed view for authenticated users (fire and forget)
          if (currentUser) {
            sql`
              INSERT INTO pitch_views (pitch_id, viewer_id, ip_address, user_agent, referrer, view_type)
              VALUES (${pitch.id}, ${currentUser.id}, ${viewerInfo.ipAddress}, ${viewerInfo.userAgent}, ${viewerInfo.referrer}, 'detailed')
            `.catch(console.error);
            
            // Track analytics event
            sql`
              INSERT INTO analytics_events (event_type, user_id, pitch_id, event_data)
              VALUES ('pitch_view', ${currentUser.id}, ${pitch.id}, ${JSON.stringify({
                viewType: hasNdaAccess ? 'nda_access' : 'public',
                userType: currentUser.user_type,
                accessLevel: hasNdaAccess ? 'full' : 'limited'
              })})
            `.catch(console.error);
          } else {
            // Anonymous view tracking (fire and forget)
            sql`
              INSERT INTO pitch_views (pitch_id, ip_address, user_agent, referrer, view_type)
              VALUES (${pitch.id}, ${viewerInfo.ipAddress}, ${viewerInfo.userAgent}, ${viewerInfo.referrer}, 'anonymous')
            `.catch(console.error);
          }
          
          // Build comprehensive response
          const analytics = analyticsResults[0] || {};
          const ndaStats = ndaResults[0] || {};
          const investmentStats = investmentResults[0] || {};
          
          const comprehensivePitch = {
            // Core pitch information
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            shortSynopsis: pitch.short_synopsis,
            longSynopsis: pitch.long_synopsis,
            
            // Production details
            genre: pitch.genre,
            format: pitch.format,
            formatCategory: pitch.format_category,
            formatSubtype: pitch.format_subtype,
            customFormat: pitch.custom_format,
            
            // Creative elements
            opener: pitch.opener,
            premise: pitch.premise,
            targetAudience: pitch.target_audience,
            characters: pitch.characters,
            themes: pitch.themes,
            worldDescription: pitch.world_description,
            episodeBreakdown: pitch.episode_breakdown,
            
            // Character details (structured from database table or parsed from text field)
            charactersList: charactersResults.length > 0 
              ? charactersResults.map(char => ({
                  id: char.id,
                  name: char.name,
                  description: char.description,
                  age: char.age,
                  gender: char.gender,
                  actor: char.actor,
                  role: char.role,
                  relationship: char.relationship,
                  displayOrder: char.display_order
                }))
              : [], // Empty array if no structured characters data
            
            // Business information
            budgetRange: pitch.budget_range,
            budgetBracket: pitch.budget_bracket,
            estimatedBudget: pitch.estimated_budget ? parseFloat(pitch.estimated_budget) : null,
            stage: pitch.stage,
            productionStage: pitch.production_stage,
            productionTimeline: pitch.production_timeline,
            seekingInvestment: pitch.seekingInvestment,
            
            // Media assets
            posterUrl: pitch.posterUrl,
            videoUrl: pitch.videoUrl,
            pitchDeckUrl: pitch.pitchDeckUrl,
            titleImage: pitch.titleImage,
            lookbookUrl: pitch.lookbookUrl,
            scriptUrl: pitch.scriptUrl,
            trailerUrl: pitch.trailerUrl,
            additionalMaterials: pitch.additional_materials,
            additionalMedia: pitch.additional_media,
            
            // Documents (based on access level)
            documents: documentsResults.map(doc => ({
              id: doc.id,
              fileName: doc.file_name,
              originalFileName: doc.original_file_name,
              fileType: doc.file_type,
              documentType: doc.document_type,
              fileSize: doc.file_size,
              isPublic: doc.is_public,
              requiresNda: doc.requires_nda,
              uploadedAt: doc.uploaded_at?.toISOString ? doc.uploaded_at.toISOString() : doc.uploaded_at,
              downloadCount: doc.download_count,
              downloadUrl: hasNdaAccess && doc.file_url ? doc.file_url : null
            })),
            
            // Privacy and access
            visibility: pitch.visibility,
            visibilitySettings: pitch.visibility_settings,
            requireNda: pitch.requireNda,
            ndaStats: {
              totalRequests: parseInt(ndaStats.total_nda_requests) || 0,
              approvedNdas: parseInt(ndaStats.approved_ndas) || 0,
              pendingNdas: parseInt(ndaStats.pending_ndas) || 0
            },
            
            // Engagement metrics
            viewCount: pitch.viewCount || 0,
            likeCount: pitch.likeCount || 0,
            commentCount: pitch.commentCount || 0,
            shareCount: pitch.shareCount || 0,
            ndaCount: pitch.ndaCount || 0,
            
            // Analytics (30-day summary)
            analytics: {
              uniqueViewers: parseInt(analytics.unique_viewers) || 0,
              totalViews: parseInt(analytics.total_views) || 0,
              avgViewDuration: parseFloat(analytics.avg_view_duration) || 0,
              watchClicks: parseInt(analytics.watch_clicks) || 0,
              interestedInvestors: parseInt(investmentStats.interested_investors) || 0,
              watchlistAdds: parseInt(investmentStats.watchlist_adds) || 0
            },
            
            // Creator information
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username,
              firstName: pitch.first_name,
              lastName: pitch.last_name,
              displayName: pitch.first_name && pitch.last_name 
                ? `${pitch.first_name} ${pitch.last_name}` 
                : pitch.creator_username,
              bio: pitch.creator_bio,
              location: pitch.creator_location,
              website: pitch.creator_website,
              profileImage: pitch.creatorProfileImage,
              company: pitch.creatorCompany
            },
            
            // AI disclosure
            aiUsed: pitch.aiUsed || false,
            aiTools: pitch.aiTools || [],
            aiDisclosure: pitch.aiDisclosure,
            
            // Metadata
            feedback: pitch.feedback || [],
            tags: pitch.tags || [],
            metadata: pitch.metadata || {},
            status: pitch.status,
            
            // Timestamps
            createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
            updatedAt: pitch.updatedAt?.toISOString ? pitch.updatedAt.toISOString() : pitch.updatedAt,
            publishedAt: pitch.publishedAt?.toISOString ? pitch.publishedAt.toISOString() : pitch.publishedAt,
            
            // Related content
            relatedPitches: relatedResults.map(related => ({
              id: related.id,
              title: related.title,
              logline: related.logline,
              genre: related.genre,
              posterUrl: related.posterUrl,
              viewCount: related.viewCount || 0
            }))
          };

          console.log(`Successfully loaded comprehensive pitch ${pitchIdentifier}`);
          
          // Cache control headers for performance
          const cacheHeaders = {
            'Cache-Control': 'public, max-age=300', // 5 minutes cache
            'ETag': `"pitch-${pitch.id}-${pitch.updatedAt}"`,
            'Last-Modified': new Date(pitch.updatedAt).toUTCString()
          };
          
          return new Response(JSON.stringify({
            success: true,
            pitch: comprehensivePitch,
            data: comprehensivePitch, // Some frontends expect 'data' field
            message: `Comprehensive pitch data for ${pitchIdentifier} loaded successfully`,
            access: {
              level: hasNdaAccess ? 'full' : 'public',
              authenticated: !!currentUser,
              ndaAccess: hasNdaAccess,
              userType: currentUser?.user_type || 'anonymous'
            },
            cached: false,
            analytics: true
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders,
              ...cacheHeaders
            }
          });
          
        } catch (error) {
          console.error('Comprehensive pitch endpoint error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'pitch-comprehensive', identifier: pathname }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load comprehensive pitch data',
            error_name: error instanceof Error ? error.name : 'Unknown',
            error_details: 'Unable to retrieve complete pitch information'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle browse endpoints for marketplace functionality
      if (pathname.startsWith('/api/pitches/browse/')) {
        try {
          const browseType = pathname.split('/').pop(); // 'enhanced' or 'general'
          const sort = url.searchParams.get('sort') || 'date';
          const order = url.searchParams.get('order') || 'desc';
          const limit = parseInt(url.searchParams.get('limit') || '24', 10);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);
          const genre = url.searchParams.get('genre');
          const format = url.searchParams.get('format');
          
          console.log(`Loading ${browseType} browse pitches with filters - genre: ${genre}, format: ${format}...`);
          
          // Use direct connection (Hyperdrive has issues)
          const { neon } = await import('@neondatabase/serverless');
          const connectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          const sql = neon(connectionString);
          
          console.log(`Executing browse query with sort: ${sort}, order: ${order}...`);
          
          // Build base query with filters
          let baseQuery = `
            SELECT 
              p.id, p.title, p.logline, p.genre, p.format,
              p.view_count as "viewCount", p.like_count as "likeCount",
              p.poster_url as "posterUrl", p.created_at as "createdAt",
              p.status, p.visibility,
              u.username as creator_username, u.id as creator_id
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
          `;
          
          // Add filters
          if (genre) {
            baseQuery += ` AND p.genre = '${genre}'`;
          }
          
          if (format) {
            baseQuery += ` AND p.format = '${format}'`;
          }
          
          // Add ordering and pagination
          let orderClause;
          if (sort === 'views' && order === 'desc') {
            orderClause = ' ORDER BY p.view_count DESC';
          } else if (sort === 'views' && order === 'asc') {
            orderClause = ' ORDER BY p.view_count ASC';
          } else if (sort === 'title' && order === 'asc') {
            orderClause = ' ORDER BY p.title ASC';
          } else if (sort === 'title' && order === 'desc') {
            orderClause = ' ORDER BY p.title DESC';
          } else if (sort === 'date' && order === 'asc') {
            orderClause = ' ORDER BY p.created_at ASC';
          } else {
            orderClause = ' ORDER BY p.created_at DESC';
          }
          
          const finalQuery = baseQuery + orderClause + ` LIMIT ${limit} OFFSET ${offset}`;
          
          // Execute the query using template literal with neon
          let results;
          try {
            // Use neon's template literal format
            results = await sql([finalQuery]);
          } catch (error) {
            console.error('Query error:', error);
            // Fallback to basic query without filtering
            results = await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.format,
                p.view_count as "viewCount", p.like_count as "likeCount",
                p.poster_url as "posterUrl", p.created_at as "createdAt",
                p.status, p.visibility,
                u.username as creator_username, u.id as creator_id
              FROM pitches p
              LEFT JOIN users u ON p.user_id = u.id
              WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
              ORDER BY p.created_at DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `;
          }
          
          console.log('Query executed, mapping results...');
          const pitches = results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount || 0,
            likeCount: pitch.likeCount || 0,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
            status: pitch.status,
            visibility: pitch.visibility,
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username
            }
          }));

          // Get total count for pagination with same filters
          let countQuery = `SELECT COUNT(*) as total FROM pitches p WHERE p.status IN ('published', 'active') AND p.visibility = 'public'`;
          
          if (genre) {
            countQuery += ` AND p.genre = '${genre}'`;
          }
          
          if (format) {
            countQuery += ` AND p.format = '${format}'`;
          }
          
          let countResult;
          try {
            countResult = await sql([countQuery]);
          } catch (error) {
            console.error('Count query error:', error);
            countResult = await sql`SELECT COUNT(*) as total FROM pitches p WHERE p.status IN ('published', 'active') AND p.visibility = 'public'`;
          }
          const total = parseInt(countResult[0]?.total || '0', 10);

          console.log(`Successfully loaded ${pitches.length} ${browseType} pitches`);
          return new Response(JSON.stringify({
            success: true,
            items: pitches,
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + limit < total
            },
            sort: { by: sort, order },
            message: `Found ${pitches.length} ${browseType} pitches`
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Browse pitches error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'browse-pitches' }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load browse pitches',
            error_name: error instanceof Error ? error.name : 'Unknown'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle health endpoint
      if (pathname === '/api/health') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Pitchey API - Direct endpoints active',
          architecture: 'simplified',
          services: {
            database: 'direct-connection',
            hyperdrive: 'bypassed-due-to-530-errors'
          },
          optimizations: {
            cors: 'enabled',
            sentry: 'enabled',
            direct_database: 'enabled'
          },
          endpoints: ['/api/simple-test', '/api/db-test', '/api/pitches/trending', '/api/pitches/new', '/api/pitches/public', '/api/pitches/{id}', '/api/pitches/browse/enhanced', '/api/pitches/browse/general'],
          timestamp: new Date().toISOString()
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // === AUTHENTICATION ENDPOINTS ===
      
      // Portal-specific login endpoints
      if (pathname === '/api/auth/creator/login' && request.method === 'POST') {
        try {
          const validationResult = await validateRequest(request, ["email", "password"]);
          if (!validationResult.success) {
            return validationResult.error!;
          }

          const { email, password } = validationResult.data;
          const demoAccount = demoAccounts.creator;
          
          if (email === demoAccount.email && password === demoAccount.password) {
            const JWT_SECRET = env.JWT_SECRET || 'fallback-secret-key';
            const token = await createSimpleJWT({
              userId: demoAccount.id, 
              email: demoAccount.email, 
              userType: "creator",
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            }, JWT_SECRET);

            return jsonResponse({
              success: true,
              data: {
                token,
                user: demoAccount
              },
              message: "Creator login successful"
            });
          }

          return authErrorResponse("Invalid creator credentials");
        } catch (error) {
          return serverErrorResponse("Creator login failed");
        }
      }

      if (pathname === '/api/auth/investor/login' && request.method === 'POST') {
        try {
          const validationResult = await validateRequest(request, ["email", "password"]);
          if (!validationResult.success) {
            return validationResult.error!;
          }

          const { email, password } = validationResult.data;
          const demoAccount = demoAccounts.investor;
          
          if (email === demoAccount.email && password === demoAccount.password) {
            const JWT_SECRET = env.JWT_SECRET || 'fallback-secret-key';
            const token = await createSimpleJWT({
              userId: demoAccount.id, 
              email: demoAccount.email, 
              userType: "investor",
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            }, JWT_SECRET);

            return jsonResponse({
              success: true,
              data: {
                token,
                user: demoAccount
              },
              message: "Investor login successful"
            });
          }

          return authErrorResponse("Invalid investor credentials");
        } catch (error) {
          return serverErrorResponse("Investor login failed");
        }
      }

      if (pathname === '/api/auth/production/login' && request.method === 'POST') {
        try {
          const validationResult = await validateRequest(request, ["email", "password"]);
          if (!validationResult.success) {
            return validationResult.error!;
          }

          const { email, password } = validationResult.data;
          const demoAccount = demoAccounts.production;
          
          if (email === demoAccount.email && password === demoAccount.password) {
            const JWT_SECRET = env.JWT_SECRET || 'fallback-secret-key';
            const token = await createSimpleJWT({
              userId: demoAccount.id, 
              email: demoAccount.email, 
              userType: "production",
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            }, JWT_SECRET);

            return jsonResponse({
              success: true,
              data: {
                token,
                user: demoAccount
              },
              message: "Production login successful"
            });
          }

          return authErrorResponse("Invalid production credentials");
        } catch (error) {
          return serverErrorResponse("Production login failed");
        }
      }

      // ============ LOGOUT ENDPOINT ============
      
      // Universal logout endpoint (works for all user types)
      if (pathname === '/api/auth/logout' && request.method === 'POST') {
        try {
          // Optional: Verify token is valid before logout
          const auth = await authenticateRequest(request, env);
          
          // For client-side logout, we just return success
          // Token invalidation happens client-side by removing from localStorage
          return jsonResponse({
            success: true,
            message: "Logout successful",
            data: {
              redirectUrl: "/login",
              timestamp: new Date().toISOString()
            }
          });
        } catch (error) {
          // Even if token verification fails, allow logout to proceed
          return jsonResponse({
            success: true,
            message: "Logout completed",
            data: {
              redirectUrl: "/login",
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      // ============ DASHBOARD ENDPOINTS (Authenticated) ============

      // Creator Dashboard
      if (pathname === '/api/creator/dashboard' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        if (auth.user.userType !== 'creator') {
          return jsonResponse({
            success: false,
            message: 'Access denied: Creator access required'
          }, 403);
        }

        return jsonResponse({
          success: true,
          data: {
            stats: {
              totalPitches: 3,
              viewsThisMonth: 1250,
              likesThisMonth: 45,
              ndaRequests: 2
            },
            recentActivity: [
              { type: 'view', pitch: 'Neon Dreams', user: 'john_investor', timestamp: Date.now() - 3600000 },
              { type: 'like', pitch: 'Space Opera', user: 'sarah_prod', timestamp: Date.now() - 7200000 }
            ],
            trending: {
              bestPerforming: { title: 'Neon Dreams', views: 850, growth: '+25%' }
            }
          }
        });
      }

      // User Profile
      if (pathname === '/api/profile' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        return jsonResponse({
          success: true,
          data: {
            user: {
              id: auth.user.id,
              username: auth.user.username,
              email: auth.user.email,
              userType: auth.user.userType,
              companyName: auth.user.companyName,
              bio: `Professional ${auth.user.userType} with 5+ years experience`,
              location: 'Los Angeles, CA',
              website: `https://${auth.user.username}.com`,
              profileImageUrl: null,
              followerCount: 120,
              followingCount: 85,
              pitchCount: auth.user.userType === 'creator' ? 3 : 0
            }
          }
        });
      }

      // Follow Stats
      if (pathname.startsWith('/api/follows/stats/') && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const userId = pathname.split('/').pop();
        return jsonResponse({
          success: true,
          data: {
            followStats: {
              followers: 120,
              following: 85,
              isFollowing: false
            }
          }
        });
      }

      // Payment Credits Balance
      if (pathname === '/api/payments/credits/balance' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        return jsonResponse({
          success: true,
          data: {
            balance: 250.00,
            currency: 'USD',
            lastUpdated: new Date().toISOString()
          }
        });
      }

      // Subscription Status
      if (pathname === '/api/payments/subscription-status' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        return jsonResponse({
          success: true,
          data: {
            subscription: {
              tier: 'pro',
              status: 'active',
              nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              features: ['unlimited_pitches', 'advanced_analytics', 'priority_support']
            }
          }
        });
      }

      // Pending NDAs
      if (pathname === '/api/nda/pending' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const pendingNdas = auth.user.userType === 'creator' ? [
          {
            id: 1,
            pitchId: 1,
            pitchTitle: 'Neon Dreams',
            requesterId: 2,
            requesterName: 'Sarah Investor',
            requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending'
          }
        ] : [];

        return jsonResponse({
          success: true,
          data: {
            ndaRequests: pendingNdas,
            total: pendingNdas.length
          }
        });
      }

      // Active NDAs
      if (pathname === '/api/nda/active' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const activeNdas = auth.user.userType === 'creator' ? [
          {
            id: 2,
            pitchId: 2,
            pitchTitle: 'Space Opera',
            requesterId: 16,
            requesterName: 'Stellar Production',
            signedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
          }
        ] : [];

        return jsonResponse({
          success: true,
          data: {
            activeNdas: activeNdas,
            total: activeNdas.length
          }
        });
      }

      // Unread Notifications
      if (pathname === '/api/notifications/unread' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const notifications = [
          {
            id: 1,
            type: 'nda_request',
            title: 'New NDA Request',
            message: 'Sarah Investor has requested access to your pitch "Neon Dreams"',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            read: false
          },
          {
            id: 2,
            type: 'pitch_view',
            title: 'Pitch Viewed',
            message: 'Your pitch "Space Opera" was viewed by John Producer',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            read: false
          }
        ];

        return jsonResponse({
          success: true,
          data: {
            notifications: notifications,
            unreadCount: notifications.filter(n => !n.read).length,
            total: notifications.length
          }
        });
      }

      // User Analytics (monthly preset)
      if (pathname === '/api/analytics/user' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const preset = url.searchParams.get('preset') || 'month';
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        
        // Generate sample daily data
        const dailyViews = Array.from({length: daysInMonth}, (_, i) => ({
          date: new Date(now.getFullYear(), now.getMonth(), i + 1).toISOString().split('T')[0],
          views: Math.floor(Math.random() * 50) + 10,
          likes: Math.floor(Math.random() * 15) + 2
        }));

        return jsonResponse({
          success: true,
          data: {
            period: preset,
            analytics: {
              totalViews: dailyViews.reduce((sum, day) => sum + day.views, 0),
              totalLikes: dailyViews.reduce((sum, day) => sum + day.likes, 0),
              avgViewsPerDay: Math.round(dailyViews.reduce((sum, day) => sum + day.views, 0) / daysInMonth),
              chartData: dailyViews,
              topPitches: [
                { title: 'Neon Dreams', views: 450, likes: 28 },
                { title: 'Space Opera', views: 380, likes: 22 },
                { title: 'Digital Hearts', views: 295, likes: 15 }
              ]
            }
          }
        });
      }

      // Dashboard Analytics (monthly preset)  
      if (pathname === '/api/analytics/dashboard' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const preset = url.searchParams.get('preset') || 'month';

        return jsonResponse({
          success: true,
          data: {
            period: preset,
            summary: {
              totalPitches: auth.user.userType === 'creator' ? 3 : 0,
              totalViews: 1250,
              totalLikes: 65,
              totalComments: 18,
              ndaRequests: 2,
              activeInvestments: auth.user.userType === 'investor' ? 4 : 0
            },
            growth: {
              viewsGrowth: '+15%',
              likesGrowth: '+8%',
              engagementGrowth: '+12%'
            },
            recentActivity: [
              {
                type: 'pitch_view',
                description: 'Your pitch "Neon Dreams" was viewed',
                timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
              },
              {
                type: 'nda_request',
                description: 'New NDA request from Sarah Investor',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
              }
            ]
          }
        });
      }

      // Fallback for unhandled routes
      return new Response(JSON.stringify({
        success: false,
        message: 'Endpoint not found',
        architecture: 'simplified',
        available_endpoints: ['/api/simple-test', '/api/db-test', '/api/pitches/trending', '/api/pitches/new', '/api/pitches/public', '/api/pitches/{id}', '/api/pitches/browse/enhanced', '/api/pitches/browse/general', '/api/health', '/api/auth/creator/login', '/api/auth/investor/login', '/api/auth/production/login', '/api/auth/logout', '/api/creator/dashboard', '/api/profile', '/api/follows/stats/{id}', '/api/payments/credits/balance', '/api/payments/subscription-status', '/api/nda/pending', '/api/nda/active', '/api/notifications/unread', '/api/analytics/user', '/api/analytics/dashboard'],
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('Worker error:', error);
      
      sentry.captureException(error as Error, {
        tags: {
          component: 'worker-main',
          phase: 'phase2-services'
        }
      });

      return new Response(JSON.stringify({
        success: false,
        error: { 
          message: 'Internal server error', 
          code: 'WORKER_ERROR' 
        }
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

// Export Durable Object class for Wrangler
export { WebSocketRoom };
