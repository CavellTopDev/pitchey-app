/**
 * Authentication Adapter
 * Bridges the gap between JWT-expecting frontend and Better Auth session-based backend
 * Provides backward compatibility while migrating to Better Auth
 */

import { createAuth } from './better-auth-config';
import type { PortalType } from './better-auth-config';

export interface AuthAdapterConfig {
  env: any;
  enableJWTFallback?: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
  userType: PortalType;
  name: string;
  exp: number;
  iat: number;
}

export class AuthAdapter {
  private auth: ReturnType<typeof createAuth>;
  private enableJWTFallback: boolean;

  constructor(config: AuthAdapterConfig) {
    this.auth = createAuth(config.env);
    this.enableJWTFallback = config.enableJWTFallback ?? true;
  }

  /**
   * Handle login request - supports both JWT response and Better Auth session
   */
  async handleLogin(request: Request, userType: PortalType): Promise<Response> {
    try {
      const body = await request.json();
      const { email, password } = body;

      // First, try Better Auth login
      const authResponse = await this.auth.api.signInEmail({
        body: { email, password },
        asResponse: true
      });

      if (authResponse.status !== 200) {
        const error = await authResponse.json();
        return new Response(JSON.stringify({
          success: false,
          error: { message: error.message || 'Invalid credentials' }
        }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const authData = await authResponse.json();
      
      // Get user details from database
      const user = await this.getUserFromDatabase(authData.user.id, userType);
      
      if (!user || user.userType !== userType) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Unauthorized for this portal' }
        }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generate JWT token for backward compatibility if enabled
      let token = '';
      if (this.enableJWTFallback) {
        token = await this.generateJWTToken(user);
      }

      // Create response with both session cookie and JWT
      const response = new Response(JSON.stringify({
        success: true,
        data: {
          token, // For legacy frontend
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            userType: user.userType,
            companyName: user.companyName,
            bio: user.bio,
            website: user.website,
            linkedinUrl: user.linkedinUrl,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Forward Better Auth session cookies
          'Set-Cookie': authResponse.headers.get('Set-Cookie') || ''
        }
      });

      return response;

    } catch (error) {
      console.error('Login error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Authentication failed' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle registration request
   */
  async handleRegister(request: Request, userType: PortalType): Promise<Response> {
    try {
      const body = await request.json();
      const { email, password, name, companyName, phone, bio, website, linkedinUrl } = body;

      // Register with Better Auth
      const authResponse = await this.auth.api.signUpEmail({
        body: { 
          email, 
          password,
          name,
          data: {
            userType,
            companyName,
            phone,
            bio,
            website,
            linkedinUrl
          }
        },
        asResponse: true
      });

      if (authResponse.status !== 200) {
        const error = await authResponse.json();
        return new Response(JSON.stringify({
          success: false,
          error: { message: error.message || 'Registration failed' }
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const authData = await authResponse.json();
      
      // Create user in our database with portal-specific data
      const user = await this.createUserInDatabase({
        id: authData.user.id,
        email,
        name,
        userType,
        companyName,
        phone,
        bio,
        website,
        linkedinUrl
      });

      // Generate JWT token for backward compatibility
      let token = '';
      if (this.enableJWTFallback) {
        token = await this.generateJWTToken(user);
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          token,
          user
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': authResponse.headers.get('Set-Cookie') || ''
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Registration failed' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Validate JWT token or Better Auth session
   */
  async validateAuth(request: Request): Promise<{ valid: boolean; user?: any }> {
    // First, check Better Auth session
    try {
      const sessionResponse = await this.auth.api.getSession({
        headers: request.headers,
        asResponse: true
      });

      if (sessionResponse.status === 200) {
        const sessionData = await sessionResponse.json();
        if (sessionData.session && sessionData.user) {
          const user = await this.getUserFromDatabase(sessionData.user.id);
          return { valid: true, user };
        }
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }

    // Fallback to JWT validation if enabled
    if (this.enableJWTFallback) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = await this.validateJWTToken(token);
        if (payload) {
          const user = await this.getUserFromDatabase(payload.userId);
          return { valid: true, user };
        }
      }
    }

    return { valid: false };
  }

  /**
   * Handle logout
   */
  async handleLogout(request: Request): Promise<Response> {
    try {
      const response = await this.auth.api.signOut({
        headers: request.headers,
        asResponse: true
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': response.headers.get('Set-Cookie') || ''
        }
      });

    } catch (error) {
      console.error('Logout error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Logout failed' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Generate JWT token for backward compatibility
   */
  private async generateJWTToken(user: any): Promise<string> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30), // 30 days
      iat: Math.floor(Date.now() / 1000)
    };

    // Use Web Crypto API for proper JWT signing
    const encoder = new TextEncoder();
    const data = encoder.encode(
      btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' +
      btoa(JSON.stringify(payload))
    );

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.auth.options.secret || 'fallback-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, data);
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    return `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify(payload))}.${signatureBase64}`;
  }

  /**
   * Validate JWT token
   */
  private async validateJWTToken(token: string): Promise<JWTPayload | null> {
    try {
      const [headerB64, payloadB64, signatureB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64)) as JWTPayload;

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      // TODO: Verify signature properly
      return payload;

    } catch (error) {
      console.error('JWT validation error:', error);
      return null;
    }
  }

  /**
   * Get user from database
   */
  private async getUserFromDatabase(userId: string, requiredType?: PortalType): Promise<any> {
    // This will be implemented with actual database query
    // For now, return mock data
    return {
      id: userId,
      email: 'user@example.com',
      name: 'Test User',
      userType: requiredType || 'creator',
      companyName: '',
      bio: '',
      website: '',
      linkedinUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Create user in database
   */
  private async createUserInDatabase(userData: any): Promise<any> {
    // This will be implemented with actual database insert
    // For now, return the user data
    return {
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Middleware to validate authentication on protected routes
   */
  async requireAuth(request: Request): Promise<{ authorized: boolean; user?: any; response?: Response }> {
    const { valid, user } = await this.validateAuth(request);
    
    if (!valid) {
      return {
        authorized: false,
        response: new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      };
    }

    return { authorized: true, user };
  }

  /**
   * Middleware to check portal-specific authorization
   */
  async requirePortalAuth(
    request: Request, 
    requiredPortal: PortalType
  ): Promise<{ authorized: boolean; user?: any; response?: Response }> {
    const authResult = await this.requireAuth(request);
    
    if (!authResult.authorized) {
      return authResult;
    }

    if (authResult.user?.userType !== requiredPortal) {
      return {
        authorized: false,
        response: new Response(JSON.stringify({
          success: false,
          error: { message: `Access denied. ${requiredPortal} portal access required.` }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      };
    }

    return { authorized: true, user: authResult.user };
  }
}

// Export singleton factory
export function createAuthAdapter(env: any): AuthAdapter {
  return new AuthAdapter({ env, enableJWTFallback: true });
}