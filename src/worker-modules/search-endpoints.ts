// Search and Filtering Endpoints - Comprehensive search functionality for all content types
import { SentryLogger, Env, DatabaseService, User, AuthPayload, ApiResponse } from '../types/worker-types';

export interface SearchResult {
  id: number;
  type: 'pitch' | 'user' | 'company';
  title: string;
  description?: string;
  thumbnail?: string;
  relevance: number;
  metadata?: any;
}

export interface SearchFilters {
  query?: string;
  type?: 'pitch' | 'user' | 'company' | 'all';
  genre?: string;
  budget_range?: string;
  status?: string;
  user_type?: string;
  industry?: string;
  location?: string;
  sort_by?: 'relevance' | 'date' | 'popularity' | 'alphabetical';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
  featured_only?: boolean;
  verified_only?: boolean;
  has_nda?: boolean;
  investment_range?: string;
}

export interface SearchStats {
  total_results: number;
  pitch_results: number;
  user_results: number;
  company_results: number;
  search_time_ms: number;
  popular_searches: { query: string; count: number }[];
  trending_genres: { genre: string; count: number }[];
}

export class SearchEndpointsHandler {
  constructor(
    private logger: SentryLogger,
    private env: Env,
    private db: DatabaseService
  ) {}

  async handleRequest(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      
      // Remove 'api' and 'search' from path segments
      const relevantPath = pathSegments.slice(2);
      const method = request.method;

      // Route to appropriate handler
      if (method === 'GET' && relevantPath[0] === 'global') {
        return await this.handleGlobalSearch(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'pitches') {
        return await this.handleSearchPitches(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'users') {
        return await this.handleSearchUsers(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'companies') {
        return await this.handleSearchCompanies(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'suggestions') {
        return await this.handleSearchSuggestions(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'trending') {
        return await this.handleTrendingContent(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'featured') {
        return await this.handleFeaturedContent(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'browse') {
        return await this.handleBrowseContent(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'filters') {
        return await this.handleGetFilters(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'genres') {
        return await this.handleGetGenres(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'tags') {
        return await this.handleSearchTags(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'similar' && relevantPath[1]) {
        return await this.handleSimilarContent(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'GET' && relevantPath[0] === 'recommendations') {
        return await this.handleRecommendations(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'saved-searches' && userAuth) {
        return await this.handleGetSavedSearches(request, corsHeaders, userAuth);
      }
      
      if (method === 'POST' && relevantPath[0] === 'save' && userAuth) {
        return await this.handleSaveSearch(request, corsHeaders, userAuth);
      }
      
      if (method === 'DELETE' && relevantPath[0] === 'saved-searches' && relevantPath[1] && userAuth) {
        return await this.handleDeleteSavedSearch(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'GET' && relevantPath[0] === 'history' && userAuth) {
        return await this.handleSearchHistory(request, corsHeaders, userAuth);
      }
      
      if (method === 'POST' && relevantPath[0] === 'track' && userAuth) {
        return await this.handleTrackSearch(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'stats') {
        return await this.handleSearchStats(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'autocomplete') {
        return await this.handleAutocomplete(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'advanced') {
        return await this.handleAdvancedSearch(request, corsHeaders, userAuth);
      }
      
      if (method === 'POST' && relevantPath[0] === 'bulk-filter') {
        return await this.handleBulkFilter(request, corsHeaders, userAuth);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Search endpoint not found', code: 'ENDPOINT_NOT_FOUND' } 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Search service error', code: 'SEARCH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Global Search - Search across all content types
  private async handleGlobalSearch(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const sort_by = url.searchParams.get('sort_by') || 'relevance';

      const searchStart = Date.now();
      
      // Demo data fallback
      const demoResults = [
        {
          id: 1,
          type: 'pitch' as const,
          title: 'Cyberpunk Noir Detective Story',
          description: 'A futuristic detective thriller set in neo-Tokyo',
          thumbnail: '/api/uploads/demo/cyberpunk-thumb.jpg',
          relevance: 0.95,
          metadata: { genre: 'Thriller', budget: '$2M' }
        },
        {
          id: 2,
          type: 'user' as const,
          title: 'Alex Creator',
          description: 'Award-winning screenwriter and director',
          thumbnail: '/api/uploads/demo/alex-avatar.jpg',
          relevance: 0.87,
          metadata: { user_type: 'creator', verified: true }
        },
        {
          id: 3,
          type: 'company' as const,
          title: 'Stellar Productions',
          description: 'Independent film production company',
          thumbnail: '/api/uploads/demo/stellar-logo.jpg',
          relevance: 0.82,
          metadata: { industry: 'Film Production', founded: 2018 }
        }
      ].filter(item => 
        query === '' || 
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
      );

      const searchTime = Date.now() - searchStart;

      return new Response(JSON.stringify({
        success: true,
        results: demoResults.slice(offset, offset + limit),
        pagination: {
          total: demoResults.length,
          page: Math.floor(offset / limit) + 1,
          limit,
          has_next: offset + limit < demoResults.length
        },
        search_time_ms: searchTime,
        stats: {
          pitch_results: demoResults.filter(r => r.type === 'pitch').length,
          user_results: demoResults.filter(r => r.type === 'user').length,
          company_results: demoResults.filter(r => r.type === 'company').length
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to perform global search', code: 'GLOBAL_SEARCH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Search Pitches with filters
  private async handleSearchPitches(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const filters: SearchFilters = {
        query: url.searchParams.get('q') || '',
        genre: url.searchParams.get('genre') || undefined,
        budget_range: url.searchParams.get('budget_range') || undefined,
        status: url.searchParams.get('status') || undefined,
        sort_by: url.searchParams.get('sort_by') as any || 'relevance',
        sort_order: url.searchParams.get('sort_order') as any || 'desc',
        page: parseInt(url.searchParams.get('page') || '1'),
        limit: parseInt(url.searchParams.get('limit') || '20'),
        featured_only: url.searchParams.get('featured_only') === 'true',
        has_nda: url.searchParams.get('has_nda') === 'true'
      };

      // Demo data
      const demoPitches = [
        {
          id: 1,
          title: 'Cyberpunk Noir Detective Story',
          description: 'A futuristic detective thriller set in neo-Tokyo with cutting-edge visuals',
          genre: 'Thriller',
          budget_range: '$1M-$5M',
          status: 'seeking_funding',
          creator: 'Alex Creator',
          view_count: 2847,
          like_count: 284,
          featured: true,
          has_nda: true,
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
          creator: 'Marie Dubois',
          view_count: 1923,
          like_count: 156,
          featured: false,
          has_nda: false,
          created_at: '2024-10-15T14:30:00Z',
          thumbnail: '/api/uploads/demo/paris-thumb.jpg'
        }
      ];

      // Apply filters
      let filteredPitches = demoPitches;

      if (filters.query) {
        filteredPitches = filteredPitches.filter(p => 
          p.title.toLowerCase().includes(filters.query!.toLowerCase()) ||
          p.description.toLowerCase().includes(filters.query!.toLowerCase())
        );
      }

      if (filters.genre) {
        filteredPitches = filteredPitches.filter(p => p.genre === filters.genre);
      }

      if (filters.status) {
        filteredPitches = filteredPitches.filter(p => p.status === filters.status);
      }

      if (filters.featured_only) {
        filteredPitches = filteredPitches.filter(p => p.featured);
      }

      if (filters.has_nda) {
        filteredPitches = filteredPitches.filter(p => p.has_nda);
      }

      // Sort
      if (filters.sort_by === 'date') {
        filteredPitches.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return filters.sort_order === 'asc' ? dateA - dateB : dateB - dateA;
        });
      } else if (filters.sort_by === 'popularity') {
        filteredPitches.sort((a, b) => {
          return filters.sort_order === 'asc' ? a.view_count - b.view_count : b.view_count - a.view_count;
        });
      }

      // Pagination
      const startIndex = ((filters.page || 1) - 1) * (filters.limit || 20);
      const endIndex = startIndex + (filters.limit || 20);
      const paginatedResults = filteredPitches.slice(startIndex, endIndex);

      return new Response(JSON.stringify({
        success: true,
        pitches: paginatedResults,
        pagination: {
          total: filteredPitches.length,
          page: filters.page || 1,
          limit: filters.limit || 20,
          has_next: endIndex < filteredPitches.length,
          has_prev: (filters.page || 1) > 1
        },
        filters_applied: filters
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to search pitches', code: 'PITCH_SEARCH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Search Users
  private async handleSearchUsers(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      const user_type = url.searchParams.get('user_type');
      const industry = url.searchParams.get('industry');
      const location = url.searchParams.get('location');
      const verified_only = url.searchParams.get('verified_only') === 'true';
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Demo users
      const demoUsers = [
        {
          id: 1,
          username: 'alex.creator',
          display_name: 'Alex Creator',
          user_type: 'creator',
          industry: 'Film & TV',
          location: 'Los Angeles, CA',
          verified: true,
          follower_count: 1247,
          pitch_count: 12,
          bio: 'Award-winning screenwriter and director with 10+ years experience',
          avatar_url: '/api/uploads/demo/alex-avatar.jpg'
        },
        {
          id: 2,
          username: 'sarah.investor',
          display_name: 'Sarah Investor',
          user_type: 'investor',
          industry: 'Entertainment Investment',
          location: 'New York, NY',
          verified: true,
          follower_count: 2891,
          investment_count: 47,
          bio: 'Investment partner at leading entertainment fund',
          avatar_url: '/api/uploads/demo/sarah-avatar.jpg'
        }
      ];

      // Apply filters
      let filteredUsers = demoUsers;

      if (query) {
        filteredUsers = filteredUsers.filter(u => 
          u.display_name.toLowerCase().includes(query.toLowerCase()) ||
          u.username.toLowerCase().includes(query.toLowerCase()) ||
          u.bio.toLowerCase().includes(query.toLowerCase())
        );
      }

      if (user_type) {
        filteredUsers = filteredUsers.filter(u => u.user_type === user_type);
      }

      if (verified_only) {
        filteredUsers = filteredUsers.filter(u => u.verified);
      }

      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      return new Response(JSON.stringify({
        success: true,
        users: paginatedUsers,
        pagination: {
          total: filteredUsers.length,
          page: Math.floor(offset / limit) + 1,
          limit,
          has_next: offset + limit < filteredUsers.length
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to search users', code: 'USER_SEARCH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Search Companies
  private async handleSearchCompanies(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      const industry = url.searchParams.get('industry');
      const location = url.searchParams.get('location');
      const verified_only = url.searchParams.get('verified_only') === 'true';

      // Demo companies
      const demoCompanies = [
        {
          id: 1,
          name: 'Stellar Productions',
          industry: 'Film Production',
          location: 'Los Angeles, CA',
          verified: true,
          employee_count: '50-100',
          founded: 2018,
          description: 'Independent film production company specializing in genre films',
          logo_url: '/api/uploads/demo/stellar-logo.jpg',
          website: 'https://stellarproductions.com'
        },
        {
          id: 2,
          name: 'Creative Capital Fund',
          industry: 'Investment',
          location: 'New York, NY',
          verified: true,
          employee_count: '10-25',
          founded: 2015,
          description: 'Venture capital firm focused on entertainment and media investments',
          logo_url: '/api/uploads/demo/creative-capital-logo.jpg',
          website: 'https://creativecapital.fund'
        }
      ];

      // Apply filters
      let filteredCompanies = demoCompanies;

      if (query) {
        filteredCompanies = filteredCompanies.filter(c => 
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.description.toLowerCase().includes(query.toLowerCase())
        );
      }

      if (industry) {
        filteredCompanies = filteredCompanies.filter(c => c.industry === industry);
      }

      if (verified_only) {
        filteredCompanies = filteredCompanies.filter(c => c.verified);
      }

      return new Response(JSON.stringify({
        success: true,
        companies: filteredCompanies
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to search companies', code: 'COMPANY_SEARCH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Search Suggestions/Autocomplete
  private async handleSearchSuggestions(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      const type = url.searchParams.get('type') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '10');

      // Demo suggestions
      const suggestions = [
        { text: 'Cyberpunk', type: 'genre', count: 45 },
        { text: 'Thriller', type: 'genre', count: 89 },
        { text: 'Comedy', type: 'genre', count: 67 },
        { text: 'Alex Creator', type: 'user', count: 23 },
        { text: 'Stellar Productions', type: 'company', count: 12 },
        { text: 'Los Angeles', type: 'location', count: 156 },
        { text: 'Independent Film', type: 'tag', count: 78 }
      ].filter(s => 
        query === '' || s.text.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      return new Response(JSON.stringify({
        success: true,
        suggestions
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get search suggestions', code: 'SUGGESTIONS_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Trending Content
  private async handleTrendingContent(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const period = url.searchParams.get('period') || 'week';
      const type = url.searchParams.get('type') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const trendingData = {
        pitches: [
          {
            id: 1,
            title: 'Cyberpunk Noir Detective Story',
            view_count: 2847,
            view_growth: 156,
            trending_score: 0.95
          },
          {
            id: 2,
            title: 'Space Opera Epic',
            view_count: 1923,
            view_growth: 89,
            trending_score: 0.87
          }
        ],
        users: [
          {
            id: 1,
            username: 'alex.creator',
            follower_growth: 47,
            trending_score: 0.92
          }
        ],
        genres: [
          { name: 'Thriller', pitch_count: 45, growth: 12 },
          { name: 'Sci-Fi', pitch_count: 34, growth: 8 }
        ],
        tags: [
          { name: 'cyberpunk', usage_count: 89, growth: 23 },
          { name: 'independent', usage_count: 67, growth: 15 }
        ]
      };

      return new Response(JSON.stringify({
        success: true,
        trending: trendingData,
        period,
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get trending content', code: 'TRENDING_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Featured Content
  private async handleFeaturedContent(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '10');

      const featuredContent = {
        hero_pitch: {
          id: 1,
          title: 'Cyberpunk Noir Detective Story',
          description: 'A groundbreaking cyberpunk thriller that redefines the genre',
          thumbnail: '/api/uploads/demo/cyberpunk-hero.jpg',
          creator: 'Alex Creator',
          featured_until: '2024-12-31T23:59:59Z'
        },
        featured_pitches: [
          {
            id: 2,
            title: 'Space Opera Epic',
            thumbnail: '/api/uploads/demo/space-thumb.jpg',
            creator: 'Luna Starr'
          },
          {
            id: 3,
            title: 'Romantic Comedy in Paris',
            thumbnail: '/api/uploads/demo/paris-thumb.jpg',
            creator: 'Marie Dubois'
          }
        ],
        featured_creators: [
          {
            id: 1,
            username: 'alex.creator',
            display_name: 'Alex Creator',
            avatar_url: '/api/uploads/demo/alex-avatar.jpg',
            featured_reason: 'Rising Star Director'
          }
        ]
      };

      return new Response(JSON.stringify({
        success: true,
        featured: featuredContent
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get featured content', code: 'FEATURED_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Browse Content by Category
  private async handleBrowseContent(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category') || 'all';
      const sort_by = url.searchParams.get('sort_by') || 'date';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      // Demo browse categories
      const browseData = {
        categories: [
          {
            id: 'new-releases',
            name: 'New Releases',
            description: 'Latest pitches from our community',
            count: 45
          },
          {
            id: 'popular',
            name: 'Popular This Week',
            description: 'Most viewed pitches this week',
            count: 23
          },
          {
            id: 'staff-picks',
            name: 'Staff Picks',
            description: 'Curated by our editorial team',
            count: 12
          }
        ],
        content: [
          {
            id: 1,
            title: 'Cyberpunk Noir Detective Story',
            category: 'new-releases',
            view_count: 2847,
            created_at: '2024-11-01T10:00:00Z'
          },
          {
            id: 2,
            title: 'Space Opera Epic',
            category: 'popular',
            view_count: 1923,
            created_at: '2024-10-28T15:30:00Z'
          }
        ]
      };

      return new Response(JSON.stringify({
        success: true,
        browse: browseData,
        pagination: {
          page,
          limit,
          total: browseData.content.length,
          has_next: false
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to browse content', code: 'BROWSE_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Get Available Filters
  private async handleGetFilters(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const filters = {
        genres: [
          { value: 'action', label: 'Action', count: 89 },
          { value: 'comedy', label: 'Comedy', count: 67 },
          { value: 'drama', label: 'Drama', count: 123 },
          { value: 'horror', label: 'Horror', count: 45 },
          { value: 'romance', label: 'Romance', count: 78 },
          { value: 'sci-fi', label: 'Sci-Fi', count: 56 },
          { value: 'thriller', label: 'Thriller', count: 91 }
        ],
        budget_ranges: [
          { value: 'under-500k', label: 'Under $500K', count: 145 },
          { value: '500k-1m', label: '$500K - $1M', count: 89 },
          { value: '1m-5m', label: '$1M - $5M', count: 67 },
          { value: '5m-10m', label: '$5M - $10M', count: 23 },
          { value: 'over-10m', label: 'Over $10M', count: 12 }
        ],
        statuses: [
          { value: 'seeking_funding', label: 'Seeking Funding', count: 178 },
          { value: 'in_development', label: 'In Development', count: 89 },
          { value: 'pre_production', label: 'Pre-Production', count: 34 },
          { value: 'in_production', label: 'In Production', count: 12 },
          { value: 'post_production', label: 'Post-Production', count: 8 },
          { value: 'completed', label: 'Completed', count: 23 }
        ],
        user_types: [
          { value: 'creator', label: 'Creator', count: 234 },
          { value: 'investor', label: 'Investor', count: 89 },
          { value: 'production', label: 'Production Company', count: 45 }
        ],
        locations: [
          { value: 'los-angeles', label: 'Los Angeles, CA', count: 156 },
          { value: 'new-york', label: 'New York, NY', count: 98 },
          { value: 'london', label: 'London, UK', count: 67 },
          { value: 'toronto', label: 'Toronto, ON', count: 45 },
          { value: 'other', label: 'Other', count: 234 }
        ]
      };

      return new Response(JSON.stringify({
        success: true,
        filters
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get filters', code: 'FILTERS_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Get Genres
  private async handleGetGenres(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const genres = [
        { id: 1, name: 'Action', slug: 'action', pitch_count: 89, trending: true },
        { id: 2, name: 'Comedy', slug: 'comedy', pitch_count: 67, trending: false },
        { id: 3, name: 'Drama', slug: 'drama', pitch_count: 123, trending: false },
        { id: 4, name: 'Horror', slug: 'horror', pitch_count: 45, trending: true },
        { id: 5, name: 'Romance', slug: 'romance', pitch_count: 78, trending: false },
        { id: 6, name: 'Sci-Fi', slug: 'sci-fi', pitch_count: 56, trending: true },
        { id: 7, name: 'Thriller', slug: 'thriller', pitch_count: 91, trending: false }
      ];

      return new Response(JSON.stringify({
        success: true,
        genres
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get genres', code: 'GENRES_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Search Tags
  private async handleSearchTags(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const demoTags = [
        { name: 'cyberpunk', usage_count: 89, trending: true },
        { name: 'independent', usage_count: 67, trending: false },
        { name: 'low-budget', usage_count: 156, trending: true },
        { name: 'award-winning', usage_count: 34, trending: false },
        { name: 'debut-feature', usage_count: 78, trending: true }
      ].filter(tag => 
        query === '' || tag.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      return new Response(JSON.stringify({
        success: true,
        tags: demoTags
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to search tags', code: 'TAGS_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Similar Content
  private async handleSimilarContent(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload, contentId: number): Promise<Response> {
    try {
      const url = new URL(request.url);
      const type = url.searchParams.get('type') || 'pitch';
      const limit = parseInt(url.searchParams.get('limit') || '10');

      // Demo similar content based on contentId
      const similarContent = [
        {
          id: 2,
          title: 'Neo-Tokyo Nights',
          similarity_score: 0.87,
          reason: 'Similar genre and setting'
        },
        {
          id: 3,
          title: 'Future Cop Chronicles',
          similarity_score: 0.82,
          reason: 'Similar themes and tone'
        },
        {
          id: 4,
          title: 'Digital Dreams',
          similarity_score: 0.79,
          reason: 'Similar visual style'
        }
      ].filter(item => item.id !== contentId).slice(0, limit);

      return new Response(JSON.stringify({
        success: true,
        similar_content: similarContent,
        content_id: contentId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get similar content', code: 'SIMILAR_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Personalized Recommendations
  private async handleRecommendations(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      if (!userAuth) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Authentication required for recommendations', code: 'AUTH_REQUIRED' } 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const url = new URL(request.url);
      const type = url.searchParams.get('type') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '20');

      // Demo personalized recommendations
      const recommendations = {
        for_you: [
          {
            id: 1,
            title: 'Cyberpunk Thriller Sequel',
            reason: 'Based on your recent views',
            score: 0.95
          },
          {
            id: 2,
            title: 'Independent Sci-Fi Drama',
            reason: 'Similar to pitches you liked',
            score: 0.87
          }
        ],
        trending_for_you: [
          {
            id: 3,
            title: 'Space Opera Epic',
            reason: 'Popular in your network',
            score: 0.82
          }
        ],
        new_from_following: [
          {
            id: 4,
            title: 'Latest from Alex Creator',
            reason: 'From creators you follow',
            score: 0.91
          }
        ]
      };

      return new Response(JSON.stringify({
        success: true,
        recommendations,
        user_id: userAuth.userId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get recommendations', code: 'RECOMMENDATIONS_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Get Saved Searches
  private async handleGetSavedSearches(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      // Demo saved searches
      const savedSearches = [
        {
          id: 1,
          name: 'Cyberpunk Thrillers',
          query: 'cyberpunk',
          filters: { genre: 'thriller', budget_range: '1m-5m' },
          created_at: '2024-10-15T10:00:00Z',
          last_run: '2024-11-01T15:30:00Z',
          result_count: 23,
          new_results: 3
        },
        {
          id: 2,
          name: 'LA-based Creators',
          query: '',
          filters: { user_type: 'creator', location: 'los-angeles' },
          created_at: '2024-10-20T14:20:00Z',
          last_run: '2024-10-28T09:15:00Z',
          result_count: 156,
          new_results: 12
        }
      ];

      return new Response(JSON.stringify({
        success: true,
        saved_searches: savedSearches
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get saved searches', code: 'SAVED_SEARCHES_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Save Search
  private async handleSaveSearch(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as {
        name: string;
        query: string;
        filters: SearchFilters;
        notify_new_results?: boolean;
      };

      if (!body.name?.trim()) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Search name is required', code: 'VALIDATION_ERROR' } 
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Demo response
      const savedSearch = {
        id: Math.floor(Math.random() * 1000) + 100,
        name: body.name,
        query: body.query,
        filters: body.filters,
        notify_new_results: body.notify_new_results || false,
        created_at: new Date().toISOString(),
        user_id: userAuth.userId
      };

      return new Response(JSON.stringify({
        success: true,
        saved_search: savedSearch
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to save search', code: 'SAVE_SEARCH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Delete Saved Search
  private async handleDeleteSavedSearch(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, searchId: number): Promise<Response> {
    try {
      // Demo validation
      if (searchId <= 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Saved search not found', code: 'NOT_FOUND' } 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Saved search deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to delete saved search', code: 'DELETE_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Search History
  private async handleSearchHistory(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');

      // Demo search history
      const searchHistory = [
        {
          id: 1,
          query: 'cyberpunk thriller',
          filters: { genre: 'thriller' },
          timestamp: '2024-11-01T15:30:00Z',
          result_count: 23
        },
        {
          id: 2,
          query: 'alex creator',
          filters: { type: 'user' },
          timestamp: '2024-11-01T14:20:00Z',
          result_count: 1
        },
        {
          id: 3,
          query: 'sci-fi',
          filters: { genre: 'sci-fi', budget_range: 'under-500k' },
          timestamp: '2024-10-31T16:45:00Z',
          result_count: 34
        }
      ].slice(0, limit);

      return new Response(JSON.stringify({
        success: true,
        search_history: searchHistory
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get search history', code: 'HISTORY_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Track Search
  private async handleTrackSearch(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as {
        query: string;
        filters?: SearchFilters;
        result_count: number;
        clicked_result_id?: number;
      };

      // Demo tracking (would save to analytics database)
      const trackingId = `search_${Date.now()}_${userAuth.userId}`;

      await this.logger.captureMessage('Search tracked', {
        level: 'info',
        extra: {
          user_id: userAuth.userId,
          query: body.query,
          filters: body.filters,
          result_count: body.result_count,
          tracking_id: trackingId
        }
      });

      return new Response(JSON.stringify({
        success: true,
        tracking_id: trackingId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to track search', code: 'TRACKING_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Search Statistics
  private async handleSearchStats(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const stats: SearchStats = {
        total_results: 1247,
        pitch_results: 856,
        user_results: 234,
        company_results: 157,
        search_time_ms: 142,
        popular_searches: [
          { query: 'cyberpunk', count: 89 },
          { query: 'thriller', count: 67 },
          { query: 'independent', count: 45 },
          { query: 'sci-fi', count: 34 },
          { query: 'comedy', count: 28 }
        ],
        trending_genres: [
          { genre: 'Thriller', count: 91 },
          { genre: 'Sci-Fi', count: 56 },
          { genre: 'Action', count: 89 },
          { genre: 'Drama', count: 123 },
          { genre: 'Horror', count: 45 }
        ]
      };

      return new Response(JSON.stringify({
        success: true,
        stats
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get search stats', code: 'STATS_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Autocomplete
  private async handleAutocomplete(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      const type = url.searchParams.get('type') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '10');

      if (query.length < 2) {
        return new Response(JSON.stringify({
          success: true,
          suggestions: []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Demo autocomplete suggestions
      const suggestions = [
        { text: 'Cyberpunk thriller', type: 'query', count: 45 },
        { text: 'Cyberpunk 2077', type: 'query', count: 23 },
        { text: 'Alex Creator', type: 'user', count: 1 },
        { text: 'Thriller', type: 'genre', count: 91 },
        { text: 'Stellar Productions', type: 'company', count: 1 }
      ].filter(s => 
        s.text.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      return new Response(JSON.stringify({
        success: true,
        suggestions,
        query
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get autocomplete suggestions', code: 'AUTOCOMPLETE_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Advanced Search with complex filters
  private async handleAdvancedSearch(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const filters: SearchFilters = {
        query: url.searchParams.get('query') || '',
        type: url.searchParams.get('type') as any,
        genre: url.searchParams.get('genre') || undefined,
        budget_range: url.searchParams.get('budget_range') || undefined,
        status: url.searchParams.get('status') || undefined,
        user_type: url.searchParams.get('user_type') || undefined,
        industry: url.searchParams.get('industry') || undefined,
        location: url.searchParams.get('location') || undefined,
        date_from: url.searchParams.get('date_from') || undefined,
        date_to: url.searchParams.get('date_to') || undefined,
        featured_only: url.searchParams.get('featured_only') === 'true',
        verified_only: url.searchParams.get('verified_only') === 'true',
        has_nda: url.searchParams.get('has_nda') === 'true',
        investment_range: url.searchParams.get('investment_range') || undefined,
        sort_by: url.searchParams.get('sort_by') as any || 'relevance',
        sort_order: url.searchParams.get('sort_order') as any || 'desc',
        page: parseInt(url.searchParams.get('page') || '1'),
        limit: parseInt(url.searchParams.get('limit') || '20')
      };

      // Demo advanced search results
      const results = {
        pitches: [
          {
            id: 1,
            title: 'Cyberpunk Noir Detective Story',
            description: 'A futuristic detective thriller',
            genre: 'Thriller',
            budget_range: '$1M-$5M',
            status: 'seeking_funding',
            creator: 'Alex Creator',
            view_count: 2847,
            relevance_score: 0.95,
            matches: ['title', 'genre', 'budget_range']
          }
        ],
        users: [
          {
            id: 1,
            username: 'alex.creator',
            display_name: 'Alex Creator',
            user_type: 'creator',
            verified: true,
            relevance_score: 0.87,
            matches: ['display_name', 'user_type']
          }
        ],
        companies: [
          {
            id: 1,
            name: 'Stellar Productions',
            industry: 'Film Production',
            verified: true,
            relevance_score: 0.82,
            matches: ['industry']
          }
        ],
        total_results: 3,
        search_metadata: {
          filters_applied: Object.keys(filters).filter(key => 
            filters[key as keyof SearchFilters] !== undefined && 
            filters[key as keyof SearchFilters] !== '' && 
            filters[key as keyof SearchFilters] !== false
          ).length,
          search_time_ms: 156,
          query_complexity: 'medium'
        }
      };

      return new Response(JSON.stringify({
        success: true,
        results,
        filters: filters,
        pagination: {
          page: filters.page || 1,
          limit: filters.limit || 20,
          total: results.total_results,
          has_next: false,
          has_prev: false
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to perform advanced search', code: 'ADVANCED_SEARCH_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Bulk Filter Operation
  private async handleBulkFilter(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as {
        ids: number[];
        filters: SearchFilters;
        operation: 'include' | 'exclude';
      };

      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Valid item IDs are required', code: 'VALIDATION_ERROR' } 
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Demo bulk filter results
      const filteredResults = body.ids.map(id => ({
        id,
        included: body.operation === 'include',
        reason: body.operation === 'include' ? 'Matches filter criteria' : 'Excluded by filter criteria'
      }));

      return new Response(JSON.stringify({
        success: true,
        filtered_results: filteredResults,
        operation: body.operation,
        processed_count: body.ids.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureException(error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to perform bulk filter operation', code: 'BULK_FILTER_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
}