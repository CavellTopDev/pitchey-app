/**
 * Minimal test Worker to diagnose deployment issues
 */

export interface Env {
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    
    try {
      // Simple health check
      if (url.pathname === '/health' || url.pathname === '/') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          path: url.pathname,
          environment: {
            hasJwtSecret: !!env.JWT_SECRET,
            frontendUrl: env.FRONTEND_URL,
            originUrl: env.ORIGIN_URL
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Default response for unknown paths
      return new Response(JSON.stringify({
        error: 'Not Found',
        path: url.pathname,
        method: request.method
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};