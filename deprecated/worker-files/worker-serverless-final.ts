/**
 * Production Worker with Neon Serverless Driver - FINAL VERSION
 * Fixed all column references and endpoint routes
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, gte, desc, asc, like, sql, count, inArray, isNull } from 'drizzle-orm';
import * as schema from './db/schema.ts';

// Configure Neon for Cloudflare Workers
neonConfig.useSecureWebSocket = true;
neonConfig.wsProxy = (host: string) => `wss://${host}/v2/websocket`;
neonConfig.webSocketConstructor = WebSocket;
neonConfig.poolQueryViaFetch = false;
neonConfig.fetchEndpoint = (host: string) => `https://${host}/sql`;

// Environment interface
interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  NOTIFICATION_ROOM?: DurableObjectNamespace;
}

// Global database instance
let globalDb: any = null;
let globalSql: any = null;

/**
 * Initialize database connection
 */
function initializeDatabase(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!globalDb) {
    console.log('Initializing Neon serverless connection...');
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });
    globalSql = sql;
    globalDb = db;
    console.log('Database initialized successfully');
  }

  return { sql: globalSql, db: globalDb };
}

/**
 * Create CORS response helper
 */
function corsResponse(request: Request, data: any, status = 200) {
  const origin = request.headers.get('Origin') || '*';
  return new Response(
    typeof data === 'string' ? data : JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': typeof data === 'string' ? 'text/plain' : 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
      },
    }
  );
}

/**
 * Verify JWT token and extract user
 */
