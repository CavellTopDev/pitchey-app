/**
 * Production Worker with Neon Serverless Driver - Complete Implementation
 * Includes all core endpoints migrated from production
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, gte, lte, desc, asc, like, sql, count, inArray, isNull, not } from 'drizzle-orm';
import * as schema from './db/schema.ts';
import { Redis } from '@upstash/redis/cloudflare';

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
  SENDGRID_API_KEY?: string;
}

// Global instances
let globalDb: any = null;
let globalSql: any = null;
let globalRedis: Redis | null = null;

/**
 * Initialize database with Neon serverless driver
 */
function initializeDatabase(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  try {
    console.log('Initializing Neon serverless connection...');
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });
    
    globalSql = sql;
    globalDb = db;
    
    console.log('Neon serverless driver initialized successfully');
    return { sql, db };
  } catch (error) {
    console.error('Failed to initialize Neon serverless driver:', error);
    throw error;
  }
}

/**
 * Initialize Redis cache
 */
function initializeRedis(env: Env): Redis | null {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch (error) {
      console.error('Redis initialization failed:', error);
    }
  }
  return null;
}

/**
 * Test database connectivity
 */
async function testConnection(sql: any): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 as test`;
    return result && result[0]?.test === 1;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

/**
 * CORS headers configuration
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

/**
 * Create CORS response
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
 * Authentication middleware
 */
async function verifyAuth(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.split(' ')[1];
    const isValid = await jwt.verify(token, env.JWT_SECRET || 'default-secret-key');
    if (!isValid) return null;
    
    const payload = jwt.decode(token);
    return payload?.payload || payload;
  } catch (error) {
    return null;
  }
}

/**
 * Cache wrapper for expensive queries
 */
async function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
  redis: Redis | null
): Promise<T> {
  if (!redis) return fn();
  
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached as string);
    
    const result = await fn();
    await redis.set(key, JSON.stringify(result), { ex: ttl });
    return result;
  } catch (error) {
    console.error('Cache error:', error);
    return fn();
  }
}

// Durable Object exports
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
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Initialize services on first request
      if (!globalDb) {
        initializeDatabase(env);
        globalRedis = initializeRedis(env);
      }

      // ============= HEALTH CHECK =============
      if (path === '/api/health') {
        const isConnected = await testConnection(globalSql);
        const redisStatus = globalRedis ? await globalRedis.ping().catch(() => null) : null;
        
        return corsResponse(request, {
          status: isConnected ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          version: 'serverless-complete-v1.0',
          database: isConnected,
          driver: '@neondatabase/serverless',
          services: {
            database: isConnected,
            cache: !!env.KV,
            redis: redisStatus === 'PONG',
            websocket: !!env.WEBSOCKET_ROOM,
            r2: !!env.R2_BUCKET,
          },
          indexes: 274,
        }, isConnected ? 200 : 503);
      }

      // ============= AUTHENTICATION ENDPOINTS =============
      
      // Login endpoints
      if ((path === '/api/auth/creator/login' || 
           path === '/api/auth/investor/login' || 
           path === '/api/auth/production/login') && method === 'POST') {
        
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
        const validPassword = await bcrypt.compare(password, user.passwordHash || user.password_hash || user.password);
        
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
            userType: user.userType || user.user_type,
          },
          env.JWT_SECRET || 'default-secret-key',
          { expiresIn: '7d' }
        );

        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        try {
          await globalDb.insert(schema.sessions).values({
            token: sessionToken,
            userId: user.id,
            expiresAt: expiresAt,
            lastActivity: new Date(),
            createdAt: new Date(),
          });
        } catch (sessionError) {
          console.warn('Session creation failed, continuing:', sessionError);
        }

        await globalDb
          .update(schema.users)
          .set({ lastLoginAt: new Date() })
          .where(eq(schema.users.id, user.id));

        const { password: _, passwordHash: __, password_hash: ___, ...safeUser } = user;
        
        return corsResponse(request, {
          success: true,
          user: safeUser,
          token,
          sessionToken,
          message: 'Login successful'
        });
      }

      // Registration endpoints
      if ((path === '/api/auth/creator/register' || 
           path === '/api/auth/investor/register' || 
           path === '/api/auth/production/register') && method === 'POST') {
        
        const body = await request.json() as { 
          email: string; 
          password: string; 
          name: string;
          company?: string;
        };
        
        const userType = path.includes('creator') ? 'creator' : 
                        path.includes('investor') ? 'investor' : 'production';
        
        const hashedPassword = await bcrypt.hash(body.password, 10);
        
        try {
          const [newUser] = await globalDb.insert(schema.users).values({
            email: body.email,
            passwordHash: hashedPassword,
            firstName: body.name.split(' ')[0],
            lastName: body.name.split(' ').slice(1).join(' '),
            userType: userType,
            companyName: body.company,
            createdAt: new Date(),
            emailVerified: false,
            isActive: true,
          }).returning();

          const token = await jwt.sign(
            {
              id: newUser.id,
              email: newUser.email,
              userType: newUser.userType,
            },
            env.JWT_SECRET,
            { expiresIn: '7d' }
          );

          return corsResponse(request, {
            success: true,
            user: newUser,
            token,
            message: 'Registration successful'
          });
        } catch (error: any) {
          if (error.message?.includes('duplicate')) {
            return corsResponse(request, {
              success: false,
              message: 'Email already registered'
            }, 400);
          }
          throw error;
        }
      }

      // Logout
      if (path === '/api/auth/logout' && method === 'POST') {
        const userPayload = await verifyAuth(request, env);
        if (userPayload) {
          // Invalidate session
          const authHeader = request.headers.get('Authorization');
          const token = authHeader?.split(' ')[1];
          
          if (token && globalRedis) {
            // Add token to blacklist
            await globalRedis.set(`blacklist:${token}`, '1', { ex: 604800 }); // 7 days
          }
        }
        
        return corsResponse(request, {
          success: true,
          message: 'Logged out successfully'
        });
      }

      // ============= BROWSE & SEARCH ENDPOINTS =============
      
      // Enhanced browse with filters
      if (path === '/api/pitches/browse/enhanced' || path === '/api/browse/enhanced') {
        const { searchParams } = url;
        const genre = searchParams.get('genre');
        const format = searchParams.get('format');
        const search = searchParams.get('search');
        const sort = searchParams.get('sort') || 'latest';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        const cacheKey = `browse:${genre}:${format}:${search}:${sort}:${page}`;
        
        const result = await withCache(
          cacheKey,
          300, // 5 minutes cache
          async () => {
            const conditions = [eq(schema.pitches.status, 'published')];
            if (genre) conditions.push(eq(schema.pitches.genre, genre));
            if (format) conditions.push(eq(schema.pitches.format, format));
            if (search) {
              conditions.push(
                or(
                  like(schema.pitches.title, `%${search}%`),
                  like(schema.pitches.logline, `%${search}%`)
                )
              );
            }

            let query = globalDb
              .select({
                id: schema.pitches.id,
                title: schema.pitches.title,
                logline: schema.pitches.logline,
                genre: schema.pitches.genre,
                format: schema.pitches.format,
                status: schema.pitches.status,
                createdAt: schema.pitches.createdAt,
                viewCount: schema.pitches.viewCount,
                saveCount: schema.pitches.saveCount,
                creatorId: schema.pitches.creatorId,
                creator: {
                  id: schema.users.id,
                  firstName: schema.users.firstName,
                  lastName: schema.users.lastName,
                  companyName: schema.users.companyName,
                },
              })
              .from(schema.pitches)
              .leftJoin(schema.users, eq(schema.pitches.creatorId, schema.users.id))
              .where(and(...conditions));

            // Apply sorting
            switch (sort) {
              case 'trending':
                query = query.orderBy(desc(schema.pitches.viewCount));
                break;
              case 'most-saved':
                query = query.orderBy(desc(schema.pitches.saveCount));
                break;
              case 'latest':
              default:
                query = query.orderBy(desc(schema.pitches.createdAt));
            }

            const [pitches, countResult] = await Promise.all([
              query.limit(limit).offset(offset),
              globalDb.select({ count: count() })
                .from(schema.pitches)
                .where(and(...conditions))
            ]);

            return {
              success: true,
              data: pitches,
              total: countResult[0]?.count || 0,
              page,
              totalPages: Math.ceil((countResult[0]?.count || 0) / limit)
            };
          },
          globalRedis
        );

        return corsResponse(request, result);
      }

      // Trending pitches
      if (path === '/api/pitches/trending' && method === 'GET') {
        const result = await withCache(
          'pitches:trending',
          600, // 10 minutes cache
          async () => {
            const pitches = await globalDb
              .select()
              .from(schema.pitches)
              .where(eq(schema.pitches.status, 'published'))
              .orderBy(desc(schema.pitches.viewCount))
              .limit(10);

            return { success: true, data: pitches };
          },
          globalRedis
        );

        return corsResponse(request, result);
      }

      // New releases
      if (path === '/api/pitches/new' && method === 'GET') {
        const result = await withCache(
          'pitches:new',
          300, // 5 minutes cache
          async () => {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const pitches = await globalDb
              .select()
              .from(schema.pitches)
              .where(
                and(
                  eq(schema.pitches.status, 'published'),
                  gte(schema.pitches.createdAt, sevenDaysAgo)
                )
              )
              .orderBy(desc(schema.pitches.createdAt))
              .limit(20);

            return { success: true, data: pitches };
          },
          globalRedis
        );

        return corsResponse(request, result);
      }

      // Search endpoint
      if (path === '/api/search' && method === 'GET') {
        const { searchParams } = url;
        const query = searchParams.get('q') || '';
        const type = searchParams.get('type') || 'all';
        
        if (!query) {
          return corsResponse(request, { 
            success: false, 
            message: 'Search query required' 
          }, 400);
        }

        const results = await globalDb
          .select()
          .from(schema.pitches)
          .where(
            and(
              eq(schema.pitches.status, 'published'),
              or(
                like(schema.pitches.title, `%${query}%`),
                like(schema.pitches.logline, `%${query}%`),
                like(schema.pitches.synopsis, `%${query}%`)
              )
            )
          )
          .limit(20);

        return corsResponse(request, {
          success: true,
          data: results,
          query,
          total: results.length
        });
      }

      // ============= AUTHENTICATED ENDPOINTS =============
      const userPayload = await verifyAuth(request, env);

      // ============= DASHBOARD ENDPOINTS =============
      
      // Creator Dashboard
      if (path === '/api/creator/dashboard' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const cacheKey = `dashboard:creator:${userPayload.id}`;
        const result = await withCache(
          cacheKey,
          60, // 1 minute cache
          async () => {
            const [pitchCount, viewStats, saveStats, ndaCount] = await Promise.all([
              globalDb.select({ count: count() })
                .from(schema.pitches)
                .where(eq(schema.pitches.creatorId, userPayload.id)),
              
              globalDb.select({ total: sql`COALESCE(SUM(view_count), 0)` })
                .from(schema.pitches)
                .where(eq(schema.pitches.creatorId, userPayload.id)),
              
              globalDb.select({ total: sql`COALESCE(SUM(save_count), 0)` })
                .from(schema.pitches)
                .where(eq(schema.pitches.creatorId, userPayload.id)),
              
              globalDb.select({ count: count() })
                .from(schema.ndaRequests)
                .leftJoin(schema.pitches, eq(schema.ndaRequests.pitchId, schema.pitches.id))
                .where(eq(schema.pitches.creatorId, userPayload.id))
            ]);

            const recentPitches = await globalDb
              .select()
              .from(schema.pitches)
              .where(eq(schema.pitches.creatorId, userPayload.id))
              .orderBy(desc(schema.pitches.createdAt))
              .limit(5);

            return {
              success: true,
              stats: {
                totalPitches: pitchCount[0]?.count || 0,
                totalViews: Number(viewStats[0]?.total) || 0,
                totalSaves: Number(saveStats[0]?.total) || 0,
                ndaRequests: ndaCount[0]?.count || 0,
              },
              recentPitches,
              lastUpdated: new Date().toISOString()
            };
          },
          globalRedis
        );

        return corsResponse(request, result);
      }

      // Investor Dashboard
      if (path === '/api/investor/dashboard' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'investor') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const cacheKey = `dashboard:investor:${userPayload.id}`;
        const result = await withCache(
          cacheKey,
          60,
          async () => {
            const [savedCount, investmentStats, ndaStats, followCount] = await Promise.all([
              globalDb.select({ count: count() })
                .from(schema.savedPitches)
                .where(eq(schema.savedPitches.userId, userPayload.id)),
              
              globalDb.select({ 
                count: count(),
                total: sql`COALESCE(SUM(amount), 0)`
              })
                .from(schema.investments)
                .where(eq(schema.investments.investorId, userPayload.id)),
              
              globalDb.select({ count: count() })
                .from(schema.ndaRequests)
                .where(eq(schema.ndaRequests.investorId, userPayload.id)),
              
              globalDb.select({ count: count() })
                .from(schema.follows)
                .where(eq(schema.follows.followerId, userPayload.id))
            ]);

            const recentActivity = await globalDb
              .select({
                id: schema.ndaRequests.id,
                type: sql`'nda_request'`,
                createdAt: schema.ndaRequests.createdAt,
                pitch: {
                  id: schema.pitches.id,
                  title: schema.pitches.title
                }
              })
              .from(schema.ndaRequests)
              .leftJoin(schema.pitches, eq(schema.ndaRequests.pitchId, schema.pitches.id))
              .where(eq(schema.ndaRequests.investorId, userPayload.id))
              .orderBy(desc(schema.ndaRequests.createdAt))
              .limit(5);

            return {
              success: true,
              stats: {
                savedPitches: savedCount[0]?.count || 0,
                activeInvestments: investmentStats[0]?.count || 0,
                totalInvested: Number(investmentStats[0]?.total) || 0,
                ndaRequests: ndaStats[0]?.count || 0,
                following: followCount[0]?.count || 0,
              },
              recentActivity,
              lastUpdated: new Date().toISOString()
            };
          },
          globalRedis
        );

        return corsResponse(request, result);
      }

      // Production Dashboard
      if (path === '/api/production/dashboard' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'production') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const cacheKey = `dashboard:production:${userPayload.id}`;
        const result = await withCache(
          cacheKey,
          60,
          async () => {
            const companyId = userPayload.id;

            const [projectCount, budgetStats, teamCount, submissionCount] = await Promise.all([
              globalDb.select({ count: count() })
                .from(schema.productionProjects)
                .where(eq(schema.productionProjects.companyId, companyId)),
              
              globalDb.select({ 
                count: count(),
                total: sql`COALESCE(SUM(budget_allocated), 0)`
              })
                .from(schema.productionProjects)
                .where(eq(schema.productionProjects.companyId, companyId)),
              
              globalDb.select({ count: count() })
                .from(schema.productionTeam)
                .where(eq(schema.productionTeam.companyId, companyId)),
              
              globalDb.select({ count: count() })
                .from(schema.pitches)
                .where(eq(schema.pitches.productionCompanyId, companyId))
            ]);

            const activeProjects = await globalDb
              .select()
              .from(schema.productionProjects)
              .where(
                and(
                  eq(schema.productionProjects.companyId, companyId),
                  eq(schema.productionProjects.status, 'in_production')
                )
              )
              .limit(5);

            return {
              success: true,
              stats: {
                totalProjects: projectCount[0]?.count || 0,
                budgetAllocated: Number(budgetStats[0]?.total) || 0,
                teamSize: teamCount[0]?.count || 0,
                submissions: submissionCount[0]?.count || 0,
              },
              activeProjects,
              lastUpdated: new Date().toISOString()
            };
          },
          globalRedis
        );

        return corsResponse(request, result);
      }

      // ============= PITCH MANAGEMENT =============
      
      // Create pitch
      if (path === '/api/pitches' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const body = await request.json();
        
        const [newPitch] = await globalDb
          .insert(schema.pitches)
          .values({
            ...body,
            creatorId: userPayload.id,
            status: body.status || 'draft',
            createdAt: new Date(),
            updatedAt: new Date(),
            viewCount: 0,
            saveCount: 0,
          })
          .returning();

        // Invalidate cache
        if (globalRedis) {
          await globalRedis.del(`creator:pitches:${userPayload.id}`);
          await globalRedis.del('pitches:new');
        }

        return corsResponse(request, {
          success: true,
          data: newPitch,
          message: 'Pitch created successfully'
        });
      }

      // Get user's pitches
      if (path === '/api/creator/pitches' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitches = await globalDb
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.creatorId, userPayload.id))
          .orderBy(desc(schema.pitches.createdAt));

        return corsResponse(request, {
          success: true,
          data: pitches
        });
      }

      // Update pitch
      if (path.match(/^\/api\/pitches\/\d+$/) && method === 'PUT') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitchId = parseInt(path.split('/').pop()!);
        const body = await request.json();

        // Verify ownership
        const [pitch] = await globalDb
          .select()
          .from(schema.pitches)
          .where(
            and(
              eq(schema.pitches.id, pitchId),
              eq(schema.pitches.creatorId, userPayload.id)
            )
          )
          .limit(1);

        if (!pitch) {
          return corsResponse(request, { success: false, message: 'Pitch not found' }, 404);
        }

        const [updated] = await globalDb
          .update(schema.pitches)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(schema.pitches.id, pitchId))
          .returning();

        // Invalidate cache
        if (globalRedis) {
          await globalRedis.del(`pitch:${pitchId}`);
          await globalRedis.del(`creator:pitches:${userPayload.id}`);
        }

        return corsResponse(request, {
          success: true,
          data: updated,
          message: 'Pitch updated successfully'
        });
      }

      // Delete pitch
      if (path.match(/^\/api\/pitches\/\d+$/) && method === 'DELETE') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const pitchId = parseInt(path.split('/').pop()!);

        // Verify ownership
        const [pitch] = await globalDb
          .select()
          .from(schema.pitches)
          .where(
            and(
              eq(schema.pitches.id, pitchId),
              eq(schema.pitches.creatorId, userPayload.id)
            )
          )
          .limit(1);

        if (!pitch) {
          return corsResponse(request, { success: false, message: 'Pitch not found' }, 404);
        }

        await globalDb
          .delete(schema.pitches)
          .where(eq(schema.pitches.id, pitchId));

        // Invalidate cache
        if (globalRedis) {
          await globalRedis.del(`pitch:${pitchId}`);
          await globalRedis.del(`creator:pitches:${userPayload.id}`);
        }

        return corsResponse(request, {
          success: true,
          message: 'Pitch deleted successfully'
        });
      }

      // Get single pitch
      if (path.match(/^\/api\/pitches\/\d+$/) && method === 'GET') {
        const pitchId = parseInt(path.split('/').pop()!);
        
        const cacheKey = `pitch:${pitchId}`;
        const result = await withCache(
          cacheKey,
          300,
          async () => {
            const [pitch] = await globalDb
              .select()
              .from(schema.pitches)
              .where(eq(schema.pitches.id, pitchId))
              .limit(1);

            if (!pitch) {
              return null;
            }

            // Increment view count (non-blocking)
            ctx.waitUntil(
              globalDb
                .update(schema.pitches)
                .set({ viewCount: sql`view_count + 1` })
                .where(eq(schema.pitches.id, pitchId))
            );

            return { success: true, data: pitch };
          },
          globalRedis
        );

        if (!result) {
          return corsResponse(request, { success: false, message: 'Pitch not found' }, 404);
        }

        return corsResponse(request, result);
      }

      // ============= SAVED PITCHES =============
      
      // Toggle save pitch
      if (path === '/api/saved-pitches' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const { pitch_id } = await request.json();

        // Check if already saved
        const existing = await globalDb
          .select()
          .from(schema.savedPitches)
          .where(
            and(
              eq(schema.savedPitches.pitchId, pitch_id),
              eq(schema.savedPitches.userId, userPayload.id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Remove from saved
          await globalDb
            .delete(schema.savedPitches)
            .where(
              and(
                eq(schema.savedPitches.pitchId, pitch_id),
                eq(schema.savedPitches.userId, userPayload.id)
              )
            );

          // Update save count
          await globalDb
            .update(schema.pitches)
            .set({ saveCount: sql`GREATEST(save_count - 1, 0)` })
            .where(eq(schema.pitches.id, pitch_id));

          return corsResponse(request, {
            success: true,
            saved: false,
            message: 'Removed from saved pitches'
          });
        } else {
          // Add to saved
          await globalDb
            .insert(schema.savedPitches)
            .values({
              pitchId: pitch_id,
              userId: userPayload.id,
              createdAt: new Date(),
            });

          // Update save count
          await globalDb
            .update(schema.pitches)
            .set({ saveCount: sql`save_count + 1` })
            .where(eq(schema.pitches.id, pitch_id));

          return corsResponse(request, {
            success: true,
            saved: true,
            message: 'Added to saved pitches'
          });
        }
      }

      // Get saved pitches
      if ((path === '/api/saved-pitches' || path === '/api/investor/saved-pitches') && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const savedPitches = await globalDb
          .select({
            id: schema.savedPitches.id,
            pitch: schema.pitches,
            savedAt: schema.savedPitches.createdAt,
          })
          .from(schema.savedPitches)
          .leftJoin(schema.pitches, eq(schema.savedPitches.pitchId, schema.pitches.id))
          .where(eq(schema.savedPitches.userId, userPayload.id))
          .orderBy(desc(schema.savedPitches.createdAt));

        return corsResponse(request, {
          success: true,
          data: savedPitches
        });
      }

      // ============= NDA ENDPOINTS =============
      
      // Request NDA
      if (path === '/api/nda/request' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const body = await request.json() as { pitchId: number; message?: string };
        
        // Check if NDA request already exists
        const existing = await globalDb
          .select()
          .from(schema.ndaRequests)
          .where(
            and(
              eq(schema.ndaRequests.pitchId, body.pitchId),
              eq(schema.ndaRequests.investorId, userPayload.id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return corsResponse(request, {
            success: false,
            message: 'NDA request already exists',
            existingRequest: existing[0]
          }, 409);
        }

        const [newRequest] = await globalDb
          .insert(schema.ndaRequests)
          .values({
            pitchId: body.pitchId,
            investorId: userPayload.id,
            status: 'pending',
            message: body.message,
            createdAt: new Date(),
          })
          .returning();

        // Invalidate cache
        if (globalRedis) {
          await globalRedis.del(`nda:pending:${userPayload.id}`);
        }

        return corsResponse(request, {
          success: true,
          data: newRequest,
          message: 'NDA request submitted successfully'
        });
      }

      // Get NDA stats
      if (path === '/api/nda/stats' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const [pending, approved, rejected] = await Promise.all([
          globalDb.select({ count: count() })
            .from(schema.ndaRequests)
            .where(
              and(
                eq(schema.ndaRequests.investorId, userPayload.id),
                eq(schema.ndaRequests.status, 'pending')
              )
            ),
          
          globalDb.select({ count: count() })
            .from(schema.ndaRequests)
            .where(
              and(
                eq(schema.ndaRequests.investorId, userPayload.id),
                eq(schema.ndaRequests.status, 'approved')
              )
            ),
          
          globalDb.select({ count: count() })
            .from(schema.ndaRequests)
            .where(
              and(
                eq(schema.ndaRequests.investorId, userPayload.id),
                eq(schema.ndaRequests.status, 'rejected')
              )
            ),
        ]);

        return corsResponse(request, {
          success: true,
          stats: {
            pending: pending[0]?.count || 0,
            approved: approved[0]?.count || 0,
            rejected: rejected[0]?.count || 0,
            total: (pending[0]?.count || 0) + (approved[0]?.count || 0) + (rejected[0]?.count || 0)
          }
        });
      }

      // Approve NDA
      if (path.match(/^\/api\/nda\/\d+\/approve$/) && method === 'PUT') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const ndaId = parseInt(path.split('/')[3]);
        
        const [updated] = await globalDb
          .update(schema.ndaRequests)
          .set({ 
            status: 'approved',
            approvedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.ndaRequests.id, ndaId))
          .returning();

        if (!updated) {
          return corsResponse(request, { success: false, message: 'NDA request not found' }, 404);
        }

        return corsResponse(request, {
          success: true,
          data: updated,
          message: 'NDA approved successfully'
        });
      }

      // Reject NDA
      if (path.match(/^\/api\/nda\/\d+\/reject$/) && method === 'PUT') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const ndaId = parseInt(path.split('/')[3]);
        const body = await request.json() as { reason?: string };
        
        const [updated] = await globalDb
          .update(schema.ndaRequests)
          .set({ 
            status: 'rejected',
            rejectionReason: body.reason,
            updatedAt: new Date()
          })
          .where(eq(schema.ndaRequests.id, ndaId))
          .returning();

        if (!updated) {
          return corsResponse(request, { success: false, message: 'NDA request not found' }, 404);
        }

        return corsResponse(request, {
          success: true,
          data: updated,
          message: 'NDA rejected'
        });
      }

      // ============= NOTIFICATIONS =============
      
      if (path === '/api/notifications' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const notifications = await globalDb
          .select()
          .from(schema.notifications)
          .where(eq(schema.notifications.userId, userPayload.id))
          .orderBy(desc(schema.notifications.createdAt))
          .limit(20);

        return corsResponse(request, {
          success: true,
          data: notifications
        });
      }

      // Mark notification as read
      if (path.match(/^\/api\/notifications\/\d+\/read$/) && method === 'PUT') {
        if (!userPayload) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }

        const notificationId = parseInt(path.split('/')[3]);
        
        await globalDb
          .update(schema.notifications)
          .set({ read: true })
          .where(
            and(
              eq(schema.notifications.id, notificationId),
              eq(schema.notifications.userId, userPayload.id)
            )
          );

        return corsResponse(request, {
          success: true,
          message: 'Notification marked as read'
        });
      }

      // ============= CONFIGURATION ENDPOINTS =============
      
      if (path === '/api/config/genres' && method === 'GET') {
        const genres = [
          'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 
          'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy',
          'Film Noir', 'History', 'Horror', 'Music', 'Musical',
          'Mystery', 'Romance', 'Sci-Fi', 'Sport', 'Superhero',
          'Thriller', 'War', 'Western'
        ];
        
        return corsResponse(request, { success: true, data: genres });
      }

      if (path === '/api/config/formats' && method === 'GET') {
        const formats = [
          'Feature Film', 'Short Film', 'TV Series', 'Limited Series',
          'Documentary', 'Documentary Series', 'Animation', 'Web Series'
        ];
        
        return corsResponse(request, { success: true, data: formats });
      }

      // ============= ANALYTICS TRACKING =============
      
      if (path === '/api/analytics/track' && method === 'POST') {
        const body = await request.json();
        
        // Store analytics event
        if (env.KV) {
          const key = `analytics:${body.event}:${Date.now()}`;
          await env.KV.put(key, JSON.stringify({
            ...body,
            timestamp: new Date().toISOString(),
            ip: request.headers.get('CF-Connecting-IP'),
            userAgent: request.headers.get('User-Agent'),
          }), { expirationTtl: 86400 * 30 }); // 30 days
        }

        return corsResponse(request, { success: true });
      }

      // Default 404 response
      return corsResponse(request, {
        success: false,
        message: `Endpoint not found: ${path}`,
        method,
        availableEndpoints: [
          '/api/health',
          '/api/auth/*/login',
          '/api/auth/*/register',
          '/api/pitches/browse/enhanced',
          '/api/pitches/trending',
          '/api/pitches/new',
          '/api/search',
          '/api/creator/dashboard',
          '/api/investor/dashboard',
          '/api/production/dashboard',
          '/api/pitches (CRUD)',
          '/api/saved-pitches',
          '/api/nda/request',
          '/api/nda/stats',
          '/api/notifications',
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