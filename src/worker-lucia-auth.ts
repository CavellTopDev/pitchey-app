/**
 * Cloudflare Worker with Lucia Auth v3
 * Edge-optimized authentication for Pitchey platform
 */

import { LuciaAuthHandler } from './auth/lucia-handlers';
import { handleOptions, withCache, withErrorHandling } from './utils/edge-cache-optimized-v2';

export interface Env {
  DATABASE_URL: string;
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  SENTRY_DSN?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle OPTIONS requests
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize Lucia Auth handler
    const authHandler = new LuciaAuthHandler(env);

    try {
      // Authentication endpoints
      if (path === '/api/auth/sign-up' && request.method === 'POST') {
        return await authHandler.handleSignUp(request);
      }

      if (path === '/api/auth/sign-in' && request.method === 'POST') {
        return await authHandler.handleSignIn(request);
      }

      if (path === '/api/auth/sign-out' && request.method === 'POST') {
        return await authHandler.handleSignOut(request);
      }

      if (path === '/api/auth/session' && request.method === 'GET') {
        return await authHandler.handleSession(request);
      }

      // Portal-specific login endpoints
      if (path === '/api/auth/creator/login' && request.method === 'POST') {
        return await authHandler.handlePortalLogin(request, 'creator');
      }

      if (path === '/api/auth/investor/login' && request.method === 'POST') {
        return await authHandler.handlePortalLogin(request, 'investor');
      }

      if (path === '/api/auth/production/login' && request.method === 'POST') {
        return await authHandler.handlePortalLogin(request, 'production');
      }

      // Health check endpoint
      if (path === '/health' || path === '/api/health') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Worker is healthy',
          timestamp: new Date().toISOString(),
          auth: 'lucia-v3'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // For all other endpoints, proxy to the backend
      // This allows gradual migration from the existing backend
      const backendUrl = env.BACKEND_URL || 'https://pitchey-backend-fresh.deno.dev';
      const proxyUrl = new URL(url.pathname + url.search, backendUrl);
      
      const proxyRequest = new Request(proxyUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow'
      });

      const response = await fetch(proxyRequest);
      
      // Add CORS headers to proxied response
      const corsHeaders = new Headers(response.headers);
      corsHeaders.set('Access-Control-Allow-Origin', '*');
      corsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
      corsHeaders.set('Access-Control-Allow-Credentials', 'true');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: corsHeaders
      });

    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};