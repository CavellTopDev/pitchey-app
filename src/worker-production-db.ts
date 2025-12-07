/**
 * Production Worker with Real Database Connection
 * Uses Neon PostgreSQL for data persistence
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, gte, lte, desc, asc, like, sql, count, inArray } from 'drizzle-orm';
import * as schema from './db/schema.ts';
import { Redis } from '@upstash/redis/cloudflare';
import { SessionManager, RateLimiter } from './auth/session-manager.ts';

// Wrapper for Redis client to work with Cloudflare Workers
function createRedisClient(env: Env) {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Helper function to get relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  ENVIRONMENT?: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  WEBSOCKET_ROOMS?: DurableObjectNamespace;
  NOTIFICATION_ROOMS?: DurableObjectNamespace;
  SENDGRID_API_KEY?: string;
  FRONTEND_URL?: string;
}

// Dynamic CORS headers function to support credentials
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = [
    'https://pitchey.pages.dev',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000'
  ];
  
  // Check if origin matches allowed list or is a Cloudflare Pages subdomain
  const isAllowed = allowedOrigins.includes(origin) || 
                    origin.match(/^https:\/\/[a-z0-9]+\.pitchey\.pages\.dev$/);
  
  // If credentials are needed, we must return the exact origin (not *)
  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'Set-Cookie'
    };
  }
  
  // Fallback for non-credentialed requests
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Helper function to create CORS-enabled JSON responses
function corsResponse(request: Request, data: any, status = 200, headers: Record<string, string> = {}): Response {
  const corsHeaders = getCorsHeaders(request);
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' },
  });
}

async function hashPassword(password: string): Promise<string> {
  // Use bcrypt for new passwords
  return await bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Handle bcrypt hashes from database
  if (hash.startsWith('$2b$') || hash.startsWith('$2a$')) {
    return await bcrypt.compare(password, hash);
  }
  // Fallback for SHA-256 hashes (legacy)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'pitchey-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return inputHash === hash;
}

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function verifyToken(token: string, env: Env): Promise<any | null> {
  try {
    const isValid = await jwt.verify(token, env.JWT_SECRET);
    if (!isValid) return null;
    const { payload } = jwt.decode(token);
    return payload;
  } catch (error) {
    return null;
  }
}

// Unified authentication function that checks both session and JWT
async function authenticateRequest(request: Request, env: Env, db: any): Promise<any | null> {
  // First check for session cookie
  const cookieHeader = request.headers.get('Cookie');
  const sessionId = SessionManager.parseSessionFromCookie(cookieHeader);
  
  if (sessionId) {
    try {
      const redis = createRedisClient(env);
      const sessionManager = new SessionManager(redis, {
        domain: env.ENVIRONMENT === 'production' ? '.pitchey.pages.dev' : undefined,
        secure: env.ENVIRONMENT === 'production',
        httpOnly: true,
        sameSite: 'lax'
      });
      
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        // Get fresh user data from database
        const users = await db.select()
          .from(schema.users)
          .where(eq(schema.users.id, session.userId))
          .limit(1);
        
        if (users.length > 0) {
          const user = users[0];
          // Return JWT-like payload for compatibility
          return {
            sub: user.id.toString(),
            email: user.email,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName,
            companyName: user.companyName,
            verified: user.emailVerified || user.isVerified || false,
            iat: Math.floor(session.createdAt / 1000),
            exp: Math.floor(session.expiresAt / 1000),
          };
        }
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }
  
  // Fall back to JWT token
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return await verifyToken(token, env);
  }
  
  return null;
}

async function handleLogin(request: Request, env: Env, userType: string): Promise<Response> {
  try {
    console.log('Login attempt for userType:', userType);
    
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql);
    
    const body = await request.json();
    const { email, password } = body;
    console.log('Login attempt for email:', email);

    if (!email || !password) {
      return corsResponse(request, {
        success: false,
        message: 'Email and password are required',
      }, 400, getCorsHeaders(request));
    }

    // Rate limiting
    const redis = createRedisClient(env);
    
    const rateLimiter = new RateLimiter(redis, 5, 60);
    const identifier = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { allowed, remaining } = await rateLimiter.checkLimit(`auth:${identifier}`);
    
    if (!allowed) {
      return corsResponse(request, {
        success: false,
        message: 'Too many login attempts. Please try again later.',
      }, 429, getCorsHeaders(request));
    }

    // Get user from database
    console.log('Querying database for user...');
    const users = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    console.log('Database query completed, users found:', users.length);

    if (users.length === 0) {
      return corsResponse(request, {
        success: false,
        message: 'Invalid credentials',
      }, 401, getCorsHeaders(request));
    }

    const user = users[0];
    console.log('User found, verifying password...');

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    console.log('Password verification result:', passwordValid);
    if (!passwordValid) {
      return corsResponse(request, {
        success: false,
        message: 'Invalid credentials',
      }, 401, getCorsHeaders(request));
    }

    // Check user type (unless admin)
    if (userType !== 'admin' && user.userType !== userType) {
      return corsResponse(request, {
        success: false,
        message: `Invalid ${userType} credentials`,
      }, 401, getCorsHeaders(request));
    }

    // Create secure session instead of JWT
    const sessionManager = new SessionManager(redis, {
      domain: env.ENVIRONMENT === 'production' ? '.pitchey.pages.dev' : undefined,
      secure: env.ENVIRONMENT === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    const { sessionId, cookie } = await sessionManager.createSession({
      userId: user.id,
      email: user.email,
      userType: user.userType as any,
    }, request);

    // Update last login
    await db.update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    // Also create JWT for backward compatibility
    const token = await jwt.sign({
      sub: user.id.toString(),
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      verified: user.emailVerified || user.isVerified || false,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    }, env.JWT_SECRET);

    // Prepare response headers with cookie
    const responseHeaders = {
      ...getCorsHeaders(request),
      'Set-Cookie': cookie,
    };

    return corsResponse(request, {
      success: true,
      data: {
        token, // Include JWT for backward compatibility
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          userType: user.userType,
          verified: user.emailVerified || user.isVerified || false,
        },
      },
    }, 200, responseHeaders);
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    // Always include error details for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return corsResponse(request, {
      success: false,
      message: `Login failed: ${errorMessage}`,
      error: String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join(' ') : undefined
    }, 500, getCorsHeaders(request));
  }
}

async function handleRegister(request: Request, env: Env, userType: string): Promise<Response> {
  try {
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql);
    
    const body = await request.json();
    const { email, password, firstName, lastName, companyName } = body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return corsResponse(request, {
        success: false,
        message: 'All fields are required',
      }, 400);
    }

    if (password.length < 8) {
      return corsResponse(request, {
        success: false,
        message: 'Password must be at least 8 characters',
      }, 400);
    }

    // Check if user exists
    const existingUsers = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      return corsResponse(request, {
        success: false,
        message: 'Email already registered',
      }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await db.insert(schema.users)
      .values({
        email,
        username: email.split('@')[0], // Generate username from email
        password: '', // Legacy field, empty for now
        passwordHash,
        firstName,
        lastName,
        companyName: companyName || '',
        userType,
        emailVerified: false,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const user = newUser[0];

    // Generate verification token
    const verificationToken = generateToken();
    
    // Store in KV
    if (env.KV) {
      await env.KV.put(
        `verify:${verificationToken}`,
        JSON.stringify({ userId: user.id, email: user.email }),
        { expirationTtl: 86400 } // 24 hours
      );
    }

    // TODO: Send verification email

    // Create JWT token
    const token = await jwt.sign({
      sub: user.id.toString(),
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      verified: user.emailVerified || user.isVerified || false,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    }, env.JWT_SECRET);

    return corsResponse(request, {
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
        },
      },
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return corsResponse(request, {
      success: false,
      message: 'Registration failed',
    }, 500);
  }
}

// Cache helpers
async function getCachedResponse(key: string, kv: KVNamespace | undefined, request?: Request): Promise<Response | null> {
  if (!kv) return null;
  
  try {
    const cached = await kv.get(key, 'text');
    if (cached) {
      const data = JSON.parse(cached);
      return corsResponse(request, data, 200, {}, request);
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }
  
  return null;
}

async function setCachedResponse(key: string, data: any, kv: KVNamespace | undefined, ttl = 300): Promise<void> {
  if (!kv) return;
  
  try {
    await kv.put(key, JSON.stringify(data), {
      expirationTtl: ttl, // Cache for 5 minutes by default
    });
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;
    const method = request.method;

    // CORS preflight - handle OPTIONS requests immediately
    if (method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: getCorsHeaders(request) 
      });
    }

    // Add endpoint aliases for backward compatibility
    // Fix for saved-pitches endpoint
    if (path === '/api/saved-pitches') {
      path = '/api/user/saved-pitches';
    }
    // Fix for browse enhanced endpoint (without /pitches prefix)
    if (path === '/api/browse/enhanced') {
      path = '/api/pitches/browse/enhanced';
    }
    // Additional alias for investor saved pitches
    if (path === '/api/investor/saved-pitches') {
      path = '/api/user/saved-pitches';
    }

    // WebSocket endpoint - connect to Durable Object
    if (path === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        // Return info for non-WebSocket requests
        return corsResponse(request, {
          success: true,
          message: 'WebSocket endpoint',
          info: 'Connect with WebSocket protocol for real-time features',
        }, 200, {}, request);
      }
      
      // Route to Durable Object if available
      if (env.WEBSOCKET_ROOMS) {
        // Get or create room ID (could be user-specific or global)
        const roomId = env.WEBSOCKET_ROOMS.idFromName('global-room');
        const room = env.WEBSOCKET_ROOMS.get(roomId);
        
        // Forward the WebSocket request to the Durable Object
        return room.fetch(request);
      }
      
      // Fallback to simple WebSocket if no Durable Object
      try {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        
        server.accept();
        server.send(JSON.stringify({
          type: 'connection',
          status: 'connected',
          message: 'Connected to Pitchey real-time service (fallback mode)',
        }));
        
        server.addEventListener('message', event => {
          const message = JSON.parse(event.data as string);
          server.send(JSON.stringify({
            type: 'echo',
            data: message,
            timestamp: new Date().toISOString(),
          }));
        });
        
        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      } catch (error) {
        console.error('WebSocket error:', error);
        return corsResponse(request, {
          success: false,
          message: 'WebSocket initialization failed',
        }, 500);
      }
    }

    try {
      // Initialize database connection
      const sql = neon(env.DATABASE_URL);
      const db = drizzle(sql);

      // Health check
      if (path === '/api/health') {
        // Test database connection
        let dbHealthy = false;
        try {
          await sql`SELECT 1`;
          dbHealthy = true;
        } catch (error) {
          console.error('Database health check failed:', error);
        }

        return corsResponse(request, {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: 'production-db-v1.0',
          services: {
            database: dbHealthy,
            auth: true,
            cache: !!env.KV,
            websocket: !!env.WEBSOCKET_ROOMS,
            email: !!env.SENDGRID_API_KEY,
          },
        });
      }

      // Authentication endpoints
      if (path === '/api/auth/creator/login' && method === 'POST') {
        return handleLogin(request, env, 'creator');
      }
      if (path === '/api/auth/investor/login' && method === 'POST') {
        return handleLogin(request, env, 'investor');
      }
      if (path === '/api/auth/production/login' && method === 'POST') {
        return handleLogin(request, env, 'production');
      }
      if (path === '/api/auth/admin/login' && method === 'POST') {
        return handleLogin(request, env, 'admin');
      }

      // Registration endpoints
      if (path === '/api/auth/creator/register' && method === 'POST') {
        return handleRegister(request, env, 'creator');
      }
      if (path === '/api/auth/investor/register' && method === 'POST') {
        return handleRegister(request, env, 'investor');
      }
      if (path === '/api/auth/production/register' && method === 'POST') {
        return handleRegister(request, env, 'production');
      }

      // Logout endpoint
      if (path === '/api/auth/logout' && method === 'POST') {
        const cookieHeader = request.headers.get('Cookie');
        const sessionId = SessionManager.parseSessionFromCookie(cookieHeader);
        
        if (sessionId) {
          const redis = createRedisClient(env);
          
          const sessionManager = new SessionManager(redis, {
            domain: env.ENVIRONMENT === 'production' ? '.pitchey.pages.dev' : undefined,
            secure: env.ENVIRONMENT === 'production',
          });
          
          await sessionManager.destroySession(sessionId);
        }
        
        const logoutCookie = SessionManager.generateLogoutCookie(
          env.ENVIRONMENT === 'production' ? '.pitchey.pages.dev' : undefined
        );
        
        return corsResponse(request, {
          success: true,
          message: 'Logged out successfully',
        }, 200, {
          ...getCorsHeaders(request),
          'Set-Cookie': logoutCookie,
        });
      }

      // Profile endpoint - returns current user data
      if (path === '/api/auth/profile' && method === 'GET') {
        const cookieHeader = request.headers.get('Cookie');
        const sessionId = SessionManager.parseSessionFromCookie(cookieHeader);
        
        if (!sessionId) {
          // Also check for JWT token for backward compatibility
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return corsResponse(request, {
              success: false,
              message: 'Authentication required',
            }, 401, getCorsHeaders(request));
          }
          
          // Validate JWT token
          try {
            const token = authHeader.substring(7);
            const payload = await jwt.verify(token, env.JWT_SECRET);
            const userId = parseInt(payload.sub as string);
            
            // Get user from database
            const users = await db.select()
              .from(schema.users)
              .where(eq(schema.users.id, userId))
              .limit(1);
            
            if (users.length === 0) {
              return corsResponse(request, {
                success: false,
                message: 'User not found',
              }, 404, getCorsHeaders(request));
            }
            
            const user = users[0];
            return corsResponse(request, {
              success: true,
              data: {
                id: user.id,
                email: user.email,
                username: user.username,
                userType: user.userType,
                firstName: user.firstName,
                lastName: user.lastName,
                companyName: user.companyName,
                profileImage: user.profileImage,
                bio: user.bio,
              },
            }, 200, getCorsHeaders(request));
          } catch (error) {
            return corsResponse(request, {
              success: false,
              message: 'Invalid token',
            }, 401, getCorsHeaders(request));
          }
        }
        
        // Use session authentication
        const redis = createRedisClient(env);
        
        const sessionManager = new SessionManager(redis, {
          domain: env.ENVIRONMENT === 'production' ? '.pitchey.pages.dev' : undefined,
          secure: env.ENVIRONMENT === 'production',
          httpOnly: true,
          sameSite: 'lax'
        });
        const session = await sessionManager.getSession(sessionId);
        
        if (!session) {
          return corsResponse(request, {
            success: false,
            message: 'Invalid or expired session',
          }, 401, getCorsHeaders(request));
        }
        
        // Get fresh user data
        const users = await db.select()
          .from(schema.users)
          .where(eq(schema.users.id, session.userId))
          .limit(1);
        
        if (users.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'User not found',
          }, 404, getCorsHeaders(request));
        }
        
        const user = users[0];
        return corsResponse(request, {
          success: true,
          data: {
            id: user.id,
            email: user.email,
            username: user.username,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName,
            companyName: user.companyName,
            profileImage: user.profileImage,
            bio: user.bio,
          },
        }, 200, getCorsHeaders(request));
      }
      
      // Session validation endpoint
      if (path === '/api/auth/session' && method === 'GET') {
        const cookieHeader = request.headers.get('Cookie');
        const sessionId = SessionManager.parseSessionFromCookie(cookieHeader);
        
        if (!sessionId) {
          return corsResponse(request, {
            success: false,
            message: 'No session found',
          }, 401, getCorsHeaders(request));
        }
        
        const redis = createRedisClient(env);
        
        const sessionManager = new SessionManager(redis, {
          domain: env.ENVIRONMENT === 'production' ? '.pitchey.pages.dev' : undefined,
          secure: env.ENVIRONMENT === 'production',
          httpOnly: true,
          sameSite: 'lax'
        });
        const session = await sessionManager.getSession(sessionId);
        
        if (!session) {
          return corsResponse(request, {
            success: false,
            message: 'Invalid or expired session',
          }, 401, getCorsHeaders(request));
        }
        
        // Get fresh user data
        const users = await db.select()
          .from(schema.users)
          .where(eq(schema.users.id, session.userId))
          .limit(1);
        
        if (users.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'User not found',
          }, 404, getCorsHeaders(request));
        }
        
        const user = users[0];
        
        return corsResponse(request, {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            companyName: user.companyName,
            userType: user.userType,
            verified: user.emailVerified || user.isVerified || false,
          },
          session: {
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
          },
        }, 200, getCorsHeaders(request));
      }

      // Password reset
      if (path === '/api/auth/request-reset' && method === 'POST') {
        const body = await request.json();
        const { email } = body;
        
        if (!email) {
          return corsResponse(request, {
            success: false,
            message: 'Email is required',
          }, 400);
        }

        // Get user from database
        const users = await db.select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);

        if (users.length > 0) {
          const user = users[0];
          const resetToken = generateToken();
          
          // Store in KV
          if (env.KV) {
            await env.KV.put(
              `reset:${resetToken}`,
              JSON.stringify({ userId: user.id, email: user.email }),
              { expirationTtl: 3600 } // 1 hour
            );
          }

          // TODO: Send email with reset link
          console.log(`Reset token for ${email}: ${resetToken}`);
        }

        // Always return success (don't reveal if email exists)
        return corsResponse(request, {
          success: true,
          message: 'If that email exists, we sent password reset instructions',
        });
      }

      // Reset password
      if (path === '/api/auth/reset-password' && method === 'POST') {
        const body = await request.json();
        const { token, newPassword } = body;
        
        if (!token || !newPassword) {
          return corsResponse(request, {
            success: false,
            message: 'Token and new password are required',
          }, 400);
        }

        if (newPassword.length < 8) {
          return corsResponse(request, {
            success: false,
            message: 'Password must be at least 8 characters',
          }, 400);
        }

        // Verify token from KV
        if (env.KV) {
          const resetData = await env.KV.get(`reset:${token}`);
          if (resetData) {
            const { userId } = JSON.parse(resetData);
            
            // Update password in database
            const passwordHash = await hashPassword(newPassword);
            await db.update(schema.users)
              .set({ 
                passwordHash,
                updatedAt: new Date(),
              })
              .where(eq(schema.users.id, userId));
            
            // Delete token
            await env.KV.delete(`reset:${token}`);
            
            return corsResponse(request, {
              success: true,
              message: 'Password has been reset successfully',
            });
          }
        }

        return corsResponse(request, {
          success: false,
          message: 'Invalid or expired reset token',
        }, 400);
      }

      // Public pitch endpoints
      if (path === '/api/pitches/public') {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const tab = url.searchParams.get('tab') || 'all';
        const genre = url.searchParams.get('genre');
        
        // Use specific queries for each tab to avoid SQL template issues
        let result;
        
        if (tab === 'film') {
          result = await sql`
            SELECT 
              id, title, logline, genre, format, 
              estimated_budget as "estimatedBudget", 
              budget_bracket as "budgetBracket", 
              status, 
              thumbnail_url as "thumbnail", 
              view_count as "viewCount", 
              like_count as "likeCount", 
              user_id as "creatorId", 
              created_at as "createdAt"
            FROM pitches
            WHERE status = 'published' AND format = 'Film'
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;
        } else if (tab === 'television') {
          result = await sql`
            SELECT 
              id, title, logline, genre, format, 
              estimated_budget as "estimatedBudget", 
              budget_bracket as "budgetBracket", 
              status, 
              thumbnail_url as "thumbnail", 
              view_count as "viewCount", 
              like_count as "likeCount", 
              user_id as "creatorId", 
              created_at as "createdAt"
            FROM pitches
            WHERE status = 'published' AND format IN ('Television - Scripted', 'Television - Unscripted', 'Limited Series')
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;
        } else if (tab === 'web-series') {
          result = await sql`
            SELECT 
              id, title, logline, genre, format, 
              estimated_budget as "estimatedBudget", 
              budget_bracket as "budgetBracket", 
              status, 
              thumbnail_url as "thumbnail", 
              view_count as "viewCount", 
              like_count as "likeCount", 
              user_id as "creatorId", 
              created_at as "createdAt"
            FROM pitches
            WHERE status = 'published' AND format = 'Web Series'
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;
        } else if (tab === 'documentary') {
          result = await sql`
            SELECT 
              id, title, logline, genre, format, 
              estimated_budget as "estimatedBudget", 
              budget_bracket as "budgetBracket", 
              status, 
              thumbnail_url as "thumbnail", 
              view_count as "viewCount", 
              like_count as "likeCount", 
              user_id as "creatorId", 
              created_at as "createdAt"
            FROM pitches
            WHERE status = 'published' AND format = 'Documentary'
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;
        } else {
          // Default: show all published pitches
          if (genre) {
            result = await sql`
              SELECT 
                id, title, logline, genre, format, 
                estimated_budget as "estimatedBudget", 
                budget_bracket as "budgetBracket", 
                status, 
                thumbnail_url as "thumbnail", 
                view_count as "viewCount", 
                like_count as "likeCount", 
                user_id as "creatorId", 
                created_at as "createdAt"
              FROM pitches
              WHERE status = 'published' AND genre = ${genre}
              ORDER BY created_at DESC
              LIMIT ${limit}
            `;
          } else {
            result = await sql`
              SELECT 
                id, title, logline, genre, format, 
                estimated_budget as "estimatedBudget", 
                budget_bracket as "budgetBracket", 
                status, 
                thumbnail_url as "thumbnail", 
                view_count as "viewCount", 
                like_count as "likeCount", 
                user_id as "creatorId", 
                created_at as "createdAt"
              FROM pitches
              WHERE status = 'published'
              ORDER BY created_at DESC
              LIMIT ${limit}
            `;
          }
        }

        return corsResponse(request, {
          success: true,
          data: result || [],
          total: result?.length || 0,
          tab: tab,
          filters: {
            genre: genre || null
          }
        });
      }

      // Public pitch detail endpoint
      const publicPitchMatch = path.match(/^\/api\/pitches\/public\/(\d+)$/);
      if (publicPitchMatch && method === 'GET') {
        const pitchId = parseInt(publicPitchMatch[1]);
        
        const pitches = await db.select()
          .from(schema.pitches)
          .where(and(
            eq(schema.pitches.id, pitchId),
            eq(schema.pitches.status, 'published') // Only show published pitches
          ))
          .limit(1);
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found or not publicly available',
          }, 404);
        }

        // Increment view count for public viewing
        await db.update(schema.pitches)
          .set({ viewCount: (pitches[0].viewCount || 0) + 1 })
          .where(eq(schema.pitches.id, pitchId));

        const pitch = pitches[0];
        
        // Get creator info
        const creators = await db.select({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          companyName: schema.users.companyName,
          profileImageUrl: schema.users.profileImageUrl,
        })
        .from(schema.users)
        .where(eq(schema.users.id, pitch.userId))
        .limit(1);

        const creator = creators[0];

        return corsResponse(request, {
          success: true,
          data: {
            ...pitch,
            creator: creator ? {
              name: `${creator.firstName} ${creator.lastName}`,
              companyName: creator.companyName,
              profileImage: creator.profileImageUrl,
            } : null,
            viewCount: (pitch.viewCount || 0) + 1, // Return updated count
          },
        });
      }

      // Search endpoint
      if (path === '/api/search') {
        const searchParams = url.searchParams;
        const q = searchParams.get('q');
        const genre = searchParams.get('genre');
        const status = searchParams.get('status');
        const minBudget = searchParams.get('minBudget');
        const maxBudget = searchParams.get('maxBudget');
        
        let query = db.select()
          .from(schema.pitches)
          .where(eq(schema.pitches.status, 'published'));
        
        // Apply filters
        const conditions = [];
        
        if (q) {
          conditions.push(
            or(
              like(schema.pitches.title, `%${q}%`),
              like(schema.pitches.tagline, `%${q}%`),
              like(schema.pitches.logline, `%${q}%`)
            )
          );
        }
        
        if (genre) {
          conditions.push(eq(schema.pitches.genre, genre));
        }
        
        if (minBudget) {
          conditions.push(gte(schema.pitches.budget, parseInt(minBudget)));
        }
        
        if (maxBudget) {
          conditions.push(lte(schema.pitches.budget, parseInt(maxBudget)));
        }
        
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        
        const results = await query.limit(50);
        
        return corsResponse(request, {
          success: true,
          results,
          total: results.length,
        });
      }

      // Protected endpoints - verify authentication (session or JWT)
      const userPayload = await authenticateRequest(request, env, db);

      // Creator dashboard
      if (path === '/api/creator/dashboard' && userPayload?.userType === 'creator') {
        const userId = parseInt(userPayload.sub);
        
        // Get user's pitches
        const pitches = await db.select()
          .from(schema.pitches)
          .where(eq(schema.pitches.userId, userId))
          .orderBy(desc(schema.pitches.createdAt));
        
        // Calculate stats
        const stats = {
          totalPitches: pitches.length,
          totalViews: pitches.reduce((sum, p) => sum + (p.views || 0), 0),
          publishedPitches: pitches.filter(p => p.status === 'published').length,
          draftPitches: pitches.filter(p => p.status === 'draft').length,
        };
        
        return corsResponse(request, {
          success: true,
          data: {
            stats,
            recentPitches: pitches.slice(0, 5),
          },
        });
      }

      // Create pitch
      if (path === '/api/pitches' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, {
            success: false,
            message: 'Only creators can create pitches',
          }, 403);
        }
        
        const body = await request.json();
        const userId = parseInt(userPayload.sub);
        
        const newPitch = await db.insert(schema.pitches)
          .values({
            ...body,
            userId: userId,
            status: body.status || 'draft',
            views: 0,
            rating: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        
        return corsResponse(request, {
          success: true,
          message: 'Pitch created successfully',
          data: newPitch[0],
        }, 201);
      }

      // Get creator's pitches
      if (path === '/api/creator/pitches' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }

        const userId = userPayload.userId;
        
        try {
          const pitches = await db.select({
            id: schema.pitches.id,
            title: schema.pitches.title,
            logline: schema.pitches.logline,
            genre: schema.pitches.genre,
            formatCategory: schema.pitches.formatCategory,
            status: schema.pitches.status,
            views: schema.pitches.views,
            likes: schema.pitches.likes,
            createdAt: schema.pitches.createdAt,
            updatedAt: schema.pitches.updatedAt,
            thumbnail: schema.pitches.thumbnail,
            seekingFunding: schema.pitches.seekingFunding
          })
          .from(schema.pitches)
          .where(eq(schema.pitches.userId, userId))
          .orderBy(desc(schema.pitches.createdAt));

          return corsResponse(request, {
            success: true,
            data: pitches
          });
        } catch (error) {
          console.error('Failed to fetch creator pitches:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch pitches',
          }, 500);
        }
      }

      // Create pitch (new creator endpoint)
      if (path === '/api/creator/pitches' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, {
            success: false,
            message: 'Only creators can create pitches',
          }, 403);
        }
        
        try {
          const body = await request.json();
          const userId = parseInt(userPayload.sub);
          
          // Validate required fields
          if (!body.title || !body.logline || !body.genre || !body.format) {
            return corsResponse(request, {
              success: false,
              error: {
                message: 'Missing required fields: title, logline, genre, and format are required'
              }
            }, 400);
          }
          
          // Insert pitch with comprehensive validation
          const newPitch = await db.insert(schema.pitches)
            .values({
              userId: userId,
              title: body.title,
              logline: body.logline,
              genre: body.genre,
              format: body.format,
              formatCategory: body.formatCategory,
              formatSubtype: body.formatSubtype, 
              customFormat: body.customFormat,
              shortSynopsis: body.shortSynopsis,
              longSynopsis: body.longSynopsis,
              themes: body.themes,
              worldDescription: body.worldDescription,
              characters: JSON.stringify(body.characters || []),
              budgetBracket: body.budgetBracket || 'Medium',
              estimatedBudget: body.estimatedBudget,
              productionTimeline: body.productionTimeline,
              seekingInvestment: body.seekingInvestment || false,
              requireNDA: body.requireNDA || false,
              aiUsed: body.aiUsed || false,
              status: body.status || 'draft',
              viewCount: 0,
              likeCount: 0,
              ndaCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          return corsResponse(request, {
            success: true,
            message: 'Pitch created successfully',
            data: {
              pitch: newPitch[0]
            }
          }, 201);
        } catch (error) {
          console.error('Error creating pitch:', error);
          return corsResponse(request, {
            success: false,
            error: {
              message: error instanceof Error ? error.message : 'Failed to create pitch'
            }
          }, 500);
        }
      }

      // Get all pitches (with caching)
      if (path.startsWith('/api/pitches') && method === 'GET' && !path.match(/^\/api\/pitches\/\d+$/) && !path.match(/^\/api\/pitches\/\d+\/investment-interests$/) && !path.startsWith('/api/pitches/browse') && path !== '/api/pitches/following' && path !== '/api/pitches/trending' && path !== '/api/pitches/new') {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const genre = url.searchParams.get('genre');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');
        
        // Try to get from cache
        const cacheKey = `pitches:${limit}:${offset}:${genre || ''}:${status || ''}:${search || ''}`;
        const cached = await getCachedResponse(cacheKey, env.KV, request);
        if (cached) {
          console.log('Cache hit for pitches');
          return cached;
        }
        
        let query = db.select()
          .from(schema.pitches)
          .orderBy(desc(schema.pitches.createdAt))
          .limit(limit)
          .offset(offset);
        
        const conditions = [];
        if (genre) conditions.push(eq(schema.pitches.genre, genre));
        if (status) conditions.push(eq(schema.pitches.status, status));
        if (search) conditions.push(like(schema.pitches.title, `%${search}%`));
        
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        
        const pitches = await query;
        
        const responseData = {
          success: true,
          data: pitches,
          pagination: {
            limit,
            offset,
            total: pitches.length
          }
        };
        
        // Cache the response
        await setCachedResponse(cacheKey, responseData, env.KV, 300); // Cache for 5 minutes
        
        return corsResponse(request, responseData);
      }

      // Update pitch
      const pitchMatch = path.match(/^\/api\/pitches\/(\d+)$/);
      if (pitchMatch && method === 'PUT') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(pitchMatch[1]);
        const userId = parseInt(userPayload.sub);
        const body = await request.json();
        
        // Check ownership
        const pitches = await db.select()
          .from(schema.pitches)
          .where(eq(schema.pitches.id, pitchId))
          .limit(1);
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        if (pitches[0].userId !== userId) {
          return corsResponse(request, {
            success: false,
            message: 'You can only edit your own pitches',
          }, 403);
        }
        
        const updated = await db.update(schema.pitches)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(schema.pitches.id, pitchId))
          .returning();
        
        // Generate notifications for interested parties
        if (updated[0].status === 'published') {
          // Notify investors who expressed interest
          const interestedInvestors = await db.select({
            userId: schema.investmentInterests.investorId
          })
          .from(schema.investmentInterests)
          .where(eq(schema.investmentInterests.pitchId, pitchId));
          
          for (const investor of interestedInvestors) {
            await db.insert(schema.notifications)
              .values({
                userId: investor.userId,
                type: 'pitch_updated',
                title: 'Pitch Updated',
                message: `"${updated[0].title}" has been updated with new information`,
                relatedId: pitchId,
                relatedType: 'pitch',
                data: {
                  pitchId: pitchId,
                  pitchTitle: updated[0].title,
                  updatedFields: Object.keys(body)
                }
              });
          }
          
          // Notify users with approved NDAs
          const ndaHolders = await db.select({
            userId: schema.ndaRequests.requesterId
          })
          .from(schema.ndaRequests)
          .where(
            and(
              eq(schema.ndaRequests.pitchId, pitchId),
              eq(schema.ndaRequests.status, 'approved')
            )
          );
          
          for (const holder of ndaHolders) {
            await db.insert(schema.notifications)
              .values({
                userId: holder.userId,
                type: 'pitch_updated',
                title: 'Protected Pitch Updated',
                message: `"${updated[0].title}" (NDA protected) has been updated`,
                relatedId: pitchId,
                relatedType: 'pitch',
                data: {
                  pitchId: pitchId,
                  pitchTitle: updated[0].title,
                  hasNDA: true,
                  updatedFields: Object.keys(body)
                }
              });
          }
          
          // Notify production companies who reviewed the pitch (using raw SQL)
          const productionReviewers = await sql`
            SELECT DISTINCT production_id as "userId"
            FROM production_reviews
            WHERE pitch_id = ${pitchId}
          `;
          
          for (const reviewer of productionReviewers) {
            await db.insert(schema.notifications)
              .values({
                userId: reviewer.userId,
                type: 'pitch_updated',
                title: 'Reviewed Pitch Updated',
                message: `"${updated[0].title}" that you reviewed has been updated`,
                relatedId: pitchId,
                relatedType: 'pitch',
                data: {
                  pitchId: pitchId,
                  pitchTitle: updated[0].title,
                  wasReviewed: true,
                  updatedFields: Object.keys(body)
                }
              });
          }
        }
        
        return corsResponse(request, {
          success: true,
          message: 'Pitch updated successfully',
          data: updated[0],
        });
      }

      // Character management endpoints
      const characterMatch = path.match(/^\/api\/pitches\/(\d+)\/characters$/);
      const singleCharacterMatch = path.match(/^\/api\/pitches\/(\d+)\/characters\/(\d+)$/);
      
      // Get all characters for a pitch
      if (characterMatch && method === 'GET') {
        const pitchId = parseInt(characterMatch[1]);
        
        const pitches = await sql`
          SELECT id, user_id, characters 
          FROM pitches 
          WHERE id = ${pitchId}
        `;
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        let characters = [];
        try {
          characters = JSON.parse(pitches[0].characters || '[]');
        } catch (e) {
          characters = [];
        }
        
        return corsResponse(request, {
          success: true,
          data: characters
        });
      }
      
      // Update all characters (used for reordering)
      if (characterMatch && method === 'PUT') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(characterMatch[1]);
        const userId = parseInt(userPayload.sub);
        const { characters } = await request.json();
        
        // Check ownership
        const pitches = await sql`
          SELECT user_id FROM pitches WHERE id = ${pitchId}
        `;
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        if (pitches[0].user_id !== userId) {
          return corsResponse(request, {
            success: false,
            message: 'You can only edit your own pitches',
          }, 403);
        }
        
        // Update characters
        await sql`
          UPDATE pitches 
          SET characters = ${JSON.stringify(characters)},
              updated_at = NOW()
          WHERE id = ${pitchId}
        `;
        
        return corsResponse(request, {
          success: true,
          message: 'Characters updated successfully',
          data: characters
        });
      }
      
      // Add a new character
      if (characterMatch && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(characterMatch[1]);
        const userId = parseInt(userPayload.sub);
        const newCharacter = await request.json();
        
        // Check ownership
        const pitches = await sql`
          SELECT user_id, characters FROM pitches WHERE id = ${pitchId}
        `;
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        if (pitches[0].user_id !== userId) {
          return corsResponse(request, {
            success: false,
            message: 'You can only edit your own pitches',
          }, 403);
        }
        
        // Parse existing characters
        let characters = [];
        try {
          characters = JSON.parse(pitches[0].characters || '[]');
        } catch (e) {
          characters = [];
        }
        
        // Add new character with ID
        newCharacter.id = Date.now(); // Simple ID generation
        characters.push(newCharacter);
        
        // Update database
        await sql`
          UPDATE pitches 
          SET characters = ${JSON.stringify(characters)},
              updated_at = NOW()
          WHERE id = ${pitchId}
        `;
        
        return corsResponse(request, {
          success: true,
          message: 'Character added successfully',
          data: newCharacter
        });
      }
      
      // Update a single character
      if (singleCharacterMatch && method === 'PUT') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(singleCharacterMatch[1]);
        const characterId = parseInt(singleCharacterMatch[2]);
        const userId = parseInt(userPayload.sub);
        const updatedCharacter = await request.json();
        
        // Check ownership
        const pitches = await sql`
          SELECT user_id, characters FROM pitches WHERE id = ${pitchId}
        `;
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        if (pitches[0].user_id !== userId) {
          return corsResponse(request, {
            success: false,
            message: 'You can only edit your own pitches',
          }, 403);
        }
        
        // Parse and update characters
        let characters = [];
        try {
          characters = JSON.parse(pitches[0].characters || '[]');
        } catch (e) {
          characters = [];
        }
        
        const characterIndex = characters.findIndex(c => c.id === characterId);
        if (characterIndex === -1) {
          return corsResponse(request, {
            success: false,
            message: 'Character not found',
          }, 404);
        }
        
        characters[characterIndex] = { ...characters[characterIndex], ...updatedCharacter, id: characterId };
        
        // Update database
        await sql`
          UPDATE pitches 
          SET characters = ${JSON.stringify(characters)},
              updated_at = NOW()
          WHERE id = ${pitchId}
        `;
        
        return corsResponse(request, {
          success: true,
          message: 'Character updated successfully',
          data: characters[characterIndex]
        });
      }
      
      // Delete a character
      if (singleCharacterMatch && method === 'DELETE') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(singleCharacterMatch[1]);
        const characterId = parseInt(singleCharacterMatch[2]);
        const userId = parseInt(userPayload.sub);
        
        // Check ownership
        const pitches = await sql`
          SELECT user_id, characters FROM pitches WHERE id = ${pitchId}
        `;
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        if (pitches[0].user_id !== userId) {
          return corsResponse(request, {
            success: false,
            message: 'You can only edit your own pitches',
          }, 403);
        }
        
        // Parse and filter characters
        let characters = [];
        try {
          characters = JSON.parse(pitches[0].characters || '[]');
        } catch (e) {
          characters = [];
        }
        
        const filteredCharacters = characters.filter(c => c.id !== characterId);
        
        if (filteredCharacters.length === characters.length) {
          return corsResponse(request, {
            success: false,
            message: 'Character not found',
          }, 404);
        }
        
        // Update database
        await sql`
          UPDATE pitches 
          SET characters = ${JSON.stringify(filteredCharacters)},
              updated_at = NOW()
          WHERE id = ${pitchId}
        `;
        
        return corsResponse(request, {
          success: true,
          message: 'Character deleted successfully'
        });
      }
      
      // Update pitch themes and world description
      const pitchFieldsMatch = path.match(/^\/api\/pitches\/(\d+)\/fields$/);
      if (pitchFieldsMatch && method === 'PATCH') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(pitchFieldsMatch[1]);
        const userId = parseInt(userPayload.sub);
        const { themes, worldDescription } = await request.json();
        
        // Check ownership
        const pitches = await sql`
          SELECT user_id FROM pitches WHERE id = ${pitchId}
        `;
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        if (pitches[0].user_id !== userId) {
          return corsResponse(request, {
            success: false,
            message: 'You can only edit your own pitches',
          }, 403);
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [pitchId];
        let paramIndex = 2;
        
        if (themes !== undefined) {
          updates.push(`themes = $${paramIndex}`);
          values.push(themes);
          paramIndex++;
        }
        
        if (worldDescription !== undefined) {
          updates.push(`world_description = $${paramIndex}`);
          values.push(worldDescription);
          paramIndex++;
        }
        
        if (updates.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'No fields to update',
          }, 400);
        }
        
        updates.push('updated_at = NOW()');
        
        // Execute update with raw SQL for flexibility
        const updateQuery = `
          UPDATE pitches 
          SET ${updates.join(', ')}
          WHERE id = $1
          RETURNING id, themes, world_description
        `;
        
        const result = await sql.unsafe(updateQuery, values);
        
        return corsResponse(request, {
          success: true,
          message: 'Pitch fields updated successfully',
          data: {
            id: result[0].id,
            themes: result[0].themes,
            worldDescription: result[0].world_description
          }
        });
      }
      
      // Get single pitch
      if (pitchMatch && method === 'GET') {
        const pitchId = parseInt(pitchMatch[1]);
        
        const pitches = await db.select({
          // Pitch fields
          id: schema.pitches.id,
          title: schema.pitches.title,
          logline: schema.pitches.logline,
          synopsis: schema.pitches.synopsis,
          genre: schema.pitches.genre,
          format: schema.pitches.format,
          status: schema.pitches.status,
          budget: schema.pitches.budget,
          targetAudience: schema.pitches.targetAudience,
          posterUrl: schema.pitches.posterUrl,
          titleImage: schema.pitches.titleImage,
          videoUrl: schema.pitches.videoUrl,
          viewCount: schema.pitches.viewCount,
          views: schema.pitches.views,
          tags: schema.pitches.tags,
          characters: schema.pitches.characters,
          themes: schema.pitches.themes,
          worldDescription: schema.pitches.worldDescription,
          isNdaRequired: schema.pitches.isNdaRequired,
          ndaUrl: schema.pitches.ndaUrl,
          protectedContent: schema.pitches.protectedContent,
          createdAt: schema.pitches.createdAt,
          updatedAt: schema.pitches.updatedAt,
          userId: schema.pitches.userId,
          // Creator fields
          creatorId: schema.users.id,
          creatorUsername: schema.users.username,
          creatorFirstName: schema.users.firstName,
          creatorLastName: schema.users.lastName,
          creatorEmail: schema.users.email,
          creatorCompanyName: schema.users.companyName,
          creatorProfileImage: schema.users.profileImageUrl,
          creatorUserType: schema.users.userType,
        })
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
          .where(eq(schema.pitches.id, pitchId))
          .limit(1);
        
        if (pitches.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        // Increment views
        await db.update(schema.pitches)
          .set({ views: (pitches[0].views || 0) + 1 })
          .where(eq(schema.pitches.id, pitchId));
        
        // Format the response to include creator as nested object
        const pitch = pitches[0];
        const formattedPitch = {
          id: pitch.id,
          title: pitch.title,
          logline: pitch.logline,
          synopsis: pitch.synopsis,
          genre: pitch.genre,
          format: pitch.format,
          status: pitch.status,
          budget: pitch.budget,
          targetAudience: pitch.targetAudience,
          posterUrl: pitch.posterUrl,
          titleImage: pitch.titleImage,
          videoUrl: pitch.videoUrl,
          viewCount: pitch.viewCount,
          views: (pitch.views || 0) + 1,
          tags: pitch.tags,
          characters: pitch.characters,
          themes: pitch.themes,
          worldDescription: pitch.worldDescription,
          isNdaRequired: pitch.isNdaRequired,
          ndaUrl: pitch.ndaUrl,
          protectedContent: pitch.protectedContent,
          createdAt: pitch.createdAt,
          updatedAt: pitch.updatedAt,
          userId: pitch.userId,
          creator: pitch.creatorId ? {
            id: pitch.creatorId,
            username: pitch.creatorUsername || `${pitch.creatorFirstName} ${pitch.creatorLastName}`,
            firstName: pitch.creatorFirstName,
            lastName: pitch.creatorLastName,
            email: pitch.creatorEmail,
            companyName: pitch.creatorCompanyName,
            profileImageUrl: pitch.creatorProfileImage,
            userType: pitch.creatorUserType
          } : null
        };
        
        return corsResponse(request, {
          success: true,
          data: formattedPitch,
        });
      }

      // Get user profile
      if (path === '/api/profile' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const userId = parseInt(userPayload.sub);
        const users = await db.select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);
        
        if (users.length === 0) {
          return corsResponse(request, {
            success: false,
            message: 'User not found',
          }, 404);
        }
        
        const user = users[0];
        return corsResponse(request, {
          success: true,
          data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            companyName: user.companyName,
            userType: user.userType,
            bio: user.bio,
            profileImageUrl: user.profileImageUrl,
            verified: user.emailVerified || user.isVerified || false,
          }
        });
      }

      // Validate token
      if (path === '/api/validate-token' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            valid: false,
            message: 'Invalid token',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          valid: true,
          user: {
            id: userPayload.sub,
            email: userPayload.email,
            userType: userPayload.userType,
            firstName: userPayload.firstName,
            lastName: userPayload.lastName,
            companyName: userPayload.companyName,
            verified: userPayload.verified,
          }
        });
      }

      // Search pitches
      if (path === '/api/search/pitches' && method === 'GET') {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') || '';
        const genre = url.searchParams.get('genre');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        const conditions = [];
        if (query) {
          conditions.push(
            or(
              like(schema.pitches.title, `%${query}%`),
              like(schema.pitches.logline, `%${query}%`)
            )
          );
        }
        if (genre) conditions.push(eq(schema.pitches.genre, genre));
        
        const pitches = await db.select()
          .from(schema.pitches)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(schema.pitches.createdAt))
          .limit(limit);
        
        return corsResponse(request, {
          success: true,
          data: pitches,
        });
      }

      // User preferences
      if (path === '/api/user/preferences' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        // Return default preferences for now
        return corsResponse(request, {
          success: true,
          data: {
            emailAlerts: true,
            pushNotifications: false,
            marketplaceFilters: {
              genres: [],
              formats: [],
              budgetRanges: [],
            },
            dashboardLayout: 'grid',
            theme: 'light',
          }
        });
      }

      // Saved filters
      if (path === '/api/filters/saved' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        // Return empty array for now (no saved filters)
        return corsResponse(request, {
          success: true,
          data: [],
        });
      }

      // Email alerts
      if (path === '/api/alerts/email' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        // Return empty array for now (no email alerts)
        return corsResponse(request, {
          success: true,
          data: [],
        });
      }

      // Enhanced browse endpoint for marketplace (with caching)
      if (path.startsWith('/api/pitches/browse/enhanced') && method === 'GET') {
        const url = new URL(request.url);
        const sort = url.searchParams.get('sort') || 'date';
        const order = url.searchParams.get('order') || 'desc';
        const limit = parseInt(url.searchParams.get('limit') || '24');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const genre = url.searchParams.get('genre');
        const format = url.searchParams.get('format');
        const budget = url.searchParams.get('budget');
        
        // Try cache first
        const cacheKey = `browse:${sort}:${order}:${limit}:${offset}:${genre || ''}:${format || ''}:${budget || ''}`;
        const cached = await getCachedResponse(cacheKey, env.KV, request);
        if (cached) {
          console.log('Cache hit for enhanced browse');
          return cached;
        }
        
        let query = db.select({
          // Pitch fields
          id: schema.pitches.id,
          title: schema.pitches.title,
          logline: schema.pitches.logline,
          genre: schema.pitches.genre,
          format: schema.pitches.format,
          status: schema.pitches.status,
          posterUrl: schema.pitches.posterUrl,
          titleImage: schema.pitches.titleImage,
          viewCount: schema.pitches.viewCount,
          tags: schema.pitches.tags,
          budgetRange: schema.pitches.budgetRange,
          createdAt: schema.pitches.createdAt,
          userId: schema.pitches.userId,
          // Creator fields
          creatorId: schema.users.id,
          creatorUsername: schema.users.username,
          creatorFirstName: schema.users.firstName,
          creatorLastName: schema.users.lastName,
          creatorCompanyName: schema.users.companyName,
          creatorProfileImage: schema.users.profileImageUrl,
          creatorUserType: schema.users.userType,
        })
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
          .limit(limit)
          .offset(offset);
        
        // Apply filters
        const conditions = [];
        conditions.push(eq(schema.pitches.status, 'published')); // Only show published pitches
        if (genre) conditions.push(eq(schema.pitches.genre, genre));
        if (format) conditions.push(eq(schema.pitches.format, format));
        if (budget) conditions.push(eq(schema.pitches.budgetRange, budget));
        
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        
        // Apply sorting
        if (sort === 'date') {
          query = query.orderBy(order === 'asc' ? asc(schema.pitches.createdAt) : desc(schema.pitches.createdAt));
        } else if (sort === 'views') {
          query = query.orderBy(order === 'asc' ? asc(schema.pitches.viewCount) : desc(schema.pitches.viewCount));
        } else if (sort === 'rating') {
          query = query.orderBy(order === 'asc' ? asc(schema.pitches.likeCount) : desc(schema.pitches.likeCount));
        }
        
        const pitches = await query;
        
        // Get total count for pagination
        let totalCount = 0;
        try {
          const countResult = await db.select()
            .from(schema.pitches)
            .where(conditions.length > 0 ? and(...conditions) : undefined);
          totalCount = countResult.length;
        } catch (e) {
          console.error('Count query error:', e);
          totalCount = pitches.length;
        }
        
        const responseData = {
          success: true,
          data: pitches.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            status: pitch.status,
            posterUrl: pitch.posterUrl,
            titleImage: pitch.titleImage,
            viewCount: pitch.viewCount,
            tags: pitch.tags || [],
            budgetRange: pitch.budgetRange,
            createdAt: pitch.createdAt,
            userId: pitch.userId,
            creatorId: pitch.creatorId,
            // Add enhanced fields
            thumbnail: pitch.posterUrl || pitch.titleImage || '/placeholder.jpg',
            isNew: new Date(pitch.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000,
            isTrending: (pitch.viewCount || 0) > 100,
            creator: pitch.creatorId ? {
              id: pitch.creatorId,
              username: pitch.creatorUsername || `${pitch.creatorFirstName} ${pitch.creatorLastName}`,
              firstName: pitch.creatorFirstName,
              lastName: pitch.creatorLastName,
              companyName: pitch.creatorCompanyName,
              profileImageUrl: pitch.creatorProfileImage,
              userType: pitch.creatorUserType
            } : null
          })),
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount,
          },
          filters: {
            genre,
            format,
            budget,
          },
        };
        
        // Cache the response
        await setCachedResponse(cacheKey, responseData, env.KV, 300); // Cache for 5 minutes
        
        return corsResponse(request, responseData);
      }

      // General browse endpoint for marketplace with advanced sorting
      if (path.startsWith('/api/pitches/browse/general') && method === 'GET') {
        const url = new URL(request.url);
        const sort = url.searchParams.get('sort') || 'date';
        const order = url.searchParams.get('order') || 'desc';
        const limit = parseInt(url.searchParams.get('limit') || '24');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const genre = url.searchParams.get('genre');
        const format = url.searchParams.get('format');
        
        try {
          let query;
          
          // Investment status sorting requires join with investments table
          if (sort === 'investment_status') {
            // Use raw SQL for complex investment status sorting
            const orderClause = order === 'desc' ? 'DESC' : 'ASC';
            const sqlQuery = `
              SELECT 
                p.*,
                CASE 
                  WHEN SUM(CASE WHEN i.status = 'funded' THEN 1 ELSE 0 END) > 0 THEN 'funded'
                  WHEN SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) > 0 THEN 'in_production'
                  ELSE 'seeking_funding'
                END as investment_status_order
              FROM pitches p
              LEFT JOIN investments i ON p.id = i.pitch_id
              WHERE p.status = 'active'
              ${genre ? `AND p.genre = '${genre}'` : ''}
              ${format ? `AND p.format = '${format}'` : ''}
              GROUP BY p.id
              ORDER BY 
                CASE 
                  WHEN investment_status_order = 'funded' THEN ${order === 'desc' ? 1 : 3}
                  WHEN investment_status_order = 'in_production' THEN 2
                  WHEN investment_status_order = 'seeking_funding' THEN ${order === 'desc' ? 3 : 1}
                END,
                p.created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `;
            
            const result = await db.execute(sql`${sqlQuery}`);
            const pitches = result.rows as any[];
            
            // Get total count
            const countResult = await db.execute(sql`
              SELECT COUNT(DISTINCT p.id) as count
              FROM pitches p
              LEFT JOIN investments i ON p.id = i.pitch_id
              WHERE p.status = 'active'
              ${genre ? `AND p.genre = '${genre}'` : ''}
              ${format ? `AND p.format = '${format}'` : ''}
            `);
            const totalCount = Number(countResult.rows[0]?.count || 0);
            
            return corsResponse(request, {
              success: true,
              data: pitches,
              totalCount,
              pagination: {
                limit,
                offset,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: Math.floor(offset / limit) + 1,
              },
            });
          }
          
          // Standard sorting (alphabetical, date, budget, views, likes)
          query = db.select().from(schema.pitches).limit(limit).offset(offset);
          
          // Apply filters
          const conditions = [];
          conditions.push(eq(schema.pitches.status, 'active'));
          if (genre) conditions.push(eq(schema.pitches.genre, genre));
          if (format) conditions.push(eq(schema.pitches.format, format));
          
          if (conditions.length > 0) {
            query = query.where(and(...conditions));
          }
          
          // Apply sorting
          switch (sort) {
            case 'alphabetical':
              query = query.orderBy(order === 'asc' ? asc(schema.pitches.title) : desc(schema.pitches.title));
              break;
            case 'date':
              query = query.orderBy(order === 'asc' ? asc(schema.pitches.createdAt) : desc(schema.pitches.createdAt));
              break;
            case 'budget':
              query = query.orderBy(order === 'asc' ? asc(schema.pitches.budgetAmount) : desc(schema.pitches.budgetAmount));
              break;
            case 'views':
              query = query.orderBy(order === 'asc' ? asc(schema.pitches.viewCount) : desc(schema.pitches.viewCount));
              break;
            case 'likes':
              query = query.orderBy(order === 'asc' ? asc(schema.pitches.likeCount) : desc(schema.pitches.likeCount));
              break;
            default:
              query = query.orderBy(desc(schema.pitches.createdAt));
          }
          
          const pitches = await query;
          
          // Get total count
          let countQuery = db.select({ count: count() }).from(schema.pitches);
          if (conditions.length > 0) {
            countQuery = countQuery.where(and(...conditions));
          }
          const [{ count: totalCount }] = await countQuery;
          
          return corsResponse(request, {
            success: true,
            data: pitches,
            totalCount,
            pagination: {
              limit,
              offset,
              totalPages: Math.ceil(totalCount / limit),
              currentPage: Math.floor(offset / limit) + 1,
            },
          });
        } catch (error) {
          console.error('Error in general browse:', error);
          return corsResponse(request, {
            success: false,
            error: { message: 'Failed to fetch pitches' },
            data: [],
          }, 500);
        }
      }

      // Creator dashboard stats
      if (path === '/api/creator/dashboard' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, {
            success: false,
            message: 'Creator access required',
          }, 403);
        }
        
        const userId = parseInt(userPayload.sub);
        
        // Get creator's pitches
        const pitches = await db.select()
          .from(schema.pitches)
          .where(eq(schema.pitches.userId, userId));
        
        // Calculate stats
        const totalViews = pitches.reduce((sum, p) => sum + (p.views || 0), 0);
        const totalPitches = pitches.length;
        const activePitches = pitches.filter(p => p.status === 'active').length;
        
        return corsResponse(request, {
          success: true,
          data: {
            stats: {
              totalPitches,
              activePitches,
              totalViews,
              averageRating: 0,
            },
            recentPitches: pitches.slice(0, 5),
            trending: pitches.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3),
          }
        });
      }

      // Investor dashboard endpoints
      if (path === '/api/investor/dashboard' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'investor') {
          return corsResponse(request, {
            success: false,
            message: 'Investor access required',
          }, 403);
        }
        
        const investorId = parseInt(userPayload.sub);
        
        try {
          // Get real investment interests data
          const investmentInterests = await sql`
            SELECT 
              ii.*,
              p.title as pitch_title,
              p.logline,
              p.genre,
              p.format,
              p.status as pitch_status,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name,
              u.company_name as creator_company
            FROM investment_interests ii
            JOIN pitches p ON ii.pitch_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE ii.investor_id = ${investorId}
            ORDER BY ii.created_at DESC
          `;
          
          // Calculate portfolio summary from real data
          const totalInvested = investmentInterests.reduce((sum, inv) => 
            sum + (parseFloat(inv.amount) || 0), 0
          );
          
          const portfolio = {
            totalInvested: totalInvested.toFixed(2),
            activeInvestments: investmentInterests.length.toString(),
            roi: 0 // ROI would need tracking of returns
          };

          // Get recent activity from investment interests
          const recentActivity = investmentInterests.slice(0, 5).map(inv => ({
            id: inv.id,
            investor_id: investorId,
            pitch_id: inv.pitch_id,
            pitch_title: inv.pitch_title,
            creator_name: `${inv.creator_first_name} ${inv.creator_last_name}`,
            amount: inv.amount,
            investment_level: inv.investment_level,
            status: inv.pitch_status === 'published' ? 'active' : 'pending',
            notes: inv.message || 'Investment interest expressed',
            created_at: inv.created_at,
            updated_at: inv.updated_at || inv.created_at
          }));

          // Get investment opportunities (published pitches seeking investment)
          const opportunities = await sql`
            SELECT 
              p.*,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name,
              u.company_name as creator_company,
              COUNT(DISTINCT ii.id) as investor_count,
              SUM(CAST(ii.amount AS DECIMAL)) as total_interest
            FROM pitches p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN investment_interests ii ON p.id = ii.pitch_id
            WHERE p.status = 'published' 
              AND p.seeking_investment = true
              AND p.id NOT IN (
                SELECT pitch_id FROM investment_interests WHERE investor_id = ${investorId}
              )
            GROUP BY p.id, u.id, u.first_name, u.last_name, u.company_name
            ORDER BY p.created_at DESC
            LIMIT 6
          `;
          
          // Get saved pitches count
          const savedPitchesCount = await sql`
            SELECT COUNT(*)::integer as count
            FROM saved_pitches
            WHERE user_id = ${investorId}
          `;
          
          // Get NDA stats
          const ndaStats = await sql`
            SELECT 
              COUNT(*)::integer as total_ndas,
              COUNT(CASE WHEN status = 'approved' THEN 1 END)::integer as approved_ndas,
              COUNT(CASE WHEN status = 'pending' THEN 1 END)::integer as pending_ndas
            FROM nda_requests
            WHERE requester_id = ${investorId}
          `;

          return corsResponse(request, {
            success: true,
            data: {
              portfolio,
              recentActivity,
              opportunities: opportunities.map(opp => ({
                ...opp,
                creator_name: `${opp.creator_first_name} ${opp.creator_last_name}`,
                creator_company: opp.creator_company,
                investor_count: parseInt(opp.investor_count) || 0,
                total_interest: parseFloat(opp.total_interest) || 0,
                seeking_investment: true,
                production_stage: 'Development'
              })),
              stats: {
                savedPitches: savedPitchesCount[0]?.count || 0,
                totalNdas: ndaStats[0]?.total_ndas || 0,
                approvedNdas: ndaStats[0]?.approved_ndas || 0,
                pendingNdas: ndaStats[0]?.pending_ndas || 0
              }
            }
          });
        } catch (error) {
          console.error('Investor dashboard error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Dashboard data unavailable',
            error: error.message
          }, 500);
        }
      }

      // Investor portfolio summary
      if (path === '/api/investor/portfolio/summary' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'investor') {
          return corsResponse(request, {
            success: false,
            message: 'Investor access required',
          }, 403);
        }
        
        const investorId = parseInt(userPayload.sub);
        
        try {
          // Simplified approach to avoid stack overflow
          // Get all investments for the investor
          const investments = await db
            .select()
            .from(schema.investments)
            .where(eq(schema.investments.investorId, investorId));
          
          // Calculate aggregates in JavaScript
          const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
          const activeInvestments = investments.filter(inv => inv.status === 'active').length;
          const averageROI = investments.length > 0 
            ? investments.reduce((sum, inv) => sum + Number(inv.roiPercentage || 0), 0) / investments.length
            : 0;
          
          // Get top performer title
          let topPerformerTitle = 'No investments yet';
          if (investments.length > 0) {
            const topInvestment = investments
              .sort((a, b) => Number(b.roiPercentage || 0) - Number(a.roiPercentage || 0))[0];
            
            if (topInvestment && topInvestment.pitchId) {
              const pitch = await db
                .select()
                .from(schema.pitches)
                .where(eq(schema.pitches.id, topInvestment.pitchId))
                .limit(1);
              
              if (pitch[0]) {
                topPerformerTitle = pitch[0].title;
              }
            }
          }
          
          return corsResponse(request, {
            success: true,
            data: {
              totalInvested,
              activeInvestments,
              averageROI: parseFloat(averageROI.toFixed(2)),
              topPerformer: topPerformerTitle
            }
          });
        } catch (error) {
          console.error('Failed to fetch portfolio summary:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Detailed error:', errorMessage);
          
          // Always show error in response for debugging
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch portfolio summary',
            error: errorMessage,
            details: 'Check if investments table has roi_percentage column'
          }, 500);
        }
      }

      // Investor investments list
      if (path === '/api/investor/investments' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'investor') {
          return corsResponse(request, {
            success: false,
            message: 'Investor access required',
          }, 403);
        }
        
        const investorId = parseInt(userPayload.sub);
        
        try {
          // Get real investment data from investment_interests table
          const investments = await sql`
            SELECT 
              ii.id,
              ii.pitch_id,
              ii.amount,
              ii.investment_level,
              ii.message,
              ii.created_at as date_invested,
              p.title as pitch_title,
              p.logline,
              p.genre,
              p.format,
              p.status as pitch_status,
              p.budget_bracket,
              p.estimated_budget,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name,
              u.company_name as creator_company
            FROM investment_interests ii
            JOIN pitches p ON ii.pitch_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE ii.investor_id = ${investorId}
            ORDER BY ii.created_at DESC
          `;
          
          const formattedInvestments = investments.map(inv => ({
            id: inv.id,
            pitchId: inv.pitch_id,
            pitchTitle: inv.pitch_title,
            pitchLogline: inv.logline,
            creatorName: `${inv.creator_first_name} ${inv.creator_last_name}`,
            creatorCompany: inv.creator_company,
            amount: parseFloat(inv.amount) || 0,
            investmentLevel: inv.investment_level,
            status: inv.pitch_status === 'published' ? 'active' : 'pending',
            roi: 0, // Would need actual returns tracking
            dateInvested: inv.date_invested,
            genre: inv.genre,
            format: inv.format,
            estimatedBudget: inv.estimated_budget
          }));
          
          return corsResponse(request, {
            success: true,
            data: formattedInvestments
          });
        } catch (error) {
          console.error('Error fetching investments:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch investments',
            error: error instanceof Error ? error.message : String(error)
          }, 500);
        }
      }

      // Investment recommendations
      if (path === '/api/investment/recommendations' && method === 'GET') {
        if (!userPayload || (userPayload.userType !== 'investor' && userPayload.userType !== 'production')) {
          return corsResponse(request, {
            success: false,
            message: 'Investor or production access required',
          }, 403);
        }
        
        try {
          const recommendations = await db.select({
            id: schema.pitches.id,
            title: schema.pitches.title,
            tagline: schema.pitches.tagline,
            genre: schema.pitches.genre,
            format: schema.pitches.format,
            budget: schema.pitches.budget,
            status: schema.pitches.status,
            thumbnail: schema.pitches.thumbnail,
            views: schema.pitches.viewCount,
            createdAt: schema.pitches.createdAt,
            creatorId: schema.users.id,
            creatorFirstName: schema.users.firstName,
            creatorLastName: schema.users.lastName,
            creatorCompanyName: schema.users.companyName,
            creatorProfileImage: schema.users.profileImageUrl
          })
            .from(schema.pitches)
            .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
            .where(eq(schema.pitches.status, 'active'))
            .orderBy(desc(schema.pitches.viewCount))
            .limit(6);
          
          // Transform data to match frontend expectations
          const transformedData = recommendations
            .filter(rec => rec.id !== null && rec.id !== undefined)
            .map(rec => ({
              id: rec.id,
              title: rec.title || 'Untitled',
              tagline: rec.tagline || '',
              genre: rec.genre || 'General',
              format: rec.format || '',
              budget: rec.budget || 'TBD',
              status: rec.status || 'active',
              thumbnail: rec.thumbnail || '',
              views: rec.views || 0,
              createdAt: rec.createdAt || new Date(),
              creator: rec.creatorId ? {
                id: rec.creatorId,
                name: `${rec.creatorFirstName || ''} ${rec.creatorLastName || ''}`.trim() || 'Anonymous',
                companyName: rec.creatorCompanyName || '',
                profileImage: rec.creatorProfileImage || ''
              } : {
                id: 0,
                name: 'Anonymous',
                companyName: '',
                profileImage: ''
              }
            }));
          
          return corsResponse(request, {
            success: true,
            data: transformedData
          });
        } catch (error) {
          console.error('Error fetching investment recommendations:', error);
          // Return empty data instead of error
          return corsResponse(request, {
            success: true,
            data: []
          });
        }
      }

      // Express investment interest in a pitch
      if (path === '/api/investment/express-interest' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'investor') {
          return corsResponse(request, {
            success: false,
            message: 'Only investors can express investment interest',
          }, 403);
        }
        
        try {
          const body = await request.json();
          const { pitchId, amount, message } = body;
          
          if (!pitchId) {
            return corsResponse(request, {
              success: false,
              message: 'Pitch ID is required',
            }, 400);
          }
          
          const investorId = parseInt(userPayload.sub);
          
          // Check if interest already exists
          const existingInterest = await db.select()
            .from(schema.investmentInterests)
            .where(and(
              eq(schema.investmentInterests.pitchId, pitchId),
              eq(schema.investmentInterests.investorId, investorId),
              eq(schema.investmentInterests.status, 'active')
            ))
            .limit(1);
          
          if (existingInterest.length > 0) {
            return corsResponse(request, {
              success: false,
              message: 'You have already expressed interest in this pitch',
            }, 409);
          }
          
          // Get the pitch to find the creator
          const pitches = await db.select()
            .from(schema.pitches)
            .where(eq(schema.pitches.id, pitchId))
            .limit(1);
          
          if (pitches.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'Pitch not found',
            }, 404);
          }
          
          const pitch = pitches[0];
          
          // Create investment interest record
          const newInterest = await db.insert(schema.investmentInterests)
            .values({
              pitchId,
              investorId,
              creatorId: pitch.userId,
              amount: amount || 0,
              message: message || null,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          // Create notification for the pitch creator
          await db.insert(schema.notifications)
            .values({
              userId: pitch.userId,
              type: 'investment_interest',
              title: 'New Investment Interest',
              message: amount 
                ? `An investor has expressed interest of $${amount.toLocaleString()} in "${pitch.title}"`
                : `An investor has expressed interest in "${pitch.title}"`,
              relatedId: newInterest[0].id,
              relatedType: 'investment_interest',
              data: {
                pitchId: pitchId,
                pitchTitle: pitch.title,
                investorId: investorId,
                amount: amount,
                interestLevel: interestLevel,
                interestId: newInterest[0].id
              },
              createdAt: new Date(),
            });
          
          return corsResponse(request, {
            success: true,
            message: 'Investment interest expressed successfully',
            data: newInterest[0],
          }, 201);
        } catch (error) {
          console.error('Error expressing investment interest:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to express investment interest',
          }, 500);
        }
      }

      // Get investment interests for a pitch (creator view)
      if (path.match(/^\/api\/pitches\/\d+\/investment-interests$/) && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(path.split('/')[3]);
        
        try {
          // Get all investment interests for the pitch with investor details
          const interests = await db.select({
            id: schema.investmentInterests.id,
            investorId: schema.investmentInterests.investorId,
            amount: schema.investmentInterests.amount,
            interestLevel: schema.investmentInterests.interestLevel,
            notes: schema.investmentInterests.notes,
            status: schema.investmentInterests.status,
            createdAt: schema.investmentInterests.createdAt,
            investorFirstName: schema.users.firstName,
            investorLastName: schema.users.lastName,
            investorCompany: schema.users.companyName,
            investorEmail: schema.users.email,
          })
            .from(schema.investmentInterests)
            .leftJoin(schema.users, eq(schema.investmentInterests.investorId, schema.users.id))
            .where(eq(schema.investmentInterests.pitchId, pitchId))
            .orderBy(desc(schema.investmentInterests.createdAt));
          
          return corsResponse(request, {
            success: true,
            data: interests,
          });
        } catch (error) {
          console.error('Error fetching investment interests:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch investment interests';
          return corsResponse(request, {
            success: false,
            message: errorMessage,
            error: error instanceof Error ? error.toString() : undefined,
          }, 500);
        }
      }

      // Production company review workflow
      if (path === '/api/production/reviews' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'production') {
          return corsResponse(request, {
            success: false,
            message: 'Only production companies can create reviews',
          }, 403);
        }
        
        try {
          const body = await request.json();
          const { pitchId, status, feedback, meetingRequested } = body;
          
          if (!pitchId || !status) {
            return corsResponse(request, {
              success: false,
              message: 'Pitch ID and status are required',
            }, 400);
          }
          
          const productionId = parseInt(userPayload.sub);
          
          // Create review record (use 'approved' status for now)
          const newReview = await db.insert(schema.reviews)
            .values({
              pitchId,
              reviewerId: productionId,
              status: 'approved', // Valid values: approved, rejected, pending, needs_revision
              feedback: feedback || null,
              rating: 5, // Add a default rating
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          // Get pitch details for notification
          const pitches = await db.select()
            .from(schema.pitches)
            .where(eq(schema.pitches.id, pitchId))
            .limit(1);
          
          if (pitches.length > 0) {
            const pitch = pitches[0];
            
            // Create notification for the pitch creator
            await db.insert(schema.notifications)
              .values({
                userId: pitch.userId,
                type: 'production_review',
                title: 'Production Company Review',
                message: `A production company has reviewed "${pitch.title}" - Status: ${status}`,
                relatedId: newReview[0].id,
                relatedType: 'review',
                data: {
                  pitchId: pitchId,
                  pitchTitle: pitch.title,
                  reviewId: newReview[0].id,
                  status: status,
                  meetingRequested: meetingRequested
                },
                createdAt: new Date(),
              });
            
            // If meeting requested, create notification
            if (meetingRequested) {
              // Create notification for meeting request
              await db.insert(schema.notifications)
                .values({
                  userId: pitch.userId,
                  type: 'meeting_request',
                  title: 'Meeting Request',
                  message: `A production company wants to schedule a meeting about "${pitch.title}"`,
                  relatedId: pitchId,
                  relatedType: 'pitch',
                  data: {
                    pitchId: pitchId,
                    pitchTitle: pitch.title,
                    requesterId: productionId,
                    meetingRequested: true
                  },
                  createdAt: new Date(),
                });
            }
          }
          
          return corsResponse(request, {
            success: true,
            message: 'Review submitted successfully',
            data: newReview[0],
          }, 201);
        } catch (error) {
          console.error('Error creating review:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to create review';
          return corsResponse(request, {
            success: false,
            message: errorMessage,
            error: error instanceof Error ? error.toString() : undefined,
          }, 500);
        }
      }
      
      // Get production reviews for a pitch
      if (path.match(/^\/api\/pitches\/(\d+)\/reviews$/) && method === 'GET') {
        const pitchId = parseInt(path.split('/')[3]);
        
        try {
          const reviews = await db.select({
            id: schema.reviews.id,
            reviewerId: schema.reviews.reviewerId,
            status: schema.reviews.status,
            feedback: schema.reviews.feedback,
            reviewedAt: schema.reviews.reviewedAt,
            reviewerName: sql`${schema.users.firstName} || ' ' || ${schema.users.lastName}`,
            reviewerCompany: schema.users.companyName,
          })
            .from(schema.reviews)
            .leftJoin(schema.users, eq(schema.reviews.reviewerId, schema.users.id))
            .where(eq(schema.reviews.pitchId, pitchId))
            .orderBy(desc(schema.reviews.reviewedAt));
          
          return corsResponse(request, {
            success: true,
            data: reviews,
          });
        } catch (error) {
          console.error('Error fetching reviews:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch reviews',
          }, 500);
        }
      }
      
      // Additional missing endpoints that frontend expects
      
      // Trending pitches
      if (path === '/api/pitches/trending' && method === 'GET') {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        const trendingPitches = await db.select({
          // Pitch fields
          id: schema.pitches.id,
          title: schema.pitches.title,
          logline: schema.pitches.logline,
          genre: schema.pitches.genre,
          format: schema.pitches.format,
          status: schema.pitches.status,
          posterUrl: schema.pitches.posterUrl,
          titleImage: schema.pitches.titleImage,
          viewCount: schema.pitches.viewCount,
          createdAt: schema.pitches.createdAt,
          userId: schema.pitches.userId,
          // Creator fields
          creatorId: schema.users.id,
          creatorUsername: schema.users.username,
          creatorFirstName: schema.users.firstName,
          creatorLastName: schema.users.lastName,
          creatorCompanyName: schema.users.companyName,
          creatorProfileImage: schema.users.profileImageUrl,
          creatorUserType: schema.users.userType,
        })
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
          .where(or(
            eq(schema.pitches.status, 'active'),
            eq(schema.pitches.status, 'published')
          ))
          .orderBy(desc(schema.pitches.viewCount))
          .limit(limit);
        
        return corsResponse(request, {
          success: true,
          data: trendingPitches.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            status: pitch.status,
            posterUrl: pitch.posterUrl,
            titleImage: pitch.titleImage,
            viewCount: pitch.viewCount,
            createdAt: pitch.createdAt,
            userId: pitch.userId,
            creatorId: pitch.creatorId,
            creator: pitch.creatorId ? {
              id: pitch.creatorId,
              username: pitch.creatorUsername || `${pitch.creatorFirstName} ${pitch.creatorLastName}`,
              firstName: pitch.creatorFirstName,
              lastName: pitch.creatorLastName,
              companyName: pitch.creatorCompanyName,
              profileImageUrl: pitch.creatorProfileImage,
              userType: pitch.creatorUserType
            } : null
          }))
        });
      }

      // New pitches
      if (path === '/api/pitches/new' && method === 'GET') {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        const newPitches = await db.select({
          // Pitch fields
          id: schema.pitches.id,
          title: schema.pitches.title,
          logline: schema.pitches.logline,
          genre: schema.pitches.genre,
          format: schema.pitches.format,
          status: schema.pitches.status,
          posterUrl: schema.pitches.posterUrl,
          titleImage: schema.pitches.titleImage,
          viewCount: schema.pitches.viewCount,
          createdAt: schema.pitches.createdAt,
          userId: schema.pitches.userId,
          // Creator fields
          creatorId: schema.users.id,
          creatorUsername: schema.users.username,
          creatorFirstName: schema.users.firstName,
          creatorLastName: schema.users.lastName,
          creatorCompanyName: schema.users.companyName,
          creatorProfileImage: schema.users.profileImageUrl,
          creatorUserType: schema.users.userType,
        })
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
          .where(or(
            eq(schema.pitches.status, 'active'),
            eq(schema.pitches.status, 'published')
          ))
          .orderBy(desc(schema.pitches.createdAt))
          .limit(limit);
        
        return corsResponse(request, {
          success: true,
          data: newPitches.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            status: pitch.status,
            posterUrl: pitch.posterUrl,
            titleImage: pitch.titleImage,
            viewCount: pitch.viewCount,
            createdAt: pitch.createdAt,
            userId: pitch.userId,
            creatorId: pitch.creatorId,
            creator: pitch.creatorId ? {
              id: pitch.creatorId,
              username: pitch.creatorUsername || `${pitch.creatorFirstName} ${pitch.creatorLastName}`,
              firstName: pitch.creatorFirstName,
              lastName: pitch.creatorLastName,
              companyName: pitch.creatorCompanyName,
              profileImageUrl: pitch.creatorProfileImage,
              userType: pitch.creatorUserType
            } : null
          }))
        });
      }

      // Following pitches
      if (path === '/api/pitches/following' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const userId = parseInt(userPayload.sub);
        
        try {
          // First, try to get the IDs of creators that the user follows
          const followedCreators = await db.select({
            creatorId: schema.follows.creatorId
          })
          .from(schema.follows)
          .where(eq(schema.follows.followerId, userId));
          
          const creatorIds = followedCreators.map(f => f.creatorId).filter(id => id !== null);
          
          let followedPitches;
          
          if (creatorIds.length > 0) {
            // Get pitches from followed creators
            followedPitches = await db.select({
              // Pitch fields
              id: schema.pitches.id,
              title: schema.pitches.title,
              logline: schema.pitches.logline,
              genre: schema.pitches.genre,
              format: schema.pitches.format,
              status: schema.pitches.status,
              posterUrl: schema.pitches.posterUrl,
              titleImage: schema.pitches.titleImage,
              viewCount: schema.pitches.viewCount,
              createdAt: schema.pitches.createdAt,
              userId: schema.pitches.userId,
              // Creator fields
              creatorId: schema.users.id,
              creatorUsername: schema.users.username,
              creatorFirstName: schema.users.firstName,
              creatorLastName: schema.users.lastName,
              creatorCompanyName: schema.users.companyName,
              creatorProfileImage: schema.users.profileImageUrl,
              creatorUserType: schema.users.userType,
            })
            .from(schema.pitches)
            .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
            .where(
              and(
                inArray(schema.pitches.userId, creatorIds),
                or(
                  eq(schema.pitches.status, 'published'),
                  eq(schema.pitches.status, 'active')
                )
              )
            )
            .orderBy(desc(schema.pitches.createdAt))
            .limit(20);
          } else {
            // No followed creators, return latest pitches instead (for demo purposes)
            followedPitches = await db.select({
              // Pitch fields
              id: schema.pitches.id,
              title: schema.pitches.title,
              logline: schema.pitches.logline,
              genre: schema.pitches.genre,
              format: schema.pitches.format,
              status: schema.pitches.status,
              posterUrl: schema.pitches.posterUrl,
              titleImage: schema.pitches.titleImage,
              viewCount: schema.pitches.viewCount,
              createdAt: schema.pitches.createdAt,
              userId: schema.pitches.userId,
              // Creator fields
              creatorId: schema.users.id,
              creatorUsername: schema.users.username,
              creatorFirstName: schema.users.firstName,
              creatorLastName: schema.users.lastName,
              creatorCompanyName: schema.users.companyName,
              creatorProfileImage: schema.users.profileImageUrl,
              creatorUserType: schema.users.userType,
            })
            .from(schema.pitches)
            .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
            .where(
              or(
                eq(schema.pitches.status, 'published'),
                eq(schema.pitches.status, 'active')
              )
            )
            .orderBy(desc(schema.pitches.createdAt))
            .limit(20);
          }
          
          // Format the response to include creator as nested object
          const formattedPitches = followedPitches.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            status: pitch.status,
            posterUrl: pitch.posterUrl,
            titleImage: pitch.titleImage,
            viewCount: pitch.viewCount,
            createdAt: pitch.createdAt,
            userId: pitch.userId,
            creator: {
              id: pitch.creatorId,
              username: pitch.creatorUsername || `${pitch.creatorFirstName} ${pitch.creatorLastName}`,
              firstName: pitch.creatorFirstName,
              lastName: pitch.creatorLastName,
              companyName: pitch.creatorCompanyName,
              profileImageUrl: pitch.creatorProfileImage,
              userType: pitch.creatorUserType
            }
          }));
          
          return corsResponse(request, {
            success: true,
            data: formattedPitches
          });
        } catch (error) {
          console.error('Error fetching followed pitches:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch followed pitches',
            error: error.message
          }, 500);
        }
      }

      // Payment endpoints
      if (path === '/api/payments/credits/balance' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            balance: 1000,
            currency: 'USD'
          }
        });
      }

      if (path === '/api/payments/subscription-status' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            status: 'active',
            plan: 'premium',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      }

      // Analytics dashboard
      if (path === '/api/analytics/dashboard' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          analytics: {
            views: {
              total: 1250,
              thisMonth: 450,
              growth: "+15%"
            },
            engagement: {
              likes: 89,
              comments: 34,
              shares: 12
            },
            demographics: {
              age: "25-34",
              location: "US",
              gender: "Mixed"
            },
            performance: {
              topPitch: "Space Adventure",
              avgEngagement: "7.2%"
            }
          }
        });
      }

      // NDA stats
      if (path === '/api/ndas/stats' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            pending: 2,
            signed: 5,
            total: 7
          }
        });
      }

      // Create NDA request
      if (path === '/api/nda/request' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const body = await request.json();
          const { pitchId, purpose, message } = body;
          
          if (!pitchId) {
            return corsResponse(request, {
              success: false,
              message: 'Pitch ID is required',
            }, 400);
          }
          
          // Get the pitch to find the creator
          const pitches = await db.select()
            .from(schema.pitches)
            .where(eq(schema.pitches.id, pitchId))
            .limit(1);
          
          if (pitches.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'Pitch not found',
            }, 404);
          }
          
          const pitch = pitches[0];
          const requesterId = parseInt(userPayload.sub);
          
          // Check if NDA request already exists
          const existingRequests = await db.select()
            .from(schema.ndaRequests)
            .where(and(
              eq(schema.ndaRequests.pitchId, pitchId),
              eq(schema.ndaRequests.requesterId, requesterId),
              eq(schema.ndaRequests.status, 'pending')
            ))
            .limit(1);
          
          if (existingRequests.length > 0) {
            return corsResponse(request, {
              success: false,
              message: 'NDA request already exists for this pitch',
            }, 409);
          }
          
          // Create the NDA request
          const newRequest = await db.insert(schema.ndaRequests)
            .values({
              pitchId,
              requesterId,
              ownerId: pitch.userId,
              status: 'pending',
              requestMessage: message || 'Requesting NDA for investment opportunity',
              requestedAt: new Date(),
            })
            .returning();
          
          // Create notification for the pitch owner
          await db.insert(schema.notifications)
            .values({
              userId: pitch.userId,
              type: 'nda_request',
              title: 'New NDA Request',
              message: `You have received an NDA request for "${pitch.title}"`,
              relatedId: newRequest[0].id,
              relatedType: 'nda_request',
              data: {
                pitchId: pitchId,
                pitchTitle: pitch.title,
                requesterId: requesterId,
                requestId: newRequest[0].id
              },
              createdAt: new Date(),
            });
          
          return corsResponse(request, {
            success: true,
            message: 'NDA request sent successfully',
            data: newRequest[0],
          }, 201);
        } catch (error) {
          console.error('Error creating NDA request:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to create NDA request',
          }, 500);
        }
      }

      // Approve or reject NDA request
      if (path.match(/^\/api\/nda\/request\/\d+\/(approve|reject)$/) && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pathParts = path.split('/');
        const requestId = parseInt(pathParts[4]);
        const action = pathParts[5] as 'approve' | 'reject';
        
        try {
          // Get the NDA request
          const ndaRequests = await db.select()
            .from(schema.ndaRequests)
            .where(eq(schema.ndaRequests.id, requestId))
            .limit(1);
          
          if (ndaRequests.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'NDA request not found',
            }, 404);
          }
          
          const ndaRequest = ndaRequests[0];
          
          // Verify the user is the creator/owner of the pitch
          const pitches = await db.select()
            .from(schema.pitches)
            .where(eq(schema.pitches.id, ndaRequest.pitchId))
            .limit(1);
          
          if (pitches.length === 0 || pitches[0].userId !== parseInt(userPayload.sub)) {
            return corsResponse(request, {
              success: false,
              message: 'You are not authorized to approve/reject this NDA request',
            }, 403);
          }
          
          const body = await request.json().catch(() => ({}));
          
          if (action === 'approve') {
            // Update NDA request to approved
            await db.update(schema.ndaRequests)
              .set({
                status: 'approved',
                respondedAt: new Date(),
              })
              .where(eq(schema.ndaRequests.id, requestId));
            
            // Create signed NDA record
            await db.insert(schema.ndas)
              .values({
                pitchId: ndaRequest.pitchId,
                signerId: ndaRequest.requesterId,
                userId: ndaRequest.requesterId,
                status: 'active',
                accessGranted: true,
                signedAt: new Date(),
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
              });
            
            // Create notification for the requester
            await db.insert(schema.notifications)
              .values({
                userId: ndaRequest.requesterId,
                type: 'nda_approved',
                title: 'NDA Approved',
                message: `Your NDA request has been approved. You now have access to protected content.`,
                relatedId: requestId,
                relatedType: 'nda_request',
                data: {
                  pitchId: ndaRequest.pitchId,
                  requestId: requestId
                },
                createdAt: new Date(),
              });
            
            return corsResponse(request, {
              success: true,
              message: 'NDA request approved successfully',
            });
          } else {
            // Reject NDA request
            await db.update(schema.ndaRequests)
              .set({
                status: 'rejected',
                rejectionReason: body.reason || 'No reason provided',
                respondedAt: new Date(),
              })
              .where(eq(schema.ndaRequests.id, requestId));
            
            return corsResponse(request, {
              success: true,
              message: 'NDA request rejected',
            });
          }
        } catch (error) {
          console.error('Error handling NDA request:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to process NDA request',
          }, 500);
        }
      }

      // Check NDA status for a pitch
      if (path.match(/^\/api\/pitches\/\d+\/nda-status$/) && method === 'GET') {
        const pitchId = parseInt(path.split('/')[3]);
        
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const userId = parseInt(userPayload.sub);
        
        try {
          // Check if user has an approved NDA for this pitch
          const ndas = await db.select()
            .from(schema.ndas)
            .where(and(
              eq(schema.ndas.pitchId, pitchId),
              eq(schema.ndas.requesterId, userId),
              eq(schema.ndas.status, 'signed')
            ))
            .limit(1);
          
          const hasApprovedNDA = ndas.length > 0;
          
          // Check for pending requests
          const pendingRequests = await db.select()
            .from(schema.ndaRequests)
            .where(and(
              eq(schema.ndaRequests.pitchId, pitchId),
              eq(schema.ndaRequests.requesterId, userId),
              eq(schema.ndaRequests.status, 'pending')
            ))
            .limit(1);
          
          const hasPendingRequest = pendingRequests.length > 0;
          
          return corsResponse(request, {
            success: true,
            data: {
              hasApprovedNDA,
              hasPendingRequest,
              ndaRequired: true, // Would be fetched from pitch data
              canViewProtectedContent: hasApprovedNDA,
            }
          });
        } catch (error) {
          console.error('Error checking NDA status:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to check NDA status',
          }, 500);
        }
      }

      // NDA incoming requests (NDAs others want you to sign)
      if (path === '/api/ndas/incoming-requests' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          // Get NDAs where current user is the recipient
          const ndaRequests = await db.select({
            id: schema.ndas.id,
            pitchId: schema.ndas.pitchId,
            requesterId: schema.ndas.requesterId,
            recipientId: schema.ndas.recipientId,
            status: schema.ndas.status,
            requestedAt: schema.ndas.requestedAt,
            signedAt: schema.ndas.signedAt,
            expiresAt: schema.ndas.expiresAt,
            pitch: {
              id: schema.pitches.id,
              title: schema.pitches.title,
              genre: schema.pitches.genre,
            },
            requester: {
              id: schema.users.id,
              username: schema.users.username,
              email: schema.users.email,
            }
          })
          .from(schema.ndas)
          .leftJoin(schema.pitches, eq(schema.ndas.pitchId, schema.pitches.id))
          .leftJoin(schema.users, eq(schema.ndas.requesterId, schema.users.id))
          .where(and(
            eq(schema.ndas.recipientId, userPayload.sub),
            eq(schema.ndas.status, 'pending')
          ))
          .orderBy(desc(schema.ndas.requestedAt));

          return corsResponse(request, {
            success: true,
            data: ndaRequests
          });
        } catch (error) {
          console.error('Error fetching incoming NDA requests:', error);
          return corsResponse(request, {
            success: true,
            data: [] // Return empty array on error
          });
        }
      }

      // NDA outgoing requests (NDAs you've requested others to sign)
      if (path === '/api/ndas/outgoing-requests' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          // Get NDAs where current user is the requester
          const ndaRequests = await db.select({
            id: schema.ndas.id,
            pitchId: schema.ndas.pitchId,
            requesterId: schema.ndas.requesterId,
            recipientId: schema.ndas.recipientId,
            status: schema.ndas.status,
            requestedAt: schema.ndas.requestedAt,
            signedAt: schema.ndas.signedAt,
            expiresAt: schema.ndas.expiresAt,
            pitch: {
              id: schema.pitches.id,
              title: schema.pitches.title,
              genre: schema.pitches.genre,
            },
            recipient: {
              id: schema.users.id,
              username: schema.users.username,
              email: schema.users.email,
            }
          })
          .from(schema.ndas)
          .leftJoin(schema.pitches, eq(schema.ndas.pitchId, schema.pitches.id))
          .leftJoin(schema.users, eq(schema.ndas.recipientId, schema.users.id))
          .where(and(
            eq(schema.ndas.requesterId, userPayload.sub),
            eq(schema.ndas.status, 'pending')
          ))
          .orderBy(desc(schema.ndas.requestedAt));

          return corsResponse(request, {
            success: true,
            data: ndaRequests
          });
        } catch (error) {
          console.error('Error fetching outgoing NDA requests:', error);
          return corsResponse(request, {
            success: true,
            data: [] // Return empty array on error
          });
        }
      }

      // NDA incoming signed (NDAs you've signed for others)
      if (path === '/api/ndas/incoming-signed' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const signedNdas = await db.select({
            id: schema.ndas.id,
            pitchId: schema.ndas.pitchId,
            requesterId: schema.ndas.requesterId,
            recipientId: schema.ndas.recipientId,
            status: schema.ndas.status,
            requestedAt: schema.ndas.requestedAt,
            signedAt: schema.ndas.signedAt,
            expiresAt: schema.ndas.expiresAt,
            pitch: {
              id: schema.pitches.id,
              title: schema.pitches.title,
              genre: schema.pitches.genre,
            },
            requester: {
              id: schema.users.id,
              username: schema.users.username,
              email: schema.users.email,
            }
          })
          .from(schema.ndas)
          .leftJoin(schema.pitches, eq(schema.ndas.pitchId, schema.pitches.id))
          .leftJoin(schema.users, eq(schema.ndas.requesterId, schema.users.id))
          .where(and(
            eq(schema.ndas.recipientId, userPayload.sub),
            eq(schema.ndas.status, 'signed')
          ))
          .orderBy(desc(schema.ndas.signedAt));

          return corsResponse(request, {
            success: true,
            data: signedNdas
          });
        } catch (error) {
          console.error('Error fetching signed NDAs:', error);
          return corsResponse(request, {
            success: true,
            data: [] // Return empty array on error
          });
        }
      }

      // NDA outgoing signed (NDAs others have signed for you)
      if (path === '/api/ndas/outgoing-signed' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const signedNdas = await db.select({
            id: schema.ndas.id,
            pitchId: schema.ndas.pitchId,
            requesterId: schema.ndas.requesterId,
            recipientId: schema.ndas.recipientId,
            status: schema.ndas.status,
            requestedAt: schema.ndas.requestedAt,
            signedAt: schema.ndas.signedAt,
            expiresAt: schema.ndas.expiresAt,
            pitch: {
              id: schema.pitches.id,
              title: schema.pitches.title,
              genre: schema.pitches.genre,
            },
            recipient: {
              id: schema.users.id,
              username: schema.users.username,
              email: schema.users.email,
            }
          })
          .from(schema.ndas)
          .leftJoin(schema.pitches, eq(schema.ndas.pitchId, schema.pitches.id))
          .leftJoin(schema.users, eq(schema.ndas.recipientId, schema.users.id))
          .where(and(
            eq(schema.ndas.requesterId, userPayload.sub),
            eq(schema.ndas.status, 'signed')
          ))
          .orderBy(desc(schema.ndas.signedAt));

          return corsResponse(request, {
            success: true,
            data: signedNdas
          });
        } catch (error) {
          console.error('Error fetching signed NDAs:', error);
          return corsResponse(request, {
            success: true,
            data: [] // Return empty array on error
          });
        }
      }

      // Production investments overview
      if (path === '/api/production/investments/overview' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            totalInvestments: 3,
            totalAmount: 1500000,
            activeProjects: 2,
            completedProjects: 1,
            avgInvestment: 500000,
            recentInvestments: [
              {
                id: 1,
                pitchTitle: "The Last Echo",
                amount: 750000,
                date: "2024-12-01",
                status: "active"
              },
              {
                id: 2,
                pitchTitle: "Digital Dreams",
                amount: 500000,
                date: "2024-11-15",
                status: "active"
              }
            ]
          }
        });
      }

      // Analytics realtime
      if (path === '/api/analytics/realtime' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }

        try {
          const userId = userPayload.userId;
          
          // Get recent activity - views and NDAs for user's pitches
          const recentViews = await db.select({
            id: schema.pitchViews.id,
            pitchId: schema.pitchViews.pitchId,
            pitchTitle: schema.pitches.title,
            viewerId: schema.pitchViews.viewerId,
            viewerName: schema.users.username,
            viewerCompany: schema.users.companyName,
            viewedAt: schema.pitchViews.viewedAt
          })
          .from(schema.pitchViews)
          .innerJoin(schema.pitches, eq(schema.pitchViews.pitchId, schema.pitches.id))
          .innerJoin(schema.users, eq(schema.pitchViews.viewerId, schema.users.id))
          .where(eq(schema.pitches.userId, userId))
          .orderBy(desc(schema.pitchViews.viewedAt))
          .limit(5);

          const recentNDAs = await db.select({
            id: schema.ndaRequests.id,
            pitchId: schema.ndaRequests.pitchId,
            pitchTitle: schema.pitches.title,
            requesterId: schema.ndaRequests.userId,
            requesterName: schema.users.username,
            requesterCompany: schema.users.companyName,
            status: schema.ndaRequests.status,
            createdAt: schema.ndaRequests.createdAt
          })
          .from(schema.ndaRequests)
          .innerJoin(schema.pitches, eq(schema.ndaRequests.pitchId, schema.pitches.id))
          .innerJoin(schema.users, eq(schema.ndaRequests.userId, schema.users.id))
          .where(eq(schema.pitches.userId, userId))
          .orderBy(desc(schema.ndaRequests.createdAt))
          .limit(5);

          // Format recent activity
          const recentActivity = [
            ...recentViews.map(view => ({
              id: `view-${view.id}`,
              type: 'view',
              userName: view.viewerCompany || view.viewerName || 'Anonymous',
              pitchTitle: view.pitchTitle || 'Unknown Pitch',
              timestamp: getRelativeTime(new Date(view.viewedAt)),
              pitchId: view.pitchId
            })),
            ...recentNDAs.map(nda => ({
              id: `nda-${nda.id}`,
              type: 'nda',
              userName: nda.requesterCompany || nda.requesterName || 'Anonymous',
              pitchTitle: nda.pitchTitle || 'Unknown Pitch',
              timestamp: getRelativeTime(new Date(nda.createdAt)),
              pitchId: nda.pitchId,
              status: nda.status
            }))
          ].sort((a, b) => {
            // Sort by timestamp, most recent first
            const timeA = a.timestamp.includes('second') ? 0 : 
                          a.timestamp.includes('minute') ? 1 : 
                          a.timestamp.includes('hour') ? 2 : 3;
            const timeB = b.timestamp.includes('second') ? 0 : 
                          b.timestamp.includes('minute') ? 1 : 
                          b.timestamp.includes('hour') ? 2 : 3;
            return timeA - timeB;
          }).slice(0, 10);

          // Get top pitches by views
          const topPitches = await db.select({
            id: schema.pitches.id,
            title: schema.pitches.title,
            views: sql<number>`COUNT(DISTINCT ${schema.pitchViews.id})::integer`
          })
          .from(schema.pitches)
          .leftJoin(schema.pitchViews, eq(schema.pitches.id, schema.pitchViews.pitchId))
          .where(eq(schema.pitches.userId, userId))
          .groupBy(schema.pitches.id, schema.pitches.title)
          .orderBy(desc(sql`COUNT(DISTINCT ${schema.pitchViews.id})`))
          .limit(5);
          
          return corsResponse(request, {
            success: true,
            data: {
              activeUsers: 42,
              viewsLastHour: 156,
              pitchesViewed: 23,
              ndaRequests: recentNDAs.length,
              topPitches: topPitches.map(p => ({
                id: p.id,
                title: p.title || 'Unknown Pitch',
                views: p.views || 0
              })),
              recentActivity
            }
          });
        } catch (error) {
          console.error('Failed to fetch realtime analytics:', error);
          
          // Return safe fallback data
          return corsResponse(request, {
            success: true,
            data: {
              activeUsers: 0,
              viewsLastHour: 0,
              pitchesViewed: 0,
              ndaRequests: 0,
              topPitches: [],
              recentActivity: []
            }
          });
        }
      }

      // Payment history
      if (path === '/api/payments/history' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            payments: [
              {
                id: 1,
                date: "2024-12-01",
                amount: 29.99,
                description: "Popular Plan - Monthly",
                status: "completed"
              },
              {
                id: 2,
                date: "2024-11-01",
                amount: 29.99,
                description: "Popular Plan - Monthly",
                status: "completed"
              }
            ],
            total: 2
          }
        });
      }

      // Payment invoices
      if (path === '/api/payments/invoices' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            invoices: [
              {
                id: "INV-2024-001",
                date: "2024-12-01",
                amount: 29.99,
                status: "paid",
                downloadUrl: "/api/payments/invoices/INV-2024-001/download"
              }
            ],
            total: 1
          }
        });
      }

      // Payment methods
      if (path === '/api/payments/payment-methods' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            methods: [
              {
                id: 1,
                type: "card",
                last4: "4242",
                brand: "Visa",
                expiryMonth: 12,
                expiryYear: 2025,
                isDefault: true
              }
            ]
          }
        });
      }

      // Notification preferences
      if (path === '/api/notifications/preferences' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            email: {
              pitchViews: true,
              ndaRequests: true,
              investments: true,
              messages: true,
              marketing: false
            },
            push: {
              enabled: false
            }
          }
        });
      }

      // Saved filters
      if (path === '/api/filters/saved' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            filters: [
              {
                id: 1,
                name: "High Budget Thrillers",
                criteria: {
                  genre: "Thriller",
                  minBudget: 1000000
                }
              }
            ]
          }
        });
      }

      // Email alerts
      if (path === '/api/alerts/email' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            alerts: [
              {
                id: 1,
                type: "new_pitch",
                criteria: { genre: "Sci-Fi" },
                frequency: "daily",
                enabled: true
              }
            ]
          }
        });
      }

      // Notifications unread endpoint
      if (path === '/api/notifications/unread' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        // Get unread notifications count from database
        try {
          const notifications = await db.select({
            count: sql<number>`count(*)`
          })
          .from(schema.notifications)
          .where(and(
            eq(schema.notifications.userId, parseInt(userPayload.sub)),
            eq(schema.notifications.read, false)
          ));
          
          return corsResponse(request, {
            success: true,
            count: Number(notifications[0]?.count || 0)
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching unread notifications:', error);
          return corsResponse(request, {
            success: true,
            count: 0
          }, 200, getCorsHeaders(request));
        }
      }

      // NDA pending endpoint
      if (path === '/api/nda/pending' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        try {
          const userId = parseInt(userPayload.sub);
          const pendingNdas = await db.select()
            .from(schema.ndaRequests)
            .where(and(
              eq(schema.ndaRequests.creatorId, userId),
              eq(schema.ndaRequests.status, 'pending')
            ))
            .orderBy(desc(schema.ndaRequests.createdAt));
          
          return corsResponse(request, {
            success: true,
            data: pendingNdas
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching pending NDAs:', error);
          return corsResponse(request, {
            success: true,
            data: []
          }, 200, getCorsHeaders(request));
        }
      }

      // NDA active endpoint
      if (path === '/api/nda/active' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        try {
          const userId = parseInt(userPayload.sub);
          const activeNdas = await db.select()
            .from(schema.ndaRequests)
            .where(and(
              or(
                eq(schema.ndaRequests.creatorId, userId),
                eq(schema.ndaRequests.investorId, userId)
              ),
              eq(schema.ndaRequests.status, 'approved')
            ))
            .orderBy(desc(schema.ndaRequests.approvedAt));
          
          return corsResponse(request, {
            success: true,
            data: activeNdas
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching active NDAs:', error);
          return corsResponse(request, {
            success: true,
            data: []
          }, 200, getCorsHeaders(request));
        }
      }

      // Follows stats endpoint
      if (path.match(/^\/api\/follows\/stats\/\d+$/) && method === 'GET') {
        const targetUserId = parseInt(path.split('/').pop() || '0');
        
        try {
          // Get follower count
          const followers = await db.select({
            count: sql<number>`count(*)`
          })
          .from(schema.follows)
          .where(eq(schema.follows.followingId, targetUserId));
          
          // Get following count
          const following = await db.select({
            count: sql<number>`count(*)`
          })
          .from(schema.follows)
          .where(eq(schema.follows.followerId, targetUserId));
          
          return corsResponse(request, {
            success: true,
            data: {
              followersCount: Number(followers[0]?.count || 0),
              followingCount: Number(following[0]?.count || 0)
            }
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching follow stats:', error);
          return corsResponse(request, {
            success: true,
            data: {
              followersCount: 0,
              followingCount: 0
            }
          }, 200, getCorsHeaders(request));
        }
      }

      // Analytics user endpoint
      if (path === '/api/analytics/user' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        const userId = parseInt(userPayload.sub);
        const preset = url.searchParams.get('preset') || 'month';
        
        // Calculate date range based on preset
        const now = new Date();
        let startDate = new Date();
        
        switch (preset) {
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        try {
          // Get user's pitches
          const pitches = await db.select()
            .from(schema.pitches)
            .where(eq(schema.pitches.userId, userId));
          
          const pitchIds = pitches.map(p => p.id);
          
          // Get views for the period - with better error handling
          let viewCount = 0;
          if (pitchIds.length > 0) {
            try {
              const views = await db.select({
                count: sql<number>`count(*)`
              })
              .from(schema.pitchViews)
              .where(and(
                or(...pitchIds.map(id => eq(schema.pitchViews.pitchId, id))),
                gte(schema.pitchViews.viewedAt, startDate)
              ));
              viewCount = views[0]?.count || 0;
            } catch (e) {
              console.error('Error fetching views:', e);
              // Continue with 0 views if table doesn't exist
            }
          }
          
          return corsResponse(request, {
            success: true,
            data: {
              totalPitches: pitches.length,
              activePitches: pitches.filter(p => p.status === 'active').length,
              totalViews: viewCount,
              engagementRate: 0,
              preset,
              period: {
                start: startDate.toISOString(),
                end: now.toISOString()
              }
            }
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching user analytics:', error);
          return corsResponse(request, {
            success: true,
            data: {
              totalPitches: 0,
              activePitches: 0,
              totalViews: 0,
              engagementRate: 0,
              preset,
              period: {
                start: startDate.toISOString(),
                end: now.toISOString()
              }
            }
          }, 200, getCorsHeaders(request));
        }
      }

      // Creator dashboard stats endpoint
      if (path === '/api/creator/dashboard/stats' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, {
            success: false,
            message: 'Creator authentication required',
          }, 401);
        }
        
        const creatorId = parseInt(userPayload.sub);
        
        try {
          // Get pitch statistics
          const totalPitchesResult = await sql`
            SELECT COUNT(*)::integer as count 
            FROM pitches 
            WHERE user_id = ${creatorId}
          `;
          
          const publishedPitchesResult = await sql`
            SELECT COUNT(*)::integer as count 
            FROM pitches 
            WHERE user_id = ${creatorId} AND status = 'published'
          `;
          
          const draftPitchesResult = await sql`
            SELECT COUNT(*)::integer as count 
            FROM pitches 
            WHERE user_id = ${creatorId} AND status = 'draft'
          `;
          
          // Get total views and engagement
          const engagementResult = await sql`
            SELECT 
              COALESCE(SUM(view_count), 0)::integer as total_views,
              COALESCE(SUM(like_count), 0)::integer as total_likes,
              COALESCE(SUM(comment_count), 0)::integer as total_comments
            FROM pitches 
            WHERE user_id = ${creatorId}
          `;
          
          // Get NDA statistics  
          const ndaResult = await sql`
            SELECT 
              COUNT(*)::integer as total_ndas,
              COUNT(CASE WHEN nr.status = 'approved' THEN 1 END)::integer as approved,
              COUNT(CASE WHEN nr.status = 'pending' THEN 1 END)::integer as pending,
              COUNT(CASE WHEN nr.status = 'rejected' THEN 1 END)::integer as rejected
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            WHERE p.user_id = ${creatorId}
          `;
          
          // Get investment interest count
          const investmentResult = await sql`
            SELECT 
              COUNT(*)::integer as total_interests,
              COALESCE(SUM(ii.amount), 0)::numeric as total_amount
            FROM investment_interests ii
            JOIN pitches p ON ii.pitch_id = p.id
            WHERE p.user_id = ${creatorId} AND ii.status = 'active'
          `;
          
          // Get recent activity (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const recentActivityResult = await sql`
            SELECT 
              COUNT(*)::integer as recent_views
            FROM pitch_views 
            WHERE pitch_id IN (
              SELECT id FROM pitches WHERE user_id = ${creatorId}
            ) 
            AND viewed_at >= ${thirtyDaysAgo.toISOString()}
          `;
          
          return corsResponse(request, {
            success: true,
            data: {
              pitches: {
                total: totalPitchesResult[0]?.count || 0,
                published: publishedPitchesResult[0]?.count || 0,
                draft: draftPitchesResult[0]?.count || 0
              },
              engagement: {
                totalViews: engagementResult[0]?.total_views || 0,
                totalLikes: engagementResult[0]?.total_likes || 0,
                totalComments: engagementResult[0]?.total_comments || 0,
                recentViews: recentActivityResult[0]?.recent_views || 0
              },
              ndas: {
                total: ndaResult[0]?.total_ndas || 0,
                approved: ndaResult[0]?.approved || 0,
                pending: ndaResult[0]?.pending || 0,
                rejected: ndaResult[0]?.rejected || 0
              },
              investments: {
                totalInterests: investmentResult[0]?.total_interests || 0,
                totalAmount: parseFloat(investmentResult[0]?.total_amount || '0')
              },
              performance: {
                conversionRate: ndaResult[0]?.total_ndas > 0 
                  ? ((ndaResult[0]?.approved / ndaResult[0]?.total_ndas) * 100).toFixed(1) + '%'
                  : '0%',
                engagementRate: totalPitchesResult[0]?.count > 0 && engagementResult[0]?.total_views > 0
                  ? ((engagementResult[0]?.total_likes / engagementResult[0]?.total_views) * 100).toFixed(1) + '%'
                  : '0%'
              }
            }
          });
        } catch (error) {
          console.error('Error fetching creator dashboard stats:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch dashboard statistics',
            error: error instanceof Error ? error.message : undefined,
          }, 500);
        }
      }

      // User notifications endpoint
      if (path === '/api/user/notifications' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        
        // Get notifications from database
        try {
          const notifications = await db.select()
            .from(schema.notifications)
            .where(eq(schema.notifications.userId, parseInt(userPayload.sub)))
            .orderBy(desc(schema.notifications.createdAt))
            .limit(limit)
            .offset(offset);
          
          return corsResponse(request, {
            success: true,
            data: notifications.map(n => ({
              id: n.id,
              type: n.type || 'general',
              title: n.title || 'Notification',
              message: n.message || '',
              read: n.read || false,
              createdAt: n.createdAt,
              metadata: n.data || {}
            })),
            total: notifications.length
          });
        } catch (error) {
          console.error('Error fetching user notifications:', error);
          return corsResponse(request, {
            success: true,
            data: [],
            total: 0
          });
        }
      }

      // Production following activity
      if (path === '/api/production/following' && method === 'GET') {
        const tab = url.searchParams.get('tab') || 'activity';
        
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            activity: [
              {
                id: 1,
                type: "pitch_update",
                user: "Alex Creator",
                action: "updated pitch",
                pitch: "The Last Echo",
                time: "2 hours ago"
              }
            ],
            following: [],
            followers: []
          }
        });
      }

      // General notifications endpoint (without /user prefix)
      if (path === '/api/notifications' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        
        try {
          const notifications = await db.select()
            .from(schema.notifications)
            .where(eq(schema.notifications.userId, parseInt(userPayload.sub)))
            .orderBy(desc(schema.notifications.createdAt))
            .limit(limit)
            .offset(offset);
          
          return corsResponse(request, {
            success: true,
            data: notifications.map(n => ({
              id: n.id,
              type: n.type || 'general',
              title: n.title || 'Notification',
              message: n.message || '',
              read: n.read || false,
              createdAt: n.createdAt,
              metadata: n.data || {}
            }))
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching notifications:', error);
          return corsResponse(request, {
            success: true,
            data: []
          }, 200, getCorsHeaders(request));
        }
      }

      // Mark notification as read
      if (path.match(/^\/api\/notifications\/\d+\/read$/) && method === 'PUT') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        const notificationId = parseInt(path.split('/')[3]);
        
        try {
          await db.update(schema.notifications)
            .set({ read: true })
            .where(and(
              eq(schema.notifications.id, notificationId),
              eq(schema.notifications.userId, parseInt(userPayload.sub))
            ));
          
          return corsResponse(request, {
            success: true,
            message: 'Notification marked as read'
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error marking notification as read:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to update notification'
          }, 500, getCorsHeaders(request));
        }
      }

      // Subscription status endpoint
      if (path === '/api/subscription/status' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            tier: 'basic',
            status: 'active',
            credits: 1000,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }, 200, getCorsHeaders(request));
      }

      // Saved pitches endpoints
      if (path === '/api/user/saved-pitches' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const userId = parseInt(userPayload.sub);
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        
        try {
          // Get saved pitches for the user
          const savedPitches = await sql`
            SELECT 
              p.id, p.title, p.logline, p.genre, p.format,
              p.estimated_budget as "estimatedBudget",
              p.budget_bracket as "budgetBracket",
              p.thumbnail_url as "thumbnail",
              p.view_count as "viewCount",
              p.like_count as "likeCount",
              p.user_id as "creatorId",
              p.created_at as "createdAt",
              sp.saved_at as "savedAt"
            FROM saved_pitches sp
            JOIN pitches p ON sp.pitch_id = p.id
            WHERE sp.user_id = ${userId}
            ORDER BY sp.saved_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
          
          const totalResult = await sql`
            SELECT COUNT(*)::integer as count
            FROM saved_pitches
            WHERE user_id = ${userId}
          `;
          
          return corsResponse(request, {
            success: true,
            data: savedPitches || [],
            pagination: {
              limit,
              offset,
              total: totalResult[0]?.count || 0
            }
          });
        } catch (error) {
          console.error('Error fetching saved pitches:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch saved pitches',
            error: error instanceof Error ? error.message : undefined,
          }, 500);
        }
      }
      
      // Save a pitch
      if (path === '/api/pitches/save' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const { pitchId } = await request.json();
        const userId = parseInt(userPayload.sub);
        
        if (!pitchId) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch ID is required',
          }, 400);
        }
        
        try {
          // Check if already saved
          const existing = await sql`
            SELECT id FROM saved_pitches
            WHERE user_id = ${userId} AND pitch_id = ${pitchId}
            LIMIT 1
          `;
          
          if (existing && existing.length > 0) {
            return corsResponse(request, {
              success: false,
              message: 'Pitch already saved',
            }, 409);
          }
          
          // Save the pitch
          await sql`
            INSERT INTO saved_pitches (user_id, pitch_id, saved_at)
            VALUES (${userId}, ${pitchId}, NOW())
          `;
          
          return corsResponse(request, {
            success: true,
            message: 'Pitch saved successfully',
          });
        } catch (error) {
          console.error('Error saving pitch:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to save pitch',
            error: error instanceof Error ? error.message : undefined,
          }, 500);
        }
      }
      
      // Unsave a pitch
      if (path === '/api/pitches/unsave' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const { pitchId } = await request.json();
        const userId = parseInt(userPayload.sub);
        
        if (!pitchId) {
          return corsResponse(request, {
            success: false,
            message: 'Pitch ID is required',
          }, 400);
        }
        
        try {
          await sql`
            DELETE FROM saved_pitches
            WHERE user_id = ${userId} AND pitch_id = ${pitchId}
          `;
          
          return corsResponse(request, {
            success: true,
            message: 'Pitch unsaved successfully',
          });
        } catch (error) {
          console.error('Error unsaving pitch:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to unsave pitch',
            error: error instanceof Error ? error.message : undefined,
          }, 500);
        }
      }

      // Browse pitches with tab filtering - Back to Drizzle with fixed implementation
      if (path === '/api/pitches/browse' && method === 'GET') {
        const tab = url.searchParams.get('tab') || 'all';
        const genre = url.searchParams.get('genre');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        
        try {
          // Define the base select fields including creator data
          const selectFields = {
            id: schema.pitches.id,
            title: schema.pitches.title,
            logline: schema.pitches.logline,
            genre: schema.pitches.genre,
            format: schema.pitches.format,
            estimatedBudget: schema.pitches.estimatedBudget,
            budgetBracket: schema.pitches.budgetBracket,
            thumbnail: schema.pitches.thumbnail,
            posterUrl: schema.pitches.posterUrl,
            titleImage: schema.pitches.titleImage,
            viewCount: schema.pitches.viewCount,
            likeCount: schema.pitches.likeCount,
            creatorId: schema.pitches.userId,
            createdAt: schema.pitches.createdAt,
            status: schema.pitches.status,
            // Creator fields
            creatorUserId: schema.users.id,
            creatorUsername: schema.users.username,
            creatorFirstName: schema.users.firstName,
            creatorLastName: schema.users.lastName,
            creatorCompanyName: schema.users.companyName,
            creatorProfileImage: schema.users.profileImageUrl,
            creatorUserType: schema.users.userType,
          };
          
          // Build conditions based on tab and filters
          const conditions = [eq(schema.pitches.status, 'published')];
          
          // Apply format filter based on tab
          if (tab === 'film') {
            conditions.push(eq(schema.pitches.format, 'Film'));
          } else if (tab === 'television') {
            conditions.push(eq(schema.pitches.format, 'Television - Scripted'));
          } else if (tab === 'web-series') {
            conditions.push(eq(schema.pitches.format, 'Web Series'));
          } else if (tab === 'documentary') {
            conditions.push(eq(schema.pitches.format, 'Documentary'));
          }
          
          // Apply genre filter if provided
          if (genre) {
            conditions.push(eq(schema.pitches.genre, genre));
          }
          
          // Create query with all conditions
          let query = db.select(selectFields)
            .from(schema.pitches)
            .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
            .where(and(...conditions))
            .orderBy(desc(schema.pitches.createdAt))
            .limit(limit)
            .offset(offset);
          
          // Execute query and get results
          const pitches = await query;
          
          // Format the response with creator data
          const formattedPitches = pitches.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            estimatedBudget: pitch.estimatedBudget,
            budgetBracket: pitch.budgetBracket,
            thumbnail: pitch.thumbnail || pitch.posterUrl || pitch.titleImage,
            posterUrl: pitch.posterUrl,
            titleImage: pitch.titleImage,
            viewCount: pitch.viewCount,
            likeCount: pitch.likeCount,
            creatorId: pitch.creatorId,
            createdAt: pitch.createdAt,
            status: pitch.status,
            creator: pitch.creatorUserId ? {
              id: pitch.creatorUserId,
              username: pitch.creatorUsername || `${pitch.creatorFirstName} ${pitch.creatorLastName}`,
              firstName: pitch.creatorFirstName,
              lastName: pitch.creatorLastName,
              companyName: pitch.creatorCompanyName,
              profileImageUrl: pitch.creatorProfileImage,
              userType: pitch.creatorUserType
            } : null
          }));
          
          return corsResponse(request, {
            success: true,
            data: formattedPitches,
            pagination: {
              total: formattedPitches.length,
              limit,
              offset,
              hasMore: formattedPitches.length === limit,
            },
            filters: { tab, genre },
          });
        } catch (error) {
          console.error('Error fetching browse pitches:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch pitches',
            error: error instanceof Error ? error.message : String(error),
          }, 500);
        }
      }

      // Enhanced Browse Section with sorting and filtering
      if (path === '/api/browse/enhanced' && method === 'GET') {
        try {
          // Extract query parameters
          const tab = url.searchParams.get('tab') || 'all';
          const sortBy = url.searchParams.get('sortBy') || 'date'; // date, views, rating, investment
          const sortOrder = url.searchParams.get('sortOrder') || 'desc'; // asc, desc
          const genre = url.searchParams.get('genre');
          const budgetRange = url.searchParams.get('budgetRange'); // low, medium, high, mega
          const seekingInvestment = url.searchParams.get('seekingInvestment');
          const hasNDA = url.searchParams.get('hasNDA');
          const search = url.searchParams.get('search');
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
          const offset = parseInt(url.searchParams.get('offset') || '0');
          
          // Build base query with JOINs for creator info and stats
          let baseQuery = `
            SELECT 
              p.id,
              p.title,
              p.logline,
              p.genre,
              p.format,
              p.format_category,
              p.estimated_budget,
              p.budget_bracket,
              p.thumbnail_url,
              p.poster_url,
              p.view_count,
              p.like_count,
              p.nda_count,
              p.seeking_investment,
              p.require_nda,
              p.status,
              p.created_at,
              p.updated_at,
              u.id as creator_id,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name,
              u.company_name as creator_company,
              COALESCE(ii.investment_count, 0) as investment_count,
              COALESCE(ii.total_investment, 0) as total_investment,
              COALESCE(pr.avg_rating, 0) as avg_rating,
              COALESCE(pr.review_count, 0) as review_count
            FROM pitches p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN (
              SELECT 
                pitch_id,
                COUNT(*) as investment_count,
                SUM(CAST(amount AS DECIMAL)) as total_investment
              FROM investment_interests
              GROUP BY pitch_id
            ) ii ON p.id = ii.pitch_id
            LEFT JOIN (
              SELECT 
                pitch_id,
                AVG(rating) as avg_rating,
                COUNT(*) as review_count
              FROM production_reviews
              GROUP BY pitch_id
            ) pr ON p.id = pr.pitch_id
            WHERE p.status = 'published'
          `;
          
          // Apply filters
          const filters = [];
          const params = [];
          let paramIndex = 1;
          
          // Tab/Format filter
          if (tab !== 'all') {
            if (tab === 'film') {
              filters.push(`p.format = 'Film'`);
            } else if (tab === 'television') {
              filters.push(`p.format IN ('Television - Scripted', 'Television - Unscripted', 'Limited Series')`);
            } else if (tab === 'web-series') {
              filters.push(`p.format = 'Web Series'`);
            } else if (tab === 'documentary') {
              filters.push(`p.format = 'Documentary'`);
            } else if (tab === 'short') {
              filters.push(`p.format = 'Short Film'`);
            } else if (tab === 'animation') {
              filters.push(`p.format_category = 'Animation'`);
            }
          }
          
          // Genre filter
          if (genre) {
            filters.push(`p.genre = $${paramIndex}`);
            params.push(genre);
            paramIndex++;
          }
          
          // Budget range filter
          if (budgetRange) {
            if (budgetRange === 'low') {
              filters.push(`p.estimated_budget < 1000000`);
            } else if (budgetRange === 'medium') {
              filters.push(`p.estimated_budget BETWEEN 1000000 AND 10000000`);
            } else if (budgetRange === 'high') {
              filters.push(`p.estimated_budget BETWEEN 10000000 AND 50000000`);
            } else if (budgetRange === 'mega') {
              filters.push(`p.estimated_budget > 50000000`);
            }
          }
          
          // Investment filter
          if (seekingInvestment === 'true') {
            filters.push(`p.seeking_investment = true`);
          }
          
          // NDA filter
          if (hasNDA === 'true') {
            filters.push(`p.require_nda = true`);
          }
          
          // Search filter (title or logline)
          if (search) {
            filters.push(`(LOWER(p.title) LIKE LOWER($${paramIndex}) OR LOWER(p.logline) LIKE LOWER($${paramIndex + 1}))`);
            params.push(`%${search}%`, `%${search}%`);
            paramIndex += 2;
          }
          
          // Add filters to query
          if (filters.length > 0) {
            baseQuery += ` AND ${filters.join(' AND ')}`;
          }
          
          // Apply sorting
          let orderClause = '';
          const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
          
          switch (sortBy) {
            case 'views':
              orderClause = `p.view_count ${order}`;
              break;
            case 'rating':
              orderClause = `avg_rating ${order}, review_count ${order}`;
              break;
            case 'investment':
              orderClause = `total_investment ${order}, investment_count ${order}`;
              break;
            case 'likes':
              orderClause = `p.like_count ${order}`;
              break;
            case 'updated':
              orderClause = `p.updated_at ${order}`;
              break;
            case 'date':
            default:
              orderClause = `p.created_at ${order}`;
              break;
          }
          
          baseQuery += ` ORDER BY ${orderClause}`;
          
          // Add pagination
          baseQuery += ` LIMIT ${limit} OFFSET ${offset}`;
          
          // Execute query
          const results = await sql.unsafe(baseQuery, params);
          
          // Get total count for pagination
          let countQuery = `
            SELECT COUNT(*) as total
            FROM pitches p
            WHERE p.status = 'published'
          `;
          
          if (filters.length > 0) {
            countQuery += ` AND ${filters.join(' AND ')}`;
          }
          
          const countResult = await sql.unsafe(countQuery, params);
          const total = parseInt(countResult[0]?.total || 0);
          
          // Format results
          const formattedResults = results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            formatCategory: pitch.format_category,
            estimatedBudget: pitch.estimated_budget,
            budgetBracket: pitch.budget_bracket,
            thumbnail: pitch.thumbnail_url,
            poster: pitch.poster_url,
            viewCount: pitch.view_count,
            likeCount: pitch.like_count,
            ndaCount: pitch.nda_count,
            seekingInvestment: pitch.seeking_investment,
            requireNDA: pitch.require_nda,
            createdAt: pitch.created_at,
            updatedAt: pitch.updated_at,
            creator: {
              id: pitch.creator_id,
              name: `${pitch.creator_first_name} ${pitch.creator_last_name}`,
              company: pitch.creator_company
            },
            stats: {
              investmentCount: parseInt(pitch.investment_count),
              totalInvestment: parseFloat(pitch.total_investment) || 0,
              avgRating: parseFloat(pitch.avg_rating) || 0,
              reviewCount: parseInt(pitch.review_count)
            }
          }));
          
          return corsResponse(request, {
            success: true,
            data: formattedResults,
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + limit < total,
              page: Math.floor(offset / limit) + 1,
              totalPages: Math.ceil(total / limit)
            },
            filters: {
              tab,
              sortBy,
              sortOrder,
              genre,
              budgetRange,
              seekingInvestment,
              hasNDA,
              search
            }
          });
        } catch (error) {
          console.error('Browse error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch pitches',
            error: error.message
          }, 500);
        }
      }
      
      // Get available genres for filtering
      if (path === '/api/browse/genres' && method === 'GET') {
        try {
          const genres = await sql`
            SELECT DISTINCT genre 
            FROM pitches 
            WHERE status = 'published' 
              AND genre IS NOT NULL
            ORDER BY genre
          `;
          
          return corsResponse(request, {
            success: true,
            data: genres.map(g => g.genre).filter(Boolean)
          });
        } catch (error) {
          console.error('Error fetching genres:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch genres',
            error: error.message
          }, 500);
        }
      }
      
      // Get browse statistics
      if (path === '/api/browse/stats' && method === 'GET') {
        try {
          const stats = await sql`
            SELECT 
              COUNT(*) as total_pitches,
              COUNT(DISTINCT user_id) as total_creators,
              COUNT(CASE WHEN seeking_investment = true THEN 1 END) as seeking_investment,
              COUNT(CASE WHEN require_nda = true THEN 1 END) as require_nda,
              COUNT(CASE WHEN format = 'Film' THEN 1 END) as film_count,
              COUNT(CASE WHEN format LIKE 'Television%' OR format = 'Limited Series' THEN 1 END) as tv_count,
              COUNT(CASE WHEN format = 'Web Series' THEN 1 END) as web_count,
              COUNT(CASE WHEN format = 'Documentary' THEN 1 END) as doc_count
            FROM pitches
            WHERE status = 'published'
          `;
          
          return corsResponse(request, {
            success: true,
            data: {
              totalPitches: parseInt(stats[0].total_pitches),
              totalCreators: parseInt(stats[0].total_creators),
              seekingInvestment: parseInt(stats[0].seeking_investment),
              requireNDA: parseInt(stats[0].require_nda),
              byFormat: {
                film: parseInt(stats[0].film_count),
                television: parseInt(stats[0].tv_count),
                webSeries: parseInt(stats[0].web_count),
                documentary: parseInt(stats[0].doc_count)
              }
            }
          });
        } catch (error) {
          console.error('Error fetching browse stats:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
          }, 500);
        }
      }
      
      // File upload endpoints
      // Upload single file
      if (path === '/api/upload' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        if (!env.R2_BUCKET) {
          return corsResponse(request, {
            success: false,
            message: 'Storage service not configured',
          }, 503);
        }
        
        try {
          const formData = await request.formData();
          const file = formData.get('file') as File;
          const type = formData.get('type') as string || 'general';
          const pitchId = formData.get('pitchId') as string;
          
          if (!file) {
            return corsResponse(request, {
              success: false,
              message: 'No file provided',
            }, 400);
          }
          
          // Validate file size (50MB limit)
          if (file.size > 50 * 1024 * 1024) {
            return corsResponse(request, {
              success: false,
              message: 'File size exceeds 50MB limit',
            }, 400);
          }
          
          // Generate unique filename
          const timestamp = Date.now();
          const userId = userPayload.sub;
          const extension = file.name.split('.').pop();
          const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const key = `${userId}/${pitchId || 'general'}/${timestamp}_${safeFileName}`;
          
          // Upload to R2
          const arrayBuffer = await file.arrayBuffer();
          await env.R2_BUCKET.put(key, arrayBuffer, {
            httpMetadata: {
              contentType: file.type,
            },
            customMetadata: {
              userId: userId,
              pitchId: pitchId || '',
              uploadType: type,
              originalName: file.name,
              uploadedAt: new Date().toISOString(),
            },
          });
          
          // Store file reference in database
          const fileRecord = await sql`
            INSERT INTO uploaded_files (
              user_id,
              pitch_id,
              file_type,
              file_name,
              original_name,
              file_size,
              mime_type,
              r2_key,
              uploaded_at
            ) VALUES (
              ${parseInt(userId)},
              ${pitchId ? parseInt(pitchId) : null},
              ${type},
              ${safeFileName},
              ${file.name},
              ${file.size},
              ${file.type},
              ${key},
              NOW()
            )
            RETURNING id, file_name, original_name, file_size, mime_type
          `;
          
          return corsResponse(request, {
            success: true,
            message: 'File uploaded successfully',
            data: {
              id: fileRecord[0].id,
              fileName: fileRecord[0].file_name,
              originalName: fileRecord[0].original_name,
              size: fileRecord[0].file_size,
              mimeType: fileRecord[0].mime_type,
              url: `/api/files/${fileRecord[0].id}`,
            },
          });
        } catch (error) {
          console.error('Upload error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to upload file',
            error: error.message,
          }, 500);
        }
      }
      
      // Upload multiple files
      if (path === '/api/upload/multiple' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        if (!env.R2_BUCKET) {
          return corsResponse(request, {
            success: false,
            message: 'Storage service not configured',
          }, 503);
        }
        
        try {
          const formData = await request.formData();
          const files = formData.getAll('files') as File[];
          const type = formData.get('type') as string || 'general';
          const pitchId = formData.get('pitchId') as string;
          
          if (!files || files.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'No files provided',
            }, 400);
          }
          
          // Limit to 10 files at once
          if (files.length > 10) {
            return corsResponse(request, {
              success: false,
              message: 'Maximum 10 files allowed per upload',
            }, 400);
          }
          
          const uploadedFiles = [];
          const userId = userPayload.sub;
          
          for (const file of files) {
            // Validate each file size
            if (file.size > 50 * 1024 * 1024) {
              continue; // Skip files over 50MB
            }
            
            const timestamp = Date.now();
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const key = `${userId}/${pitchId || 'general'}/${timestamp}_${safeFileName}`;
            
            // Upload to R2
            const arrayBuffer = await file.arrayBuffer();
            await env.R2_BUCKET.put(key, arrayBuffer, {
              httpMetadata: {
                contentType: file.type,
              },
              customMetadata: {
                userId: userId,
                pitchId: pitchId || '',
                uploadType: type,
                originalName: file.name,
              },
            });
            
            // Store in database
            const fileRecord = await sql`
              INSERT INTO uploaded_files (
                user_id,
                pitch_id,
                file_type,
                file_name,
                original_name,
                file_size,
                mime_type,
                r2_key,
                uploaded_at
              ) VALUES (
                ${parseInt(userId)},
                ${pitchId ? parseInt(pitchId) : null},
                ${type},
                ${safeFileName},
                ${file.name},
                ${file.size},
                ${file.type},
                ${key},
                NOW()
              )
              RETURNING id, file_name, original_name, file_size, mime_type
            `;
            
            uploadedFiles.push({
              id: fileRecord[0].id,
              fileName: fileRecord[0].file_name,
              originalName: fileRecord[0].original_name,
              size: fileRecord[0].file_size,
              mimeType: fileRecord[0].mime_type,
              url: `/api/files/${fileRecord[0].id}`,
            });
          }
          
          return corsResponse(request, {
            success: true,
            message: `${uploadedFiles.length} files uploaded successfully`,
            data: uploadedFiles,
          });
        } catch (error) {
          console.error('Multiple upload error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to upload files',
            error: error.message,
          }, 500);
        }
      }
      
      // Upload custom NDA document
      if (path === '/api/pitches/nda/upload' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return corsResponse(request, {
            success: false,
            message: 'Creator access required',
          }, 403);
        }
        
        if (!env.R2_BUCKET) {
          return corsResponse(request, {
            success: false,
            message: 'Storage service not configured',
          }, 503);
        }
        
        try {
          const formData = await request.formData();
          const file = formData.get('file') as File;
          const pitchId = formData.get('pitchId') as string;
          
          if (!file || !pitchId) {
            return corsResponse(request, {
              success: false,
              message: 'File and pitch ID are required',
            }, 400);
          }
          
          // Verify ownership
          const pitch = await sql`
            SELECT user_id FROM pitches WHERE id = ${parseInt(pitchId)}
          `;
          
          if (pitch.length === 0 || pitch[0].user_id !== parseInt(userPayload.sub)) {
            return corsResponse(request, {
              success: false,
              message: 'You can only upload NDAs for your own pitches',
            }, 403);
          }
          
          // Only allow PDF files for NDAs
          if (file.type !== 'application/pdf') {
            return corsResponse(request, {
              success: false,
              message: 'NDA documents must be PDF files',
            }, 400);
          }
          
          const userId = userPayload.sub;
          const timestamp = Date.now();
          const key = `${userId}/ndas/${pitchId}/${timestamp}_nda.pdf`;
          
          // Upload to R2
          const arrayBuffer = await file.arrayBuffer();
          await env.R2_BUCKET.put(key, arrayBuffer, {
            httpMetadata: {
              contentType: 'application/pdf',
            },
            customMetadata: {
              userId: userId,
              pitchId: pitchId,
              uploadType: 'nda',
              originalName: file.name,
            },
          });
          
          // Store NDA document reference
          const ndaRecord = await sql`
            INSERT INTO uploaded_files (
              user_id,
              pitch_id,
              file_type,
              file_name,
              original_name,
              file_size,
              mime_type,
              r2_key,
              uploaded_at
            ) VALUES (
              ${parseInt(userId)},
              ${parseInt(pitchId)},
              'nda',
              'custom_nda.pdf',
              ${file.name},
              ${file.size},
              'application/pdf',
              ${key},
              NOW()
            )
            RETURNING id
          `;
          
          // Update pitch to indicate custom NDA
          await sql`
            UPDATE pitches 
            SET custom_nda_id = ${ndaRecord[0].id},
                require_nda = true,
                updated_at = NOW()
            WHERE id = ${parseInt(pitchId)}
          `;
          
          return corsResponse(request, {
            success: true,
            message: 'Custom NDA uploaded successfully',
            data: {
              id: ndaRecord[0].id,
              pitchId: pitchId,
              url: `/api/files/${ndaRecord[0].id}`,
            },
          });
        } catch (error) {
          console.error('NDA upload error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to upload NDA',
            error: error.message,
          }, 500);
        }
      }
      
      // Get file by ID
      const fileMatch = path.match(/^\/api\/files\/(\d+)$/);
      if (fileMatch && method === 'GET') {
        const fileId = parseInt(fileMatch[1]);
        
        try {
          const file = await sql`
            SELECT * FROM uploaded_files WHERE id = ${fileId}
          `;
          
          if (file.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'File not found',
            }, 404);
          }
          
          // Check access permissions
          if (userPayload) {
            const userId = parseInt(userPayload.sub);
            const fileUserId = file[0].user_id;
            const pitchId = file[0].pitch_id;
            
            // Owner can always access
            if (userId === fileUserId) {
              // Get file from R2
              const object = await env.R2_BUCKET.get(file[0].r2_key);
              
              if (!object) {
                return corsResponse(request, {
                  success: false,
                  message: 'File not found in storage',
                }, 404);
              }
              
              return new Response(object.body, {
                headers: {
                  'Content-Type': file[0].mime_type || 'application/octet-stream',
                  'Content-Disposition': `inline; filename="${file[0].original_name}"`,
                },
              });
            }
            
            // For NDA files, check if user has signed NDA
            if (file[0].file_type === 'nda' && pitchId) {
              const hasNDA = await sql`
                SELECT id FROM nda_requests 
                WHERE pitch_id = ${pitchId} 
                  AND requester_id = ${userId}
                  AND status = 'approved'
              `;
              
              if (hasNDA.length > 0) {
                const object = await env.R2_BUCKET.get(file[0].r2_key);
                
                if (!object) {
                  return corsResponse(request, {
                    success: false,
                    message: 'File not found in storage',
                  }, 404);
                }
                
                return new Response(object.body, {
                  headers: {
                    'Content-Type': file[0].mime_type || 'application/octet-stream',
                    'Content-Disposition': `inline; filename="${file[0].original_name}"`,
                  },
                });
              }
            }
          }
          
          return corsResponse(request, {
            success: false,
            message: 'Access denied',
          }, 403);
        } catch (error) {
          console.error('File retrieval error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to retrieve file',
            error: error.message,
          }, 500);
        }
      }
      
      // Rename file
      if (path === '/api/files/rename' && method === 'PATCH') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const { fileId, newName } = await request.json();
          
          if (!fileId || !newName) {
            return corsResponse(request, {
              success: false,
              message: 'File ID and new name are required',
            }, 400);
          }
          
          // Verify ownership
          const file = await sql`
            SELECT user_id FROM uploaded_files WHERE id = ${fileId}
          `;
          
          if (file.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'File not found',
            }, 404);
          }
          
          if (file[0].user_id !== parseInt(userPayload.sub)) {
            return corsResponse(request, {
              success: false,
              message: 'You can only rename your own files',
            }, 403);
          }
          
          // Update file name
          await sql`
            UPDATE uploaded_files 
            SET original_name = ${newName},
                updated_at = NOW()
            WHERE id = ${fileId}
          `;
          
          return corsResponse(request, {
            success: true,
            message: 'File renamed successfully',
            data: {
              id: fileId,
              newName: newName,
            },
          });
        } catch (error) {
          console.error('File rename error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to rename file',
            error: error.message,
          }, 500);
        }
      }
      
      // Delete file
      const deleteFileMatch = path.match(/^\/api\/files\/(\d+)$/);
      if (deleteFileMatch && method === 'DELETE') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const fileId = parseInt(deleteFileMatch[1]);
        
        try {
          // Verify ownership
          const file = await sql`
            SELECT user_id, r2_key FROM uploaded_files WHERE id = ${fileId}
          `;
          
          if (file.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'File not found',
            }, 404);
          }
          
          if (file[0].user_id !== parseInt(userPayload.sub)) {
            return corsResponse(request, {
              success: false,
              message: 'You can only delete your own files',
            }, 403);
          }
          
          // Delete from R2
          await env.R2_BUCKET.delete(file[0].r2_key);
          
          // Delete from database
          await sql`
            DELETE FROM uploaded_files WHERE id = ${fileId}
          `;
          
          return corsResponse(request, {
            success: true,
            message: 'File deleted successfully',
          });
        } catch (error) {
          console.error('File deletion error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to delete file',
            error: error.message,
          }, 500);
        }
      }
      
      // Get files for a pitch
      const pitchFilesMatch = path.match(/^\/api\/pitches\/(\d+)\/files$/);
      if (pitchFilesMatch && method === 'GET') {
        const pitchId = parseInt(pitchFilesMatch[1]);
        
        try {
          const files = await sql`
            SELECT 
              id,
              file_type,
              file_name,
              original_name,
              file_size,
              mime_type,
              uploaded_at
            FROM uploaded_files
            WHERE pitch_id = ${pitchId}
            ORDER BY uploaded_at DESC
          `;
          
          return corsResponse(request, {
            success: true,
            data: files.map(f => ({
              ...f,
              url: `/api/files/${f.id}`,
            })),
          });
        } catch (error) {
          console.error('Error fetching pitch files:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch files',
            error: error.message,
          }, 500);
        }
      }
      
      // ================== ACCESS CONTROL & PERMISSIONS ==================
      
      // Create team
      if (path === '/api/teams' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const { name, description } = await request.json();
          const userId = parseInt(userPayload.sub);
          
          if (!name) {
            return corsResponse(request, {
              success: false,
              message: 'Team name is required',
            }, 400);
          }
          
          // Create team
          const team = await sql`
            INSERT INTO teams (name, owner_id, description)
            VALUES (${name}, ${userId}, ${description})
            RETURNING *
          `;
          
          // Add owner as team member
          await sql`
            INSERT INTO team_members (team_id, user_id, role, permissions)
            VALUES (${team[0].id}, ${userId}, 'owner', '{"full_access": true}')
          `;
          
          return corsResponse(request, {
            success: true,
            data: team[0],
          });
        } catch (error) {
          console.error('Team creation error:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to create team',
            error: error.message,
          }, 500);
        }
      }
      
      // Get user's teams
      if (path === '/api/teams' && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const userId = parseInt(userPayload.sub);
          
          const teams = await sql`
            SELECT 
              t.*,
              tm.role,
              tm.permissions,
              COUNT(DISTINCT tm2.user_id) as member_count
            FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            LEFT JOIN team_members tm2 ON t.id = tm2.team_id
            WHERE tm.user_id = ${userId}
            GROUP BY t.id, tm.role, tm.permissions
            ORDER BY t.created_at DESC
          `;
          
          return corsResponse(request, {
            success: true,
            data: teams,
          });
        } catch (error) {
          console.error('Error fetching teams:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch teams',
            error: error.message,
          }, 500);
        }
      }
      
      // Add team member
      const teamMemberMatch = path.match(/^\/api\/teams\/(\d+)\/members$/);
      if (teamMemberMatch && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const teamId = parseInt(teamMemberMatch[1]);
          const userId = parseInt(userPayload.sub);
          const { userEmail, role = 'member' } = await request.json();
          
          // Verify user is team owner or admin
          const memberRole = await sql`
            SELECT role FROM team_members 
            WHERE team_id = ${teamId} AND user_id = ${userId}
          `;
          
          if (memberRole.length === 0 || !['owner', 'admin'].includes(memberRole[0].role)) {
            return corsResponse(request, {
              success: false,
              message: 'You do not have permission to add members to this team',
            }, 403);
          }
          
          // Find user by email
          const invitedUser = await sql`
            SELECT id FROM users WHERE email = ${userEmail}
          `;
          
          if (invitedUser.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'User not found',
            }, 404);
          }
          
          // Add member
          const member = await sql`
            INSERT INTO team_members (team_id, user_id, role, invited_by)
            VALUES (${teamId}, ${invitedUser[0].id}, ${role}, ${userId})
            ON CONFLICT (team_id, user_id) DO UPDATE SET role = ${role}
            RETURNING *
          `;
          
          return corsResponse(request, {
            success: true,
            data: member[0],
          });
        } catch (error) {
          console.error('Error adding team member:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to add team member',
            error: error.message,
          }, 500);
        }
      }
      
      // Add pitch collaborator
      const collaboratorMatch = path.match(/^\/api\/pitches\/(\d+)\/collaborators$/);
      if (collaboratorMatch && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const pitchId = parseInt(collaboratorMatch[1]);
          const userId = parseInt(userPayload.sub);
          const { 
            userEmail, 
            teamId, 
            role = 'viewer', 
            canEdit = false,
            canDelete = false,
            canShare = false,
            canManageNda = false 
          } = await request.json();
          
          // Verify user owns the pitch
          const pitch = await sql`
            SELECT user_id FROM pitches WHERE id = ${pitchId}
          `;
          
          if (pitch.length === 0 || pitch[0].user_id !== userId) {
            return corsResponse(request, {
              success: false,
              message: 'You do not have permission to manage collaborators for this pitch',
            }, 403);
          }
          
          if (userEmail) {
            // Find user by email
            const invitedUser = await sql`
              SELECT id FROM users WHERE email = ${userEmail}
            `;
            
            if (invitedUser.length === 0) {
              return corsResponse(request, {
                success: false,
                message: 'User not found',
              }, 404);
            }
            
            // Add user collaborator
            const collaborator = await sql`
              INSERT INTO pitch_collaborators (
                pitch_id, user_id, role, can_edit, can_delete, can_share, can_manage_nda, invited_by
              ) VALUES (
                ${pitchId}, ${invitedUser[0].id}, ${role}, ${canEdit}, ${canDelete}, ${canShare}, ${canManageNda}, ${userId}
              ) ON CONFLICT (pitch_id, user_id) DO UPDATE SET 
                role = ${role},
                can_edit = ${canEdit},
                can_delete = ${canDelete},
                can_share = ${canShare},
                can_manage_nda = ${canManageNda}
              RETURNING *
            `;
            
            return corsResponse(request, {
              success: true,
              data: collaborator[0],
            });
          } else if (teamId) {
            // Add team collaborator
            const collaborator = await sql`
              INSERT INTO pitch_collaborators (
                pitch_id, team_id, role, can_edit, can_delete, can_share, can_manage_nda, invited_by
              ) VALUES (
                ${pitchId}, ${teamId}, ${role}, ${canEdit}, ${canDelete}, ${canShare}, ${canManageNda}, ${userId}
              ) RETURNING *
            `;
            
            return corsResponse(request, {
              success: true,
              data: collaborator[0],
            });
          } else {
            return corsResponse(request, {
              success: false,
              message: 'Either userEmail or teamId is required',
            }, 400);
          }
        } catch (error) {
          console.error('Error adding collaborator:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to add collaborator',
            error: error.message,
          }, 500);
        }
      }
      
      // Get pitch collaborators
      if (collaboratorMatch && method === 'GET') {
        try {
          const pitchId = parseInt(collaboratorMatch[1]);
          
          const collaborators = await sql`
            SELECT 
              pc.*,
              u.email as user_email,
              u.first_name,
              u.last_name,
              u.company_name,
              t.name as team_name,
              inviter.email as invited_by_email
            FROM pitch_collaborators pc
            LEFT JOIN users u ON pc.user_id = u.id
            LEFT JOIN teams t ON pc.team_id = t.id
            LEFT JOIN users inviter ON pc.invited_by = inviter.id
            WHERE pc.pitch_id = ${pitchId}
            ORDER BY pc.added_at DESC
          `;
          
          return corsResponse(request, {
            success: true,
            data: collaborators,
          });
        } catch (error) {
          console.error('Error fetching collaborators:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to fetch collaborators',
            error: error.message,
          }, 500);
        }
      }
      
      // Check user permissions for a resource
      if (path === '/api/permissions/check' && method === 'POST') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        try {
          const userId = parseInt(userPayload.sub);
          const { resourceType, resourceId, action } = await request.json();
          
          if (!resourceType || !resourceId || !action) {
            return corsResponse(request, {
              success: false,
              message: 'resourceType, resourceId, and action are required',
            }, 400);
          }
          
          // Check if user owns the resource
          if (resourceType === 'pitch') {
            const pitch = await sql`
              SELECT user_id FROM pitches WHERE id = ${resourceId}
            `;
            
            if (pitch.length > 0 && pitch[0].user_id === userId) {
              return corsResponse(request, {
                success: true,
                data: { hasPermission: true, role: 'owner' },
              });
            }
            
            // Check if user is a collaborator
            const collaborator = await sql`
              SELECT role, can_edit, can_delete, can_share, can_manage_nda
              FROM pitch_collaborators
              WHERE pitch_id = ${resourceId} AND user_id = ${userId}
            `;
            
            if (collaborator.length > 0) {
              let hasPermission = false;
              const role = collaborator[0].role;
              
              if (action === 'read') hasPermission = true;
              else if (action === 'edit') hasPermission = collaborator[0].can_edit;
              else if (action === 'delete') hasPermission = collaborator[0].can_delete;
              else if (action === 'share') hasPermission = collaborator[0].can_share;
              else if (action === 'manage_nda') hasPermission = collaborator[0].can_manage_nda;
              
              return corsResponse(request, {
                success: true,
                data: { hasPermission, role },
              });
            }
            
            // Check if user is part of a team that has access
            const teamAccess = await sql`
              SELECT pc.role, pc.can_edit, pc.can_delete, pc.can_share, pc.can_manage_nda
              FROM pitch_collaborators pc
              JOIN team_members tm ON pc.team_id = tm.team_id
              WHERE pc.pitch_id = ${resourceId} AND tm.user_id = ${userId}
            `;
            
            if (teamAccess.length > 0) {
              let hasPermission = false;
              const role = teamAccess[0].role;
              
              if (action === 'read') hasPermission = true;
              else if (action === 'edit') hasPermission = teamAccess[0].can_edit;
              else if (action === 'delete') hasPermission = teamAccess[0].can_delete;
              else if (action === 'share') hasPermission = teamAccess[0].can_share;
              else if (action === 'manage_nda') hasPermission = teamAccess[0].can_manage_nda;
              
              return corsResponse(request, {
                success: true,
                data: { hasPermission, role },
              });
            }
          }
          
          // Log access attempt
          await sql`
            INSERT INTO access_logs (user_id, resource_type, resource_id, action, success, ip_address)
            VALUES (${userId}, ${resourceType}, ${resourceId}, ${action}, false, ${request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown'})
          `;
          
          return corsResponse(request, {
            success: true,
            data: { hasPermission: false, role: null },
          });
        } catch (error) {
          console.error('Error checking permissions:', error);
          return corsResponse(request, {
            success: false,
            message: 'Failed to check permissions',
            error: error.message,
          }, 500);
        }
      }
      
      // Get access logs for a resource
      if (path.startsWith('/api/access-logs/') && method === 'GET') {
        if (!userPayload) {
          return corsResponse(request, {
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const logMatch = path.match(/^\/api\/access-logs\/(\w+)\/(\d+)$/);
        if (logMatch) {
          try {
            const userId = parseInt(userPayload.sub);
            const resourceType = logMatch[1];
            const resourceId = parseInt(logMatch[2]);
            
            // Verify user owns the resource (simplified check for pitch)
            if (resourceType === 'pitch') {
              const pitch = await sql`
                SELECT user_id FROM pitches WHERE id = ${resourceId}
              `;
              
              if (pitch.length === 0 || pitch[0].user_id !== userId) {
                return corsResponse(request, {
                  success: false,
                  message: 'Access denied',
                }, 403);
              }
            }
            
            const logs = await sql`
              SELECT 
                al.*,
                u.email,
                u.first_name,
                u.last_name
              FROM access_logs al
              LEFT JOIN users u ON al.user_id = u.id
              WHERE al.resource_type = ${resourceType} 
                AND al.resource_id = ${resourceId}
              ORDER BY al.created_at DESC
              LIMIT 100
            `;
            
            return corsResponse(request, {
              success: true,
              data: logs,
            });
          } catch (error) {
            console.error('Error fetching access logs:', error);
            return corsResponse(request, {
              success: false,
              message: 'Failed to fetch access logs',
              error: error.message,
            }, 500);
          }
        }
      }
      
      // 404 for unknown endpoints
      return corsResponse(request, {
        success: false,
        message: `Endpoint ${path} not found`,
      }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return corsResponse(request, {
        success: false,
        message: 'Internal server error',
        error: error.message,
      }, 500);
    }
  },
};

// Export Durable Objects
export { WebSocketRoom } from './websocket-durable-object.ts';
export { NotificationRoom } from './notification-room.ts';