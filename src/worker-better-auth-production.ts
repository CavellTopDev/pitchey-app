/**
 * Pitchey Production Worker with Better Auth Integration
 * Clean, modern architecture using Better Auth for session management
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis/cloudflare';

// Better Auth integration
import { createAuth } from './auth/better-auth-config';
import { 
  createPortalHandlers, 
  verifySession,
  handleAuthRoute 
} from './auth/better-auth-worker-integration';

// Core utilities
import { EdgeCache } from './utils/edge-cache';
import { PerformanceMiddleware } from './middleware/performance';
import { getErrorMessage } from './utils/error-serializer';

// Optimize Neon configuration
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = 'password';
neonConfig.coalesceWrites = true;
neonConfig.poolQueryViaFetch = true;

// Export Durable Objects for WebSocket support
export { WebSocketRoom } from './durable-objects/websocket-room';
export { NotificationRoom } from './notification-room';

// Environment interface
interface Env {
  // Database
  DATABASE_URL: string;
  HYPERDRIVE?: Hyperdrive;
  
  // Better Auth
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  
  // Storage & Cache
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  REDIS_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  
  // Environment
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  
  // Session storage
  SESSIONS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
}

// ==========================================
// DATABASE MANAGER
// ==========================================

class DatabaseManager {
  private static connections: Map<string, any> = new Map();

  static getConnection(env: Env) {
    const cacheKey = 'neon_connection';
    
    if (!this.connections.has(cacheKey)) {
      if (!env.DATABASE_URL) {
        throw new Error('DATABASE_URL not configured');
      }
      
      console.log('Creating Neon connection for edge deployment');
      const sql = neon(env.DATABASE_URL);
      this.connections.set(cacheKey, sql);
    }
    
    return this.connections.get(cacheKey);
  }

  static getSqlInstance(env: Env) {
    return this.getConnection(env);
  }
}

// ==========================================
// REQUEST ROUTER
// ==========================================

class RouteHandler {
  private authInstance: ReturnType<typeof createAuth>;
  private portalHandlers: ReturnType<typeof createPortalHandlers>;
  private sql: ReturnType<typeof DatabaseManager.getSqlInstance>;
  private redis?: Redis;
  private cache: EdgeCache;
  private performance: PerformanceMiddleware;

  constructor(env: Env) {
    this.authInstance = createAuth(env);
    this.portalHandlers = createPortalHandlers(this.authInstance);
    this.sql = DatabaseManager.getSqlInstance(env);
    this.cache = new EdgeCache(env.KV);
    this.performance = new PerformanceMiddleware();
    
    // Initialize Redis if available
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN
      });
    }
  }

  async handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return this.handlePreflightRequest();
      }

      // Better Auth endpoints (handle authentication)
      if (url.pathname.startsWith('/api/auth/')) {
        return this.handleBetterAuthEndpoint(request, env);
      }

      // API routes requiring authentication
      if (url.pathname.startsWith('/api/')) {
        return this.handleAPIRoute(request, url, method);
      }

      // Health check
      if (url.pathname === '/health') {
        return this.handleHealthCheck();
      }

      // Default response
      return this.createJsonResponse({ 
        message: 'Pitchey API with Better Auth',
        version: '2.0.0',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  // ==========================================
  // BETTER AUTH INTEGRATION
  // ==========================================

  private async handleBetterAuthEndpoint(request: Request, env: Env): Promise<Response> {
    try {
      // Use the handleAuthRoute function from better-auth-worker-integration
      return await handleAuthRoute(request, new URL(request.url).pathname, env);
      
    } catch (error) {
      console.error('Better Auth endpoint error:', error);
      return this.createJsonResponse({
        success: false,
        message: 'Authentication service error'
      }, 500);
    }
  }

  // ==========================================
  // API ROUTES
  // ==========================================

  private async handleAPIRoute(request: Request, url: URL, method: string): Promise<Response> {
    const path = url.pathname.replace('/api', '');

    // Public endpoints (no auth required)
    if (this.isPublicEndpoint(path)) {
      return this.handlePublicEndpoint(request, path, method);
    }

    // Protected endpoints require authentication
    const authResult = await verifySession(request, this.authInstance);
    
    if (!authResult.success) {
      return authResult.error || this.createJsonResponse({ error: 'Authentication required' }, 401);
    }
    
    const authContext = { user: authResult.user, session: authResult.session };
    
    // Route to appropriate handler
    if (path.startsWith('/pitch')) {
      return this.handlePitchEndpoints(request, path, method, authContext);
    }
    
    if (path.startsWith('/user')) {
      return this.handleUserEndpoints(request, path, method, authContext);
    }
    
    if (path.startsWith('/dashboard')) {
      return this.handleDashboardEndpoints(request, path, method, authContext);
    }

    if (path.startsWith('/nda')) {
      return this.handleNDAEndpoints(request, path, method, authContext);
    }

    if (path.startsWith('/upload')) {
      return this.handleUploadEndpoints(request, path, method, authContext);
    }

    return this.createJsonResponse({ error: 'Endpoint not found' }, 404);
  }

  private isPublicEndpoint(path: string): boolean {
    const publicPaths = [
      '/health',
      '/browse/public',
      '/pitch/public',
      '/stats/public'
    ];
    
    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  // ==========================================
  // ENDPOINT HANDLERS
  // ==========================================

  private async handlePublicEndpoint(request: Request, path: string, method: string): Promise<Response> {
    if (path === '/browse/public' && method === 'GET') {
      return this.getPublicPitches();
    }
    
    if (path === '/health') {
      return this.handleHealthCheck();
    }

    return this.createJsonResponse({ error: 'Public endpoint not found' }, 404);
  }

  private async handlePitchEndpoints(request: Request, path: string, method: string, authContext: any): Promise<Response> {
    if (method === 'GET' && path === '/pitch') {
      return this.getUserPitches(authContext);
    }
    
    if (method === 'POST' && path === '/pitch') {
      return this.createPitch(request, authContext);
    }
    
    if (method === 'PUT' && path.match(/^\/pitch\/\d+$/)) {
      const pitchId = path.split('/')[2];
      return this.updatePitch(request, pitchId, authContext);
    }
    
    if (method === 'DELETE' && path.match(/^\/pitch\/\d+$/)) {
      const pitchId = path.split('/')[2];
      return this.deletePitch(pitchId, authContext);
    }

    return this.createJsonResponse({ error: 'Pitch endpoint not found' }, 404);
  }

  private async handleUserEndpoints(request: Request, path: string, method: string, authContext: any): Promise<Response> {
    if (method === 'GET' && path === '/user/profile') {
      return this.getUserProfile(authContext);
    }
    
    if (method === 'PUT' && path === '/user/profile') {
      return this.updateUserProfile(request, authContext);
    }

    return this.createJsonResponse({ error: 'User endpoint not found' }, 404);
  }

  private async handleDashboardEndpoints(request: Request, path: string, method: string, authContext: any): Promise<Response> {
    if (method === 'GET' && path === '/dashboard/stats') {
      return this.getDashboardStats(authContext);
    }

    return this.createJsonResponse({ error: 'Dashboard endpoint not found' }, 404);
  }

  private async handleNDAEndpoints(request: Request, path: string, method: string, authContext: any): Promise<Response> {
    if (method === 'GET' && path === '/nda') {
      return this.getUserNDAs(authContext);
    }
    
    if (method === 'POST' && path === '/nda') {
      return this.createNDA(request, authContext);
    }

    return this.createJsonResponse({ error: 'NDA endpoint not found' }, 404);
  }

  private async handleUploadEndpoints(request: Request, path: string, method: string, authContext: any): Promise<Response> {
    if (method === 'POST' && path === '/upload') {
      return this.handleFileUpload(request, authContext);
    }

    return this.createJsonResponse({ error: 'Upload endpoint not found' }, 404);
  }

  // ==========================================
  // BUSINESS LOGIC METHODS
  // ==========================================

  private async getPublicPitches(): Promise<Response> {
    try {
      const cacheKey = 'public-pitches';
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return this.createJsonResponse(cached);
      }

      const pitches = await this.sql`
        SELECT 
          p.*,
          u.id as creator_id,
          u.name as creator_name,
          u.portal_type as creator_portal_type
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.is_public = true
        ORDER BY p.created_at DESC
        LIMIT 20
      `;

      const result = { pitches, total: pitches.length };
      await this.cache.set(cacheKey, result, 300); // 5-minute cache

      return this.createJsonResponse(result);
    } catch (error) {
      console.error('Get public pitches error:', error);
      return this.createJsonResponse({ error: 'Failed to fetch public pitches' }, 500);
    }
  }

  private async getUserPitches(authContext: any): Promise<Response> {
    try {
      const pitches = await this.sql`
        SELECT * FROM pitches 
        WHERE user_id = ${authContext.user.id}
        ORDER BY created_at DESC
        LIMIT 50
      `;

      return this.createJsonResponse({ pitches });
    } catch (error) {
      console.error('Get user pitches error:', error);
      return this.createJsonResponse({ error: 'Failed to fetch pitches' }, 500);
    }
  }

  private async createPitch(request: Request, authContext: any): Promise<Response> {
    try {
      const data = await request.json();
      
      // Validate required fields
      const requiredFields = ['title', 'tagline', 'genre', 'synopsis'];
      for (const field of requiredFields) {
        if (!data[field]) {
          return this.createJsonResponse({ 
            error: `${field} is required` 
          }, 400);
        }
      }

      const now = new Date().toISOString();
      
      const [pitch] = await this.sql`
        INSERT INTO pitches (
          user_id, title, tagline, genre, synopsis, 
          created_at, updated_at
        ) VALUES (
          ${authContext.user.id}, 
          ${data.title}, 
          ${data.tagline}, 
          ${data.genre}, 
          ${data.synopsis},
          ${now}, 
          ${now}
        )
        RETURNING *
      `;

      return this.createJsonResponse({ pitch }, 201);
    } catch (error) {
      console.error('Create pitch error:', error);
      return this.createJsonResponse({ error: 'Failed to create pitch' }, 500);
    }
  }

  private async updatePitch(request: Request, pitchId: string, authContext: any): Promise<Response> {
    try {
      const data = await request.json();
      
      const now = new Date().toISOString();
      const pitchIdNum = parseInt(pitchId);
      
      const [pitch] = await this.sql`
        UPDATE pitches 
        SET 
          title = COALESCE(${data.title}, title),
          tagline = COALESCE(${data.tagline}, tagline),
          genre = COALESCE(${data.genre}, genre),
          synopsis = COALESCE(${data.synopsis}, synopsis),
          updated_at = ${now}
        WHERE id = ${pitchIdNum} AND user_id = ${authContext.user.id}
        RETURNING *
      `;

      if (!pitch) {
        return this.createJsonResponse({ error: 'Pitch not found or unauthorized' }, 404);
      }

      return this.createJsonResponse({ pitch });
    } catch (error) {
      console.error('Update pitch error:', error);
      return this.createJsonResponse({ error: 'Failed to update pitch' }, 500);
    }
  }

  private async deletePitch(pitchId: string, authContext: any): Promise<Response> {
    try {
      const pitchIdNum = parseInt(pitchId);
      
      const [deleted] = await this.sql`
        DELETE FROM pitches 
        WHERE id = ${pitchIdNum} AND user_id = ${authContext.user.id}
        RETURNING id
      `;

      if (!deleted) {
        return this.createJsonResponse({ error: 'Pitch not found or unauthorized' }, 404);
      }

      return this.createJsonResponse({ message: 'Pitch deleted successfully' });
    } catch (error) {
      console.error('Delete pitch error:', error);
      return this.createJsonResponse({ error: 'Failed to delete pitch' }, 500);
    }
  }

  private async getUserProfile(authContext: any): Promise<Response> {
    return this.createJsonResponse({ user: authContext.user });
  }

  private async updateUserProfile(request: Request, authContext: any): Promise<Response> {
    try {
      const data = await request.json();
      
      // Remove sensitive fields that shouldn't be updated
      delete data.id;
      delete data.email;
      delete data.emailVerified;
      delete data.portalType;

      const now = new Date().toISOString();
      
      const [user] = await this.sql`
        UPDATE users 
        SET 
          name = COALESCE(${data.name}, name),
          updated_at = ${now}
        WHERE id = ${authContext.user.id}
        RETURNING *
      `;

      return this.createJsonResponse({ user });
    } catch (error) {
      console.error('Update profile error:', error);
      return this.createJsonResponse({ error: 'Failed to update profile' }, 500);
    }
  }

  private async getDashboardStats(authContext: any): Promise<Response> {
    try {
      const cacheKey = `dashboard-stats-${authContext.user.id}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return this.createJsonResponse(cached);
      }

      // Get user-specific stats based on portal type
      const stats = await this.getUserSpecificStats(authContext);
      
      await this.cache.set(cacheKey, stats, 300); // 5-minute cache
      
      return this.createJsonResponse(stats);
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      return this.createJsonResponse({ error: 'Failed to fetch dashboard stats' }, 500);
    }
  }

  private async getUserSpecificStats(authContext: any) {
    const portalType = authContext.user.portalType;
    
    if (portalType === 'creator') {
      const [pitchCount] = await this.sql`
        SELECT COUNT(*) as count 
        FROM pitches 
        WHERE user_id = ${authContext.user.id}
      `;
        
      return {
        totalPitches: parseInt(pitchCount.count),
        recentActivity: 'Sample data for creator'
      };
    }
    
    if (portalType === 'investor') {
      return {
        totalInvestments: 0,
        recentActivity: 'Sample data for investor'
      };
    }
    
    if (portalType === 'production') {
      return {
        totalProjects: 0,
        recentActivity: 'Sample data for production'
      };
    }
    
    return { recentActivity: 'No portal-specific data' };
  }

  private async getUserNDAs(authContext: any): Promise<Response> {
    try {
      // Placeholder implementation
      return this.createJsonResponse({ ndas: [], total: 0 });
    } catch (error) {
      console.error('Get NDAs error:', error);
      return this.createJsonResponse({ error: 'Failed to fetch NDAs' }, 500);
    }
  }

  private async createNDA(request: Request, authContext: any): Promise<Response> {
    try {
      const data = await request.json();
      // Placeholder implementation
      return this.createJsonResponse({ 
        message: 'NDA creation endpoint - to be implemented',
        data 
      });
    } catch (error) {
      console.error('Create NDA error:', error);
      return this.createJsonResponse({ error: 'Failed to create NDA' }, 500);
    }
  }

  private async handleFileUpload(request: Request, authContext: any): Promise<Response> {
    try {
      // Placeholder implementation
      return this.createJsonResponse({ 
        message: 'File upload endpoint - to be implemented' 
      });
    } catch (error) {
      console.error('File upload error:', error);
      return this.createJsonResponse({ error: 'Failed to handle file upload' }, 500);
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private async handleHealthCheck(): Promise<Response> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0-better-auth',
        database: 'connected',
        auth: 'better-auth'
      };

      // Test database connection
      try {
        await this.sql`SELECT COUNT(*) FROM users LIMIT 1`;
      } catch (dbError) {
        health.database = 'error';
        health.status = 'degraded';
      }

      return this.createJsonResponse(health);
    } catch (error) {
      return this.createJsonResponse({
        status: 'unhealthy',
        error: getErrorMessage(error)
      }, 500);
    }
  }

  private handleError(error: any): Response {
    console.error('Worker error:', error);

    return this.createJsonResponse({
      error: 'Internal server error',
      message: getErrorMessage(error)
    }, 500);
  }

  private handlePreflightRequest(): Response {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  private createJsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}

// ==========================================
// WORKER ENTRY POINT
// ==========================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Initialize performance monitoring
      const startTime = Date.now();
      
      // Create route handler
      const handler = new RouteHandler(env);
      
      // Handle request
      const response = await handler.handleRequest(request, env);
      
      // Add performance headers
      const duration = Date.now() - startTime;
      response.headers.set('X-Response-Time', `${duration}ms`);
      
      return response;
      
    } catch (error) {
      console.error('Worker fetch error:', error);
      
      return new Response(JSON.stringify({
        error: 'Worker initialization failed',
        message: getErrorMessage(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// Export types for external use
export type { Env };