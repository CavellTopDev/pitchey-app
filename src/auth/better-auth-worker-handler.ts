/**
 * Better Auth Worker Integration Handler
 * Optimized for Cloudflare Workers with free tier constraints
 */

import { createBetterAuth, createPortalSignInData, createPortalSignUpData, validatePortalAccess, type PortalType, type BetterAuthInstance } from './better-auth-cloudflare-config';

// Environment interface
interface WorkerEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  SESSIONS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
  KV?: KVNamespace;
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  TRUSTED_ORIGINS?: string;
}

/**
 * Better Auth Worker Handler
 */
export class BetterAuthWorkerHandler {
  private auth: BetterAuthInstance;
  private rateLimiter: Map<string, number[]> = new Map();

  constructor(private env: WorkerEnv) {
    this.auth = createBetterAuth(env);
  }

  /**
   * Handle Better Auth requests
   */
  async handleAuthRequest(request: Request): Promise<Response> {
    try {
      // Rate limiting check
      if (!this.checkRateLimit(this.getClientIP(request))) {
        return this.createErrorResponse('Too many requests', 429);
      }

      // Let Better Auth handle the request
      return await this.auth.handler(request);
    } catch (error) {
      console.error('Better Auth handler error:', error);
      return this.createErrorResponse('Authentication service error', 500);
    }
  }

  /**
   * Portal-specific authentication handlers
   */
  async handlePortalAuth(request: Request, portal: PortalType): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      if (method === 'POST') {
        const body = await request.json();

        // Handle portal login
        if (url.pathname.endsWith('/login')) {
          return this.handlePortalLogin(body, portal, request);
        }

        // Handle portal registration
        if (url.pathname.endsWith('/register')) {
          return this.handlePortalRegister(body, portal, request);
        }
      }

      // Handle logout
      if (method === 'POST' && url.pathname.endsWith('/logout')) {
        return this.handleLogout(request);
      }

      // Handle session validation
      if (method === 'GET' && url.pathname.endsWith('/session')) {
        return this.handleSessionCheck(request, portal);
      }

