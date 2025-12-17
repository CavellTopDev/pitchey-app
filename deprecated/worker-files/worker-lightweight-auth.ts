/**
 * Lightweight Worker with JWT Authentication
 * Replaces Better Auth to fix resource limit issues
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import bcrypt from 'bcryptjs';
import { Toucan } from 'toucan-js';
import { neon } from '@neondatabase/serverless';

export interface Env {
  // Database
  DATABASE_URL: string;
  HYPERDRIVE?: Fetcher;
  
  // Auth
  JWT_SECRET: string;
  
  // Storage & Cache
  KV?: KVNamespace;
  R2?: R2Bucket;
  
  // WebSocket
  WEBSOCKET_ROOMS?: DurableObjectNamespace;
  
  // Backend
  BACKEND_URL?: string;
  
  // Monitoring
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  
  // Environment
  ENVIRONMENT?: string;
}

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

// Helper to create JSON response
function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...headers,
    },
  });
}

// Extract token from request
function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Database connection helper
async function getDb(env: Env) {
  // Use Hyperdrive if available, otherwise direct connection
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not configured');
  }
  
  // Use Neon serverless driver with fetch polyfill for Cloudflare Workers
  const sql = neon(connectionString, {
    fetchConnectionCache: true,
  });
  return sql;
}

// Verify user credentials
async function verifyUserCredentials(
  email: string,
  password: string,
  userType: string,
  env: Env
): Promise<any> {
  try {
    const sql = await getDb(env);
    
    // Query user from database
    const query = `
      SELECT id, email, password_hash, first_name, last_name, 
             company_name, user_type, created_at
      FROM users 
      WHERE email = $1 AND user_type = $2
      LIMIT 1
    `;
    
    const result = await sql(query, [email, userType]);
    const user = result[0];
    
    if (!user) {
      return null;
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return null;
    }
    
    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return null;
  }
}

// Handle login for any user type
async function handleLogin(
  request: Request,
  env: Env,
  userType: 'creator' | 'investor' | 'production'
): Promise<Response> {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return jsonResponse({
        success: false,
        message: 'Email and password are required'
      }, 400);
    }
    
    // Verify credentials
    const user = await verifyUserCredentials(email, password, userType, env);
    
    if (!user) {
      return jsonResponse({
        success: false,
        message: 'Invalid credentials'
      }, 401);
    }
    
    // Create JWT token
    const token = await jwt.sign({
      sub: user.id.toString(),
      email: user.email,
      userType,
      firstName: user.first_name,
      lastName: user.last_name,
      companyName: user.company_name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    }, env.JWT_SECRET);
    
    // Store session in KV if available
    if (env.KV) {
      await env.KV.put(
        `session:${user.id}`,
        JSON.stringify({
          userId: user.id,
          userType,
          email: user.email,
          loginTime: new Date().toISOString(),
        }),
        { expirationTtl: 604800 } // 7 days
      );
    }
    
    return jsonResponse({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          companyName: user.company_name,
          userType,
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({
      success: false,
      message: 'An error occurred during login'
    }, 500);
  }
}

// Handle registration for any user type
async function handleRegister(
  request: Request,
  env: Env,
  userType: 'creator' | 'investor' | 'production'
): Promise<Response> {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, companyName } = body;
    
    // Validate input
    if (!email || !password) {
      return jsonResponse({
        success: false,
        message: 'Email and password are required'
      }, 400);
    }
    
    if (password.length < 8) {
      return jsonResponse({
        success: false,
        message: 'Password must be at least 8 characters'
      }, 400);
    }
    
    const sql = await getDb(env);
    
    // Check if user exists
    const existingUser = await sql(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.length > 0) {
      return jsonResponse({
        success: false,
        message: 'Email already registered'
      }, 409);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert new user
    const insertQuery = `
      INSERT INTO users (
        email, password_hash, user_type, first_name, 
        last_name, company_name, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, email, first_name, last_name, company_name, user_type
    `;
    
    const result = await sql(insertQuery, [
      email,
      passwordHash,
      userType,
      firstName || '',
      lastName || '',
      companyName || ''
    ]);
    
    const newUser = result[0];
    
    // Create JWT token
    const token = await jwt.sign({
      sub: newUser.id.toString(),
      email: newUser.email,
      userType,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      companyName: newUser.company_name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    }, env.JWT_SECRET);
    
    return jsonResponse({
      success: true,
      data: {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          companyName: newUser.company_name,
          userType,
        }
      }
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return jsonResponse({
      success: false,
      message: 'An error occurred during registration'
    }, 500);
  }
}

// Verify JWT and add user context to request
async function verifyAuth(request: Request, env: Env): Promise<{
  isValid: boolean;
  payload?: any;
}> {
  const token = getTokenFromRequest(request);
  
  if (!token) {
    return { isValid: false };
  }
  
  try {
    const isValid = await jwt.verify(token, env.JWT_SECRET);
    if (!isValid) {
      return { isValid: false };
    }
    
    const { payload } = jwt.decode(token);
    return { isValid: true, payload };
  } catch (error) {
    console.error('JWT verification error:', error);
    return { isValid: false };
  }
}

// Health check endpoint
async function handleHealthCheck(env: Env): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: env.SENTRY_RELEASE || 'lightweight-jwt-v1.0',
    services: {
      database: false,
      cache: !!env.KV,
      storage: !!env.R2,
      websocket: !!env.WEBSOCKET_ROOMS,
      auth: true,
    }
  };
  
  // Test database connection
  try {
    const sql = await getDb(env);
    await sql('SELECT 1');
    health.services.database = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }
  
  return jsonResponse(health);
}

// Enterprise service overviews (for monitoring)
function handleServiceOverview(serviceName: string): Response {
  const services: Record<string, any> = {
    'ml': {
      service: 'Machine Learning Service',
      status: 'operational',
      capabilities: ['Pitch Recommendation', 'Success Prediction', 'Genre Classification'],
    },
    'data-science': {
      service: 'Data Science Service',
      status: 'operational',
      capabilities: ['Performance Metrics', 'Trend Analysis', 'User Segmentation'],
    },
    'security': {
      service: 'Security Service',
      status: 'operational',
      capabilities: ['Authentication', 'Authorization', 'Encryption', 'Rate Limiting'],
    },
    'distributed': {
      service: 'Distributed Computing Service',
      status: 'operational',
      capabilities: ['Global Edge Deployment', 'Load Balancing', 'Auto-scaling'],
    },
    'edge': {
      service: 'Edge Computing Service',
      status: 'operational',
      capabilities: ['CDN Distribution', 'Edge Processing', 'WebSocket at Edge'],
    },
    'automation': {
      service: 'Automation Service',
      status: 'operational',
      capabilities: ['CI/CD Pipeline', 'Health Monitoring', 'Report Generation'],
    },
  };
  
  const service = services[serviceName];
  if (!service) {
    return jsonResponse({ error: 'Service not found' }, 404);
  }
  
  return jsonResponse(service);
}

// Main worker export
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry if configured
    const sentry = env.SENTRY_DSN
      ? new Toucan({
          dsn: env.SENTRY_DSN,
          environment: env.SENTRY_ENVIRONMENT || env.ENVIRONMENT || 'production',
          release: env.SENTRY_RELEASE,
          context: ctx,
          request,
        })
      : null;

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;
      
      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      
      // Health check endpoint (no auth required)
      if (pathname === '/api/health') {
        return handleHealthCheck(env);
      }
      
      // Enterprise service overviews (no auth required)
      const serviceMatch = pathname.match(/^\/api\/(ml|data-science|security|distributed|edge|automation)\/overview$/);
      if (serviceMatch) {
        return handleServiceOverview(serviceMatch[1]);
      }
      
      // Authentication endpoints
      if (pathname === '/api/auth/creator/login' && method === 'POST') {
        return handleLogin(request, env, 'creator');
      }
      if (pathname === '/api/auth/investor/login' && method === 'POST') {
        return handleLogin(request, env, 'investor');
      }
      if (pathname === '/api/auth/production/login' && method === 'POST') {
        return handleLogin(request, env, 'production');
      }
      
      // Registration endpoints
      if (pathname === '/api/auth/creator/register' && method === 'POST') {
        return handleRegister(request, env, 'creator');
      }
      if (pathname === '/api/auth/investor/register' && method === 'POST') {
        return handleRegister(request, env, 'investor');
      }
      if (pathname === '/api/auth/production/register' && method === 'POST') {
        return handleRegister(request, env, 'production');
      }
      
      // Public endpoints (no auth required)
      if (pathname === '/api/pitches/public' || 
          pathname === '/api/pitches/trending' ||
          pathname === '/api/pitches/featured' ||
          pathname.startsWith('/api/pitches/browse')) {
        // These can be handled locally or proxied to backend
        if (env.BACKEND_URL) {
          const backendUrl = new URL(pathname, env.BACKEND_URL);
          backendUrl.search = url.search;
          return fetch(backendUrl, {
            method,
            headers: request.headers,
            body: method !== 'GET' ? await request.text() : undefined,
          });
        }
        // Fallback response if no backend configured
        return jsonResponse({ pitches: [], total: 0 });
      }
      
      // Protected endpoints - verify JWT
      const auth = await verifyAuth(request, env);
      
      // Allow some endpoints without auth but add user context if available
      if (pathname.startsWith('/api/pitches/') && method === 'GET') {
        // Public pitch viewing, but track if user is logged in
        if (auth.isValid && auth.payload) {
          request.headers.set('X-User-Id', auth.payload.sub);
          request.headers.set('X-User-Type', auth.payload.userType);
        }
      } else if (pathname.startsWith('/api/')) {
        // All other API endpoints require authentication
        if (!auth.isValid) {
          return jsonResponse({ 
            success: false, 
            message: 'Authentication required' 
          }, 401);
        }
        
        // Add user context to request for backend
        if (auth.payload) {
          request.headers.set('X-User-Id', auth.payload.sub);
          request.headers.set('X-User-Type', auth.payload.userType);
          request.headers.set('X-User-Email', auth.payload.email);
        }
      }
      
      // Proxy to backend for complex operations
      if (env.BACKEND_URL) {
        const backendUrl = new URL(pathname, env.BACKEND_URL);
        backendUrl.search = url.search;
        
        const backendRequest = new Request(backendUrl, {
          method,
          headers: request.headers,
          body: method !== 'GET' && method !== 'HEAD' ? await request.text() : undefined,
        });
        
        return fetch(backendRequest);
      }
      
      // Default 404 response
      return jsonResponse({ 
        success: false, 
        message: 'Endpoint not found' 
      }, 404);
      
    } catch (error) {
      // Log to Sentry if configured
      if (sentry) {
        sentry.captureException(error);
      }
      
      console.error('Worker error:', error);
      
      return jsonResponse({
        success: false,
        message: 'Internal server error',
        error: env.ENVIRONMENT === 'development' ? error.message : undefined,
      }, 500);
    }
  },
  
  // WebSocket handler (if Durable Objects are configured)
  async webSocketMessage(request: Request, env: Env): Promise<Response> {
    if (!env.WEBSOCKET_ROOMS) {
      return jsonResponse({ 
        success: false, 
        message: 'WebSocket not configured' 
      }, 501);
    }
    
    // Verify auth for WebSocket connection
    const auth = await verifyAuth(request, env);
    if (!auth.isValid) {
      return jsonResponse({ 
        success: false, 
        message: 'Authentication required for WebSocket' 
      }, 401);
    }
    
    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    
    // Create WebSocket pair and handle connection
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    // Accept WebSocket connection
    server.accept();
    
    // Handle WebSocket messages
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        // Handle different message types
        console.log('WebSocket message:', message);
        
        // Echo message back for now
        server.send(JSON.stringify({
          type: 'echo',
          data: message,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        console.error('WebSocket message error:', error);
        server.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });
    
    return new Response(null, { status: 101, webSocket: client });
  },
};

// Export Durable Objects
export { WebSocketRoom } from './websocket-room-optimized.ts';
export { NotificationRoom } from './notification-room.ts';