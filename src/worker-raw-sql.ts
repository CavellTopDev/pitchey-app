/**
 * Cloudflare Worker with Raw SQL Implementation
 * Production-ready edge API with WebSocket support
 */

/// <reference types="@cloudflare/workers-types" />

import { RawSQLDatabase } from './db/raw-sql-connection';
import { RawSQLAuth } from './auth/raw-sql-auth';
import { RawSQLAuthMiddleware } from './middleware/raw-sql-auth.middleware';
import { RawSQLAPIHandlers } from './api/raw-sql-endpoints';
import { getCORSHeaders, RateLimiter } from './auth/raw-sql-auth-config';

// Worker Environment
interface Env {
  // Database
  DATABASE_URL: string;
  READ_REPLICA_URLS?: string;
  
  // Redis Cache
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  
  // Auth
  JWT_SECRET: string;
  
  // Cloudflare Bindings
  CACHE?: KVNamespace;
  DURABLE_OBJECTS?: DurableObjectNamespace;
  R2_BUCKET?: R2Bucket;
  
  // Environment
  ENVIRONMENT: 'development' | 'production';
}

// Rate limiter instance
const rateLimiter = new RateLimiter(60, 100); // 100 requests per minute

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Get origin for CORS
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin, env);
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    
    // Rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!rateLimiter.isAllowed(clientIP)) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      });
    }
    
    // Initialize database connection
    const db = new RawSQLDatabase({
      connectionString: env.DATABASE_URL,
      readReplicaUrls: env.READ_REPLICA_URLS ? env.READ_REPLICA_URLS.split(',') : [],
      redis: env.UPSTASH_REDIS_REST_URL ? {
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN!
      } : undefined,
      maxRetries: 3,
      queryTimeoutMs: 10000
    });
    
    // Initialize auth services
    const auth = new RawSQLAuth(env.DATABASE_URL);
    const authMiddleware = new RawSQLAuthMiddleware(db);
    const apiHandlers = new RawSQLAPIHandlers(db);
    
    try {
      // Health check endpoint
      if (path === '/health') {
        const isHealthy = await db.healthCheck();
        const stats = db.getStats();
        
        return new Response(JSON.stringify({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          stats,
          environment: env.ENVIRONMENT
        }), {
          status: isHealthy ? 200 : 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // WebSocket endpoint
      if (path === '/ws') {
        // Check for WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
          return new Response('Expected WebSocket', { status: 400 });
        }
        
        // Authenticate WebSocket connection
        const context = await authMiddleware.authenticate(request);
        
        // Handle WebSocket with Durable Object
        if (env.DURABLE_OBJECTS) {
          const id = env.DURABLE_OBJECTS.idFromName('global-room');
          const stub = env.DURABLE_OBJECTS.get(id);
          return stub.fetch(request);
        }
        
        // Fallback WebSocket handling
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        
        // Handle WebSocket messages
        server.accept();
        server.addEventListener('message', async (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            
            // Process message based on type
            switch (message.type) {
              case 'ping':
                server.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
                
              case 'subscribe':
                // Subscribe to updates (would integrate with Redis pub/sub)
                server.send(JSON.stringify({
                  type: 'subscribed',
                  channel: message.channel
                }));
                break;
                
              case 'query':
                // Execute database query (if authorized)
                if (context.isAuthenticated) {
                  const result = await db.query(message.query, message.params);
                  server.send(JSON.stringify({
                    type: 'result',
                    id: message.id,
                    data: result
                  }));
                }
                break;
                
              default:
                server.send(JSON.stringify({
                  type: 'error',
                  message: 'Unknown message type'
                }));
            }
          } catch (error) {
            server.send(JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error'
            }));
          }
        });
        
        return new Response(null, {
          status: 101,
          webSocket: client
        });
      }
      
      // Authentication endpoints
      if (path.startsWith('/api/auth/')) {
        const endpoint = path.replace('/api/auth/', '');
        
        switch (endpoint) {
          case 'signup':
            if (method === 'POST') {
              const data = await request.json();
              const result = await auth.signUp(data);
              
              // Set session cookie
              const cookieHeader = `pitchey-session=${result.session.token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${30 * 24 * 60 * 60}`;
              
              return new Response(JSON.stringify({
                success: true,
                user: result.user,
                session: { id: result.session.id }
              }), {
                status: 201,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'Set-Cookie': cookieHeader
                }
              });
            }
            break;
            
          case 'signin':
            if (method === 'POST') {
              const data = await request.json();
              const result = await auth.signIn(data);
              
              // Set session cookie
              const cookieHeader = `pitchey-session=${result.session.token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${30 * 24 * 60 * 60}`;
              
              return new Response(JSON.stringify({
                success: true,
                user: result.user,
                session: { id: result.session.id },
                token: result.session.token // For backward compatibility
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'Set-Cookie': cookieHeader
                }
              });
            }
            break;
            
          case 'signout':
            if (method === 'POST') {
              const token = getSessionToken(request);
              if (token) {
                await auth.signOut(token);
              }
              
              // Clear session cookie
              const cookieHeader = `pitchey-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
              
              return new Response(JSON.stringify({
                success: true,
                message: 'Signed out successfully'
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'Set-Cookie': cookieHeader
                }
              });
            }
            break;
            
          case 'session':
            if (method === 'GET') {
              const context = await authMiddleware.authenticate(request);
              
              if (!context.isAuthenticated) {
                return new Response(JSON.stringify({
                  success: false,
                  message: 'Not authenticated'
                }), {
                  status: 401,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              
              return new Response(JSON.stringify({
                success: true,
                user: context.user,
                session: context.session
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            break;
        }
      }
      
      // API endpoints
      if (path.startsWith('/api/')) {
        // Remove /api/ prefix
        const apiPath = path.replace('/api/', '');
        
        // Route to appropriate handler
        switch (true) {
          case apiPath === 'pitches' && method === 'GET':
            return await apiHandlers.getPitches(request);
            
          case apiPath === 'pitches' && method === 'POST':
            return await apiHandlers.createPitch(request);
            
          case apiPath.startsWith('pitches/') && method === 'GET':
            const pitchId = parseInt(apiPath.split('/')[1]);
            return await apiHandlers.getPitchById(request, pitchId);
            
          case apiPath.startsWith('pitches/') && method === 'PUT':
            const updateId = parseInt(apiPath.split('/')[1]);
            return await apiHandlers.updatePitch(request, updateId);
            
          case apiPath === 'users' && method === 'GET':
            return await apiHandlers.getUsers(request);
            
          case apiPath === 'nda/request' && method === 'POST':
            return await apiHandlers.requestNDA(request);
            
          case apiPath === 'nda/approve' && method === 'POST':
            return await apiHandlers.approveNDA(request);
            
          case apiPath === 'investments' && method === 'POST':
            return await apiHandlers.createInvestment(request);
            
          case apiPath === 'follows' && method === 'POST':
            return await apiHandlers.followUser(request);
            
          case apiPath === 'saved-pitches' && method === 'POST':
            return await apiHandlers.savePitch(request);
            
          case apiPath === 'dashboard/stats' && method === 'GET':
            return await apiHandlers.getDashboardStats(request);
            
          default:
            return new Response(JSON.stringify({
              error: 'Not found',
              path: apiPath,
              method
            }), {
              status: 404,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
        }
      }
      
      // Static response for root
      if (path === '/') {
        return new Response(JSON.stringify({
          name: 'Pitchey API - Raw SQL Edition',
          version: '2.0.0',
          status: 'operational',
          features: [
            'Raw SQL with Neon serverless',
            'WebSocket support',
            'Redis caching',
            'Edge-optimized',
            'No ORM dependencies'
          ],
          endpoints: {
            health: '/health',
            auth: '/api/auth/*',
            api: '/api/*',
            websocket: '/ws'
          }
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // 404 for unknown routes
      return new Response(JSON.stringify({
        error: 'Not found',
        path
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      
      // Return error response
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: env.ENVIRONMENT === 'development' && error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
};

// WebSocket Durable Object
export class WebSocketRoom implements DurableObject {
  state: DurableObjectState;
  env: Env;
  sessions: Map<WebSocket, any> = new Map();
  db: RawSQLDatabase;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Initialize database
    this.db = new RawSQLDatabase({
      connectionString: env.DATABASE_URL,
      redis: env.UPSTASH_REDIS_REST_URL ? {
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN!
      } : undefined
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }
    
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    // Accept the WebSocket
    this.state.acceptWebSocket(server);
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  
  async webSocketMessage(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);
      
      // Handle different message types
      switch (data.type) {
        case 'join':
          this.sessions.set(ws, { userId: data.userId });
          this.broadcast(JSON.stringify({
            type: 'user-joined',
            userId: data.userId
          }), ws);
          break;
          
        case 'message':
          // Save message to database
          await this.db.insert('messages', {
            user_id: this.sessions.get(ws)?.userId,
            content: data.content,
            created_at: new Date()
          });
          
          // Broadcast to all clients
          this.broadcast(JSON.stringify({
            type: 'message',
            userId: this.sessions.get(ws)?.userId,
            content: data.content,
            timestamp: Date.now()
          }));
          break;
          
        case 'leave':
          const session = this.sessions.get(ws);
          if (session) {
            this.sessions.delete(ws);
            this.broadcast(JSON.stringify({
              type: 'user-left',
              userId: session.userId
            }), ws);
          }
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  }
  
  async webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (session) {
      this.sessions.delete(ws);
      this.broadcast(JSON.stringify({
        type: 'user-left',
        userId: session.userId
      }), ws);
    }
  }
  
  broadcast(message: string, exclude?: WebSocket) {
    for (const ws of this.sessions.keys()) {
      if (ws !== exclude) {
        ws.send(message);
      }
    }
  }
}

// NotificationRoom Durable Object (for compatibility)
export class NotificationRoom implements DurableObject {
  state: DurableObjectState;
  env: Env;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }
  
  async fetch(request: Request): Promise<Response> {
    // Simple notification handler for backward compatibility
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'NotificationRoom active'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Helper function to extract session token
function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
    
    return cookies['pitchey-session'] || null;
  }
  
  // Check Authorization header for backward compatibility
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}