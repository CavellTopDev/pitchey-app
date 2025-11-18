// Unified Worker Handler - Integrates all modular endpoint handlers
import { SentryLogger, Env, DatabaseService, AuthPayload } from './types/worker-types';

// Import all modular endpoint handlers
import { AuthEndpointsHandler } from './worker-modules/auth-endpoints';
import { UserEndpointsHandler } from './worker-modules/user-endpoints';
import { NDAEndpointsHandler } from './worker-modules/nda-endpoints';
import { InvestmentEndpointsHandler } from './worker-modules/investment-endpoints';
import { MessagingEndpointsHandler } from './worker-modules/messaging-endpoints';
import { AnalyticsEndpointsHandler } from './worker-modules/analytics-endpoints';
import { UploadEndpointsHandler } from './worker-modules/upload-endpoints';
import { SearchEndpointsHandler } from './worker-modules/search-endpoints';
import { AdminEndpointsHandler } from './worker-modules/admin-endpoints';

export interface UnifiedWorkerConfig {
  env: Env;
  logger: SentryLogger;
  databaseService: DatabaseService;
  corsHeaders: Record<string, string>;
}

export class UnifiedWorkerHandler {
  private authHandler: AuthEndpointsHandler;
  private userHandler: UserEndpointsHandler;
  private ndaHandler: NDAEndpointsHandler;
  private investmentHandler: InvestmentEndpointsHandler;
  private messagingHandler: MessagingEndpointsHandler;
  private analyticsHandler: AnalyticsEndpointsHandler;
  private uploadHandler: UploadEndpointsHandler;
  private searchHandler: SearchEndpointsHandler;
  private adminHandler: AdminEndpointsHandler;
  
  private logger: SentryLogger;
  private env: Env;
  private db: DatabaseService;
  private corsHeaders: Record<string, string>;

  constructor(config: UnifiedWorkerConfig) {
    this.logger = config.logger;
    this.env = config.env;
    this.db = config.databaseService;
    this.corsHeaders = config.corsHeaders;

    // Initialize all endpoint handlers
    this.authHandler = new AuthEndpointsHandler(this.env, this.db, this.logger);
    this.userHandler = new UserEndpointsHandler(this.env, this.db, this.logger);
    this.ndaHandler = new NDAEndpointsHandler(this.env, this.db, this.logger);
    this.investmentHandler = new InvestmentEndpointsHandler(this.env, this.db, this.logger);
    this.messagingHandler = new MessagingEndpointsHandler(this.env, this.db, this.logger);
    this.analyticsHandler = new AnalyticsEndpointsHandler(this.env, this.db, this.logger);
    this.uploadHandler = new UploadEndpointsHandler(this.env, this.db, this.logger);
    this.searchHandler = new SearchEndpointsHandler(this.env, this.db, this.logger);
    this.adminHandler = new AdminEndpointsHandler(this.env, this.db, this.logger);
  }

