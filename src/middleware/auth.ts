/**
 * Authentication Middleware Stubs for Workers
 * These are placeholder implementations - real auth is handled by Better Auth
 */

export type UserRole = 'creator' | 'investor' | 'production' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Middleware that requires authentication
 */
export function requireAuth(handler: (request: Request, user: AuthUser) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    // In production, this would validate the Better Auth session
    // For now, allow requests through for API compatibility
    const mockUser: AuthUser = {
      id: 'auth-required',
      email: 'auth@required.com',
      name: 'Auth Required',
      role: 'creator'
    };
    return handler(request, mockUser);
  };
}

/**
 * Middleware that requires a specific role
 */
export function requireRole(roles: UserRole | UserRole[]) {
  return (handler: (request: Request, user: AuthUser) => Promise<Response>) => {
    return async (request: Request): Promise<Response> => {
      // In production, this would validate the role from Better Auth session
      const mockUser: AuthUser = {
        id: 'role-required',
        email: 'role@required.com',
        name: 'Role Required',
        role: Array.isArray(roles) ? roles[0] : roles
      };
      return handler(request, mockUser);
    };
  };
}
