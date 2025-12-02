/**
 * Production Worker with Real Database Connection
 * Uses Neon PostgreSQL for data persistence
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, gte, lte, desc, asc, like, sql as sqlOperator } from 'drizzle-orm';
import * as schema from './db/schema';

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  WEBSOCKET_ROOMS?: DurableObjectNamespace;
  NOTIFICATION_ROOMS?: DurableObjectNamespace;
  SENDGRID_API_KEY?: string;
  FRONTEND_URL?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'pitchey-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
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

async function handleLogin(request: Request, env: Env, userType: string): Promise<Response> {
  try {
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql);
    
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return jsonResponse({
        success: false,
        message: 'Email and password are required',
      }, 400);
    }

    // Get user from database
    const users = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (users.length === 0) {
      return jsonResponse({
        success: false,
        message: 'Invalid credentials',
      }, 401);
    }

    const user = users[0];

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return jsonResponse({
        success: false,
        message: 'Invalid credentials',
      }, 401);
    }

    // Check user type (unless admin)
    if (userType !== 'admin' && user.userType !== userType) {
      return jsonResponse({
        success: false,
        message: `Invalid ${userType} credentials`,
      }, 401);
    }

    // Create JWT token
    const token = await jwt.sign({
      sub: user.id.toString(),
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      verified: user.verified,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    }, env.JWT_SECRET);

    // Update last login
    await db.update(schema.users)
      .set({ lastLogin: new Date() })
      .where(eq(schema.users.id, user.id));

    return jsonResponse({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          userType: user.userType,
          verified: user.verified,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({
      success: false,
      message: 'Login failed',
    }, 500);
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
        passwordHash,
        firstName,
        lastName,
        companyName: companyName || '',
        userType,
        verified: false,
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
      verified: user.verified,
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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
          creatorId: schema.pitches.creatorId,
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

      // Protected endpoints - verify JWT
      const authHeader = request.headers.get('Authorization');
      let userPayload = null;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        userPayload = await verifyToken(token, env);
      }

      // Creator dashboard
      if (path === '/api/creator/dashboard' && userPayload?.userType === 'creator') {
        const userId = parseInt(userPayload.sub);
        
        // Get user's pitches
        const pitches = await db.select()
          .from(schema.pitches)
          .where(eq(schema.pitches.creatorId, userId))
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
            creatorId: userId,
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
export { WebSocketRoom } from './websocket-room-optimized.ts';
export { NotificationRoom } from './notification-room.ts';