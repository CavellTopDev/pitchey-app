/**
 * Pitchey Cloudflare Worker - Better Auth Integration
 * Optimized for free tier constraints with session-based authentication
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { BetterAuthWorkerHandler } from './auth/better-auth-worker-handler';

// Optimize Neon for Cloudflare Workers
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = 'password';
neonConfig.coalesceWrites = true;
neonConfig.poolQueryViaFetch = true;

// Environment interface
interface Env {
  // Database
  DATABASE_URL: string;
  
  // Better Auth
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  
  // Storage
  SESSIONS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  
  // Environment
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  TRUSTED_ORIGINS?: string;
}

// Portal types
type PortalType = 'creator' | 'investor' | 'production';

/**
 * Database Manager - Optimized for serverless
 */
class DatabaseManager {
  private static connections: Map<string, any> = new Map();

  static getConnection(env: Env) {
    if (!this.connections.has('neon')) {
      if (!env.DATABASE_URL) {
        throw new Error('DATABASE_URL not configured');
      }
      
      const sql = neon(env.DATABASE_URL);
      this.connections.set('neon', sql);
    }
    
    return this.connections.get('neon');
  }
}

/**
 * Rate Limiter - Memory-based for free tier
 */
class FreeTierRateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  isAllowed(key: string, windowMs = 60000, max = 100): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests
    const validRequests = requests.filter(time => time > now - windowMs);
    
    if (validRequests.length >= max) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    // Cleanup periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }
    
    return true;
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > now - 60000);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

/**
 * Main Worker Handler
 */
class PitcheyWorker {
  private authHandler: BetterAuthWorkerHandler;
  private sql: ReturnType<typeof DatabaseManager.getConnection>;
  private rateLimiter: FreeTierRateLimiter;

