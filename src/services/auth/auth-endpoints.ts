/**
 * Authentication Endpoints Module
 * Complete authentication system with login, register, and token management
 */

import { AuthPayload, validateJWT, extractAuthToken, createAuthErrorResponse } from '../../shared/auth-utils';
import { users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
  userType: 'creator' | 'investor' | 'production';
  companyName?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      username: string;
      userType: string;
      firstName?: string;
      lastName?: string;
    };
  };
  error?: {
    message: string;
    code: string;
  };
}

export class AuthEndpoints {
  private jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  /**
   * Handle all authentication endpoints
   */
  async handleAuthRequest(request: Request, pathname: string, sql: any): Promise<Response | null> {
    const method = request.method;

    // Login endpoints
    if (pathname === '/api/auth/creator/login' && method === 'POST') {
      return this.handleLogin(request, sql, 'creator');
    }
    if (pathname === '/api/auth/investor/login' && method === 'POST') {
      return this.handleLogin(request, sql, 'investor');
    }
    if (pathname === '/api/auth/production/login' && method === 'POST') {
      return this.handleLogin(request, sql, 'production');
    }

    // Register endpoints  
    if (pathname === '/api/auth/creator/register' && method === 'POST') {
      return this.handleRegister(request, sql, 'creator');
    }
    if (pathname === '/api/auth/investor/register' && method === 'POST') {
      return this.handleRegister(request, sql, 'investor');
    }
    if (pathname === '/api/auth/production/register' && method === 'POST') {
      return this.handleRegister(request, sql, 'production');
    }

    // Token validation
    if (pathname === '/api/validate-token' && method === 'GET') {
      return this.handleValidateToken(request, sql);
    }
    if (pathname === '/api/auth/validate' && method === 'GET') {
      return this.handleValidateToken(request, sql);
    }

    // Token refresh
    if (pathname === '/api/refresh-token' && method === 'POST') {
      return this.handleRefreshToken(request, sql);
    }

    // Logout
    if (pathname === '/api/auth/logout' && method === 'POST') {
      return this.handleLogout(request);
    }

    // Password reset (basic implementation)
    if (pathname === '/api/auth/forgot-password' && method === 'POST') {
      return this.handleForgotPassword(request, sql);
    }

    return null;
  }

  /**
   * Handle user login
   */
  private async handleLogin(request: Request, sql: any, userType: 'creator' | 'investor' | 'production'): Promise<Response> {
    try {
      const body = await request.json() as LoginRequest;
      
      if (!body.email || !body.password) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Email and password required', code: 'INVALID_INPUT' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Query user from database
      const userResult = await sql
        .select()
        .from(users)
        .where(and(
          eq(users.email, body.email.toLowerCase()),
          eq(users.userType, userType),
          eq(users.isActive, true)
        ))
        .limit(1);

      if (userResult.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = userResult[0];

      // For demo purposes, verify password (in production, use proper bcrypt)
      const isValidPassword = await this.verifyPassword(body.password, user.passwordHash);
      
      if (!isValidPassword) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generate JWT token
      const token = await this.generateJWT({
        userId: user.id.toString(),
        email: user.email,
        userType: user.userType,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      });

      // Update last login
      await sql
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      return new Response(JSON.stringify({
        success: true,
        data: {
          token,
          user: {
            id: user.id.toString(),
            email: user.email,
            username: user.username,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Login error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Login failed', code: 'LOGIN_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle user registration
   */
  private async handleRegister(request: Request, sql: any, userType: 'creator' | 'investor' | 'production'): Promise<Response> {
    try {
      const body = await request.json() as RegisterRequest;

      if (!body.email || !body.password || !body.username) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Email, password and username required', code: 'INVALID_INPUT' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user already exists
      const existingUser = await sql
        .select()
        .from(users)
        .where(eq(users.email, body.email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'User already exists', code: 'USER_EXISTS' }
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Hash password (simplified for demo)
      const passwordHash = await this.hashPassword(body.password);

      // Create new user
      const newUserResult = await sql
        .insert(users)
        .values({
          email: body.email.toLowerCase(),
          username: body.username,
          password: passwordHash, // Legacy field
          passwordHash: passwordHash,
          userType: userType,
          firstName: body.firstName,
          lastName: body.lastName,
          companyName: body.companyName,
          emailVerified: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      const newUser = newUserResult[0];

      // Generate JWT token
      const token = await this.generateJWT({
        userId: newUser.id.toString(),
        email: newUser.email,
        userType: newUser.userType,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          token,
          user: {
            id: newUser.id.toString(),
            email: newUser.email,
            username: newUser.username,
            userType: newUser.userType,
            firstName: newUser.firstName,
            lastName: newUser.lastName
          }
        }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Registration error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Registration failed', code: 'REGISTRATION_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle token validation
   */
  private async handleValidateToken(request: Request, sql: any): Promise<Response> {
    try {
      const token = extractAuthToken(request);
      if (!token) {
        return createAuthErrorResponse('Authorization token required', 401);
      }

      const auth = await validateJWT(token, this.jwtSecret);

      // Verify user still exists and is active
      const userResult = await sql
        .select()
        .from(users)
        .where(and(
          eq(users.id, parseInt(auth.userId)),
          eq(users.isActive, true)
        ))
        .limit(1);

      if (userResult.length === 0) {
        return createAuthErrorResponse('User not found or inactive', 401);
      }

      const user = userResult[0];

      return new Response(JSON.stringify({
        success: true,
        user: {
          id: user.id.toString(),
          email: user.email,
          username: user.username,
          userType: user.userType,
          firstName: user.firstName,
          lastName: user.lastName
        },
        exp: auth.exp
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return createAuthErrorResponse(`Invalid token: ${error.message}`, 401);
    }
  }

  /**
   * Handle token refresh
   */
  private async handleRefreshToken(request: Request, sql: any): Promise<Response> {
    try {
      const token = extractAuthToken(request);
      if (!token) {
        return createAuthErrorResponse('Authorization token required', 401);
      }

      const auth = await validateJWT(token, this.jwtSecret);

      // Generate new token
      const newToken = await this.generateJWT({
        userId: auth.userId,
        email: auth.email,
        userType: auth.userType,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      });

      return new Response(JSON.stringify({
        success: true,
        token: newToken
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return createAuthErrorResponse(`Token refresh failed: ${error.message}`, 401);
    }
  }

  /**
   * Handle logout
   */
  private async handleLogout(request: Request): Promise<Response> {
    // In a stateless JWT system, logout is handled client-side
    // Could implement token blacklisting here if needed
    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle forgot password
   */
  private async handleForgotPassword(request: Request, sql: any): Promise<Response> {
    try {
      const body = await request.json() as { email: string };
      
      if (!body.email) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Email required', code: 'INVALID_INPUT' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // In a real implementation, you'd send a password reset email
      // For now, just return success to prevent enumeration
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account with that email exists, you will receive a password reset link'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Password reset request failed', code: 'RESET_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Generate JWT token
   */
  private async generateJWT(payload: AuthPayload): Promise<string> {
    // Simplified JWT generation for demo (use proper library in production)
    const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'HS256' }));
    const payloadStr = btoa(JSON.stringify(payload));
    const signature = await this.createSignature(`${header}.${payloadStr}`, this.jwtSecret);
    
    return `${header}.${payloadStr}.${signature}`;
  }

  /**
   * Create HMAC signature for JWT
   */
  private async createSignature(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Hash password (simplified for demo)
   */
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  }

  /**
   * Verify password (simplified for demo)
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const hashedInput = await this.hashPassword(password);
    return hashedInput === hash;
  }
}