/**
 * Cloudflare Worker with Neon PostgreSQL connection via Hyperdrive
 * This version can use real database data or fallback to demo data
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './db/schema.ts';

export interface Env {
  // Storage  
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  
  // Database
  HYPERDRIVE?: Hyperdrive;
  
  // Real-time
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  
  // Configuration
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL?: string;
}

// Database helper function
function getDatabase(env: Env) {
  if (!env.HYPERDRIVE) {
    throw new Error('HYPERDRIVE binding not available');
  }
  return drizzle(env.HYPERDRIVE, { schema });
}

// Demo data as fallback
const DEMO_DATA = {
  users: [
    { 
      id: 1004, 
      email: 'alex.creator@demo.com', 
      userType: 'creator',
      firstName: 'Alex',
      lastName: 'Creator',
      displayName: 'Alex Creator',
      companyName: 'Independent Films',
      bio: 'Passionate filmmaker with 10+ years of experience.',
      isVerified: true,
      createdAt: '2024-01-15T10:00:00Z'
    },
    { 
      id: 1005, 
      email: 'sarah.investor@demo.com', 
      userType: 'investor',
      firstName: 'Sarah',
      lastName: 'Investor',
      displayName: 'Sarah Investor',
      companyName: 'Capital Ventures',
      bio: 'Angel investor focused on entertainment and media.',
      isVerified: true,
      createdAt: '2024-01-15T10:00:00Z'
    }
  ],
  pitches: [
    {
      id: 1,
      title: 'The Last Stand',
      genre: 'Action',
      budget: 5000000,
      description: 'An action-packed thriller about survival against impossible odds.',
      creatorId: 1004,
      creatorName: 'Alex Creator',
      status: 'active',
      featured: true,
      views: 1250,
      createdAt: '2024-11-10T14:30:00Z',
      updatedAt: '2024-11-15T10:00:00Z'
    }
  ]
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.FRONTEND_URL,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Health check with database connection test
    if (path === '/api/health') {
      let dbStatus = 'disconnected';
      let dbError = null;

      try {
        if (env.HYPERDRIVE) {
          const db = getDatabase(env);
          // Simple query to test connection
          const result = await db.execute('SELECT 1 as test');
          dbStatus = result ? 'connected' : 'error';
        }
      } catch (error) {
        dbError = error.message;
        dbStatus = 'error';
      }

      return new Response(JSON.stringify({ 
        status: 'ok',
        database: dbStatus,
        dbError: dbError,
        timestamp: new Date().toISOString(),
        environment: 'cloudflare-worker',
        hyperdrive: !!env.HYPERDRIVE
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all users - try database first, fallback to demo
    if (path === '/api/users' && request.method === 'GET') {
      let users = DEMO_DATA.users;
      let source = 'demo';

      try {
        if (env.HYPERDRIVE) {
          const db = getDatabase(env);
          const dbUsers = await db.select().from(schema.users).limit(10);
          if (dbUsers.length > 0) {
            users = dbUsers.map(user => ({
              id: user.id,
              email: user.email,
              userType: user.userType,
              firstName: user.firstName,
              lastName: user.lastName,
              displayName: user.displayName || `${user.firstName} ${user.lastName}`,
              companyName: user.companyName,
              bio: user.bio,
              isVerified: user.isVerified,
              createdAt: user.createdAt
            }));
            source = 'database';
          }
        }
      } catch (error) {
        console.error('Database query failed, using demo data:', error);
      }

      return new Response(JSON.stringify({ users, source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all pitches - try database first, fallback to demo
    if (path === '/api/pitches' && request.method === 'GET') {
      let pitches = DEMO_DATA.pitches;
      let source = 'demo';

      try {
        if (env.HYPERDRIVE) {
          const db = getDatabase(env);
          const dbPitches = await db.select().from(schema.pitches).limit(10);
          if (dbPitches.length > 0) {
            pitches = dbPitches.map(pitch => ({
              id: pitch.id,
              title: pitch.title,
              genre: pitch.genre,
              budget: pitch.budget,
              description: pitch.description,
              creatorId: pitch.creatorId,
              status: pitch.status,
              featured: pitch.featured,
              views: pitch.views,
              createdAt: pitch.createdAt,
              updatedAt: pitch.updatedAt
            }));
            source = 'database';
          }
        }
      } catch (error) {
        console.error('Database query failed, using demo data:', error);
      }

      return new Response(JSON.stringify({ pitches, source }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Demo authentication endpoint
    if (path.startsWith('/api/auth/') && request.method === 'POST') {
      const body = await request.json();
      const { email, password } = body;

      // Simple demo authentication
      const user = DEMO_DATA.users.find(u => u.email === email);
      
      if (user && password === 'Demo123') {
        // Generate a simple JWT-like token
        const token = btoa(JSON.stringify({
          userId: user.id,
          email: user.email,
          userType: user.userType,
          exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        }));

        return new Response(JSON.stringify({
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userType: user.userType,
            displayName: user.displayName
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Proxy other requests to backend if available
    if (env.ORIGIN_URL && path.startsWith('/api/')) {
      const backendUrl = `${env.ORIGIN_URL}${path}${url.search}`;
      const proxyRequest = new Request(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' ? request.body : null
      });

      const backendResponse = await fetch(proxyRequest);
      const response = new Response(backendResponse.body, {
        status: backendResponse.status,
        headers: { ...corsHeaders, ...Object.fromEntries(backendResponse.headers.entries()) }
      });
      
      return response;
    }

    // Default 404
    return new Response(JSON.stringify({ 
      error: 'Not Found',
      path,
      availableEndpoints: ['/api/health', '/api/users', '/api/pitches', '/api/auth/creator/login']
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  }
};