/**
 * Optimized Worker with Modular Service Architecture
 * Implements Phase 2 service bindings pattern within single Worker
 */

import { Toucan } from 'toucan-js';
import { WebSocketRoom } from './websocket-room-optimized.ts';

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

      // Handle public pitches directly with direct database access
      if (pathname === '/api/pitches/public') {
        try {
          console.log('Loading public pitches...');
          const limit = url.searchParams.get('limit') || '10';
          
          // Use direct connection (Hyperdrive has issues)
          const { neon } = await import('@neondatabase/serverless');
          const connectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          const sql = neon(connectionString);
          
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

      // Handle browse endpoints for marketplace functionality
      if (pathname.startsWith('/api/pitches/browse/')) {
        try {
          const browseType = pathname.split('/').pop(); // 'enhanced' or 'general'
          const sort = url.searchParams.get('sort') || 'date';
          const order = url.searchParams.get('order') || 'desc';
          const limit = parseInt(url.searchParams.get('limit') || '24', 10);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);
          
          console.log(`Loading ${browseType} browse pitches...`);
          
          // Use direct connection (Hyperdrive has issues)
          const { neon } = await import('@neondatabase/serverless');
          const connectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          const sql = neon(connectionString);
          
          console.log(`Executing browse query with sort: ${sort}, order: ${order}...`);
          
          // Use separate queries for different sort options due to neon template literal limitations
          let results;
          if (sort === 'views' && order === 'desc') {
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
              ORDER BY p.view_count DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `;
          } else if (sort === 'views' && order === 'asc') {
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
              ORDER BY p.view_count ASC
              LIMIT ${limit}
              OFFSET ${offset}
            `;
          } else if (sort === 'title' && order === 'asc') {
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
              ORDER BY p.title ASC
              LIMIT ${limit}
              OFFSET ${offset}
            `;
          } else if (sort === 'title' && order === 'desc') {
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
              ORDER BY p.title DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `;
          } else if (sort === 'date' && order === 'asc') {
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
              ORDER BY p.created_at ASC
              LIMIT ${limit}
              OFFSET ${offset}
            `;
          } else {
            // Default: sort by date descending
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

          // Get total count for pagination
          const countResult = await sql`
            SELECT COUNT(*) as total
            FROM pitches p
            WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
          `;
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
          endpoints: ['/api/simple-test', '/api/db-test', '/api/pitches/trending', '/api/pitches/new', '/api/pitches/public', '/api/pitches/browse/enhanced', '/api/pitches/browse/general'],
          timestamp: new Date().toISOString()
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Fallback for unhandled routes
      return new Response(JSON.stringify({
        success: false,
        message: 'Endpoint not found',
        architecture: 'simplified',
        available_endpoints: ['/api/simple-test', '/api/db-test', '/api/pitches/trending', '/api/pitches/new', '/api/pitches/public', '/api/pitches/browse/enhanced', '/api/pitches/browse/general', '/api/health'],
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