async function verifyAuth(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const isValid = await jwt.verify(token, env.JWT_SECRET || 'default-secret-key');
    if (!isValid) return null;

    const payload = jwt.decode(token);
    return payload.payload as any;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Durable Object exports (required by Cloudflare)
export class WebSocketRoom {
  constructor(state: DurableObjectState, env: Env) {}
  async fetch(request: Request) {
    return new Response('WebSocket room active');
  }
}

export class NotificationRoom {
  constructor(state: DurableObjectState, env: Env) {}
  async fetch(request: Request) {
    return new Response('Notification room active');
  }
}

/**
 * Main worker handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400',
          }
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Initialize database
      if (!globalDb) {
        initializeDatabase(env);
      }

      // ====================
      // HEALTH CHECK
      // ====================
      if (path === '/api/health') {
        const isConnected = await globalSql`SELECT 1 as test`
          .then(() => true)
          .catch(() => false);

        // Count indexes
        const indexCount = await globalSql`
          SELECT COUNT(*) as count 
          FROM pg_indexes 
          WHERE schemaname = 'public'
        `.then(r => r[0]?.count || 0).catch(() => 0);

        return corsResponse(request, {
          status: isConnected ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          version: 'serverless-final-v2.0',
          database: isConnected,
          driver: '@neondatabase/serverless',
          services: {
            database: isConnected,
            cache: !!env.KV,
            redis: !!env.UPSTASH_REDIS_REST_URL,
            websocket: !!env.WEBSOCKET_ROOM,
            r2: !!env.R2_BUCKET,
          },
          indexes: indexCount,
          endpoints: {
            implemented: 30,
            total: 83
          }
        });
      }

      // ====================
      // AUTHENTICATION
      // ====================
      if (path.match(/^\/api\/auth\/(creator|investor|production)\/login$/)) {
        if (method !== 'POST') {
          return corsResponse(request, { success: false, message: 'Method not allowed' }, 405);
        }

        const body = await request.json() as { email: string; password: string };
        const { email, password } = body;

        if (!email || !password) {
          return corsResponse(request, {
            success: false,
            message: 'Email and password are required'
          }, 400);
        }

        const users = await globalDb
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);

        if (!users || users.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Invalid email or password'
          }, 401);
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.passwordHash || user.password);

        if (!validPassword) {
          return corsResponse(request, {
            success: false,
            message: 'Invalid email or password'
          }, 401);
        }

        const token = await jwt.sign(
          {
            id: user.id,
            email: user.email,
            userType: user.userType,
          },
          env.JWT_SECRET || 'default-secret-key'
        );

        const { password: _, passwordHash: __, ...safeUser } = user;

        return corsResponse(request, {
          success: true,
          user: safeUser,
          token,
          message: 'Login successful'
        });
      }

      // ====================
      // DASHBOARDS
      // ====================
      if (path === '/api/creator/dashboard' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        // Get creator's pitches
        const pitches = await globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.userId, user.id))
          .orderBy(desc(schema.pitches.createdAt))
          .limit(10);

        // Get total views for all creator's pitches
        const viewsResult = await globalDb
          .select({ total: count() })
          .from(schema.pitchViews)
          .innerJoin(schema.pitches, eq(schema.pitchViews.pitchId, schema.pitches.id))
          .where(eq(schema.pitches.userId, user.id));

        // Get total saves
        const savesResult = await globalDb
          .select({ total: count() })
          .from(schema.pitchSaves)
          .innerJoin(schema.pitches, eq(schema.pitchSaves.pitchId, schema.pitches.id))
          .where(eq(schema.pitches.userId, user.id));

        // Get NDA requests
        const ndaRequests = await globalDb
          .select()
          .from(schema.ndaRequests)
          .where(eq(schema.ndaRequests.ownerId, user.id))
          .orderBy(desc(schema.ndaRequests.requestedAt))
          .limit(5);

        return corsResponse(request, {
          success: true,
          data: {
            stats: {
              totalPitches: pitches.length,
              totalViews: viewsResult[0]?.total || 0,
              totalSaves: savesResult[0]?.total || 0,
              pendingNDAs: ndaRequests.filter(n => n.status === 'pending').length
            },
            recentPitches: pitches,
            recentNDAs: ndaRequests
          }
        });
      }

      if (path === '/api/investor/dashboard' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        // Get saved pitches
        const savedPitches = await globalDb
          .select({
            pitch: schema.pitches,
            savedAt: schema.pitchSaves.createdAt
          })
          .from(schema.pitchSaves)
          .innerJoin(schema.pitches, eq(schema.pitchSaves.pitchId, schema.pitches.id))
          .where(eq(schema.pitchSaves.userId, user.id))
          .orderBy(desc(schema.pitchSaves.createdAt))
          .limit(10);

        // Get investment history
        const investments = await globalDb
          .select()
          .from(schema.investments)
          .where(eq(schema.investments.investorId, user.id))
          .orderBy(desc(schema.investments.createdAt))
          .limit(10);

        // Get signed NDAs
        const signedNDAs = await globalDb
          .select()
          .from(schema.ndaRequests)
          .where(and(
            eq(schema.ndaRequests.requesterId, user.id),
            eq(schema.ndaRequests.status, 'approved')
          ))
          .orderBy(desc(schema.ndaRequests.respondedAt))
          .limit(5);

        return corsResponse(request, {
          success: true,
          data: {
            stats: {
              savedPitches: savedPitches.length,
              totalInvestments: investments.length,
              signedNDAs: signedNDAs.length,
              activeDeals: investments.filter(i => i.status === 'active').length
            },
            savedPitches: savedPitches.map(sp => sp.pitch),
            recentInvestments: investments,
            signedNDAs
          }
        });
      }

      if (path === '/api/production/dashboard' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        // For now, return placeholder data
        // Production tables need to be created
        return corsResponse(request, {
          success: true,
          data: {
            stats: {
              activeProjects: 0,
              completedProjects: 0,
              totalBudget: 0,
              teamMembers: 0
            },
            projects: [],
            team: []
          }
        });
      }

      // ====================
      // PITCH CRUD
      // ====================
      // Create pitch
      if (path === '/api/pitches' && method === 'POST') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const body = await request.json();
        const newPitch = await globalDb
          .insert(schema.pitches)
          .values({
            ...body,
            userId: user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        return corsResponse(request, {
          success: true,
          data: newPitch[0]
        });
      }

      // Get user's pitches
      if (path === '/api/pitches' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitches = await globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.userId, user.id))
          .orderBy(desc(schema.pitches.createdAt));

        return corsResponse(request, {
          success: true,
          data: pitches
        });
      }

      // Get single pitch
      if (path.match(/^\/api\/pitches\/\d+$/) && method === 'GET') {
        const pitchId = parseInt(path.split('/')[3]);
        
        const pitch = await globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.id, pitchId))
          .limit(1);

        if (!pitch || pitch.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found'
          }, 404);
        }

        // Get view and save counts
        const views = await globalDb
          .select({ count: count() })
          .from(schema.pitchViews)
          .where(eq(schema.pitchViews.pitchId, pitchId));

        const saves = await globalDb
          .select({ count: count() })
          .from(schema.pitchSaves)
          .where(eq(schema.pitchSaves.pitchId, pitchId));

        return corsResponse(request, {
          success: true,
          data: {
            ...pitch[0],
            viewCount: views[0]?.count || 0,
            saveCount: saves[0]?.count || 0
          }
        });
      }

      // Update pitch
      if (path.match(/^\/api\/pitches\/\d+$/) && method === 'PUT') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitchId = parseInt(path.split('/')[3]);
        const body = await request.json();

        const updated = await globalDb
          .update(schema.pitches)
          .set({
            ...body,
            updatedAt: new Date()
          })
          .where(and(
            eq(schema.pitches.id, pitchId),
            eq(schema.pitches.userId, user.id)
          ))
          .returning();

        if (!updated || updated.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found or unauthorized'
          }, 404);
        }

        return corsResponse(request, {
          success: true,
          data: updated[0]
        });
      }

      // Delete pitch
      if (path.match(/^\/api\/pitches\/\d+$/) && method === 'DELETE') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitchId = parseInt(path.split('/')[3]);

        const deleted = await globalDb
          .delete(schema.pitches)
          .where(and(
            eq(schema.pitches.id, pitchId),
            eq(schema.pitches.userId, user.id)
          ))
          .returning();

        if (!deleted || deleted.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found or unauthorized'
          }, 404);
        }

        return corsResponse(request, {
          success: true,
          message: 'Pitch deleted successfully'
        });
      }

      // ====================
      // SAVED PITCHES
      // ====================
      // Save a pitch
      if (path === '/api/saved-pitches' && method === 'POST') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const { pitchId } = await request.json();

        // Check if already saved
        const existing = await globalDb
          .select()
          .from(schema.pitchSaves)
          .where(and(
            eq(schema.pitchSaves.userId, user.id),
            eq(schema.pitchSaves.pitchId, pitchId)
          ))
          .limit(1);

        if (existing && existing.length > 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch already saved'
          }, 400);
        }

        const saved = await globalDb
          .insert(schema.pitchSaves)
          .values({
            userId: user.id,
            pitchId,
            createdAt: new Date()
          })
          .returning();

        return corsResponse(request, {
          success: true,
          data: saved[0]
        });
      }

      // Get saved pitches
      if (path === '/api/saved-pitches' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const savedPitches = await globalDb
          .select({
            pitch: schema.pitches,
            savedAt: schema.pitchSaves.createdAt
          })
          .from(schema.pitchSaves)
          .innerJoin(schema.pitches, eq(schema.pitchSaves.pitchId, schema.pitches.id))
          .where(eq(schema.pitchSaves.userId, user.id))
          .orderBy(desc(schema.pitchSaves.createdAt));

        return corsResponse(request, {
          success: true,
          data: savedPitches
        });
      }

      // Unsave pitch
      if (path.match(/^\/api\/saved-pitches\/\d+$/) && method === 'DELETE') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitchId = parseInt(path.split('/')[3]);

        await globalDb
          .delete(schema.pitchSaves)
          .where(and(
            eq(schema.pitchSaves.userId, user.id),
            eq(schema.pitchSaves.pitchId, pitchId)
          ));

        return corsResponse(request, {
          success: true,
          message: 'Pitch unsaved successfully'
        });
      }

      // ====================
      // NDA SYSTEM
      // ====================
      // Request NDA
      if (path === '/api/nda/request' && method === 'POST') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const { pitchId, message, companyInfo } = await request.json();

        // Get pitch owner
        const pitch = await globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.id, pitchId))
          .limit(1);

        if (!pitch || pitch.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found'
          }, 404);
        }

        // Check existing request
        const existing = await globalDb
          .select()
          .from(schema.ndaRequests)
          .where(and(
            eq(schema.ndaRequests.pitchId, pitchId),
            eq(schema.ndaRequests.requesterId, user.id)
          ))
          .limit(1);

        if (existing && existing.length > 0) {
          return corsResponse(request, {
            success: false,
            message: 'NDA already requested for this pitch'
          }, 400);
        }

        const ndaRequest = await globalDb
          .insert(schema.ndaRequests)
          .values({
            pitchId,
            requesterId: user.id,
            ownerId: pitch[0].userId,
            status: 'pending',
            requestMessage: message,
            companyInfo,
            requestedAt: new Date()
          })
          .returning();

        return corsResponse(request, {
          success: true,
          data: ndaRequest[0]
        });
      }

      // Get NDA requests for a pitch owner
      if (path === '/api/nda/requests' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitchId = url.searchParams.get('pitchId');
        let query = globalDb
          .select()
          .from(schema.ndaRequests)
          .where(eq(schema.ndaRequests.ownerId, user.id));

        if (pitchId) {
          query = query.where(and(
            eq(schema.ndaRequests.ownerId, user.id),
            eq(schema.ndaRequests.pitchId, parseInt(pitchId))
          ));
        }

        const requests = await query.orderBy(desc(schema.ndaRequests.requestedAt));

        return corsResponse(request, {
          success: true,
          data: requests
        });
      }

      // Approve/Reject NDA
      if (path.match(/^\/api\/nda\/(approve|reject)\/\d+$/) && method === 'PUT') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const action = path.includes('approve') ? 'approved' : 'rejected';
        const requestId = parseInt(path.split('/')[4]);
        const body = await request.json() || {};

        const updated = await globalDb
          .update(schema.ndaRequests)
          .set({
            status: action,
            respondedAt: new Date(),
            rejectionReason: action === 'rejected' ? body.reason : null,
            expiresAt: action === 'approved' ? 
              new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : // 90 days
              null
          })
          .where(and(
            eq(schema.ndaRequests.id, requestId),
            eq(schema.ndaRequests.ownerId, user.id)
          ))
          .returning();

        if (!updated || updated.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'NDA request not found or unauthorized'
          }, 404);
        }

        return corsResponse(request, {
          success: true,
          data: updated[0]
        });
      }

      // Get signed NDAs for investor
      if (path === '/api/nda/signed' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const signedNDAs = await globalDb
          .select({
            nda: schema.ndaRequests,
            pitch: schema.pitches
          })
          .from(schema.ndaRequests)
          .innerJoin(schema.pitches, eq(schema.ndaRequests.pitchId, schema.pitches.id))
          .where(and(
            eq(schema.ndaRequests.requesterId, user.id),
            eq(schema.ndaRequests.status, 'approved')
          ))
          .orderBy(desc(schema.ndaRequests.respondedAt));

        return corsResponse(request, {
          success: true,
          data: signedNDAs
        });
      }

      // Check NDA status for a pitch
      if (path === '/api/nda/check' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitchId = url.searchParams.get('pitchId');
        if (!pitchId) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch ID required'
          }, 400);
        }

        const nda = await globalDb
          .select()
          .from(schema.ndaRequests)
          .where(and(
            eq(schema.ndaRequests.pitchId, parseInt(pitchId)),
            eq(schema.ndaRequests.requesterId, user.id)
          ))
          .limit(1);

        return corsResponse(request, {
          success: true,
          hasNDA: nda && nda.length > 0,
          status: nda && nda.length > 0 ? nda[0].status : null
        });
      }

      // NDA stats
      if (path === '/api/nda/stats' && method === 'GET') {
        const user = await verifyAuth(request, env);
        if (!user) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pending = await globalDb
          .select({ count: count() })
          .from(schema.ndaRequests)
          .where(and(
            eq(schema.ndaRequests.ownerId, user.id),
            eq(schema.ndaRequests.status, 'pending')
          ));

        const approved = await globalDb
          .select({ count: count() })
          .from(schema.ndaRequests)
          .where(and(
            eq(schema.ndaRequests.ownerId, user.id),
            eq(schema.ndaRequests.status, 'approved')
          ));

        return corsResponse(request, {
          success: true,
          data: {
            pending: pending[0]?.count || 0,
            approved: approved[0]?.count || 0,
            total: (pending[0]?.count || 0) + (approved[0]?.count || 0)
          }
        });
      }

      // ====================
      // BROWSE & SEARCH
      // ====================
      // Browse enhanced
      if (path === '/api/pitches/browse/enhanced') {
        const genre = url.searchParams.get('genre');
        const format = url.searchParams.get('format');
        const sort = url.searchParams.get('sort') || 'recent';
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = globalDb
          .select({
            id: schema.pitches.id,
            title: schema.pitches.title,
            logline: schema.pitches.logline,
            genre: schema.pitches.genre,
            format: schema.pitches.format,
            status: schema.pitches.status,
            createdAt: schema.pitches.createdAt,
            userId: schema.pitches.userId
          })
          .from(schema.pitches)
          .where(eq(schema.pitches.status, 'published'));

        if (genre) {
          query = query.where(and(
            eq(schema.pitches.status, 'published'),
            eq(schema.pitches.genre, genre)
          ));
        }

        if (format) {
          query = query.where(and(
            eq(schema.pitches.status, 'published'),
            eq(schema.pitches.format, format)
          ));
        }

        // Apply sorting
        if (sort === 'trending') {
          // For now, order by most recent with views
          query = query.orderBy(desc(schema.pitches.createdAt));
        } else {
          query = query.orderBy(desc(schema.pitches.createdAt));
        }

        const pitches = await query.limit(limit).offset(offset);

        // Get view and save counts for each pitch
        const enrichedPitches = await Promise.all(pitches.map(async (pitch) => {
          const views = await globalDb
            .select({ count: count() })
            .from(schema.pitchViews)
            .where(eq(schema.pitchViews.pitchId, pitch.id));

          const saves = await globalDb
            .select({ count: count() })
            .from(schema.pitchSaves)
            .where(eq(schema.pitchSaves.pitchId, pitch.id));

          return {
            ...pitch,
            viewCount: views[0]?.count || 0,
            saveCount: saves[0]?.count || 0
          };
        }));

        return corsResponse(request, {
          success: true,
          data: enrichedPitches,
          total: enrichedPitches.length,
          offset,
          limit
        });
      }

      // Trending pitches
      if (path === '/api/pitches/trending') {
        const pitches = await globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.status, 'published'))
          .orderBy(desc(schema.pitches.createdAt))
          .limit(10);

        return corsResponse(request, {
          success: true,
          data: pitches
        });
      }

      // New releases
      if (path === '/api/pitches/new') {
        const pitches = await globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.status, 'published'))
          .orderBy(desc(schema.pitches.createdAt))
          .limit(10);

        return corsResponse(request, {
          success: true,
          data: pitches
        });
      }

      // Search
      if (path === '/api/search' || path === '/api/pitches/search') {
        const query = url.searchParams.get('q') || '';
        const genre = url.searchParams.get('genre');
        const format = url.searchParams.get('format');

        let searchQuery = globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.status, 'published'));

        if (query) {
          searchQuery = searchQuery.where(and(
            eq(schema.pitches.status, 'published'),
            or(
              like(schema.pitches.title, `%${query}%`),
              like(schema.pitches.logline, `%${query}%`),
              like(schema.pitches.description, `%${query}%`)
            )
          ));
        }

        if (genre) {
          searchQuery = searchQuery.where(and(
            eq(schema.pitches.status, 'published'),
            eq(schema.pitches.genre, genre)
          ));
        }

        if (format) {
          searchQuery = searchQuery.where(and(
            eq(schema.pitches.status, 'published'),
            eq(schema.pitches.format, format)
          ));
        }

        const results = await searchQuery
          .orderBy(desc(schema.pitches.createdAt))
          .limit(50);

        return corsResponse(request, {
          success: true,
          data: results,
          total: results.length
        });
      }

      // Featured pitches
      if (path === '/api/pitches/featured') {
        const featured = await globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.status, 'published'))
          .orderBy(desc(schema.pitches.createdAt))
          .limit(6);

        return corsResponse(request, {
          success: true,
          data: featured
        });
      }

      // ====================
      // CONFIG ENDPOINTS
      // ====================
      if (path === '/api/config/genres') {
        return corsResponse(request, {
          success: true,
          data: [
            'Action', 'Adventure', 'Animation', 'Biography', 'Comedy',
            'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy',
            'Film Noir', 'History', 'Horror', 'Music', 'Musical',
            'Mystery', 'Romance', 'Sci-Fi', 'Sport', 'Superhero',
            'Thriller', 'War', 'Western'
          ]
        });
      }

      if (path === '/api/config/formats') {
        return corsResponse(request, {
          success: true,
          data: [
            'Feature Film', 'Short Film', 'TV Series', 'Limited Series',
            'Web Series', 'Documentary', 'Animation', 'Experimental'
          ]
        });
      }

      // Default 404 response
      return corsResponse(request, {
        success: false,
        message: `Endpoint not found: ${path}`,
        method,
        availableEndpoints: [
          '/api/health',
          '/api/auth/*/login',
          '/api/creator/dashboard',
          '/api/investor/dashboard',
          '/api/production/dashboard',
          '/api/pitches (CRUD)',
          '/api/pitches/browse/enhanced',
          '/api/pitches/trending',
          '/api/pitches/new',
          '/api/pitches/featured',
          '/api/pitches/search',
          '/api/search',
          '/api/saved-pitches',
          '/api/nda/request',
          '/api/nda/requests',
          '/api/nda/approve/:id',
          '/api/nda/reject/:id',
          '/api/nda/signed',
          '/api/nda/check',
          '/api/nda/stats',
          '/api/config/genres',
          '/api/config/formats'
        ]
      }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return corsResponse(request, {
        success: false,
        message: 'Internal server error',
        error: error.message
      }, 500);
    }
  },
};