      return this.createErrorResponse('Endpoint not found', 404);

    } catch (error) {
      console.error(`Portal auth error for ${portal}:`, error);
      return this.createErrorResponse('Authentication failed', 400);
    }
  }

  /**
   * Handle portal-specific login
   */
  private async handlePortalLogin(body: any, portal: PortalType, request: Request): Promise<Response> {
    const { email, password } = body;

    if (!email || !password) {
      return this.createErrorResponse('Email and password required', 400);
    }

    try {
      // Create sign-in request for Better Auth
      const signInData = createPortalSignInData(email, password, { portal });
      
      // Create a new request for Better Auth
      const authRequest = new Request(`${request.url.replace(/\/api\/auth\/\w+\/login$/, '/api/auth/sign-in')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getForwardedHeaders(request)
        },
        body: JSON.stringify(signInData)
      });

      // Call Better Auth sign-in
      const authResponse = await this.auth.handler(authRequest);
      
      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({ error: 'Login failed' }));
        return this.createErrorResponse(errorData.error || 'Invalid credentials', 401);
      }

      // Get the session data
      const sessionData = await authResponse.json();
      
      // Validate portal access
      if (sessionData.user && !validatePortalAccess(sessionData.user, portal)) {
        return this.createErrorResponse(`Access denied for ${portal} portal`, 403);
      }

      // Return success with proper CORS headers
      return this.createSuccessResponse({
        user: sessionData.user,
        session: sessionData.session,
        portal
      }, authResponse);

    } catch (error) {
      console.error('Portal login error:', error);
      return this.createErrorResponse('Login service unavailable', 500);
    }
  }

  /**
   * Handle portal-specific registration
   */
  private async handlePortalRegister(body: any, portal: PortalType, request: Request): Promise<Response> {
    const { email, username, password } = body;

    if (!email || !username || !password) {
      return this.createErrorResponse('Email, username, and password required', 400);
    }

    try {
      // Create sign-up request for Better Auth
      const signUpData = createPortalSignUpData(email, username, password, { portal });
      
      // Create a new request for Better Auth
      const authRequest = new Request(`${request.url.replace(/\/api\/auth\/\w+\/register$/, '/api/auth/sign-up')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getForwardedHeaders(request)
        },
        body: JSON.stringify(signUpData)
      });

      // Call Better Auth sign-up
      const authResponse = await this.auth.handler(authRequest);
      
      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({ error: 'Registration failed' }));
        return this.createErrorResponse(errorData.error || 'Registration failed', 400);
      }

      // Get the session data
      const sessionData = await authResponse.json();

      // Return success with proper CORS headers
      return this.createSuccessResponse({
        user: sessionData.user,
        session: sessionData.session,
        portal
      }, authResponse);

    } catch (error) {
      console.error('Portal register error:', error);
      return this.createErrorResponse('Registration service unavailable', 500);
    }
  }

  /**
   * Handle logout
   */
  private async handleLogout(request: Request): Promise<Response> {
    try {
      // Create logout request for Better Auth
      const authRequest = new Request(request.url.replace(/\/api\/auth\/\w+\/logout$/, '/api/auth/sign-out'), {
        method: 'POST',
        headers: {
          ...this.getForwardedHeaders(request),
          'Cookie': request.headers.get('Cookie') || ''
        }
      });

      // Call Better Auth sign-out
      const authResponse = await this.auth.handler(authRequest);
      
      // Return success (even if Better Auth fails, clear client state)
      return this.createSuccessResponse({ success: true }, authResponse);

    } catch (error) {
      console.error('Logout error:', error);
      // Always return success for logout to clear client state
      return this.createSuccessResponse({ success: true });
    }
  }

  /**
   * Handle session validation
   */
  private async handleSessionCheck(request: Request, portal?: PortalType): Promise<Response> {
    try {
      // Create session request for Better Auth
      const authRequest = new Request(request.url.replace(/\/api\/auth\/\w+\/session$/, '/api/auth/session'), {
        method: 'GET',
        headers: {
          ...this.getForwardedHeaders(request),
          'Cookie': request.headers.get('Cookie') || ''
        }
      });

      // Call Better Auth session
      const authResponse = await this.auth.handler(authRequest);
      
      if (!authResponse.ok) {
        return this.createErrorResponse('Not authenticated', 401);
      }

      const sessionData = await authResponse.json();

      // Validate portal access if specified
      if (portal && sessionData.user && !validatePortalAccess(sessionData.user, portal)) {
        return this.createErrorResponse(`Access denied for ${portal} portal`, 403);
      }

      return this.createSuccessResponse(sessionData, authResponse);

    } catch (error) {
      console.error('Session check error:', error);
      return this.createErrorResponse('Session validation failed', 500);
    }
  }

  /**
   * Get session from request
   */
  async getSession(request: Request): Promise<any> {
    try {
      const authRequest = new Request(`${this.env.BETTER_AUTH_URL || 'http://localhost:8001'}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('Cookie') || ''
        }
      });

      const response = await this.auth.handler(authRequest);
      
      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Rate limiting for free tier
   */
  private checkRateLimit(clientIP: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100; // 100 requests per minute

    // Get or create request history for this IP
    const requests = this.rateLimiter.get(clientIP) || [];
    
    // Filter out old requests
    const recentRequests = requests.filter(time => time > now - windowMs);
    
    // Check if over limit
    if (recentRequests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.rateLimiter.set(clientIP, recentRequests);
    
    // Cleanup old entries periodically (1% chance)
    if (Math.random() < 0.01) {
      this.cleanupRateLimit();
    }
    
    return true;
  }

  /**
   * Cleanup old rate limit entries
   */
  private cleanupRateLimit(): void {
    const now = Date.now();
    const windowMs = 60 * 1000;
    
    for (const [ip, requests] of this.rateLimiter.entries()) {
      const recentRequests = requests.filter(time => time > now - windowMs);
      if (recentRequests.length === 0) {
        this.rateLimiter.delete(ip);
      } else {
        this.rateLimiter.set(ip, recentRequests);
      }
    }
  }

  /**
   * Get client IP from request
   */
  private getClientIP(request: Request): string {
    return request.headers.get('CF-Connecting-IP') ||
           request.headers.get('X-Forwarded-For')?.split(',')[0] ||
           request.headers.get('X-Real-IP') ||
           'unknown';
  }

  /**
   * Get forwarded headers for Better Auth
   */
  private getForwardedHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': request.headers.get('User-Agent') || '',
      'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || 
                         request.headers.get('X-Forwarded-For') || '',
      'X-Real-IP': request.headers.get('CF-Connecting-IP') || ''
    };

    return headers;
  }

  /**
   * Create error response with CORS
   */
  private createErrorResponse(message: string, status = 400): Response {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...this.getCORSHeaders()
      }
    });
  }

  /**
   * Create success response with CORS
   */
  private createSuccessResponse(data: any, originalResponse?: Response): Response {
    const headers = {
      'Content-Type': 'application/json',
      ...this.getCORSHeaders()
    };

    // Copy Set-Cookie headers from Better Auth response
    if (originalResponse) {
      const setCookie = originalResponse.headers.get('Set-Cookie');
      if (setCookie) {
        headers['Set-Cookie'] = setCookie;
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers
    });
  }

  /**
   * Get CORS headers
   */
  private getCORSHeaders(): Record<string, string> {
    const trustedOrigins = this.env.TRUSTED_ORIGINS 
      ? this.env.TRUSTED_ORIGINS.split(',')
      : ['*'];

    return {
      'Access-Control-Allow-Origin': trustedOrigins[0] || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    };
  }
}