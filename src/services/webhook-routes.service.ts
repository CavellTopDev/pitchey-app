/**
 * Webhook Routes Service
 * Handles HTTP routes for webhook management in Cloudflare Worker
 */

import { WebhookAPIService } from './webhook-api.service';
import { WebhookSecurityService } from './webhook-security.service';
import { authMiddleware } from '../middleware/auth.middleware';

interface Env {
  DATABASE_URL?: string;
  REDIS_URL?: string;
  JWT_SECRET: string;
}

interface RequestContext {
  request: Request;
  env: Env;
  userId?: number;
  userType?: string;
}

export class WebhookRoutesService {
  private apiService: WebhookAPIService;
  private securityService: WebhookSecurityService;

  constructor(env: Env) {
    this.apiService = new WebhookAPIService(
      env.DATABASE_URL || '',
      env.REDIS_URL
    );
    this.securityService = new WebhookSecurityService(
      env.DATABASE_URL || ''
    );
  }

  /**
   * Route webhook requests
   */
  async handleWebhookRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Extract user context from authorization
      const context = await this.extractUserContext(request, env);

      // Route to appropriate handler
      if (pathname.startsWith('/api/webhooks/endpoints')) {
        return this.handleEndpointRoutes(context, pathname);
      } else if (pathname.startsWith('/api/webhooks/events')) {
        return this.handleEventRoutes(context, pathname);
      } else if (pathname.startsWith('/api/webhooks/templates')) {
        return this.handleTemplateRoutes(context, pathname);
      } else if (pathname === '/api/webhooks/verify-signature') {
        return this.handleSignatureVerification(context);
      } else if (pathname === '/api/webhooks/event-types') {
        return this.handleEventTypes(context);
      } else {
        return this.createErrorResponse(404, 'Webhook endpoint not found');
      }
    } catch (error) {
      console.error('Webhook request error:', error);
      return this.createErrorResponse(500, 'Internal server error');
    }
  }

  /**
   * Handle endpoint management routes
   */
  private async handleEndpointRoutes(
    context: RequestContext,
    pathname: string
  ): Promise<Response> {
    if (!context.userId) {
      return this.createErrorResponse(401, 'Authentication required');
    }

    const method = context.request.method;
    const pathParts = pathname.split('/').filter(p => p);

    // GET /api/webhooks/endpoints
    if (method === 'GET' && pathParts.length === 3) {
      const result = await this.apiService.listEndpoints(context.userId);
      return this.createResponse(result);
    }

    // POST /api/webhooks/endpoints
    if (method === 'POST' && pathParts.length === 3) {
      try {
        const body = await context.request.json();
        
        // Security validation
        if (body.url) {
          const securityCheck = await this.securityService.validateRequestSecurity({
            url: body.url,
            method: 'POST',
            headers: Object.fromEntries(context.request.headers.entries()),
            body: JSON.stringify(body),
            ipAddress: this.getClientIP(context.request),
            userAgent: context.request.headers.get('user-agent') || '',
          });

          if (!securityCheck.valid) {
            return this.createErrorResponse(400, 'Security validation failed');
          }
        }

        const result = await this.apiService.createEndpoint(context.userId, body);
        return this.createResponse(result);
      } catch (error) {
        return this.createErrorResponse(400, 'Invalid request body');
      }
    }

    // POST /api/webhooks/endpoints/from-template
    if (method === 'POST' && pathParts[3] === 'from-template') {
      try {
        const body = await context.request.json();
        const result = await this.apiService.createEndpointFromTemplate(
          context.userId,
          body.template_id,
          body
        );
        return this.createResponse(result);
      } catch (error) {
        return this.createErrorResponse(400, 'Invalid request body');
      }
    }

    // Routes with endpoint ID
    const endpointId = parseInt(pathParts[3]);
    if (isNaN(endpointId)) {
      return this.createErrorResponse(400, 'Invalid endpoint ID');
    }

    // GET /api/webhooks/endpoints/:id
    if (method === 'GET' && pathParts.length === 4) {
      const result = await this.apiService.getEndpoint(context.userId, endpointId);
      return this.createResponse(result);
    }

    // PUT /api/webhooks/endpoints/:id
    if (method === 'PUT' && pathParts.length === 4) {
      try {
        const body = await context.request.json();
        const result = await this.apiService.updateEndpoint(
          context.userId,
          endpointId,
          body
        );
        return this.createResponse(result);
      } catch (error) {
        return this.createErrorResponse(400, 'Invalid request body');
      }
    }

    // DELETE /api/webhooks/endpoints/:id
    if (method === 'DELETE' && pathParts.length === 4) {
      const result = await this.apiService.deleteEndpoint(context.userId, endpointId);
      return this.createResponse(result);
    }

    // POST /api/webhooks/endpoints/:id/toggle
    if (method === 'POST' && pathParts[4] === 'toggle') {
      try {
        const body = await context.request.json();
        const result = await this.apiService.toggleEndpoint(
          context.userId,
          endpointId,
          body.is_active
        );
        return this.createResponse(result);
      } catch (error) {
        return this.createErrorResponse(400, 'Invalid request body');
      }
    }

    // POST /api/webhooks/endpoints/:id/test
    if (method === 'POST' && pathParts[4] === 'test') {
      try {
        const body = await context.request.json();
        const result = await this.apiService.testEndpoint(context.userId, {
          endpoint_id: endpointId,
          test_payload: body.test_payload,
          test_headers: body.test_headers,
        });
        return this.createResponse(result);
      } catch (error) {
        return this.createErrorResponse(400, 'Invalid request body');
      }
    }

    // GET /api/webhooks/endpoints/:id/analytics
    if (method === 'GET' && pathParts[4] === 'analytics') {
      const url = new URL(context.request.url);
      const period = url.searchParams.get('period') as any || 'day';
      const startDate = url.searchParams.get('start_date') || undefined;
      const endDate = url.searchParams.get('end_date') || undefined;

      const result = await this.apiService.getEndpointAnalytics(
        context.userId,
        endpointId,
        period,
        startDate,
        endDate
      );
      return this.createResponse(result);
    }

    // GET /api/webhooks/endpoints/:id/deliveries
    if (method === 'GET' && pathParts[4] === 'deliveries') {
      const url = new URL(context.request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const result = await this.apiService.getDeliveryHistory(
        context.userId,
        endpointId,
        page,
        limit
      );
      return this.createResponse(result);
    }

    return this.createErrorResponse(404, 'Endpoint not found');
  }

  /**
   * Handle event management routes
   */
  private async handleEventRoutes(
    context: RequestContext,
    pathname: string
  ): Promise<Response> {
    if (!context.userId) {
      return this.createErrorResponse(401, 'Authentication required');
    }

    const method = context.request.method;

    // POST /api/webhooks/events
    if (method === 'POST') {
      try {
        const body = await context.request.json();
        
        // Security check
        const securityCheck = await this.securityService.validateRequestSecurity({
          url: context.request.url,
          method: 'POST',
          headers: Object.fromEntries(context.request.headers.entries()),
          body: JSON.stringify(body),
          ipAddress: this.getClientIP(context.request),
          userAgent: context.request.headers.get('user-agent') || '',
        });

        if (!securityCheck.valid) {
          return this.createErrorResponse(400, 'Security validation failed');
        }

        const result = await this.apiService.publishEvent(context.userId, body);
        return this.createResponse(result);
      } catch (error) {
        return this.createErrorResponse(400, 'Invalid request body');
      }
    }

    return this.createErrorResponse(405, 'Method not allowed');
  }

  /**
   * Handle template routes
   */
  private async handleTemplateRoutes(
    context: RequestContext,
    pathname: string
  ): Promise<Response> {
    const method = context.request.method;

    // GET /api/webhooks/templates
    if (method === 'GET') {
      const result = await this.apiService.listTemplates();
      return this.createResponse(result);
    }

    return this.createErrorResponse(405, 'Method not allowed');
  }

  /**
   * Handle signature verification
   */
  private async handleSignatureVerification(
    context: RequestContext
  ): Promise<Response> {
    if (context.request.method !== 'POST') {
      return this.createErrorResponse(405, 'Method not allowed');
    }

    try {
      const body = await context.request.json();
      const result = this.apiService.verifyWebhookSignature(
        body.payload,
        body.signature,
        body.secret
      );
      return this.createResponse(result);
    } catch (error) {
      return this.createErrorResponse(400, 'Invalid request body');
    }
  }

  /**
   * Handle event types listing
   */
  private async handleEventTypes(
    context: RequestContext
  ): Promise<Response> {
    if (context.request.method !== 'GET') {
      return this.createErrorResponse(405, 'Method not allowed');
    }

    const result = this.apiService.getEventTypes();
    return this.createResponse(result);
  }

  /**
   * Extract user context from request
   */
  private async extractUserContext(request: Request, env: Env): Promise<RequestContext> {
    const context: RequestContext = { request, env };

    try {
      // Extract authorization header
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Verify JWT token
        const decoded = await authMiddleware.verifyToken(token, env.JWT_SECRET);
        if (decoded) {
          context.userId = decoded.userId;
          context.userType = decoded.userType;
        }
      }
    } catch (error) {
      console.error('Auth extraction error:', error);
    }

    return context;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: Request): string {
    // Check Cloudflare headers first
    const cfConnectingIP = request.headers.get('CF-Connecting-IP');
    if (cfConnectingIP) return cfConnectingIP;
    
    // Fallback headers
    const xForwardedFor = request.headers.get('X-Forwarded-For');
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }
    
    const xRealIP = request.headers.get('X-Real-IP');
    if (xRealIP) return xRealIP;
    
    return 'unknown';
  }

  /**
   * Create API response
   */
  private createResponse(result: any, status: number = 200): Response {
    return new Response(JSON.stringify(result), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  /**
   * Create error response
   */
  private createErrorResponse(status: number, message: string): Response {
    return this.createResponse({
      success: false,
      error: message,
    }, status);
  }

  /**
   * Handle CORS preflight requests
   */
  handleOptions(): Response {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
}

/**
 * Integration middleware for adding webhook routes to existing worker
 */
export function addWebhookRoutes(
  existingHandler: (request: Request, env: any) => Promise<Response>
) {
  return async function(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle webhook routes
    if (url.pathname.startsWith('/api/webhooks/')) {
      const webhookRoutes = new WebhookRoutesService(env);
      
      if (request.method === 'OPTIONS') {
        return webhookRoutes.handleOptions();
      }
      
      return webhookRoutes.handleWebhookRequest(request, env);
    }
    
    // Fall back to existing handler
    return existingHandler(request, env);
  };
}

/**
 * Standalone webhook worker
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const webhookRoutes = new WebhookRoutesService(env);
    
    if (request.method === 'OPTIONS') {
      return webhookRoutes.handleOptions();
    }
    
    return webhookRoutes.handleWebhookRequest(request, env);
  },
};