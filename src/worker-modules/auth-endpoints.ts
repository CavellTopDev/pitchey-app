/**
 * Authentication and User Management Endpoints for Unified Worker
 * Handles all authentication, registration, and user profile operations
 */

export class AuthEndpointsHandler {
  constructor(
    private env: any,
    private db: any,
    private sentry: any
  ) {}

  async handleRequest(request: Request, corsHeaders: Record<string, string>, userAuth?: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    return this.handleAuthEndpoints(request, path, corsHeaders) || new Response(JSON.stringify({
      success: false,
      error: { message: 'Auth endpoint not found', code: 'NOT_FOUND' }
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  async handleAuthEndpoints(request: Request, path: string, corsHeaders: Record<string, string>): Promise<Response | null> {
    const method = request.method;
    const url = new URL(request.url);

    try {
      // POST /api/auth/creator/login
      if (path === '/api/auth/creator/login' && method === 'POST') {
        return await this.handleCreatorLogin(request, corsHeaders);
      }

      // POST /api/auth/investor/login  
      if (path === '/api/auth/investor/login' && method === 'POST') {
        return await this.handleInvestorLogin(request, corsHeaders);
      }

      // POST /api/auth/production/login
      if (path === '/api/auth/production/login' && method === 'POST') {
        return await this.handleProductionLogin(request, corsHeaders);
      }

      // POST /api/auth/creator/register
      if (path === '/api/auth/creator/register' && method === 'POST') {
        return await this.handleCreatorRegister(request, corsHeaders);
      }

      // POST /api/auth/investor/register
      if (path === '/api/auth/investor/register' && method === 'POST') {
        return await this.handleInvestorRegister(request, corsHeaders);
      }

      // POST /api/auth/production/register
      if (path === '/api/auth/production/register' && method === 'POST') {
        return await this.handleProductionRegister(request, corsHeaders);
      }

      // POST /api/auth/logout
      if (path === '/api/auth/logout' && method === 'POST') {
        return await this.handleLogout(request, corsHeaders);
      }

      // GET /api/validate-token
      if (path === '/api/validate-token' && method === 'GET') {
        return await this.handleValidateToken(request, corsHeaders);
      }

      // POST /api/refresh-token
      if (path === '/api/refresh-token' && method === 'POST') {
        return await this.handleRefreshToken(request, corsHeaders);
      }

      // POST /api/auth/forgot-password
      if (path === '/api/auth/forgot-password' && method === 'POST') {
        return await this.handleForgotPassword(request, corsHeaders);
      }

      // POST /api/auth/reset-password
      if (path === '/api/auth/reset-password' && method === 'POST') {
        return await this.handleResetPassword(request, corsHeaders);
      }

      // POST /api/auth/verify-email
      if (path === '/api/auth/verify-email' && method === 'POST') {
        return await this.handleVerifyEmail(request, corsHeaders);
      }

      // POST /api/auth/resend-verification
      if (path === '/api/auth/resend-verification' && method === 'POST') {
        return await this.handleResendVerification(request, corsHeaders);
      }

      // POST /api/auth/2fa/setup
      if (path === '/api/auth/2fa/setup' && method === 'POST') {
        return await this.handleSetup2FA(request, corsHeaders);
      }

      // POST /api/auth/2fa/verify
      if (path === '/api/auth/2fa/verify' && method === 'POST') {
        return await this.handleVerify2FA(request, corsHeaders);
      }

      // POST /api/auth/2fa/disable
      if (path === '/api/auth/2fa/disable' && method === 'POST') {
        return await this.handleDisable2FA(request, corsHeaders);
      }

      // GET /api/auth/sessions
      if (path === '/api/auth/sessions' && method === 'GET') {
        return await this.handleGetSessions(request, corsHeaders);
      }

      // DELETE /api/auth/sessions/:sessionId
      if (path.startsWith('/api/auth/sessions/') && method === 'DELETE') {
        const sessionId = path.split('/').pop();
        return await this.handleDeleteSession(request, corsHeaders, sessionId!);
      }

      // POST /api/auth/sessions/revoke-all
      if (path === '/api/auth/sessions/revoke-all' && method === 'POST') {
        return await this.handleRevokeAllSessions(request, corsHeaders);
      }

      return null; // Not an auth endpoint

    } catch (error) {
      await this.sentry.captureException(error as Error, {
        operation: 'auth_endpoints',
        path,
        method
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication service error',
        message: 'An error occurred processing your authentication request'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleCreatorLogin(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const body = await request.json() as { email: string; password: string; };
      const { email, password } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Email and password are required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Database authentication
      let user = null;
      let token = null;

      if (this.db) {
        try {
          const userResults = await this.db.query(
            'SELECT id, email, user_type, first_name, last_name, company_name, password_hash, is_active, email_verified FROM users WHERE email = $1 AND user_type = $2',
            [email, 'creator']
          );

          if (userResults.length > 0 && userResults[0].password_hash === password) {
            user = userResults[0];
            token = await this.generateJWT({
              userId: user.id,
              email: user.email,
              userType: user.user_type
            });
          }
        } catch (dbError) {
          await this.sentry.captureException(dbError as Error, {
            operation: 'creator_login_db',
            email
          });
        }
      }

      // Demo fallback
      if (!user && email === 'alex.creator@demo.com' && password === 'Demo123') {
        user = {
          id: 1,
          email: 'alex.creator@demo.com',
          user_type: 'creator',
          first_name: 'Alex',
          last_name: 'Creator',
          company_name: 'Indie Film Works',
          is_active: true,
          email_verified: true
        };
        token = await this.generateJWT({
          userId: user.id,
          email: user.email,
          userType: user.user_type
        });
      }

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            userType: user.user_type,
            firstName: user.first_name,
            lastName: user.last_name,
            companyName: user.company_name,
            displayName: `${user.first_name} ${user.last_name}`,
            isActive: user.is_active,
            isVerified: user.email_verified
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureException(error as Error, {
        operation: 'creator_login',
        path: '/api/auth/creator/login'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Login failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleInvestorLogin(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const body = await request.json() as { email: string; password: string; };
      const { email, password } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Email and password are required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let user = null;
      let token = null;

      if (this.db) {
        try {
          const userResults = await this.db.query(
            'SELECT id, email, user_type, first_name, last_name, company_name, password_hash, is_active, email_verified FROM users WHERE email = $1 AND user_type = $2',
            [email, 'investor']
          );

          if (userResults.length > 0 && userResults[0].password_hash === password) {
            user = userResults[0];
            token = await this.generateJWT({
              userId: user.id,
              email: user.email,
              userType: user.user_type
            });
          }
        } catch (dbError) {
          await this.sentry.captureException(dbError as Error, {
            operation: 'investor_login_db',
            email
          });
        }
      }

      // Demo fallback
      if (!user && email === 'sarah.investor@demo.com' && password === 'Demo123') {
        user = {
          id: 2,
          email: 'sarah.investor@demo.com',
          user_type: 'investor',
          first_name: 'Sarah',
          last_name: 'Investor',
          company_name: 'Capital Ventures',
          is_active: true,
          email_verified: true
        };
        token = await this.generateJWT({
          userId: user.id,
          email: user.email,
          userType: user.user_type
        });
      }

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            userType: user.user_type,
            firstName: user.first_name,
            lastName: user.last_name,
            companyName: user.company_name,
            displayName: `${user.first_name} ${user.last_name}`,
            isActive: user.is_active,
            isVerified: user.email_verified
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureException(error as Error, {
        operation: 'investor_login'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Login failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleProductionLogin(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const body = await request.json() as { email: string; password: string; };
      const { email, password } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Email and password are required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let user = null;
      let token = null;

      if (this.db) {
        try {
          const userResults = await this.db.query(
            'SELECT id, email, user_type, first_name, last_name, company_name, password_hash, is_active, email_verified FROM users WHERE email = $1 AND user_type = $2',
            [email, 'production']
          );

          if (userResults.length > 0 && userResults[0].password_hash === password) {
            user = userResults[0];
            token = await this.generateJWT({
              userId: user.id,
              email: user.email,
              userType: user.user_type
            });
          }
        } catch (dbError) {
          await this.sentry.captureException(dbError as Error, {
            operation: 'production_login_db',
            email
          });
        }
      }

      // Demo fallback
      if (!user && email === 'stellar.production@demo.com' && password === 'Demo123') {
        user = {
          id: 3,
          email: 'stellar.production@demo.com',
          user_type: 'production',
          first_name: 'Stellar',
          last_name: 'Production',
          company_name: 'Stellar Studios',
          is_active: true,
          email_verified: true
        };
        token = await this.generateJWT({
          userId: user.id,
          email: user.email,
          userType: user.user_type
        });
      }

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            userType: user.user_type,
            firstName: user.first_name,
            lastName: user.last_name,
            companyName: user.company_name,
            displayName: `${user.first_name} ${user.last_name}`,
            isActive: user.is_active,
            isVerified: user.email_verified
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureException(error as Error, {
        operation: 'production_login'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Login failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Registration handlers (simplified for now - can be expanded)
  private async handleCreatorRegister(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({
      success: false,
      error: 'Registration endpoint not yet implemented',
      message: 'Creator registration will be available soon'
    }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleInvestorRegister(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({
      success: false,
      error: 'Registration endpoint not yet implemented',
      message: 'Investor registration will be available soon'
    }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleProductionRegister(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({
      success: false,
      error: 'Registration endpoint not yet implemented',
      message: 'Production company registration will be available soon'
    }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Token validation and management
  private async handleValidateToken(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Authorization header required'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.substring(7);
      const payload = await this.verifyJWT(token);
      
      if (!payload) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid or expired token'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Log payload for debugging
      this.sentry.captureMessage('Token validation payload', 'debug', { extra: { payload } });

      // Transform payload to match frontend expectations
      const userResponse = {
        id: payload.userId || payload.id || 1,
        email: payload.email || 'unknown@demo.com',
        userType: payload.userType || payload.user_type || 'creator',
        firstName: payload.firstName || payload.first_name || 'Demo',
        lastName: payload.lastName || payload.last_name || 'User',
        companyName: payload.companyName || payload.company_name || 'Demo Company',
        displayName: payload.displayName || `${payload.firstName || payload.first_name || 'Demo'} ${payload.lastName || payload.last_name || 'User'}`,
        isActive: true,
        isVerified: true
      };

      return new Response(JSON.stringify({
        success: true,
        user: userResponse,
        exp: payload.exp || Math.floor(Date.now() / 1000) + (24 * 60 * 60)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureException(error as Error, {
        operation: 'validate_token'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Token validation failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Placeholder implementations for remaining auth endpoints
  private async handleLogout(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: true, message: 'Logged out successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleRefreshToken(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleForgotPassword(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleResetPassword(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleVerifyEmail(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleResendVerification(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleSetup2FA(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleVerify2FA(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleDisable2FA(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleGetSessions(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleDeleteSession(request: Request, corsHeaders: Record<string, string>, sessionId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleRevokeAllSessions(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // JWT utilities
  private async generateJWT(payload: any): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (24 * 60 * 60); // 24 hours
    
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: exp
    };

    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(tokenPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signature = await this.signJWT(`${encodedHeader}.${encodedPayload}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private async verifyJWT(token: string): Promise<any> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) return null;

      // Verify signature
      const expectedSignature = await this.signJWT(`${parts[0]}.${parts[1]}`);
      if (parts[2] !== expectedSignature) return null;

      return payload;
    } catch {
      return null;
    }
  }

  private async signJWT(data: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.env.JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
}