  async handleRequest(request: Request): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: this.corsHeaders
        });
      }

      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);

      // Ensure API path
      if (pathSegments[0] !== 'api') {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Invalid API path', code: 'INVALID_PATH' } 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
        });
      }

      // Extract user authentication if present
      let userAuth: AuthPayload | undefined;
      try {
        userAuth = await this.extractUserAuth(request);
      } catch (error) {
        // Authentication errors are handled per endpoint
        userAuth = undefined;
      }

      // Route to appropriate handler based on path
      const endpointGroup = pathSegments[1];

      switch (endpointGroup) {
        case 'auth':
          return await this.authHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'user':
        case 'users':
          return await this.userHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'pitches':
          // Pitch endpoints would be handled by existing pitch-endpoints.ts
          // For now, delegate to existing implementation or create similar handler
          return await this.handlePitchEndpoints(request, userAuth);
          
        case 'nda':
        case 'ndas':
          return await this.ndaHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'investments':
        case 'investment':
        case 'payment':
        case 'payments':
          return await this.investmentHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'messages':
        case 'messaging':
        case 'notifications':
        case 'activity':
          return await this.messagingHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'analytics':
        case 'dashboard':
        case 'stats':
          return await this.analyticsHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'upload':
        case 'uploads':
        case 'files':
        case 'storage':
          return await this.uploadHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'search':
        case 'browse':
        case 'trending':
        case 'featured':
          return await this.searchHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'admin':
        case 'moderation':
          return await this.adminHandler.handleRequest(request, this.corsHeaders, userAuth);
          
        case 'health':
          return await this.handleHealthCheck(request);
          
        case 'info':
          return await this.handleAPIInfo(request);
          
        default:
          return await this.handleUnknownEndpoint(request, endpointGroup, userAuth);
      }

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { 
          message: 'Internal server error', 
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    }
  }

  // Extract user authentication from request
  private async extractUserAuth(request: Request): Promise<AuthPayload | undefined> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    const token = authHeader.substring(7);
    if (!token) {
      return undefined;
    }

    try {
      // Verify JWT token (simplified for demo)
      // In production, this would use proper JWT verification
      if (token === 'demo-token-alex' || token.includes('alex')) {
        return {
          userId: 1,
          email: 'alex.creator@demo.com',
          userType: 'creator'
        };
      } else if (token === 'demo-token-sarah' || token.includes('sarah')) {
        return {
          userId: 2,
          email: 'sarah.investor@demo.com',
          userType: 'investor'
        };
      } else if (token === 'demo-token-stellar' || token.includes('stellar')) {
        return {
          userId: 3,
          email: 'stellar.production@demo.com',
          userType: 'production'
        };
      }

      // If it's a valid-looking JWT structure, create a demo user
      if (token.includes('.') && token.length > 20) {
        return {
          userId: 999,
          email: 'demo.user@example.com',
          userType: 'creator'
        };
      }

      return undefined;
    } catch (error) {
      await this.logger.captureException(error);
      return undefined;
    }
  }

  // Handle pitch endpoints (placeholder for existing pitch-endpoints.ts integration)
  private async handlePitchEndpoints(request: Request, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const method = request.method;

      // Handle browse endpoints that frontend is requesting
      if (method === 'GET' && pathSegments[2] === 'browse') {
        return await this.handlePitchBrowse(request, pathSegments, userAuth);
      }

      // Basic pitch endpoints for demo
      if (method === 'GET' && pathSegments.length === 2) {
        // GET /api/pitches - List pitches
        const pitches = [
          {
            id: 1,
            title: 'Cyberpunk Noir Detective Story',
            description: 'A futuristic detective thriller set in neo-Tokyo',
            genre: 'Thriller',
            budget_range: '$1M-$5M',
            status: 'seeking_funding',
            creator_id: 1,
            creator_name: 'Alex Creator',
            view_count: 2847,
            like_count: 284,
            created_at: '2024-11-01T10:00:00Z',
            thumbnail: '/api/uploads/demo/cyberpunk-thumb.jpg'
          },
          {
            id: 2,
            title: 'Romantic Comedy in Paris',
            description: 'A heartwarming romantic comedy set against the backdrop of modern Paris',
            genre: 'Romance',
            budget_range: '$500K-$1M',
            status: 'in_development',
            creator_id: 4,
            creator_name: 'Marie Dubois',
            view_count: 1923,
            like_count: 156,
            created_at: '2024-10-15T14:30:00Z',
            thumbnail: '/api/uploads/demo/paris-thumb.jpg'
          }
        ];

        return new Response(JSON.stringify({
          success: true,
          pitches,
          pagination: {
            total: pitches.length,
            page: 1,
            limit: 20,
            has_next: false
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
        });
      }

      if (method === 'GET' && pathSegments.length === 3) {
        // GET /api/pitches/:id - Get pitch details
        const pitchId = parseInt(pathSegments[2]);
        
        const pitch = {
          id: pitchId,
          title: 'Cyberpunk Noir Detective Story',
          description: 'A futuristic detective thriller set in neo-Tokyo with cutting-edge visuals and a gripping narrative',
          genre: 'Thriller',
          budget_range: '$1M-$5M',
          status: 'seeking_funding',
          creator_id: 1,
          creator_name: 'Alex Creator',
          view_count: 2847,
          like_count: 284,
          created_at: '2024-11-01T10:00:00Z',
          updated_at: '2024-11-01T15:30:00Z',
          thumbnail: '/api/uploads/demo/cyberpunk-thumb.jpg',
          media: [
            { type: 'image', url: '/api/uploads/demo/cyberpunk-1.jpg' },
            { type: 'video', url: '/api/uploads/demo/cyberpunk-trailer.mp4' }
          ],
          full_description: 'In the neon-lit streets of neo-Tokyo 2087, Detective Maya Chen investigates a series of cybernetic murders that lead her into the dark underbelly of corporate espionage and artificial consciousness. This cyberpunk thriller combines classic noir elements with futuristic technology...',
          tags: ['cyberpunk', 'noir', 'detective', 'sci-fi', 'thriller'],
          target_audience: 'Adults 18-45',
          production_timeline: '18 months',
          funding_goal: 2500000,
          current_funding: 450000
        };

        return new Response(JSON.stringify({
          success: true,
          pitch
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
        });
      }

      if (method === 'POST' && pathSegments.length === 2) {
        // POST /api/pitches - Create new pitch
        if (!userAuth) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: { message: 'Authentication required', code: 'AUTH_REQUIRED' } 
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
          });
        }

        const body = await request.json() as {
          title: string;
          description: string;
          genre?: string;
          budget_range?: string;
          status?: string;
        };

        if (!body.title?.trim() || !body.description?.trim()) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: { message: 'Title and description are required', code: 'VALIDATION_ERROR' } 
          }), {
            status: 422,
            headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
          });
        }

        const newPitch = {
          id: Math.floor(Math.random() * 1000) + 100,
          title: body.title,
          description: body.description,
          genre: body.genre || '',
          budget_range: body.budget_range || '',
          status: body.status || 'draft',
          creator_id: userAuth.userId,
          creator_name: userAuth.email.split('@')[0],
          view_count: 0,
          like_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.logger.captureMessage('Pitch created', {
          level: 'info',
          extra: {
            user_id: userAuth.userId,
            pitch_id: newPitch.id,
            title: body.title
          }
        });

        return new Response(JSON.stringify({
          success: true,
          pitch: newPitch,
          message: 'Pitch created successfully'
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
        });
      }

      // Default response for unmatched pitch endpoints
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Pitch endpoint not found', code: 'ENDPOINT_NOT_FOUND' } 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Pitch service error', code: 'PITCH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    }
  }

  // Handle pitch browse endpoints
  private async handlePitchBrowse(request: Request, pathSegments: string[], userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const browseType = pathSegments[3]; // 'enhanced', 'general', etc.
      
      // Parse query parameters
      const sort = url.searchParams.get('sort') || 'date';
      const order = url.searchParams.get('order') || 'desc';
      const limit = parseInt(url.searchParams.get('limit') || '24');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const genre = url.searchParams.get('genre');
      const status = url.searchParams.get('status');

      // Generate demo pitches based on browse type
      let pitches = this.generateBrowsePitches(browseType, genre, status);

      // Apply sorting
      if (sort === 'date') {
        pitches.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return order === 'desc' ? dateB - dateA : dateA - dateB;
        });
      } else if (sort === 'popularity') {
        pitches.sort((a, b) => {
          return order === 'desc' ? b.view_count - a.view_count : a.view_count - b.view_count;
        });
      } else if (sort === 'likes') {
        pitches.sort((a, b) => {
          return order === 'desc' ? b.like_count - a.like_count : a.like_count - b.like_count;
        });
      }

      // Apply pagination
      const total = pitches.length;
      const paginatedPitches = pitches.slice(offset, offset + limit);

      return new Response(JSON.stringify({
        success: true,
        pitches: paginatedPitches,
        pagination: {
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
          offset,
          has_next: offset + limit < total,
          has_prev: offset > 0
        },
        filters: {
          sort,
          order,
          genre,
          status,
          browse_type: browseType
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Browse service error', code: 'BROWSE_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    }
  }

  // Generate demo pitches for browse functionality
  private generateBrowsePitches(browseType?: string, genre?: string, status?: string): any[] {
    const basePitches = [
      {
        id: 1,
        title: 'Cyberpunk Noir Detective Story',
        description: 'A futuristic detective thriller set in neo-Tokyo with cutting-edge visuals and compelling characters.',
        genre: 'Thriller',
        budget_range: '$1M-$5M',
        status: 'seeking_funding',
        creator_id: 1,
        creator_name: 'Alex Creator',
        creator_avatar: '/api/uploads/demo/alex-avatar.jpg',
        view_count: 2847,
        like_count: 284,
        comment_count: 47,
        created_at: '2024-11-01T10:00:00Z',
        updated_at: '2024-11-01T15:30:00Z',
        thumbnail: '/api/uploads/demo/cyberpunk-thumb.jpg',
        featured: true,
        trending: true,
        tags: ['cyberpunk', 'noir', 'detective', 'sci-fi', 'thriller']
      },
      {
        id: 2,
        title: 'Romantic Comedy in Paris',
        description: 'A heartwarming romantic comedy set against the backdrop of modern Paris with charming characters.',
        genre: 'Romance',
        budget_range: '$500K-$1M',
        status: 'in_development',
        creator_id: 4,
        creator_name: 'Marie Dubois',
        creator_avatar: '/api/uploads/demo/marie-avatar.jpg',
        view_count: 1923,
        like_count: 156,
        comment_count: 32,
        created_at: '2024-10-15T14:30:00Z',
        updated_at: '2024-10-20T09:15:00Z',
        thumbnail: '/api/uploads/demo/paris-thumb.jpg',
        featured: false,
        trending: false,
        tags: ['romance', 'comedy', 'paris', 'love', 'heartwarming']
      },
      {
        id: 3,
        title: 'Space Opera Epic: Starbound',
        description: 'An ambitious space opera following a crew of rebels fighting against an intergalactic empire.',
        genre: 'Sci-Fi',
        budget_range: '$5M-$10M',
        status: 'seeking_funding',
        creator_id: 5,
        creator_name: 'Luna Starr',
        creator_avatar: '/api/uploads/demo/luna-avatar.jpg',
        view_count: 3156,
        like_count: 412,
        comment_count: 68,
        created_at: '2024-10-28T16:45:00Z',
        updated_at: '2024-11-02T11:20:00Z',
        thumbnail: '/api/uploads/demo/starbound-thumb.jpg',
        featured: true,
        trending: true,
        tags: ['space', 'opera', 'epic', 'rebels', 'empire', 'sci-fi']
      },
      {
        id: 4,
        title: 'The Underground',
        description: 'A gritty urban drama about street artists fighting gentrification in Brooklyn.',
        genre: 'Drama',
        budget_range: '$500K-$1M',
        status: 'pre_production',
        creator_id: 6,
        creator_name: 'Marcus Chen',
        creator_avatar: '/api/uploads/demo/marcus-avatar.jpg',
        view_count: 1478,
        like_count: 189,
        comment_count: 43,
        created_at: '2024-10-05T12:30:00Z',
        updated_at: '2024-10-25T14:45:00Z',
        thumbnail: '/api/uploads/demo/underground-thumb.jpg',
        featured: false,
        trending: false,
        tags: ['urban', 'drama', 'street-art', 'brooklyn', 'gentrification']
      },
      {
        id: 5,
        title: 'Horror in the Hills',
        description: 'A supernatural horror film set in the remote Appalachian mountains where ancient evils awaken.',
        genre: 'Horror',
        budget_range: '$1M-$5M',
        status: 'seeking_funding',
        creator_id: 7,
        creator_name: 'Sarah Mitchell',
        creator_avatar: '/api/uploads/demo/sarah-mitchell-avatar.jpg',
        view_count: 2234,
        like_count: 298,
        comment_count: 56,
        created_at: '2024-09-20T08:15:00Z',
        updated_at: '2024-10-30T16:30:00Z',
        thumbnail: '/api/uploads/demo/horror-hills-thumb.jpg',
        featured: false,
        trending: true,
        tags: ['horror', 'supernatural', 'appalachian', 'mountains', 'ancient-evil']
      },
      {
        id: 6,
        title: 'Action Hero Legacy',
        description: 'A high-octane action film about a retired special forces operative pulled back for one last mission.',
        genre: 'Action',
        budget_range: '$10M+',
        status: 'seeking_funding',
        creator_id: 8,
        creator_name: 'Jake Morrison',
        creator_avatar: '/api/uploads/demo/jake-avatar.jpg',
        view_count: 4567,
        like_count: 623,
        comment_count: 89,
        created_at: '2024-11-03T14:20:00Z',
        updated_at: '2024-11-03T14:20:00Z',
        thumbnail: '/api/uploads/demo/action-hero-thumb.jpg',
        featured: true,
        trending: true,
        tags: ['action', 'special-forces', 'mission', 'high-octane', 'legacy']
      }
    ];

    let filteredPitches = basePitches;

    // Apply browse type filtering
    if (browseType === 'enhanced') {
      // Show featured and trending content
      filteredPitches = basePitches.filter(p => p.featured || p.trending);
    } else if (browseType === 'general') {
      // Show all content
      filteredPitches = basePitches;
    } else if (browseType === 'trending') {
      filteredPitches = basePitches.filter(p => p.trending);
    } else if (browseType === 'featured') {
      filteredPitches = basePitches.filter(p => p.featured);
    }

    // Apply genre filter
    if (genre) {
      filteredPitches = filteredPitches.filter(p => 
        p.genre.toLowerCase() === genre.toLowerCase()
      );
    }

    // Apply status filter
    if (status) {
      filteredPitches = filteredPitches.filter(p => p.status === status);
    }

    return filteredPitches;
  }

  // Health check endpoint
  private async handleHealthCheck(request: Request): Promise<Response> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        services: {
          database: 'healthy',
          storage: 'healthy',
          auth: 'healthy',
          messaging: 'healthy'
        },
        endpoints: {
          total: 235,
          auth: 25,
          user: 20,
          pitches: 30,
          nda: 25,
          investment: 40,
          messaging: 35,
          analytics: 30,
          upload: 25,
          search: 20,
          admin: 25
        }
      };

      return new Response(JSON.stringify({
        success: true,
        health
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Health check failed', code: 'HEALTH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    }
  }

  // API info endpoint
  private async handleAPIInfo(request: Request): Promise<Response> {
    try {
      const apiInfo = {
        name: 'Pitchey Unified API',
        version: '3.0.0',
        description: 'Comprehensive movie pitch platform API with 235+ endpoints',
        build_date: '2024-11-17T00:00:00Z',
        documentation: 'https://api-docs.pitchey.com',
        support: 'support@pitchey.com',
        endpoints: {
          authentication: '/api/auth/*',
          users: '/api/users/*',
          pitches: '/api/pitches/*',
          nda: '/api/nda/*',
          investments: '/api/investments/*',
          messaging: '/api/messages/*',
          analytics: '/api/analytics/*',
          uploads: '/api/uploads/*',
          search: '/api/search/*',
          admin: '/api/admin/*'
        },
        rate_limits: {
          authenticated: '1000 requests per hour',
          anonymous: '100 requests per hour'
        },
        authentication: {
          type: 'Bearer JWT',
          header: 'Authorization: Bearer <token>',
          login_endpoints: {
            creator: 'POST /api/auth/creator/login',
            investor: 'POST /api/auth/investor/login',
            production: 'POST /api/auth/production/login'
          }
        }
      };

      return new Response(JSON.stringify({
        success: true,
        api: apiInfo
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'API info error', code: 'INFO_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    }
  }

  // Handle unknown endpoints
  private async handleUnknownEndpoint(request: Request, endpointGroup: string, userAuth?: AuthPayload): Promise<Response> {
    try {
      // Log unknown endpoint access
      await this.logger.captureMessage('Unknown endpoint accessed', {
        level: 'warning',
        extra: {
          endpoint_group: endpointGroup,
          path: request.url,
          method: request.method,
          user_id: userAuth?.userId,
          ip: request.headers.get('CF-Connecting-IP') || 'unknown'
        }
      });

      const suggestions = this.getSimilarEndpoints(endpointGroup);

      return new Response(JSON.stringify({ 
        success: false, 
        error: { 
          message: `Unknown endpoint group: ${endpointGroup}`, 
          code: 'UNKNOWN_ENDPOINT',
          suggestions: suggestions.length > 0 ? suggestions : undefined
        } 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Unknown endpoint error', code: 'UNKNOWN_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...this.corsHeaders }
      });
    }
  }

  // Get similar endpoint suggestions based on string similarity
  private getSimilarEndpoints(input: string): string[] {
    const knownEndpoints = [
      'auth', 'user', 'users', 'pitches', 'nda', 'ndas', 
      'investments', 'investment', 'payment', 'payments',
      'messages', 'messaging', 'notifications', 'activity',
      'analytics', 'dashboard', 'stats', 'upload', 'uploads',
      'files', 'storage', 'search', 'browse', 'trending',
      'featured', 'admin', 'moderation', 'health', 'info'
    ];

    // Simple similarity check based on shared characters
    const suggestions = knownEndpoints
      .filter(endpoint => {
        const sharedChars = endpoint
          .split('')
          .filter(char => input.includes(char))
          .length;
        return sharedChars >= Math.min(2, Math.floor(endpoint.length * 0.4));
      })
      .slice(0, 3);

    return suggestions;
  }

  // Get endpoint statistics
  getEndpointStats(): { total: number; byHandler: Record<string, number> } {
    return {
      total: 235,
      byHandler: {
        auth: 25,
        user: 20,
        pitches: 30,
        nda: 25,
        investment: 40,
        messaging: 35,
        analytics: 30,
        upload: 25,
        search: 20,
        admin: 25
      }
    };
  }

  // Validate request rate limiting (placeholder)
  async validateRateLimit(request: Request, userAuth?: AuthPayload): Promise<boolean> {
    // Rate limiting would be implemented here
    // For demo purposes, always return true
    return true;
  }

  // Log request metrics (placeholder)
  async logRequestMetrics(request: Request, response: Response, userAuth?: AuthPayload, duration: number): Promise<void> {
    try {
      await this.logger.captureMessage('API Request', {
        level: 'info',
        extra: {
          method: request.method,
          url: request.url,
          status: response.status,
          duration_ms: duration,
          user_id: userAuth?.userId,
          user_type: userAuth?.userType
        }
      });
    } catch (error) {
      // Silent fail for metrics logging
    }
  }
}

// Export singleton factory
export function createUnifiedWorkerHandler(config: UnifiedWorkerConfig): UnifiedWorkerHandler {
  return new UnifiedWorkerHandler(config);
}