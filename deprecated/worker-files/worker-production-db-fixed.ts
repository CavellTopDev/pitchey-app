/**
 * Production Worker with Standardized Architecture
 * Fixes all identified architectural inconsistencies
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, gte, lte, desc, asc, like, sql, count, inArray } from 'drizzle-orm';
import * as schema from './db/schema.ts';
import { Redis } from '@upstash/redis/cloudflare';
import { SessionManager, RateLimiter } from './auth/session-manager.ts';
import { getErrorMessage } from './utils/error-serializer.ts';
import { Security } from './security-enhancements.ts';
import { EdgeCache } from './utils/edge-cache.ts';
import { PerformanceMiddleware } from './middleware/performance.ts';
import { ABTestManager } from './utils/ab-test-integration.ts';

// Import standardized architecture components
import {
  StandardResponse,
  AuthResult,
  FollowRequest,
  createStandardResponse,
  successResponse,
  errorResponse,
  authenticateRequest,
  requireAuth,
  requireUserType,
  validateFollowRequest,
  BaseHandler,
  Router
} from './workers/standardized-architecture.ts';

// Optimize Neon configuration for Cloudflare Workers
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = 'password';
neonConfig.coalesceWrites = true;
neonConfig.poolQueryViaFetch = true;

// Environment interface
interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  REDIS_URL?: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  HYPERDRIVE?: Hyperdrive;
}

// ==========================================
// STANDARDIZED DATABASE MANAGER
// ==========================================

class DatabaseManager {
  private static connections: Map<string, any> = new Map();

  static getOptimalConnection(env: Env) {
    const cacheKey = 'neon_sql_connection';
    
    if (!this.connections.has(cacheKey)) {
      if (!env.DATABASE_URL) {
        throw new Error('DATABASE_URL not configured');
      }
      
      console.log('Creating Neon serverless connection for edge');
      const sql = neon(env.DATABASE_URL);
      this.connections.set(cacheKey, sql);
    }
    
    return this.connections.get(cacheKey)!;
  }

  static async executeQuery<T>(
    env: Env, 
    queryFn: (sql: ReturnType<typeof neon>) => Promise<T>
  ): Promise<T> {
    try {
      const sql = this.getOptimalConnection(env);
      return await queryFn(sql);
    } catch (error) {
      console.error('Database query failed:', error);
      throw error;
    }
  }
}

// ==========================================
// STANDARDIZED AUTHENTICATION
// ==========================================

async function authenticateRequestFixed(request: Request, env: Env): Promise<AuthResult> {
  // Check for session cookie first
  const cookieHeader = request.headers.get('Cookie');
  const sessionId = SessionManager.parseSessionFromCookie(cookieHeader);
  
  if (sessionId) {
    try {
      const session = await SessionManager.getSession(sessionId);
      if (session) {
        return {
          success: true,
          user: {
            id: session.user.id,
            userType: session.user.userType as any,
            username: session.user.username,
            email: session.user.email
          }
        };
      }
    } catch (error) {
      console.warn('Session validation failed:', error);
    }
  }

  // Fall back to JWT authentication
  return authenticateRequest(request, env);
}

// ==========================================
// STANDARDIZED FOLLOW HANDLER
// ==========================================

class PitcheyFollowHandler extends BaseHandler {
  protected async handleRequest(request: Request, pathname: string, method: string): Promise<Response> {
    if (pathname === '/api/follows/follow' && method === 'POST') {
      return this.handleFollow(request);
    }

    if (pathname === '/api/follows/unfollow' && method === 'POST') {
      return this.handleUnfollow(request);
    }

    if (pathname === '/api/follows/stats' && method === 'GET') {
      return this.handleFollowStats(request);
    }

    return errorResponse('Follow endpoint not found', 404);
  }

  private async handleFollow(request: Request): Promise<Response> {
    const authResult = await authenticateRequestFixed(request, this.env);
    const authError = requireAuth(authResult);
    if (authError) return authError;

    try {
      const body = await request.json();
      
      // Handle both old and new parameter formats for backward compatibility
      let followRequest: FollowRequest;
      
      if (body.targetType && body.targetId) {
        // New standardized format
        followRequest = validateFollowRequest(body);
        if (!followRequest) {
          return errorResponse({
            code: 'INVALID_REQUEST',
            message: 'Request must include targetType ("user" or "pitch") and targetId (number)'
          }, 400);
        }
      } else if (body.creatorId || body.pitchId) {
        // Legacy format - convert to standardized
        if (body.creatorId && body.pitchId) {
          return errorResponse('Cannot follow both creator and pitch simultaneously', 400);
        }
        if (!body.creatorId && !body.pitchId) {
          return errorResponse('Must specify either creatorId or pitchId', 400);
        }
        
        followRequest = {
          targetType: body.creatorId ? 'user' : 'pitch',
          targetId: body.creatorId || body.pitchId
        };
      } else {
        return errorResponse({
          code: 'INVALID_REQUEST',
          message: 'Request must include either: (targetType, targetId) or (creatorId/pitchId)'
        }, 400);
      }

      const { targetType, targetId } = followRequest;
      const followerId = authResult.user!.id;

      // Check if already following
      const existing = await DatabaseManager.executeQuery(this.env, async (sql) => {
        return await sql`
          SELECT id FROM follows 
          WHERE follower_id = ${followerId} 
            AND target_type = ${targetType} 
            AND target_id = ${targetId}
        `;
      });

      if (existing.length > 0) {
        return errorResponse({
          code: 'ALREADY_FOLLOWING',
          message: `Already following this ${targetType}`
        }, 400);
      }

      // Create follow record
      const newFollow = await DatabaseManager.executeQuery(this.env, async (sql) => {
        return await sql`
          INSERT INTO follows (follower_id, target_type, target_id, created_at)
          VALUES (${followerId}, ${targetType}, ${targetId}, NOW())
          RETURNING id, follower_id, target_type, target_id, created_at
        `;
      });

      return successResponse(
        {
          followId: newFollow[0].id,
          followerId,
          targetType,
          targetId,
          isFollowing: true,
          // Legacy format for backward compatibility
          ...(targetType === 'user' ? { creatorId: targetId } : { pitchId: targetId })
        },
        `Successfully following ${targetType}`
      );

    } catch (error) {
      console.error('Follow error:', error);
      return errorResponse('Failed to follow');
    }
  }

  private async handleUnfollow(request: Request): Promise<Response> {
    const authResult = await authenticateRequestFixed(request, this.env);
    const authError = requireAuth(authResult);
    if (authError) return authError;

    try {
      const body = await request.json();
      
      // Handle both old and new parameter formats
      let unfollowRequest: FollowRequest;
      
      if (body.targetType && body.targetId) {
        unfollowRequest = validateFollowRequest(body);
        if (!unfollowRequest) {
          return errorResponse({
            code: 'INVALID_REQUEST',
            message: 'Request must include targetType ("user" or "pitch") and targetId (number)'
          }, 400);
        }
      } else if (body.creatorId || body.pitchId) {
        unfollowRequest = {
          targetType: body.creatorId ? 'user' : 'pitch',
          targetId: body.creatorId || body.pitchId
        };
      } else {
        return errorResponse({
          code: 'INVALID_REQUEST',
          message: 'Request must include either: (targetType, targetId) or (creatorId/pitchId)'
        }, 400);
      }

      const { targetType, targetId } = unfollowRequest;
      const followerId = authResult.user!.id;

      // Remove follow record
      const deleted = await DatabaseManager.executeQuery(this.env, async (sql) => {
        return await sql`
          DELETE FROM follows 
          WHERE follower_id = ${followerId} 
            AND target_type = ${targetType} 
            AND target_id = ${targetId}
          RETURNING id
        `;
      });

      if (deleted.length === 0) {
        return errorResponse({
          code: 'NOT_FOLLOWING',
          message: `Not currently following this ${targetType}`
        }, 400);
      }

      return successResponse(
        {
          followerId,
          targetType,
          targetId,
          isFollowing: false,
          // Legacy format for backward compatibility
          ...(targetType === 'user' ? { creatorId: targetId } : { pitchId: targetId })
        },
        `Successfully unfollowed ${targetType}`
      );

    } catch (error) {
      console.error('Unfollow error:', error);
      return errorResponse('Failed to unfollow');
    }
  }

  private async handleFollowStats(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get('userId');
    
    if (!userIdParam) {
      return errorResponse('userId parameter required', 400);
    }

    const userId = parseInt(userIdParam);
    if (isNaN(userId)) {
      return errorResponse('Invalid userId parameter', 400);
    }

    try {
      const stats = await DatabaseManager.executeQuery(this.env, async (sql) => {
        const [followersCount, followingCount] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM follows WHERE target_type = 'user' AND target_id = ${userId}`,
          sql`SELECT COUNT(*) as count FROM follows WHERE follower_id = ${userId}`
        ]);

        return {
          followersCount: Number(followersCount[0]?.count || 0),
          followingCount: Number(followingCount[0]?.count || 0)
        };
      });

      return successResponse(stats);
    } catch (error) {
      console.error('Follow stats error:', error);
      return errorResponse('Failed to fetch follow stats');
    }
  }
}

// ==========================================
// STANDARDIZED DASHBOARD HANDLER
// ==========================================

class DashboardHandler extends BaseHandler {
  protected async handleRequest(request: Request, pathname: string, method: string): Promise<Response> {
    if (method !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    const authResult = await authenticateRequestFixed(request, this.env);
    const authError = requireAuth(authResult);
    if (authError) return authError;

    if (pathname === '/api/creator/dashboard') {
      return this.handleCreatorDashboard(authResult);
    }

    if (pathname === '/api/investor/dashboard') {
      return this.handleInvestorDashboard(authResult);
    }

    if (pathname === '/api/production/dashboard') {
      return this.handleProductionDashboard(authResult);
    }

    return errorResponse('Dashboard endpoint not found', 404);
  }

  private async handleCreatorDashboard(authResult: AuthResult): Promise<Response> {
    const userTypeError = requireUserType(authResult, ['creator']);
    if (userTypeError) return userTypeError;

    try {
      const userId = authResult.user!.id;

      const dashboardData = await DatabaseManager.executeQuery(this.env, async (sql) => {
        // Get pitch stats
        const pitchStats = await sql`
          SELECT 
            COUNT(*) as total_pitches,
            SUM(view_count) as total_views,
            SUM(like_count) as total_likes
          FROM pitches 
          WHERE user_id = ${userId}
        `;

        // Get follower count
        const followerStats = await sql`
          SELECT COUNT(*) as followers_count
          FROM follows 
          WHERE target_type = 'user' AND target_id = ${userId}
        `;

        return {
          stats: {
            totalPitches: Number(pitchStats[0]?.total_pitches || 0),
            totalViews: Number(pitchStats[0]?.total_views || 0),
            totalLikes: Number(pitchStats[0]?.total_likes || 0),
            followers: Number(followerStats[0]?.followers_count || 0)
          }
        };
      });

      return successResponse(dashboardData, 'Creator dashboard data retrieved');
    } catch (error) {
      console.error('Creator dashboard error:', error);
      return errorResponse('Failed to load dashboard');
    }
  }

  private async handleInvestorDashboard(authResult: AuthResult): Response {
    const userTypeError = requireUserType(authResult, ['investor']);
    if (userTypeError) return userTypeError;

    try {
      const userId = authResult.user!.id;

      const dashboardData = await DatabaseManager.executeQuery(this.env, async (sql) => {
        // Get investment stats
        const investmentStats = await sql`
          SELECT 
            COUNT(*) as total_investments,
            SUM(amount) as total_amount
          FROM investments 
          WHERE investor_id = ${userId}
        `;

        // Get following count
        const followingStats = await sql`
          SELECT COUNT(*) as following_count
          FROM follows 
          WHERE follower_id = ${userId}
        `;

        return {
          stats: {
            totalInvestments: Number(investmentStats[0]?.total_investments || 0),
            totalAmount: Number(investmentStats[0]?.total_amount || 0),
            following: Number(followingStats[0]?.following_count || 0)
          }
        };
      });

      return successResponse(dashboardData, 'Investor dashboard data retrieved');
    } catch (error) {
      console.error('Investor dashboard error:', error);
      return errorResponse('Failed to load dashboard');
    }
  }

  private async handleProductionDashboard(authResult: AuthResult): Response {
    const userTypeError = requireUserType(authResult, ['production']);
    if (userTypeError) return userTypeError;

    try {
      const userId = authResult.user!.id;

      const dashboardData = await DatabaseManager.executeQuery(this.env, async (sql) => {
        // Get production stats
        const productionStats = await sql`
          SELECT 
            COUNT(DISTINCT p.id) as total_projects,
            COUNT(DISTINCT i.id) as total_investments
          FROM pitches p
          LEFT JOIN investments i ON p.id = i.pitch_id
          WHERE i.investor_id = ${userId} OR p.production_company_id = ${userId}
        `;

        return {
          stats: {
            totalProjects: Number(productionStats[0]?.total_projects || 0),
            totalInvestments: Number(productionStats[0]?.total_investments || 0)
          }
        };
      });

      return successResponse(dashboardData, 'Production dashboard data retrieved');
    } catch (error) {
      console.error('Production dashboard error:', error);
      return errorResponse('Failed to load dashboard');
    }
  }
}

// ==========================================
// MAIN WORKER IMPLEMENTATION
// ==========================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      // Initialize standardized router
      const router = new Router();

      // Add standardized handlers
      const followHandler = new PitcheyFollowHandler(env);
      router.addRoute(/^\/api\/follows\/(follow|unfollow|stats)/, followHandler);

      const dashboardHandler = new DashboardHandler(env);
      router.addRoute(/^\/api\/(creator|investor|production)\/dashboard$/, dashboardHandler, ['GET']);

      // Try standardized routing first
      try {
        return await router.handle(request);
      } catch (routerError) {
        // Fall back to legacy endpoints for backward compatibility
        console.warn('Standardized router failed, falling back to legacy:', routerError);
      }

      // Legacy endpoint fallbacks (gradually migrate these to standardized handlers)
      if (pathname === '/api/health') {
        return successResponse({ status: 'healthy', timestamp: new Date().toISOString() });
      }

      // Default fallback
      return errorResponse('Endpoint not found', 404);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal server error', 500, {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID()
      });
    }
  }
};