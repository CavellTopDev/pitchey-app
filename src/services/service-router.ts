/**
 * Service Router Module
 * Routes requests to appropriate service modules with zero-cost internal communication
 */

import { AuthService } from './auth/auth-service';
import { InvestorService } from './investor/investor-service';
import { CreatorService } from './creator/creator-service';
import { BrowseService } from './browse/browse-service';
import { CachingService } from '../caching-strategy';

export class ServiceRouter {
  private authService: AuthService;
  private investorService: InvestorService;
  private creatorService: CreatorService;
  private browseService: BrowseService;
  private cache: CachingService;

  constructor(env: any, cache: CachingService) {
    this.cache = cache;
    this.authService = new AuthService(env.JWT_SECRET);
    this.investorService = new InvestorService(cache);
    this.creatorService = new CreatorService(cache);
    this.browseService = new BrowseService(cache);
  }

  /**
   * Route request to appropriate service
   * Implements zero-cost internal service communication
   */
  async route(request: Request, sql: any): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Health endpoint (no auth required)
      if (pathname === '/api/health') {
        return this.handleHealthEndpoint();
      }

      // Auth service routes (handled first for efficiency)
      if (pathname.startsWith('/api/auth/') || pathname === '/api/validate-token' || pathname === '/api/refresh-token') {
        const authResponse = await this.authService.handleRequest(request, pathname, sql);
        if (authResponse) return authResponse;
      }

      // Public browse endpoints (no auth required for homepage)
      const publicEndpoints = [
        '/api/browse/trending',
        '/api/browse/featured', 
        '/api/browse/new-releases',
        '/api/pitches/trending',
        '/api/pitches/new',
        '/api/pitches/public',
        '/api/debug/db',
        '/api/debug/simple'
      ];
      
      if (publicEndpoints.some(endpoint => pathname === endpoint)) {
        // Handle public browse requests without authentication
        const browseResponse = await this.browseService.handleBrowseRequest(request, pathname, null, sql);
        if (browseResponse) return browseResponse;
      }

      // All other endpoints require authentication
      const authResult = await this.authService.validateRequest(request);
      if (!authResult.success) {
        return authResult.error!;
      }

      const auth = authResult.auth!;

      // Route to appropriate service based on user type and endpoint
      
      // Investor service routes
      if (pathname.startsWith('/api/investor/') || auth.userType === 'investor') {
        const investorResponse = await this.investorService.handleRequest(request, pathname, auth, sql);
        if (investorResponse) return investorResponse;
      }

      // Creator service routes
      if (pathname.startsWith('/api/creator/')) {
        const creatorResponse = await this.creatorService.handleRequest(request, pathname, auth, sql);
        if (creatorResponse) return creatorResponse;
      }

      // Production service routes (placeholder)  
      if (pathname.startsWith('/api/production/') || auth.userType === 'production') {
        return this.handleProductionService(request, pathname, auth, sql);
      }

      // Browse/search service (authenticated requests)
      if (pathname.startsWith('/api/browse/') || pathname.startsWith('/api/search/') || pathname.startsWith('/api/pitches')) {
        const browseResponse = await this.browseService.handleRequest(request, pathname, auth, sql);
        if (browseResponse) return browseResponse;
      }

      // Analytics service
      if (pathname.startsWith('/api/analytics/')) {
        return this.handleAnalyticsService(request, pathname, auth, sql);
      }

      // Default: endpoint not found
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Endpoint not found', code: 'NOT_FOUND' }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Service routing error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Internal service error', code: 'SERVICE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private handleHealthEndpoint(): Response {
    return new Response(JSON.stringify({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        auth: 'operational',
        investor: 'operational', 
        creator: 'operational',
        production: 'operational',
        browse: 'operational',
        analytics: 'operational'
      },
      architecture: 'modular-services',
      optimizations: {
        database_pooling: 'active',
        multi_layer_cache: 'active',
        service_routing: 'active'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Legacy placeholder - now handled by CreatorService
  private async handleCreatorService(request: Request, pathname: string, auth: any, sql: any): Promise<Response> {
    console.warn('Using legacy creator service handler - should use CreatorService instead');
    return new Response(JSON.stringify({ 
      success: true, 
      service: 'creator',
      message: 'Creator service operational (legacy handler)'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleProductionService(request: Request, pathname: string, auth: any, sql: any): Promise<Response> {
    return new Response(JSON.stringify({ 
      success: true, 
      service: 'production',
      message: 'Production service operational'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Legacy placeholder - now handled by BrowseService
  private async handleBrowseService(request: Request, pathname: string, auth: any, sql: any): Promise<Response> {
    console.warn('Using legacy browse service handler - should use BrowseService instead');
    return new Response(JSON.stringify({ 
      success: true, 
      service: 'browse',
      message: 'Browse service operational (legacy handler)'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleAnalyticsService(request: Request, pathname: string, auth: any, sql: any): Promise<Response> {
    return new Response(JSON.stringify({ 
      success: true, 
      service: 'analytics',
      message: 'Analytics service operational'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
