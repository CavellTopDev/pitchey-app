/**
 * Better Auth Client Configuration for Frontend
 * Migrated from JWT to session-based authentication
 */

import React from 'react';
import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';
import { multiSessionClient } from 'better-auth/client/plugins';
import { API_URL } from '../config';

// Portal types
export type PortalType = 'creator' | 'investor' | 'production';

// Better Auth client configuration
export const authClient = createAuthClient({
  baseURL: API_URL,
  
  // Plugin configuration
  plugins: [
    organizationClient(),
    adminClient(), 
    multiSessionClient()
  ],
  
  // Cookie configuration
  cookies: {
    sessionToken: {
      name: 'pitchey-session'
    }
  },

  // Fetch configuration for Cloudflare Workers
  fetchOptions: {
    credentials: 'include' as RequestCredentials,
    headers: {
      'Content-Type': 'application/json'
    }
  }
});

/**
 * Portal-specific authentication hooks
 */
export interface PortalAuthMethods {
  // Sign in methods
  signInCreator: (email: string, password: string) => Promise<any>;
  signInInvestor: (email: string, password: string) => Promise<any>;
  signInProduction: (email: string, password: string) => Promise<any>;
  
  // Registration methods  
  registerCreator: (email: string, username: string, password: string) => Promise<any>;
  registerInvestor: (email: string, username: string, password: string) => Promise<any>;
  registerProduction: (email: string, username: string, password: string) => Promise<any>;
  
  // Session management
  getSession: () => Promise<any>;
  signOut: () => Promise<any>;
  
  // Portal validation
  validatePortalAccess: (userType: string, requiredPortal: PortalType) => boolean;
}

/**
 * Create portal authentication methods
 */
export function createPortalAuthMethods(): PortalAuthMethods {
  return {
    // Creator authentication
    async signInCreator(email: string, password: string) {
      const response = await fetch(`${API_URL}/api/auth/creator/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || 'Login failed');
      }

      return response.json();
    },

    // Investor authentication  
    async signInInvestor(email: string, password: string) {
      const response = await fetch(`${API_URL}/api/auth/investor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || 'Login failed');
      }

      return response.json();
    },

    // Production authentication
    async signInProduction(email: string, password: string) {
      const response = await fetch(`${API_URL}/api/auth/production/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || 'Login failed');
      }

      return response.json();
    },

    // Creator registration
    async registerCreator(email: string, username: string, password: string) {
      const response = await fetch(`${API_URL}/api/auth/creator/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(error.error || 'Registration failed');
      }

      return response.json();
    },

    // Investor registration
    async registerInvestor(email: string, username: string, password: string) {
      const response = await fetch(`${API_URL}/api/auth/investor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(error.error || 'Registration failed');
      }

      return response.json();
    },

    // Production registration
    async registerProduction(email: string, username: string, password: string) {
      const response = await fetch(`${API_URL}/api/auth/production/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(error.error || 'Registration failed');
      }

      return response.json();
    },

    // Get current session
    async getSession() {
      try {
        const response = await fetch(`${API_URL}/api/auth/session`, {
          method: 'GET',
          credentials: 'include' // Send cookies for Better Auth session
        });

        if (!response.ok) {
          // Don't throw on 401/403/404/429 - just return null
          if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 429) {
            if (response.status === 429) {
              console.warn('Session check rate limited - treating as unauthenticated');
            }
            return null;
          }
          // For other errors, still return null but log them
          console.warn(`Session check returned ${response.status}`);
          return null;
        }

        return response.json();
      } catch (error) {
        // Network errors or other issues - treat as not authenticated
        console.warn('Session check failed:', error);
        return null;
      }
    },

    // Sign out
    async signOut() {
      const response = await fetch(`${API_URL}/api/auth/sign-out`, {
        method: 'POST',
        credentials: 'include' // Send cookies for Better Auth session
      });

      // Always return success for sign out
      return { success: true };
    },

    // Validate portal access
    validatePortalAccess(userType: string, requiredPortal: PortalType): boolean {
      return userType === requiredPortal;
    }
  };
}

/**
 * Migration utility to clean up JWT artifacts
 */
export function cleanupJWTArtifacts() {
  // Remove JWT-related localStorage items
  const keysToRemove = [
    'authToken',
    'token',
    'jwt',
    'accessToken',
    'refreshToken'
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    // Also remove namespaced versions
    localStorage.removeItem(`pitchey:${key}`);
    localStorage.removeItem(`pitchey:${window.location.host}:${key}`);
  });

  // Clear session storage
  sessionStorage.clear();
}

/**
 * Check if user is authenticated via Better Auth session
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const portalAuth = createPortalAuthMethods();
    const session = await portalAuth.getSession();
    return session && session.user;
  } catch {
    return false;
  }
}

/**
 * Get current user from Better Auth session
 */
export async function getCurrentUser(): Promise<any> {
  try {
    const portalAuth = createPortalAuthMethods();
    const session = await portalAuth.getSession();
    return session?.user || null;
  } catch {
    return null;
  }
}

/**
 * Export portal auth instance for use in stores
 */
export const portalAuth = createPortalAuthMethods();

/**
 * Higher-order component for authentication checking
 */
export function withBetterAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  requiredPortal?: PortalType
): React.ComponentType<T> {
  return function AuthenticatedComponent(props: T) {
    const [isLoading, setIsLoading] = React.useState(true);
    const [isAuthed, setIsAuthed] = React.useState(false);
    const [user, setUser] = React.useState(null);

    React.useEffect(() => {
      const checkAuth = async () => {
        try {
          const session = await getCurrentUser();
          
          if (!session) {
            setIsAuthed(false);
            return;
          }

          // Check portal access if required
          if (requiredPortal) {
            const portalAuth = createPortalAuthMethods();
            const hasAccess = portalAuth.validatePortalAccess(session.userType, requiredPortal);
            
            if (!hasAccess) {
              setIsAuthed(false);
              return;
            }
          }

          setUser(session);
          setIsAuthed(true);
        } catch (error) {
          console.error('Auth check failed:', error);
          setIsAuthed(false);
        } finally {
          setIsLoading(false);
        }
      };

      checkAuth();
    }, []);

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthed) {
      // DISABLED: This was causing redirect loops and flickering
      // Better Auth handles authentication via cookies
      // const loginPath = requiredPortal ? `/login/${requiredPortal}` : '/login';
      // window.location.href = loginPath;
      return <div>Please log in to continue</div>;
    }

    return <WrappedComponent {...props} />;
  };
}