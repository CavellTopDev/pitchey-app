/**
 * Authentication utilities for Worker handlers
 */

import type { Env } from '../db/connection';
import { createBetterAuthInstance } from '../auth/better-auth-neon-raw-sql';

export interface AuthUser {
  id: number;
  email: string;
  username?: string;
  userType?: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

/**
 * Verify authentication using Better Auth session
 */
export async function verifyAuth(request: Request, env: Env): Promise<AuthResult> {
  try {
    // Get session cookie
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return { success: false, error: 'No session cookie' };
    }

    // Parse cookies
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...val] = c.split('=');
        return [key, val.join('=')];
      })
    );

    const sessionToken = cookies['better-auth-session'];
    if (!sessionToken) {
      return { success: false, error: 'No session token' };
    }

    // Create Better Auth instance
    const auth = await createBetterAuthInstance(env);
    if (!auth) {
      return { success: false, error: 'Auth service unavailable' };
    }

    // Create a mock request for Better Auth with the session cookie
    const mockRequest = new Request(new URL(request.url).origin + '/api/auth/session', {
      headers: {
        'Cookie': `better-auth-session=${sessionToken}`
      }
    });

    // Get session using Better Auth
    const sessionResponse = await auth.api.getSession({
      headers: mockRequest.headers,
      query: {}
    });

    if (!sessionResponse?.user) {
      return { success: false, error: 'Invalid session' };
    }

    return {
      success: true,
      user: {
        id: parseInt(sessionResponse.user.id),
        email: sessionResponse.user.email,
        username: sessionResponse.user.name || sessionResponse.user.username,
        userType: sessionResponse.user.userType
      }
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Extract user from Better Auth session for backward compatibility
 */
export async function getUserFromSession(request: Request, env: Env): Promise<AuthUser | null> {
  const result = await verifyAuth(request, env);
  return result.success ? result.user || null : null;
}