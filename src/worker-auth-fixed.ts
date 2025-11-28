/**
 * Fixed Authentication Handler with Proper Database Integration
 * Resolves the issue where all portals return the same user
 */

import { Toucan } from 'toucan-js';
import * as bcrypt from 'bcryptjs';

// JWT utilities (same as before)
async function createJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerStr = btoa(JSON.stringify(header));
  const payloadStr = btoa(JSON.stringify(payload));
  
  const message = `${headerStr}.${payloadStr}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureStr = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${message}.${signatureStr}`;
}

// Demo accounts for fallback
const DEMO_ACCOUNTS = {
  creator: {
    id: 1,
    email: "alex.creator@demo.com",
    password: "Demo123",
    userType: "creator",
    firstName: "Alex",
    lastName: "Creator",
    displayName: "Alex Creator"
  },
  investor: {
    id: 2,
    email: "sarah.investor@demo.com",
    password: "Demo123",
    userType: "investor",
    firstName: "Sarah",
    lastName: "Investor",
    displayName: "Sarah Investor"
  },
  production: {
    id: 3,
    email: "stellar.production@demo.com",
    password: "Demo123",
    userType: "production",
    firstName: "Stellar",
    lastName: "Production",
    displayName: "Stellar Production"
  }
};

/**
 * Authenticates user against database first, falls back to demo accounts
 */
export async function authenticateUser(
  email: string,
  password: string,
  portal: 'creator' | 'investor' | 'production',
  env: any,
  sentry?: Toucan
): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
  try {
    // First, try to authenticate against the database
    if (env.HYPERDRIVE) {
      try {
        const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
        
        // Initialize pool if needed
        dbPool.initialize(env, sentry);
        
        // Query the database for the user
        const result = await withDatabase(env, async (sql) => {
          // Find user by email and user type
          const users = await sql`
            SELECT 
              id,
              email,
              password_hash,
              user_type,
              first_name,
              last_name,
              username,
              avatar_url,
              verified,
              status,
              created_at
            FROM users
            WHERE email = ${email}
              AND user_type = ${portal}
              AND status = 'active'
            LIMIT 1
          `;
          
          return users;
        }, sentry);

        if (result && result.length > 0) {
          const user = result[0];
          
          // Verify password
          const passwordValid = await bcrypt.compare(password, user.password_hash);
          
          if (passwordValid) {
            // Generate JWT token
            const token = await createJWT({
              userId: user.id,
              email: user.email,
              userType: user.user_type,
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
            }, env.JWT_SECRET || 'default-secret-key');

            // Return user data (excluding sensitive info)
            return {
              success: true,
              user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                userType: user.user_type,
                displayName: `${user.first_name} ${user.last_name}`,
                username: user.username,
                avatarUrl: user.avatar_url,
                verified: user.verified,
                source: 'database'
              },
              token
            };
          }
        }
      } catch (dbError) {
        // Log database error but continue to demo account check
        if (sentry) {
          sentry.captureException(dbError);
        }
        console.error('Database authentication error:', dbError);
      }
    }

    // Fallback to demo accounts if database auth fails or not available
    const demoAccount = DEMO_ACCOUNTS[portal];
    if (demoAccount && email === demoAccount.email && password === demoAccount.password) {
      const token = await createJWT({
        userId: demoAccount.id,
        email: demoAccount.email,
        userType: demoAccount.userType,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
      }, env.JWT_SECRET || 'default-secret-key');

      return {
        success: true,
        user: {
          ...demoAccount,
          source: 'demo'
        },
        token
      };
    }

    // Authentication failed
    return {
      success: false,
      error: 'Invalid email or password'
    };

  } catch (error) {
    if (sentry) {
      sentry.captureException(error);
    }
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * Handles portal-specific login with proper user type validation
 */
export async function handlePortalLogin(
  request: Request,
  portal: 'creator' | 'investor' | 'production',
  env: any,
  corsHeaders: any,
  sentry?: Toucan
): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Email and password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Authenticate user
    const authResult = await authenticateUser(email, password, portal, env, sentry);

    if (authResult.success) {
      return new Response(JSON.stringify({
        token: authResult.token,
        user: authResult.user
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: authResult.error || 'Invalid credentials'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

  } catch (error) {
    if (sentry) {
      sentry.captureException(error);
    }
    console.error(`${portal} login error:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Login failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Validates JWT token and returns user data
 */
export async function validateToken(token: string, env: any): Promise<any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerStr, payloadStr, signatureStr] = parts;
    const message = `${headerStr}.${payloadStr}`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.JWT_SECRET || 'default-secret-key'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(message));
    
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(atob(payloadStr));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}