/**
 * Production Worker with Real Database Connection
 * Uses Neon PostgreSQL for data persistence
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, gte, lte, desc, asc, like, sql as sqlOperator, count, sql } from 'drizzle-orm';
import * as schema from './db/schema';
import { Redis } from '@upstash/redis/cloudflare';
import { SessionManager, RateLimiter } from './auth/session-manager';

// Wrapper for Redis client to work with Cloudflare Workers
function createRedisClient(env: Env) {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
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

function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}, request?: Request): Response {
  // Always include CORS headers if request is provided
  const corsHeaders = request ? getCorsHeaders(request) : {};
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' },
  });
}

// Helper function to create CORS-enabled JSON responses
function corsResponse(request: Request, data: any, status = 200): Response {
  return jsonResponse(data, status, {}, request);
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
      return jsonResponse({
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
      return jsonResponse({
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
      return jsonResponse({
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
      return jsonResponse({
        success: false,
        message: 'Invalid credentials',
      }, 401, getCorsHeaders(request));
    }

    // Check user type (unless admin)
    if (userType !== 'admin' && user.userType !== userType) {
      return jsonResponse({
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

    return jsonResponse({
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
    
    return jsonResponse({
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
      return jsonResponse({
        success: false,
        message: 'All fields are required',
      }, 400);
    }

    if (password.length < 8) {
      return jsonResponse({
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
      return jsonResponse({
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

    return jsonResponse({
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
    return jsonResponse({
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
      return jsonResponse(data, 200, {}, request);
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
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(request) });
    }

    // WebSocket endpoint - connect to Durable Object
    if (path === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        // Return info for non-WebSocket requests
        return jsonResponse({
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
        return jsonResponse({
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

        return jsonResponse({
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
        
        return jsonResponse({
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
            return jsonResponse({
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
              return jsonResponse({
                success: false,
                message: 'User not found',
              }, 404, getCorsHeaders(request));
            }
            
            const user = users[0];
            return jsonResponse({
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
            return jsonResponse({
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
          return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'User not found',
          }, 404, getCorsHeaders(request));
        }
        
        const user = users[0];
        return jsonResponse({
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
          return jsonResponse({
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
          return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'User not found',
          }, 404, getCorsHeaders(request));
        }
        
        const user = users[0];
        
        return jsonResponse({
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
          return jsonResponse({
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
        return jsonResponse({
          success: true,
          message: 'If that email exists, we sent password reset instructions',
        });
      }

      // Reset password
      if (path === '/api/auth/reset-password' && method === 'POST') {
        const body = await request.json();
        const { token, newPassword } = body;
        
        if (!token || !newPassword) {
          return jsonResponse({
            success: false,
            message: 'Token and new password are required',
          }, 400);
        }

        if (newPassword.length < 8) {
          return jsonResponse({
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
            
            return jsonResponse({
              success: true,
              message: 'Password has been reset successfully',
            });
          }
        }

        return jsonResponse({
          success: false,
          message: 'Invalid or expired reset token',
        }, 400);
      }

      // Public pitch endpoints
      if (path === '/api/pitches/public') {
        const pitches = await db.select({
          id: schema.pitches.id,
          title: schema.pitches.title,
          tagline: schema.pitches.tagline,
          genre: schema.pitches.genre,
          format: schema.pitches.format,
          budget: schema.pitches.budget,
          status: schema.pitches.status,
          thumbnail: schema.pitches.thumbnail,
          views: schema.pitches.views,
          rating: schema.pitches.rating,
          creatorId: schema.pitches.userId,
          createdAt: schema.pitches.createdAt,
        })
        .from(schema.pitches)
        .where(eq(schema.pitches.status, 'published'))
        .orderBy(desc(schema.pitches.createdAt))
        .limit(20);

        return jsonResponse({
          success: true,
          pitches,
          total: pitches.length,
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
        
        return jsonResponse({
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
        
        return jsonResponse({
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
          return jsonResponse({
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
        
        return jsonResponse({
          success: true,
          message: 'Pitch created successfully',
          data: newPitch[0],
        }, 201);
      }

      // Create pitch (new creator endpoint)
      if (path === '/api/creator/pitches' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return jsonResponse({
            success: false,
            message: 'Only creators can create pitches',
          }, 403);
        }
        
        try {
          const body = await request.json();
          const userId = parseInt(userPayload.sub);
          
          // Validate required fields
          if (!body.title || !body.logline || !body.genre || !body.format) {
            return jsonResponse({
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
          
          return jsonResponse({
            success: true,
            message: 'Pitch created successfully',
            data: {
              pitch: newPitch[0]
            }
          }, 201);
        } catch (error) {
          console.error('Error creating pitch:', error);
          return jsonResponse({
            success: false,
            error: {
              message: error instanceof Error ? error.message : 'Failed to create pitch'
            }
          }, 500);
        }
      }

      // Get all pitches (with caching)
      if (path.startsWith('/api/pitches') && method === 'GET' && !path.match(/^\/api\/pitches\/\d+$/)) {
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
        
        return jsonResponse(responseData);
      }

      // Update pitch
      const pitchMatch = path.match(/^\/api\/pitches\/(\d+)$/);
      if (pitchMatch && method === 'PUT') {
        if (!userPayload) {
          return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        if (pitches[0].creatorId !== userId) {
          return jsonResponse({
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
        
        return jsonResponse({
          success: true,
          message: 'Pitch updated successfully',
          data: updated[0],
        });
      }

      // Get single pitch
      if (pitchMatch && method === 'GET') {
        const pitchId = parseInt(pitchMatch[1]);
        
        const pitches = await db.select()
          .from(schema.pitches)
          .where(eq(schema.pitches.id, pitchId))
          .limit(1);
        
        if (pitches.length === 0) {
          return jsonResponse({
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        // Increment views
        await db.update(schema.pitches)
          .set({ views: (pitches[0].views || 0) + 1 })
          .where(eq(schema.pitches.id, pitchId));
        
        return jsonResponse({
          success: true,
          data: pitches[0],
        });
      }

      // Get user profile
      if (path === '/api/profile' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
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
          return jsonResponse({
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
          return jsonResponse({
            success: false,
            valid: false,
            message: 'Invalid token',
          }, 401);
        }
        
        return jsonResponse({
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
        
        return jsonResponse({
          success: true,
          data: pitches,
        });
      }

      // User preferences
      if (path === '/api/user/preferences' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        // Return default preferences for now
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        // Return empty array for now (no saved filters)
        return jsonResponse({
          success: true,
          data: [],
        });
      }

      // Email alerts
      if (path === '/api/alerts/email' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        // Return empty array for now (no email alerts)
        return jsonResponse({
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
        
        let query = db.select()
          .from(schema.pitches)
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
        const countQuery = await db.select({ count: sqlOperator`count(*)::int` })
          .from(schema.pitches)
          .where(conditions.length > 0 ? and(...conditions) : undefined);
        
        const totalCount = countQuery[0]?.count || 0;
        
        const responseData = {
          success: true,
          data: pitches.map(pitch => ({
            ...pitch,
            // Add enhanced fields
            thumbnail: pitch.posterUrl || pitch.titleImage || '/placeholder.jpg',
            creatorName: 'Creator', // Would need join to get real name
            tags: pitch.tags || [],
            isNew: new Date(pitch.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000,
            isTrending: (pitch.viewCount || 0) > 100,
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
            
            return jsonResponse({
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
          
          return jsonResponse({
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
          return jsonResponse({
            success: false,
            error: { message: 'Failed to fetch pitches' },
            data: [],
          }, 500);
        }
      }

      // Creator dashboard stats
      if (path === '/api/creator/dashboard' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return jsonResponse({
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
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Investor access required',
          }, 403);
        }
        
        const userId = parseInt(userPayload.sub);
        
        try {
          // Get investment summary (mock data for now - would need investments table)
          const portfolio = {
            totalInvested: "450000.00",
            activeInvestments: "6",
            roi: 0
          };

          // Get recent activity (mock data - would need real investment tracking)
          const recentActivity = [
            {
              id: 1,
              investor_id: userId,
              pitch_id: 1,
              amount: "50000.00",
              status: "active",
              notes: "Strong concept with experienced creator",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              roi_percentage: "15.50"
            }
          ];

          // Get investment opportunities 
          const opportunities = await db.select()
            .from(schema.pitches)
            .where(eq(schema.pitches.status, 'active'))
            .orderBy(desc(schema.pitches.createdAt))
            .limit(6);

          return jsonResponse({
            success: true,
            portfolio,
            recentActivity,
            opportunities: opportunities.map(pitch => ({
              ...pitch,
              creator_name: 'Creator Name', // Would need join
              seeking_investment: true,
              production_stage: 'concept',
            }))
          });
        } catch (error) {
          console.error('Investor dashboard error:', error);
          return jsonResponse({
            success: false,
            message: 'Dashboard temporarily unavailable',
            error: 'Please try again in a moment'
          }, 500);
        }
      }

      // Investor portfolio summary
      if (path === '/api/investor/portfolio/summary' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'investor') {
          return jsonResponse({
            success: false,
            message: 'Investor access required',
          }, 403);
        }
        
        return corsResponse(request, {
          success: true,
          data: {
            totalInvested: 450000,
            activeInvestments: 6,
            averageROI: 15.2,
            topPerformer: 'The Last Echo'
          }
        });
      }

      // Investor investments list
      if (path === '/api/investor/investments' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'investor') {
          return jsonResponse({
            success: false,
            message: 'Investor access required',
          }, 403);
        }
        
        // Mock data for now
        const investments = [
          {
            id: 1,
            pitchTitle: 'The Last Echo',
            amount: 50000,
            status: 'active',
            roi: 15.5,
            dateInvested: new Date().toISOString()
          }
        ];
        
        return corsResponse(request, {
          success: true,
          data: investments
        });
      }

      // Investment recommendations
      if (path === '/api/investment/recommendations' && method === 'GET') {
        if (!userPayload || (userPayload.userType !== 'investor' && userPayload.userType !== 'production')) {
          return jsonResponse({
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

      // Additional missing endpoints that frontend expects
      
      // Trending pitches
      if (path === '/api/pitches/trending' && method === 'GET') {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        const trendingPitches = await db.select()
          .from(schema.pitches)
          .where(eq(schema.pitches.status, 'active'))
          .orderBy(desc(schema.pitches.viewCount))
          .limit(limit);
        
        return jsonResponse({
          success: true,
          data: trendingPitches.map(pitch => ({
            ...pitch,
            creator_name: 'alexcreator', // Mock creator name
          }))
        });
      }

      // New pitches
      if (path === '/api/pitches/new' && method === 'GET') {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        const newPitches = await db.select()
          .from(schema.pitches)
          .where(eq(schema.pitches.status, 'active'))
          .orderBy(desc(schema.pitches.createdAt))
          .limit(limit);
        
        return jsonResponse({
          success: true,
          data: newPitches.map(pitch => ({
            ...pitch,
            creator_name: 'alexcreator', // Mock creator name
          }))
        });
      }

      // Following pitches
      if (path === '/api/pitches/following' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        // Mock data for now
        return jsonResponse({
          success: true,
          data: []
        });
      }

      // Payment endpoints
      if (path === '/api/payments/credits/balance' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
          success: true,
          data: {
            balance: 1000,
            currency: 'USD'
          }
        });
      }

      if (path === '/api/payments/subscription-status' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
              creatorId: pitch.userId,
              status: 'pending',
              purpose: purpose || 'Investment opportunity',
              message: message || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
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

      // NDA incoming requests (NDAs others want you to sign)
      if (path === '/api/ndas/incoming-requests' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
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

          return jsonResponse({
            success: true,
            data: ndaRequests
          });
        } catch (error) {
          console.error('Error fetching incoming NDA requests:', error);
          return jsonResponse({
            success: true,
            data: [] // Return empty array on error
          });
        }
      }

      // NDA outgoing requests (NDAs you've requested others to sign)
      if (path === '/api/ndas/outgoing-requests' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
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

          return jsonResponse({
            success: true,
            data: ndaRequests
          });
        } catch (error) {
          console.error('Error fetching outgoing NDA requests:', error);
          return jsonResponse({
            success: true,
            data: [] // Return empty array on error
          });
        }
      }

      // NDA incoming signed (NDAs you've signed for others)
      if (path === '/api/ndas/incoming-signed' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
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

          return jsonResponse({
            success: true,
            data: signedNdas
          });
        } catch (error) {
          console.error('Error fetching signed NDAs:', error);
          return jsonResponse({
            success: true,
            data: [] // Return empty array on error
          });
        }
      }

      // NDA outgoing signed (NDAs others have signed for you)
      if (path === '/api/ndas/outgoing-signed' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
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

          return jsonResponse({
            success: true,
            data: signedNdas
          });
        } catch (error) {
          console.error('Error fetching signed NDAs:', error);
          return jsonResponse({
            success: true,
            data: [] // Return empty array on error
          });
        }
      }

      // Production investments overview
      if (path === '/api/production/investments/overview' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
          success: true,
          data: {
            activeUsers: 42,
            viewsLastHour: 156,
            pitchesViewed: 23,
            ndaRequests: 5,
            topPitches: [
              { id: 1, title: "The Last Echo", views: 45 },
              { id: 2, title: "Digital Dreams", views: 32 }
            ],
            recentActivity: [
              { type: "view", pitch: "The Last Echo", time: "2 mins ago" },
              { type: "nda", pitch: "Digital Dreams", time: "5 mins ago" }
            ]
          }
        });
      }

      // Payment history
      if (path === '/api/payments/history' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
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
          
          return jsonResponse({
            success: true,
            count: Number(notifications[0]?.count || 0)
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching unread notifications:', error);
          return jsonResponse({
            success: true,
            count: 0
          }, 200, getCorsHeaders(request));
        }
      }

      // NDA pending endpoint
      if (path === '/api/nda/pending' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
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
          
          return jsonResponse({
            success: true,
            data: pendingNdas
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching pending NDAs:', error);
          return jsonResponse({
            success: true,
            data: []
          }, 200, getCorsHeaders(request));
        }
      }

      // NDA active endpoint
      if (path === '/api/nda/active' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
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
          
          return jsonResponse({
            success: true,
            data: activeNdas
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching active NDAs:', error);
          return jsonResponse({
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
          
          return jsonResponse({
            success: true,
            data: {
              followersCount: Number(followers[0]?.count || 0),
              followingCount: Number(following[0]?.count || 0)
            }
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error fetching follow stats:', error);
          return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        const userId = parseInt(userPayload.sub);
        const preset = searchParams.get('preset') || 'month';
        
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
          
          // Get views for the period
          const views = pitchIds.length > 0 ? await db.select({
            count: sql<number>`count(*)`
          })
          .from(schema.pitchViews)
          .where(and(
            schema.pitchViews.pitchId ? 
              or(...pitchIds.map(id => eq(schema.pitchViews.pitchId, id))) : 
              sql`false`,
            gte(schema.pitchViews.viewedAt, startDate)
          )) : [{ count: 0 }];
          
          return jsonResponse({
            success: true,
            data: {
              totalPitches: pitches.length,
              activePitches: pitches.filter(p => p.status === 'active').length,
              totalViews: Number(views[0]?.count || 0),
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
          return jsonResponse({
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

      // User notifications endpoint
      if (path === '/api/user/notifications' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
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
          
          return jsonResponse({
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
          return jsonResponse({
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
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        return jsonResponse({
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
          return jsonResponse({
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
          
          return jsonResponse({
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
          return jsonResponse({
            success: true,
            data: []
          }, 200, getCorsHeaders(request));
        }
      }

      // Mark notification as read
      if (path.match(/^\/api\/notifications\/\d+\/read$/) && method === 'PUT') {
        if (!userPayload) {
          return jsonResponse({
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
          
          return jsonResponse({
            success: true,
            message: 'Notification marked as read'
          }, 200, getCorsHeaders(request));
        } catch (error) {
          console.error('Error marking notification as read:', error);
          return jsonResponse({
            success: false,
            message: 'Failed to update notification'
          }, 500, getCorsHeaders(request));
        }
      }

      // Subscription status endpoint
      if (path === '/api/subscription/status' && method === 'GET') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401, getCorsHeaders(request));
        }
        
        return jsonResponse({
          success: true,
          data: {
            tier: 'basic',
            status: 'active',
            credits: 1000,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }, 200, getCorsHeaders(request));
      }

      // 404 for unknown endpoints
      return jsonResponse({
        success: false,
        message: `Endpoint ${path} not found`,
      }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        success: false,
        message: 'Internal server error',
        error: error.message,
      }, 500);
    }
  },
};

// Export Durable Objects
export { WebSocketRoom } from './websocket-durable-object';
export { NotificationRoom } from './notification-room.ts';