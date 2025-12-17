/**
 * Pitchey Production Worker - Neon Serverless Edge
 * Single source of truth for all API endpoints
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, desc, asc, like, sql as sqlTag } from 'drizzle-orm';
import * as schema from './db/schema.ts';

// Environment interface
interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL?: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
}

/**
 * CORS response helper - handles credentials properly
 */
function corsResponse(request: Request, data: any, status = 200): Response {
  const origin = request.headers.get('Origin');
  
  // Allow any Cloudflare Pages subdomain or localhost
  let corsOrigin = '*';
  let allowCredentials = false;
  
  if (origin) {
    if (origin.endsWith('.pitchey.pages.dev') || 
        origin === 'https://pitchey.pages.dev' ||
        origin.startsWith('http://localhost:')) {
      corsOrigin = origin;
      allowCredentials = true;
    }
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };
  
  if (allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers,
    }
  );
}

/**
 * Verify JWT token
 */
async function verifyAuth(request: Request, env: Env): Promise<any | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const isValid = await jwt.verify(token, env.JWT_SECRET);
    if (!isValid) return null;
    
    const decoded = jwt.decode(token);
    return decoded.payload;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        const origin = request.headers.get('Origin');
        let corsOrigin = '*';
        let allowCredentials = false;
        
        if (origin && (
          origin.endsWith('.pitchey.pages.dev') || 
          origin === 'https://pitchey.pages.dev' ||
          origin.startsWith('http://localhost:')
        )) {
          corsOrigin = origin;
          allowCredentials = true;
        }
        
        const headers: Record<string, string> = {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        };
        
        if (allowCredentials) {
          headers['Access-Control-Allow-Credentials'] = 'true';
        }
        
        return new Response(null, { headers });
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Initialize Neon connection
      if (!env.DATABASE_URL) {
        return corsResponse(request, {
          success: false,
          message: 'Database not configured'
        }, 500);
      }

      const sql = neon(env.DATABASE_URL);
      const db = drizzle(sql, { schema });

      // Health check
      if (path === '/health' || path === '/api/health') {
        try {
          await sql`SELECT 1`;
          return corsResponse(request, {
            status: 'healthy',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return corsResponse(request, {
            status: 'unhealthy',
            error: error.message
          }, 500);
        }
      }

      // Public pitches endpoint
      if (path === '/api/pitches/public' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const genre = url.searchParams.get('genre');
        const format = url.searchParams.get('format');
        
        try {
          // Build query conditions
          const conditions = [eq(schema.pitches.status, 'published')];
          if (genre) conditions.push(eq(schema.pitches.genre, genre));
          if (format) conditions.push(eq(schema.pitches.format, format));
          
          // Get pitches with creator info
          const pitches = await db.select({
            id: schema.pitches.id,
            title: schema.pitches.title,
            logline: schema.pitches.logline,
            genre: schema.pitches.genre,
            format: schema.pitches.format,
            status: schema.pitches.status,
            posterUrl: schema.pitches.posterUrl,
            viewCount: schema.pitches.viewCount,
            likeCount: schema.pitches.likeCount,
            createdAt: schema.pitches.createdAt,
            creatorId: schema.users.id,
            creatorUsername: schema.users.username,
            creatorFirstName: schema.users.firstName,
            creatorLastName: schema.users.lastName,
          })
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
          .where(and(...conditions))
          .orderBy(desc(schema.pitches.createdAt))
          .limit(limit)
          .offset(offset);
          
          // Get total count
          const [{ count }] = await db.select({ count: sqlTag`count(*)::int` })
            .from(schema.pitches)
            .where(and(...conditions));
          
          return corsResponse(request, {
            success: true,
            items: pitches.map(p => ({
              id: p.id,
              title: p.title,
              logline: p.logline,
              genre: p.genre,
              format: p.format,
              status: p.status,
              posterUrl: p.posterUrl,
              thumbnail: p.posterUrl,
              viewCount: p.viewCount || 0,
              likeCount: p.likeCount || 0,
              createdAt: p.createdAt,
              creator: {
                id: p.creatorId,
                username: p.creatorUsername,
                name: `${p.creatorFirstName || ''} ${p.creatorLastName || ''}`.trim() || p.creatorUsername
              }
            })),
            total: count || 0,
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil((count || 0) / limit)
          });
        } catch (error) {
          console.error('Error fetching public pitches:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch pitches',
            error: error.message
          }, 500);
        }
      }

      // Trending pitches
      if (path === '/api/pitches/trending' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        
        try {
          const pitches = await db.select({
            id: schema.pitches.id,
            title: schema.pitches.title,
            logline: schema.pitches.logline,
            genre: schema.pitches.genre,
            format: schema.pitches.format,
            status: schema.pitches.status,
            posterUrl: schema.pitches.posterUrl,
            viewCount: schema.pitches.viewCount,
            createdAt: schema.pitches.createdAt,
            creatorUsername: schema.users.username,
          })
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
          .where(eq(schema.pitches.status, 'published'))
          .orderBy(desc(schema.pitches.viewCount))
          .limit(limit);
          
          return corsResponse(request, {
            success: true,
            data: pitches.map(p => ({
              id: p.id,
              title: p.title,
              logline: p.logline,
              genre: p.genre,
              format: p.format,
              posterUrl: p.posterUrl,
              viewCount: p.viewCount || 0,
              createdAt: p.createdAt,
              creator: { username: p.creatorUsername }
            }))
          });
        } catch (error) {
          console.error('Error fetching trending pitches:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch trending pitches'
          }, 500);
        }
      }

      // New pitches
      if (path === '/api/pitches/new' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        
        try {
          const pitches = await db.select({
            id: schema.pitches.id,
            title: schema.pitches.title,
            logline: schema.pitches.logline,
            genre: schema.pitches.genre,
            format: schema.pitches.format,
            status: schema.pitches.status,
            posterUrl: schema.pitches.posterUrl,
            viewCount: schema.pitches.viewCount,
            createdAt: schema.pitches.createdAt,
            creatorUsername: schema.users.username,
          })
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
          .where(eq(schema.pitches.status, 'published'))
          .orderBy(desc(schema.pitches.createdAt))
          .limit(limit);
          
          return corsResponse(request, {
            success: true,
            data: pitches.map(p => ({
              id: p.id,
              title: p.title,
              logline: p.logline,
              genre: p.genre,
              format: p.format,
              posterUrl: p.posterUrl,
              viewCount: p.viewCount || 0,
              createdAt: p.createdAt,
              creator: { username: p.creatorUsername }
            }))
          });
        } catch (error) {
          console.error('Error fetching new pitches:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch new pitches'
          }, 500);
        }
      }

      // Browse general endpoint
      if (path === '/api/pitches/browse/general' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '12');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const sort = url.searchParams.get('sort') || 'date';
        const order = url.searchParams.get('order') || 'desc';
        
        try {
          let orderBy;
          switch (sort) {
            case 'views':
              orderBy = order === 'desc' ? desc(schema.pitches.viewCount) : asc(schema.pitches.viewCount);
              break;
            case 'likes':
              orderBy = order === 'desc' ? desc(schema.pitches.likeCount) : asc(schema.pitches.likeCount);
              break;
            case 'alphabetical':
              orderBy = order === 'desc' ? desc(schema.pitches.title) : asc(schema.pitches.title);
              break;
            case 'date':
            default:
              orderBy = order === 'desc' ? desc(schema.pitches.createdAt) : asc(schema.pitches.createdAt);
          }
          
          const pitches = await db.select()
            .from(schema.pitches)
            .where(eq(schema.pitches.status, 'published'))
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset);
          
          return corsResponse(request, {
            success: true,
            data: pitches,
            items: pitches, // Include both for compatibility
            total: pitches.length
          });
        } catch (error) {
          console.error('Error in browse endpoint:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch pitches'
          }, 500);
        }
      }

      // Auth endpoints
      if (path.startsWith('/api/auth/') && method === 'POST') {
        const pathParts = path.split('/');
        const userType = pathParts[3]; // creator, investor, or production
        const action = pathParts[4]; // login or register
        
        if (action === 'login') {
          const { email, password } = await request.json();
          
          // Get user from database
          const users = await db.select()
            .from(schema.users)
            .where(and(
              eq(schema.users.email, email),
              eq(schema.users.userType, userType)
            ))
            .limit(1);
          
          if (users.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'Invalid credentials'
            }, 401);
          }
          
          const user = users[0];
          
          // Verify password
          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return corsResponse(request, {
              success: false,
              message: 'Invalid credentials'
            }, 401);
          }
          
          // Generate JWT token
          const token = await jwt.sign({
            sub: user.id.toString(),
            email: user.email,
            userType: user.userType,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
          }, env.JWT_SECRET);
          
          return corsResponse(request, {
            success: true,
            data: {
              user: {
                id: user.id,
                email: user.email,
                username: user.username,
                userType: user.userType,
                firstName: user.firstName,
                lastName: user.lastName
              },
              token
            }
          });
        }
      }

      // Default 404
      return corsResponse(request, {
        success: false,
        message: `Endpoint ${method} ${path} not found`
      }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return corsResponse(request, {
        success: false,
        message: 'Internal server error',
        error: error.message
      }, 500);
    }
  }
};