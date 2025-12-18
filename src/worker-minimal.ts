/**
 * Minimal Cloudflare Worker - Testing Error 1027
 */

// Stub Durable Objects for backward compatibility
export class WebSocketDurableObject {
  state: any;
  env: any;
  
  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
  }
  
  async fetch(request: Request): Promise<Response> {
    return new Response('WebSocket support disabled', { status: 503 });
  }
}

export const WebSocketRoom = WebSocketDurableObject;
export const NotificationRoom = WebSocketDurableObject;

export interface Env {
  DATABASE_URL?: string;
  FRONTEND_URL?: string;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'production'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Test endpoint
    if (url.pathname === '/api/test') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Minimal worker is running'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Default response
    return new Response('Not Found', { status: 404 });
  }
};