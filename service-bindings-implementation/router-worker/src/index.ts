/**
 * Router Worker - High-Performance Request Router
 * Routes requests to specialized service workers with zero latency
 */

import { Toucan } from 'toucan-js';

interface Env {
  // Service Bindings (zero-cost calls)
  CREATOR_SERVICE: Fetcher;
  INVESTOR_SERVICE: Fetcher;
  PRODUCTION_SERVICE: Fetcher;
  AUTH_SERVICE: Fetcher;
  BROWSE_SERVICE: Fetcher;
  ANALYTICS_SERVICE: Fetcher;
  
  // Configuration
  FRONTEND_URL: string;
  
  // Monitoring
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  
  // Caching
  ROUTING_CACHE: KVNamespace;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Route mapping for fast lookup
const ROUTE_PATTERNS = [
  // Authentication routes
  { pattern: /^\/api\/auth\/creator\//, service: 'CREATOR_SERVICE' },
  { pattern: /^\/api\/auth\/investor\//, service: 'INVESTOR_SERVICE' },
  { pattern: /^\/api\/auth\/production\//, service: 'PRODUCTION_SERVICE' },
  { pattern: /^\/api\/auth\//, service: 'AUTH_SERVICE' },
  
  // Portal-specific routes
  { pattern: /^\/api\/creator\//, service: 'CREATOR_SERVICE' },
  { pattern: /^\/api\/investor\//, service: 'INVESTOR_SERVICE' },
  { pattern: /^\/api\/production\//, service: 'PRODUCTION_SERVICE' },
  
  // Search and browse
  { pattern: /^\/api\/search\//, service: 'BROWSE_SERVICE' },
  { pattern: /^\/api\/browse\//, service: 'BROWSE_SERVICE' },
  { pattern: /^\/api\/pitches\//, service: 'BROWSE_SERVICE' },
  
  // Analytics
  { pattern: /^\/api\/analytics\//, service: 'ANALYTICS_SERVICE' },
  { pattern: /^\/api\/dashboard\//, service: 'ANALYTICS_SERVICE' },
  
  // Global endpoints (route to appropriate service based on user type)
  { pattern: /^\/api\/user\/notifications/, service: 'AUTH_SERVICE' },
  { pattern: /^\/api\/user\//, service: 'AUTH_SERVICE' },
  
  // Fallback for other API routes
  { pattern: /^\/api\//, service: 'BROWSE_SERVICE' }
];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry for error tracking
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT || 'development',
      release: env.SENTRY_RELEASE || 'router-dev',
      context: ctx,
      request
    });

    try {
      const url = new URL(request.url);
      
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }
      
      // Handle root path
      if (url.pathname === '/') {
        return handleRootPath();
      }
      
      // Handle health check
      if (url.pathname === '/api/health') {
        return handleHealthCheck(env);
      }
      
      // Route API requests to appropriate service
      const serviceBinding = routeRequest(url.pathname);
      if (serviceBinding && env[serviceBinding as keyof Env]) {
        const service = env[serviceBinding as keyof Env] as Fetcher;
        
        // Forward request with performance tracking
        const startTime = Date.now();
        const response = await service.fetch(request);
        const duration = Date.now() - startTime;
        
        // Add performance headers
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          headers.set(key, value);
        });
        headers.set('X-Router-Service', serviceBinding);
        headers.set('X-Router-Duration', `${duration}ms`);
        
        // Log routing metrics
        if (duration > 100) {
          sentry.addBreadcrumb({
            message: 'Slow service response',
            category: 'performance',
            level: 'warning',
            data: { service: serviceBinding, duration, path: url.pathname }
          });
        }
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }
      
      // Handle non-API paths
      return handleNonApiPath(url);
      
    } catch (error) {
      sentry.captureException(error);
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: 'Router error occurred',
          code: 'ROUTER_ERROR'
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

function routeRequest(pathname: string): string | null {
  // Use cached routing rules for performance
  for (const route of ROUTE_PATTERNS) {
    if (route.pattern.test(pathname)) {
      return route.service;
    }
  }
  
  return null;
}

function handleRootPath(): Response {
  return new Response(JSON.stringify({
    service: 'Pitchey API Router',
    version: 'v1.0',
    architecture: 'Service Bindings',
    status: 'operational',
    services: {
      creator: '/api/creator/',
      investor: '/api/investor/',
      production: '/api/production/',
      auth: '/api/auth/',
      browse: '/api/browse/',
      analytics: '/api/analytics/'
    },
    frontend: 'https://pitchey-5o8.pages.dev',
    docs: 'https://docs.pitchey.app'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleHealthCheck(env: Env): Promise<Response> {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    router: {
      version: 'v1.0',
      uptime: Date.now(),
      routes: ROUTE_PATTERNS.length
    },
    services: {
      creator: !!env.CREATOR_SERVICE,
      investor: !!env.INVESTOR_SERVICE,
      production: !!env.PRODUCTION_SERVICE,
      auth: !!env.AUTH_SERVICE,
      browse: !!env.BROWSE_SERVICE,
      analytics: !!env.ANALYTICS_SERVICE
    }
  };
  
  return new Response(JSON.stringify(healthData), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function handleNonApiPath(url: URL): Response {
  return new Response(JSON.stringify({
    success: false,
    error: {
      message: 'Path not found',
      code: 'NOT_FOUND',
      path: url.pathname,
      suggestion: 'This is an API-only service. Use /api/* endpoints.',
      availableServices: [
        '/api/creator/ - Creator portal endpoints',
        '/api/investor/ - Investor portal endpoints', 
        '/api/production/ - Production company endpoints',
        '/api/auth/ - Authentication endpoints',
        '/api/browse/ - Browse and search endpoints',
        '/api/analytics/ - Analytics endpoints'
      ]
    }
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}