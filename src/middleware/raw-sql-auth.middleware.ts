/**
 * Raw SQL Authentication Middleware
 * Simple session-based authentication using raw SQL
 */

import { RawSQLDatabase } from '../db/raw-sql-connection.ts';
import { z } from 'zod';

// User type schema
const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  username: z.string(),
  user_type: z.enum(['creator', 'investor', 'production', 'admin']),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email_verified: z.boolean(),
  is_active: z.boolean()
});

export type User = z.infer<typeof UserSchema>;

export interface AuthContext {
  user: User | null;
  session: any | null;
  isAuthenticated: boolean;
}

export class RawSQLAuthMiddleware {
  constructor(private db: RawSQLDatabase) {}

  /**
   * Authenticate request by validating session
   */
  async authenticate(request: Request): Promise<AuthContext> {
    const token = this.extractToken(request);
    
    if (!token) {
      return {
        user: null,
        session: null,
        isAuthenticated: false
      };
    }

    try {
      // Query session with user data
      const result = await this.db.queryOne<any>(`
        SELECT 
          s.id as session_id,
          s.expires_at,
          s.created_at as session_created_at,
          u.id,
          u.email,
          u.username,
          u.user_type,
          u.first_name,
          u.last_name,
          u.email_verified,
          u.is_active
        FROM session s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = $1
          AND s.expires_at > NOW()
          AND u.is_active = true
        LIMIT 1
      `, [token]);

      if (!result) {
        return {
          user: null,
          session: null,
          isAuthenticated: false
        };
      }

      // Parse and validate user
      const user = UserSchema.parse({
        id: result.id,
        email: result.email,
        username: result.username,
        user_type: result.user_type,
        first_name: result.first_name,
        last_name: result.last_name,
        email_verified: result.email_verified,
        is_active: result.is_active
      });

      const session = {
        id: result.session_id,
        expires_at: result.expires_at,
        created_at: result.session_created_at
      };

      // Update session activity
      await this.db.query(
        `UPDATE session SET updated_at = NOW() WHERE id = $1`,
        [session.id]
      );

      return {
        user,
        session,
        isAuthenticated: true
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        user: null,
        session: null,
        isAuthenticated: false
      };
    }
  }

  /**
   * Require authentication - throws if not authenticated
   */
  async requireAuth(request: Request): Promise<AuthContext> {
    const context = await this.authenticate(request);
    
    if (!context.isAuthenticated || !context.user) {
      throw new AuthError('Authentication required', 401);
    }
    
    return context;
  }

  /**
   * Require specific user type
   */
  async requireUserType(request: Request, allowedTypes: string[]): Promise<AuthContext> {
    const context = await this.requireAuth(request);
    
    if (!allowedTypes.includes(context.user!.user_type)) {
      throw new AuthError(`Access denied. Required user type: ${allowedTypes.join(' or ')}`, 403);
    }
    
    return context;
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: number, permission: string): Promise<boolean> {
    try {
      const result = await this.db.queryOne<{ has_permission: boolean }>(`
        SELECT EXISTS (
          SELECT 1 
          FROM user_permissions up
          JOIN permissions p ON up.permission_id = p.id
          WHERE up.user_id = $1 
            AND p.name = $2
            AND up.granted = true
        ) as has_permission
      `, [userId, permission]);

      return result?.has_permission || false;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Check if user has role
   */
  async hasRole(userId: number, roleName: string): Promise<boolean> {
    try {
      const result = await this.db.queryOne<{ has_role: boolean }>(`
        SELECT EXISTS (
          SELECT 1 
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = $1 
            AND r.name = $2
        ) as has_role
      `, [userId, roleName]);

      return result?.has_role || false;
    } catch (error) {
      console.error('Role check error:', error);
      return false;
    }
  }

  /**
   * Extract token from request
   */
  private extractToken(request: Request): string | null {
    // Check cookie first
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = this.parseCookies(cookieHeader);
      if (cookies['pitchey-session']) {
        return cookies['pitchey-session'];
      }
    }

    // Check Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Parse cookie string
   */
  private parseCookies(cookieString: string): Record<string, string> {
    return cookieString.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Create session for user
   */
  async createSession(userId: number, metadata?: any): Promise<string> {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    await this.db.insert('session', {
      id: crypto.randomUUID(),
      user_id: userId,
      token,
      expires_at: expiresAt,
      metadata: metadata || {},
      created_at: new Date(),
      updated_at: new Date()
    });

    return token;
  }

  /**
   * Invalidate session
   */
  async invalidateSession(token: string): Promise<void> {
    await this.db.delete('session', 'token = $1', [token]);
  }

  /**
   * Generate secure token
   */
  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Custom error class for authentication errors
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Helper function to create auth response
 */
export function createAuthResponse(
  success: boolean,
  message: string,
  data: any = null,
  statusCode = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify({
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  }), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      ...additionalHeaders
    }
  });
}

/**
 * Middleware wrapper for protected routes
 */
export function withAuth(
  handler: (request: Request, context: AuthContext) => Promise<Response>,
  options?: {
    requireAuth?: boolean;
    allowedUserTypes?: string[];
  }
): (request: Request, env: any) => Promise<Response> {
  return async (request: Request, env: any) => {
    const db = new RawSQLDatabase({
      connectionString: env.DATABASE_URL
    });
    const authMiddleware = new RawSQLAuthMiddleware(db);
    
    try {
      let context: AuthContext;
      
      if (options?.requireAuth) {
        context = await authMiddleware.requireAuth(request);
        
        if (options.allowedUserTypes) {
          await authMiddleware.requireUserType(request, options.allowedUserTypes);
        }
      } else {
        context = await authMiddleware.authenticate(request);
      }
      
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AuthError) {
        return createAuthResponse(false, error.message, null, error.statusCode);
      }
      throw error;
    }
  };
}