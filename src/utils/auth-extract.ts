/**
 * Authentication Extraction Utility
 * Extracts user information from JWT tokens and session cookies
 */

import { verifyJWT, extractJWT, type JWTPayload } from './worker-jwt';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  userType: string;
}

export interface AuthResult {
  authenticated: boolean;
  user: AuthenticatedUser | null;
  error?: string;
}

/**
 * Extract authenticated user from request
 * Checks both JWT Bearer token and session cookie
 */
export async function getAuthenticatedUser(
  request: Request,
  env: { JWT_SECRET?: string; SESSION_STORE?: KVNamespace }
): Promise<AuthResult> {
  const jwtSecret = env.JWT_SECRET || 'test-secret-key-for-development';

  // Try JWT token first (Authorization header)
  const authHeader = request.headers.get('Authorization');
  const token = extractJWT(authHeader);

  if (token) {
    const payload = await verifyJWT(token, jwtSecret);
    if (payload) {
      return {
        authenticated: true,
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          userType: payload.userType
        }
      };
    }
  }

  // Try session cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const sessionId = cookies['better-auth-session'] || cookies['pitchey-session'];

    if (sessionId && env.SESSION_STORE) {
      try {
        const sessionData = await env.SESSION_STORE.get(`session:${sessionId}`);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          // Check if session is expired
          if (new Date(session.expiresAt) > new Date()) {
            return {
              authenticated: true,
              user: {
                id: String(session.userId),
                email: session.userEmail || '',
                name: session.userName || session.userEmail?.split('@')[0] || '',
                userType: session.userType || 'creator'
              }
            };
          }
        }
      } catch (error) {
        console.error('Session lookup error:', error);
      }
    }
  }

  return {
    authenticated: false,
    user: null,
    error: 'No valid authentication found'
  };
}

/**
 * Get user ID from request, with fallback to query param for backward compatibility
 */
export async function getUserId(
  request: Request,
  env: { JWT_SECRET?: string; SESSION_STORE?: KVNamespace }
): Promise<string | null> {
  // First try to get from auth
  const authResult = await getAuthenticatedUser(request, env);
  if (authResult.authenticated && authResult.user) {
    return authResult.user.id;
  }

  // Fallback: Check query param (for backward compatibility during transition)
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get('userId');
  if (userIdParam) {
    console.warn('Using userId from query param - this is deprecated');
    return userIdParam;
  }

  return null;
}

/**
 * Require authentication - returns user or throws/returns error response
 */
export async function requireAuth(
  request: Request,
  env: { JWT_SECRET?: string; SESSION_STORE?: KVNamespace }
): Promise<{ user: AuthenticatedUser } | { error: Response }> {
  const authResult = await getAuthenticatedUser(request, env);

  if (!authResult.authenticated || !authResult.user) {
    const origin = request.headers.get('Origin');
    return {
      error: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    };
  }

  return { user: authResult.user };
}

/**
 * Require specific role - returns user or error response
 */
export async function requireRole(
  request: Request,
  env: { JWT_SECRET?: string; SESSION_STORE?: KVNamespace },
  allowedRoles: string | string[]
): Promise<{ user: AuthenticatedUser } | { error: Response }> {
  const authResult = await requireAuth(request, env);

  if ('error' in authResult) {
    return authResult;
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const userRole = authResult.user.userType?.toLowerCase() || '';

  if (!roles.some(role => role.toLowerCase() === userRole)) {
    const origin = request.headers.get('Origin');
    return {
      error: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Required role: ${roles.join(' or ')}`
          }
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    };
  }

  return { user: authResult.user };
}

/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookies[key] = value;
    }
  });
  return cookies;
}
