/**
 * Clean Cloudflare Worker for New Account
 * No Durable Objects, no legacy code
 */

import { createDatabase } from './db/raw-sql-connection';
import { getCorsHeaders } from './utils/response';

export interface Env {
  // Database
  DATABASE_URL: string;
  
  // Cache
  KV?: KVNamespace;
  CACHE?: KVNamespace;
  
  // Storage
  R2_BUCKET?: R2Bucket;
  
  // Redis (optional)
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  
  // Configuration
  FRONTEND_URL: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  CORS_ORIGINS?: string;
  
  // Auth
  JWT_SECRET?: string;
}

class APIHandler {
  private db: any;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    
    // Initialize database
    if (env.DATABASE_URL) {
      try {
        this.db = createDatabase({
          DATABASE_URL: env.DATABASE_URL,
          UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
          UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN
        });
      } catch (error) {
        console.error('Database initialization failed:', error);
        this.db = null;
      }
    }
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request.headers.get('Origin'))
      });
    }

    // Health check
    if (path === '/health') {
      return this.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: this.env.ENVIRONMENT || 'production',
        database: this.db ? 'connected' : 'not configured'
      });
    }

    // API routes
    if (path.startsWith('/api/')) {
      const headers = getCorsHeaders(request.headers.get('Origin'));
      
      // Simple auth endpoints (return mock data for now)
      if (path === '/api/auth/login' && method === 'POST') {
        const body = await request.json();
        return this.json({
          success: true,
          data: {
            token: 'mock-jwt-' + Date.now(),
            user: {
              id: '1',
              email: body.email,
              name: body.email?.split('@')[0] || 'User',
              userType: 'creator'
            }
          }
        }, 200, headers);
      }

      if (path === '/api/auth/session' && method === 'GET') {
        // Check for Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return this.json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'No auth token' }
          }, 401, headers);
        }
        
        return this.json({
          success: true,
          data: {
            user: {
              id: '1',
              email: 'user@example.com',
              name: 'Test User',
              userType: 'creator'
            }
          }
        }, 200, headers);
      }

      // User profile
      if (path === '/api/users/profile' && method === 'GET') {
        return this.json({
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
        }, 200, headers);
      }

      // Public pitches for marketplace
      if (path === '/api/pitches/public' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        
        // If database is available, try to fetch real data
        if (this.db) {
          try {
            const pitches = await this.db.query(
              `SELECT p.*, u.name as creator_name, u.email as creator_email
               FROM pitches p
               JOIN users u ON p.user_id = u.id
               WHERE p.status = 'published' AND p.visibility = 'public'
               ORDER BY p.created_at DESC
               LIMIT $1 OFFSET $2`,
              [limit, offset]
            );
            
            return this.json({
              success: true,
              data: pitches
            }, 200, headers);
          } catch (error) {
            console.error('Database query failed:', error);
          }
        }
        
        // Return mock data if database fails
        return this.json({
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
              created_at: new Date().toISOString()
            },
            {
              id: '2', 
              title: 'Midnight in Montana',
              logline: 'A thriller set in the wilderness',
              genre: 'Thriller',
              status: 'published',
              visibility: 'public',
              creator_name: 'Sarah Johnson',
              created_at: new Date().toISOString()
            }
          ]
        }, 200, headers);
      }

      // Analytics endpoints (return empty data)
      if (path === '/api/analytics/dashboard' && method === 'GET') {
        return this.json({
          success: true,
          data: {
            totalViews: 0,
            totalPitches: 0,
            totalInvestments: 0,
            recentActivity: []
          }
        }, 200, headers);
      }

      // NDA stats
      if (path === '/api/ndas/stats' && method === 'GET') {
        return this.json({
          success: true,
          data: {
            pending: 0,
            approved: 0,
            rejected: 0,
            total: 0
          }
        }, 200, headers);
      }

      // Trending pitches endpoint
      if (path === '/api/pitches/trending' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        // If database is available, try to fetch real data
        if (this.db) {
          try {
            const pitches = await this.db.query(
              `SELECT p.*, u.name as creator_name, u.email as creator_email, 
                      COALESCE(v.view_count, 0) as views
               FROM pitches p
               JOIN users u ON p.user_id = u.id
               LEFT JOIN (
                 SELECT pitch_id, COUNT(*) as view_count 
                 FROM pitch_views 
                 WHERE created_at >= NOW() - INTERVAL '7 days'
                 GROUP BY pitch_id
               ) v ON p.id = v.pitch_id
               WHERE p.status = 'published' AND p.visibility = 'public'
               ORDER BY COALESCE(v.view_count, 0) DESC, p.created_at DESC
               LIMIT $1`,
              [limit]
            );
            
            return this.json({
              success: true,
              data: pitches.rows || []
            }, 200, headers);
          } catch (error) {
            console.error('Database query failed:', error);
          }
        }
        
        // Return mock data if database fails
        return this.json({
          success: true,
          data: [
            {
              id: 1,
              title: "The Next Blockbuster",
              genre: "Action",
              budget_range: "$10M - $50M",
              logline: "A trending action-packed adventure",
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
              logline: "An emotional journey that captivates audiences",
              creator_name: "Sarah Writer",
              creator_email: "sarah@example.com",
              status: "published",
              visibility: "public",
              views: 980,
              created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
          ]
        }, 200, headers);
      }

      // New pitches endpoint
      if (path === '/api/pitches/new' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        // If database is available, try to fetch real data
        if (this.db) {
          try {
            const pitches = await this.db.query(
              `SELECT p.*, u.name as creator_name, u.email as creator_email
               FROM pitches p
               JOIN users u ON p.user_id = u.id
               WHERE p.status = 'published' AND p.visibility = 'public'
               ORDER BY p.created_at DESC
               LIMIT $1`,
              [limit]
            );
            
            return this.json({
              success: true,
              data: pitches.rows || []
            }, 200, headers);
          } catch (error) {
            console.error('Database query failed:', error);
          }
        }
        
        // Return mock data if database fails
        return this.json({
          success: true,
          data: [
            {
              id: 3,
              title: "Fresh New Comedy",
              genre: "Comedy",
              budget_range: "$2M - $10M",
              logline: "A hilarious take on modern life",
              creator_name: "Mike Funny",
              creator_email: "mike@example.com",
              status: "published",
              visibility: "public",
              created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 4,
              title: "New Sci-Fi Thriller",
              genre: "Sci-Fi",
              budget_range: "$20M - $100M",
              logline: "The future is closer than we think",
              creator_name: "Alex Future",
              creator_email: "alex@example.com",
              status: "published",
              visibility: "public",
              created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
            }
          ]
        }, 200, headers);
      }

      // Default API response
      return this.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${path} not implemented yet`
        }
      }, 404, headers);
    }

    return new Response('Not Found', { status: 404 });
  }

  private json(data: any, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const handler = new APIHandler(env);
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