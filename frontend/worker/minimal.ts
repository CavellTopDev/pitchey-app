export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  SENTRY_DSN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Simple test endpoint
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Worker is running',
        env: {
          hasDatabase: !!env.DATABASE_URL,
          hasJwtSecret: !!env.JWT_SECRET,
          hasSentry: !!env.SENTRY_DSN,
          hasFrontend: !!env.FRONTEND_URL
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response('Not Found', { 
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
};