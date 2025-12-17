/**
 * Optimized Production Worker with Robust Database Connection Handling
 * 
 * Features:
 * - Singleton connection pooling with Neon PostgreSQL
 * - Comprehensive error handling with circular reference safety
 * - Automatic retry logic for transient failures
 * - Connection health monitoring
 * - Environment-aware configuration
 * - Transaction support with rollback
 * - Performance monitoring and logging
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import * as bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis/cloudflare';
import { SessionManager, RateLimiter } from './auth/session-manager.ts';
import { logError, getErrorMessage, errorToResponse } from './utils/error-serializer.ts';
import { createDatabaseService, DatabaseService } from './db/database-service.ts';
import { 
  getDatabaseEnvironmentConfig, 
  checkEnvironmentHealth,
  isCloudflareWorkers,
  isHyperdriveEnabled 
} from './db/environment-config.ts';

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  ENVIRONMENT?: string;
  KV?: any; // KVNamespace
  R2_BUCKET?: any; // R2Bucket
  WEBSOCKET_ROOMS?: any; // DurableObjectNamespace
  NOTIFICATION_ROOMS?: any; // DurableObjectNamespace
  SENDGRID_API_KEY?: string;
  FRONTEND_URL?: string;
  HYPERDRIVE?: {
    connectionString: string;
  };
}

// Database service instance (initialized per request)
let dbService: DatabaseService | null = null;

// Initialize database service with environment configuration
function initializeDatabaseService(env: Env): DatabaseService {
  if (!dbService) {
    dbService = createDatabaseService(env);
  }
  return dbService;
}

// Redis client wrapper
function createRedisClient(env: Env) {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// CORS headers helper
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = [
    'https://pitchey.pages.dev',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:8001'
  ];
  
  const isAllowed = allowedOrigins.includes(origin) || 
                    origin.match(/^https:\/\/[a-z0-9-]+\.pitchey\.pages\.dev$/);
  
  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'Set-Cookie'
    };
  }
  
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// CORS-enabled JSON response helper
function corsResponse(request: Request, data: any, status = 200, headers: Record<string, string> = {}): Response {
  const corsHeaders = getCorsHeaders(request);
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' },
  });
}

// Password hashing helper
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

// Password verification helper
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// JWT token generation helper
async function generateJWT(payload: any, secret: string): Promise<string> {
  return await jwt.sign(payload, secret, { exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) });
}

// JWT token verification helper
async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const isValid = await jwt.verify(token, secret);
    if (!isValid) return null;
    
    const payload = jwt.decode(token);
    return payload.payload;
  } catch (error) {
    logError(error, 'JWT verification failed');
    return null;
  }
}

// User authentication helper
async function authenticateUser(request: Request, env: Env): Promise<any> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  return await verifyJWT(token, env.JWT_SECRET);
}

/**
 * User Login Handler with Improved Database Connection
 */
async function handleLogin(request: Request, env: Env, userType: string): Promise<Response> {
  const db = initializeDatabaseService(env);
  
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return corsResponse(request, { 
        success: false, 
        message: 'Email and password are required' 
      }, 400);
    }

    // Get user from database using the new service layer
    const userResult = await db.getUserByEmail(email);
    
    if (!userResult.success) {
      logError(new Error(userResult.error || 'Database error'), 'User lookup failed', { email, userType });
      return corsResponse(request, {
        success: false,
        message: 'Authentication failed'
      }, 500);
    }

    const user = userResult.data;
    
    if (!user) {
      return corsResponse(request, {
        success: false,
        message: 'Invalid credentials'
      }, 401);
    }

    // Verify user type
    if (user.userType !== userType) {
      return corsResponse(request, {
        success: false,
        message: `Invalid ${userType} credentials`
      }, 401);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash || user.password);
    
    if (!isValidPassword) {
      return corsResponse(request, {
        success: false,
        message: 'Invalid credentials'
      }, 401);
    }

    // Generate JWT token
    const token = await generateJWT({
      userId: user.id,
      email: user.email,
      userType: user.userType
    }, env.JWT_SECRET);

    // Prepare user data (exclude sensitive information)
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      companyName: user.companyName,
      avatar_url: user.avatar_url || user.profileImageUrl,
    };

    return corsResponse(request, {
      success: true,
      user: userData,
      token,
    });

  } catch (error) {
    logError(error, 'Login error', { userType });
    return corsResponse(request, {
      success: false,
      message: 'Authentication failed'
    }, 500);
  }
}

/**
 * User Registration Handler
 */
