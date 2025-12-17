/**
 * Production Worker with Neon Serverless Driver
 * Uses @neondatabase/serverless for edge-optimized database connections
 * Bypasses Hyperdrive to fix Error 530/1016
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, gte, lte, desc, asc, like, sql, count, inArray } from 'drizzle-orm';
import * as schema from './db/schema.ts';
import { Redis } from '@upstash/redis/cloudflare';

// Configure Neon for Cloudflare Workers - CRITICAL SETTINGS
neonConfig.useSecureWebSocket = true;
neonConfig.wsProxy = (host: string) => `wss://${host}/v2/websocket`;
neonConfig.webSocketConstructor = WebSocket;  // Use native WebSocket
neonConfig.poolQueryViaFetch = false;  // Use WebSocket for better compatibility
neonConfig.fetchEndpoint = (host: string) => `https://${host}/sql`;

// Global database instance
let globalDb: any = null;
let globalSql: any = null;

/**
 * Initialize database with Neon serverless driver
 * This bypasses Hyperdrive completely
 */
function initializeDatabase(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  try {
    console.log('Initializing Neon serverless connection...');
    
    // Use the Neon serverless driver directly
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });
    
    globalSql = sql;
    globalDb = db;
    
    console.log('Neon serverless driver initialized successfully');
    return { sql, db };
  } catch (error) {
    console.error('Failed to initialize Neon serverless driver:', error);
    throw error;
  }
}

/**
 * Test database connectivity
 */
async function testConnection(sql: any): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 as test`;
    return result && result[0]?.test === 1;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

// Import types
interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  NOTIFICATION_ROOM?: DurableObjectNamespace;
  SENDGRID_API_KEY?: string;
}

/**
 * CORS headers for all responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

/**
 * Create CORS response
 */
function corsResponse(request: Request, data: any, status = 200) {
  const origin = request.headers.get('Origin') || '*';
  
  return new Response(
    typeof data === 'string' ? data : JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': typeof data === 'string' ? 'text/plain' : 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
      },
    }
  );
}

// Durable Object exports (required even if not used)
export class WebSocketRoom {
  constructor(state: DurableObjectState, env: Env) {}
  async fetch(request: Request) {
    return new Response('WebSocket room placeholder');
  }
}

export class NotificationRoom {
  constructor(state: DurableObjectState, env: Env) {}
  async fetch(request: Request) {
    return new Response('Notification room placeholder');
  }
}

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // Initialize database on first request
      if (!globalDb) {
        initializeDatabase(env);
      }

      // Health check endpoint - test real connection
      if (path === '/api/health') {
        try {
          const isConnected = await testConnection(globalSql);
          
          return corsResponse(request, {
            status: isConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            version: 'neon-serverless-v1.0',
            database: isConnected,
            driver: '@neondatabase/serverless',
            services: {
              database: isConnected,
              cache: !!env.KV,
              redis: !!env.UPSTASH_REDIS_REST_URL,
              websocket: !!env.WEBSOCKET_ROOM,
            }
          }, isConnected ? 200 : 503);
        } catch (error) {
          return corsResponse(request, {
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
          }, 503);
        }
      }

      // Authentication endpoints
      if (path === '/api/auth/creator/login' || 
          path === '/api/auth/investor/login' || 
          path === '/api/auth/production/login') {
        
        if (request.method !== 'POST') {
          return corsResponse(request, { success: false, message: 'Method not allowed' }, 405);
        }

        try {
          const body = await request.json() as { email: string; password: string };
          const { email, password } = body;

          if (!email || !password) {
            return corsResponse(request, {
              success: false,
              message: 'Email and password are required'
            }, 400);
          }

          // Query user from database
          console.log('Querying user with email:', email);
          
          const users = await globalDb
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);

          if (!users || users.length === 0) {
            return corsResponse(request, {
              success: false,
              message: 'Invalid email or password'
            }, 401);
          }

          const user = users[0];

          // Verify password
          const validPassword = await bcrypt.compare(password, user.password_hash || user.password);
          
          if (!validPassword) {
            return corsResponse(request, {
              success: false,
              message: 'Invalid email or password'
            }, 401);
          }

          // Generate JWT token
          const token = await jwt.sign(
            {
              id: user.id,
              email: user.email,
              userType: user.user_type,
            },
            env.JWT_SECRET || 'default-secret-key',
            { expiresIn: '7d' }
          );

          // Create session
          const sessionToken = crypto.randomUUID();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          try {
            await globalDb.insert(schema.sessions).values({
              token: sessionToken,
              user_id: user.id,
              expires_at: expiresAt,
              last_activity: new Date(),
              created_at: new Date(),
            });
          } catch (sessionError) {
            console.warn('Session creation failed, continuing without session:', sessionError);
            // Continue without session - JWT is sufficient
          }

          // Update last login (skip if it fails)
          try {
            await globalDb
              .update(schema.users)
              .set({ last_login_at: new Date() })
              .where(eq(schema.users.id, user.id));
          } catch (updateError) {
            console.warn('Failed to update last login, continuing:', updateError);
            // Non-critical, continue
          }

          // Return success response
          const { password: _, password_hash: __, ...safeUser } = user;
          
          return corsResponse(request, {
            success: true,
            user: safeUser,
            token,
            sessionToken,
            message: 'Login successful'
          });

        } catch (error) {
          console.error('Login error:', error);
          return corsResponse(request, {
            success: false,
            message: `Login failed: ${error.message}`,
            error: {
              message: error.message,
              type: 'auth'
            }
          }, 500);
        }
      }

      // Browse endpoint
      if (path === '/api/pitches/browse/enhanced') {
        try {
          const pitches = await globalDb
            .select({
              id: schema.pitches.id,
              title: schema.pitches.title,
              logline: schema.pitches.logline,
              genre: schema.pitches.genre,
              format: schema.pitches.format,
              status: schema.pitches.status,
              created_at: schema.pitches.created_at,
            })
            .from(schema.pitches)
            .where(eq(schema.pitches.status, 'published'))
            .orderBy(desc(schema.pitches.created_at))
            .limit(20);

          return corsResponse(request, {
            success: true,
            data: pitches,
            total: pitches.length
          });
        } catch (error) {
          console.error('Browse error:', error);
          return corsResponse(request, {
            success: false,
            message: error.message
          }, 500);
        }
      }

      // Default response for unmatched routes
      return corsResponse(request, {
        success: false,
        message: `Endpoint not found: ${path}`,
        availableEndpoints: [
          '/api/health',
          '/api/auth/creator/login',
          '/api/auth/investor/login',
          '/api/auth/production/login',
          '/api/pitches/browse/enhanced'
        ]
      }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return corsResponse(request, {
        success: false,
        message: 'Internal server error',
        error: error.message
      }, 500);
    }
  },
};