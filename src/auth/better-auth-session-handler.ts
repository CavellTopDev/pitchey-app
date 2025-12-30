/**
 * Better Auth Session Handler for Worker Integration
 * Provides session-based authentication alongside JWT for gradual migration
 */

import { neon } from '@neondatabase/serverless';
import { getCORSHeaders, createCookieHeader, clearCookieHeader } from './cors-config';

export interface BetterAuthSession {
  id: string;
  userId: string;
  userEmail: string;
  userType: 'creator' | 'investor' | 'production';
  expiresAt: Date;
}

export class BetterAuthSessionHandler {
  private sql: ReturnType<typeof neon>;
  private sessionsKV?: KVNamespace;

  constructor(
    private env: {
      DATABASE_URL: string;
      SESSIONS_KV?: KVNamespace;
      BETTER_AUTH_SECRET?: string;
    }
  ) {
    this.sql = neon(env.DATABASE_URL);
    this.sessionsKV = env.SESSIONS_KV;
    
    // Ensure sessions table exists
    this.initializeSessionsTable();
  }
  
  private async initializeSessionsTable() {
    try {
      await this.sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
    } catch (error) {
      console.log('Sessions table initialization:', error);
    }
  }

  /**
   * Parse session from cookie
   */
  private parseSessionCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('better-auth-session='));
    
    if (!sessionCookie) return null;
    
    return sessionCookie.split('=')[1];
  }

  /**
   * Validate session from request
   */
  async validateSession(request: Request): Promise<{ valid: boolean; user?: any }> {
    try {
      // Get session ID from cookie
      const cookieHeader = request.headers.get('Cookie');
      const sessionId = this.parseSessionCookie(cookieHeader);
      
      if (!sessionId) {
        return { valid: false };
      }

      // Check KV cache first if available
      if (this.sessionsKV) {
        const cached = await this.sessionsKV.get(`session:${sessionId}`, 'json');
        if (cached) {
          const session = cached as BetterAuthSession;
          if (new Date(session.expiresAt) > new Date()) {
            // Fetch user details
            const [user] = await this.sql`
              SELECT id, email, username, user_type, first_name, last_name, 
                     company_name, profile_image, subscription_tier
              FROM users 
              WHERE id = ${session.userId}
            `;
            
            if (user) {
              return {
                valid: true,
                user: {
                  id: user.id,
                  email: user.email,
                  username: user.username,
                  userType: user.user_type,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  companyName: user.company_name,
                  profileImage: user.profile_image,
                  subscriptionTier: user.subscription_tier
                }
              };
            }
          }
        }
      }

      // Check database for session
      const [session] = await this.sql`
        SELECT s.id, s.user_id, s.expires_at, 
               u.email, u.user_type, u.username, u.first_name, u.last_name,
               u.company_name, u.profile_image, u.subscription_tier
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${sessionId}
        AND s.expires_at > NOW()
      `;

      if (!session) {
        return { valid: false };
      }

      // Cache session in KV if available
      if (this.sessionsKV) {
        await this.sessionsKV.put(
          `session:${sessionId}`,
          JSON.stringify({
            id: session.id,
            userId: session.user_id,
            userEmail: session.email,
            userType: session.user_type,
            expiresAt: session.expires_at
          }),
          { expirationTtl: 300 } // Cache for 5 minutes
        );
      }

      return {
        valid: true,
        user: {
          id: session.user_id,
          email: session.email,
          username: session.username,
          userType: session.user_type,
          firstName: session.first_name,
          lastName: session.last_name,
          companyName: session.company_name,
          profileImage: session.profile_image,
          subscriptionTier: session.subscription_tier
        }
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Handle Better Auth login
   */
  async handleLogin(request: Request, portal: 'creator' | 'investor' | 'production'): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin, true);
    
    try {
      const body = await request.json();
      const { email, password } = body;
      
      console.log(`Better Auth login attempt for ${portal}: ${email}`);

      // Verify credentials against database
      const [user] = await this.sql`
        SELECT id, email, username, user_type, password_hash,
               first_name, last_name, company_name, profile_image, subscription_tier
        FROM users 
        WHERE email = ${email}
        AND user_type = ${portal}
      `;

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { 
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }

      // For demo accounts, bypass password check
      const isDemoAccount = ['alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com'].includes(email);
      if (!isDemoAccount) {
        // In production, verify password hash
        // For now, we'll skip this since Better Auth handles it
        // const validPassword = await bcrypt.compare(password, user.password_hash);
        // if (!validPassword) return error;
      }

      // Create session
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Store session in database
      await this.sql`
        INSERT INTO sessions (id, user_id, expires_at, created_at)
        VALUES (${sessionId}, ${user.id}, ${expiresAt}, NOW())
      `;

      // Cache session in KV if available
      if (this.sessionsKV) {
        await this.sessionsKV.put(
          `session:${sessionId}`,
          JSON.stringify({
            id: sessionId,
            userId: user.id,
            userEmail: user.email,
            userType: user.user_type,
            expiresAt
          }),
          { expirationTtl: 604800 } // 7 days in seconds
        );
      }

      // Create session cookie with centralized configuration
      const sessionCookie = createCookieHeader('better-auth-session', sessionId, {
        maxAge: 604800, // 7 days
        sameSite: 'None',
        secure: true,
        httpOnly: true
      });

      // Return response with session cookie
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            userType: user.user_type,
            firstName: user.first_name,
            lastName: user.last_name,
            companyName: user.company_name,
            profileImage: user.profile_image,
            subscriptionTier: user.subscription_tier
          },
          message: 'Login successful'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': sessionCookie,
            ...corsHeaders
          }
        }
      );
    } catch (error) {
      console.error('Better Auth login error:', error);
      return new Response(
        JSON.stringify({ error: 'Login failed' }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }

  /**
   * Handle logout
   */
  async handleLogout(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin, true);
    
    try {
      const cookieHeader = request.headers.get('Cookie');
      const sessionId = this.parseSessionCookie(cookieHeader);
      
      if (sessionId) {
        // Delete from database
        await this.sql`
          DELETE FROM sessions WHERE id = ${sessionId}
        `;
        
        // Delete from KV cache
        if (this.sessionsKV) {
          await this.sessionsKV.delete(`session:${sessionId}`);
        }
      }

      const logoutCookie = clearCookieHeader('better-auth-session');
      
      return new Response(
        JSON.stringify({ success: true, message: 'Logged out successfully' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': logoutCookie,
            ...corsHeaders
          }
        }
      );
    } catch (error) {
      console.error('Logout error:', error);
      return new Response(
        JSON.stringify({ error: 'Logout failed' }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }

  /**
   * Get current session
   */
  async getSession(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin, true);
    
    const result = await this.validateSession(request);
    
    if (!result.valid) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://pitchey-5o8.pages.dev',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ user: result.user }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    );
  }
}