async function handleRegister(request: Request, env: Env, userType: string): Promise<Response> {
  const db = initializeDatabaseService(env);
  
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, companyName } = body;

    if (!email || !password) {
      return corsResponse(request, {
        success: false,
        message: 'Email and password are required'
      }, 400);
    }

    // Check if user already exists
    const existingUserResult = await db.getUserByEmail(email);
    
    if (!existingUserResult.success) {
      logError(new Error(existingUserResult.error || 'Database error'), 'User existence check failed', { email });
      return corsResponse(request, {
        success: false,
        message: 'Registration failed'
      }, 500);
    }

    if (existingUserResult.data) {
      return corsResponse(request, {
        success: false,
        message: 'User already exists'
      }, 409);
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const username = email.split('@')[0]; // Simple username generation

    const newUserData = {
      email,
      username,
      password: passwordHash, // Legacy field
      passwordHash,
      userType,
      firstName,
      lastName,
      companyName,
      emailVerified: false,
      createdAt: new Date(),
    };

    const createResult = await db.createUser(newUserData);
    
    if (!createResult.success) {
      logError(new Error(createResult.error || 'User creation failed'), 'User creation error', { email, userType });
      return corsResponse(request, {
        success: false,
        message: 'Registration failed'
      }, 500);
    }

    const newUser = createResult.data;

    // Generate JWT token
    const token = await generateJWT({
      userId: newUser.id,
      email: newUser.email,
      userType: newUser.userType
    }, env.JWT_SECRET);

    return corsResponse(request, {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        userType: newUser.userType,
        companyName: newUser.companyName,
      },
      token,
    });

  } catch (error) {
    logError(error, 'Registration error', { userType });
    return corsResponse(request, {
      success: false,
      message: 'Registration failed'
    }, 500);
  }
}

/**
 * Database Health Check Endpoint
 */
async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  try {
    const db = initializeDatabaseService(env);
    
    // Perform comprehensive health check
    const healthResult = await db.healthCheck();
    const envHealth = await checkEnvironmentHealth(env);
    
    const healthData = {
      timestamp: new Date().toISOString(),
      database: healthResult.success ? 'healthy' : 'unhealthy',
      environment: envHealth.environment.name,
      features: envHealth.environment.features,
      isCloudflareWorkers: isCloudflareWorkers(),
      hyperdriveEnabled: isHyperdriveEnabled(env),
      connectionStats: healthResult.data?.connectionStats,
      latency: healthResult.duration,
      errors: healthResult.success ? [] : [healthResult.error],
      recommendations: envHealth.recommendations,
    };

    const statusCode = healthResult.success ? 200 : 503;
    
    return corsResponse(request, {
      success: healthResult.success,
      health: healthData,
    }, statusCode);

  } catch (error) {
    logError(error, 'Health check failed');
    return corsResponse(request, {
      success: false,
      health: {
        timestamp: new Date().toISOString(),
        database: 'error',
        error: getErrorMessage(error),
      },
    }, 503);
  }
}

/**
 * Get User Pitches Handler
 */
async function handleGetUserPitches(request: Request, env: Env): Promise<Response> {
  const user = await authenticateUser(request, env);
  if (!user) {
    return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
  }

  const db = initializeDatabaseService(env);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  try {
    const pitchesResult = await db.getUserPitches(user.userId, status || undefined);
    
    if (!pitchesResult.success) {
      return corsResponse(request, db.toApiResponse(pitchesResult), 500);
    }

    return corsResponse(request, {
      success: true,
      pitches: pitchesResult.data || [],
    });

  } catch (error) {
    logError(error, 'Get user pitches failed', { userId: user.userId });
    return corsResponse(request, {
      success: false,
      message: 'Failed to retrieve pitches'
    }, 500);
  }
}

/**
 * Main Worker Handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: getCorsHeaders(request),
      });
    }

    try {
      // Health check endpoint
      if (path === '/api/health' || path === '/health') {
        return handleHealthCheck(request, env);
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

      if (path === '/api/auth/creator/register' && method === 'POST') {
        return handleRegister(request, env, 'creator');
      }

      if (path === '/api/auth/investor/register' && method === 'POST') {
        return handleRegister(request, env, 'investor');
      }

      if (path === '/api/auth/production/register' && method === 'POST') {
        return handleRegister(request, env, 'production');
      }

      // Protected endpoints
      if (path === '/api/pitches/my' && method === 'GET') {
        return handleGetUserPitches(request, env);
      }

      // Default 404 response
      return corsResponse(request, {
        success: false,
        message: 'Endpoint not found'
      }, 404);

    } catch (error) {
      logError(error, 'Worker request handler failed', {
        path,
        method,
        origin: request.headers.get('Origin'),
      });

      return corsResponse(request, {
        success: false,
        message: 'Internal server error',
        error: errorToResponse(error),
      }, 500);
    }
  },
};

// Export Durable Objects required by Cloudflare Workers
export { WebSocketRoom } from './websocket-room-optimized.ts';
export { NotificationRoom } from './notification-room.ts';