  constructor(private env: Env) {
    this.authHandler = new BetterAuthWorkerHandler(env);
    this.sql = DatabaseManager.getConnection(env);
    this.rateLimiter = new FreeTierRateLimiter();
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const clientIP = this.getClientIP(request);

    try {
      // Rate limiting check (100 requests per minute per IP)
      if (!this.rateLimiter.isAllowed(clientIP)) {
        return this.createErrorResponse('Rate limit exceeded', 429);
      }

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return this.handlePreflight();
      }

      // Health check
      if (url.pathname === '/health') {
        return this.createSuccessResponse({
          status: 'healthy',
          service: 'Pitchey API with Better Auth',
          timestamp: new Date().toISOString(),
          environment: this.env.ENVIRONMENT || 'development'
        });
      }

      // Better Auth core endpoints
      if (url.pathname.startsWith('/api/auth/') && !this.isPortalAuthEndpoint(url.pathname)) {
        return this.authHandler.handleAuthRequest(request);
      }

      // Portal-specific authentication endpoints
      if (this.isPortalAuthEndpoint(url.pathname)) {
        const portal = this.extractPortalFromPath(url.pathname);
        if (portal) {
          return this.authHandler.handlePortalAuth(request, portal);
        }
      }

      // Protected API routes
      if (url.pathname.startsWith('/api/')) {
        return this.handleProtectedAPI(request, url, method);
      }

      // Default response
      return this.createSuccessResponse({
        message: 'Pitchey API with Better Auth',
        version: '3.0.0',
        authentication: 'Better Auth',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Worker error:', error);
      return this.createErrorResponse('Internal server error', 500);
    }
  }

  /**
   * Handle protected API routes
   */
  private async handleProtectedAPI(request: Request, url: URL, method: string): Promise<Response> {
    // Get session from Better Auth
    const session = await this.authHandler.getSession(request);
    
    if (!session?.user) {
      return this.createErrorResponse('Authentication required', 401);
    }

    // Route to appropriate handlers based on path
    if (url.pathname.startsWith('/api/pitches')) {
      return this.handlePitchesAPI(request, url, method, session);
    }

    if (url.pathname.startsWith('/api/users')) {
      return this.handleUsersAPI(request, url, method, session);
    }

    if (url.pathname.startsWith('/api/dashboard')) {
      return this.handleDashboardAPI(request, url, method, session);
    }

    // Default protected endpoint
    return this.createSuccessResponse({
      message: 'Protected API endpoint',
      user: {
        id: session.user.id,
        email: session.user.email,
        userType: session.user.userType
      }
    });
  }

  /**
   * Handle pitches API
   */
  private async handlePitchesAPI(
    request: Request, 
    url: URL, 
    method: string, 
    session: any
  ): Promise<Response> {
    try {
      if (method === 'GET') {
        // Get user's pitches
        const pitches = await this.sql`
          SELECT id, title, logline, genre, format, created_at, view_count, like_count
          FROM pitches 
          WHERE creator_id = ${session.user.id}
          ORDER BY created_at DESC
          LIMIT 20
        `;
        
        return this.createSuccessResponse({ pitches });
      }

      if (method === 'POST') {
        const body = await request.json();
        const { title, logline, genre, format } = body;

        if (!title || !logline) {
          return this.createErrorResponse('Title and logline are required', 400);
        }

        // Create new pitch
        const [pitch] = await this.sql`
          INSERT INTO pitches (title, logline, genre, format, creator_id, created_at)
          VALUES (${title}, ${logline}, ${genre}, ${format}, ${session.user.id}, NOW())
          RETURNING id, title, logline, genre, format, created_at
        `;

        return this.createSuccessResponse({ pitch });
      }

      return this.createErrorResponse('Method not allowed', 405);

    } catch (error) {
      console.error('Pitches API error:', error);
      return this.createErrorResponse('Failed to process pitches request', 500);
    }
  }

  /**
   * Handle users API
   */
  private async handleUsersAPI(
    request: Request, 
    url: URL, 
    method: string, 
    session: any
  ): Promise<Response> {
    try {
      if (method === 'GET' && url.pathname === '/api/users/profile') {
        // Get user profile
        const [user] = await this.sql`
          SELECT id, email, username, user_type, first_name, last_name, 
                 company_name, bio, profile_image, subscription_tier, created_at
          FROM users 
          WHERE id = ${session.user.id}
        `;

        if (!user) {
          return this.createErrorResponse('User not found', 404);
        }

        return this.createSuccessResponse({ user });
      }

      if (method === 'PUT' && url.pathname === '/api/users/profile') {
        const body = await request.json();
        const { firstName, lastName, bio, companyName } = body;

        // Update user profile
        const [user] = await this.sql`
          UPDATE users 
          SET first_name = ${firstName || null}, 
              last_name = ${lastName || null},
              bio = ${bio || null},
              company_name = ${companyName || null},
              updated_at = NOW()
          WHERE id = ${session.user.id}
          RETURNING id, email, username, user_type, first_name, last_name, 
                    company_name, bio, profile_image, subscription_tier
        `;

        return this.createSuccessResponse({ user });
      }

      return this.createErrorResponse('Method not allowed', 405);

    } catch (error) {
      console.error('Users API error:', error);
      return this.createErrorResponse('Failed to process users request', 500);
    }
  }

  /**
   * Handle dashboard API
   */
  private async handleDashboardAPI(
    request: Request, 
    url: URL, 
    method: string, 
    session: any
  ): Promise<Response> {
    try {
      if (method === 'GET') {
        const userType = session.user.userType;

        // Get dashboard stats based on user type
        if (userType === 'creator') {
          const [stats] = await this.sql`
            SELECT 
              COUNT(*) as pitch_count,
              COALESCE(SUM(view_count), 0) as total_views,
              COALESCE(SUM(like_count), 0) as total_likes
            FROM pitches 
            WHERE creator_id = ${session.user.id}
          `;

          return this.createSuccessResponse({ 
            stats: {
              pitches: parseInt(stats.pitch_count),
              views: parseInt(stats.total_views), 
              likes: parseInt(stats.total_likes)
            }
          });
        }

        if (userType === 'investor') {
          const [stats] = await this.sql`
            SELECT COUNT(*) as saved_pitches
            FROM saved_pitches 
            WHERE user_id = ${session.user.id}
          `;

          return this.createSuccessResponse({
            stats: {
              savedPitches: parseInt(stats.saved_pitches),
              investments: 0, // Placeholder
              returns: 0 // Placeholder
            }
          });
        }

        if (userType === 'production') {
          const [stats] = await this.sql`
            SELECT COUNT(*) as reviewed_pitches
            FROM pitch_reviews 
            WHERE reviewer_id = ${session.user.id}
          `;

          return this.createSuccessResponse({
            stats: {
              reviewedPitches: parseInt(stats.reviewed_pitches),
              activeProjects: 0, // Placeholder
              partnerships: 0 // Placeholder
            }
          });
        }
      }

      return this.createErrorResponse('Method not allowed', 405);

    } catch (error) {
      console.error('Dashboard API error:', error);
      return this.createErrorResponse('Failed to process dashboard request', 500);
    }
  }

  /**
   * Check if this is a portal-specific auth endpoint
   */
  private isPortalAuthEndpoint(pathname: string): boolean {
    return /\/api\/auth\/(creator|investor|production)\/(login|register|logout|session)$/.test(pathname);
  }

  /**
   * Extract portal type from path
   */
  private extractPortalFromPath(pathname: string): PortalType | null {
    const match = pathname.match(/\/api\/auth\/(creator|investor|production)\//);
    return match ? (match[1] as PortalType) : null;
  }

  /**
   * Handle CORS preflight
   */
  private handlePreflight(): Response {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: Request): string {
    return request.headers.get('CF-Connecting-IP') ||
           request.headers.get('X-Forwarded-For')?.split(',')[0] ||
           'unknown';
  }

  /**
   * Create error response with CORS
   */
  private createErrorResponse(message: string, status = 400): Response {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }

  /**
   * Create success response with CORS
   */
  private createSuccessResponse(data: any): Response {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }
}

/**
 * Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const worker = new PitcheyWorker(env);
    return worker.handleRequest(request);
  }
};