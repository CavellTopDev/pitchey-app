/**
 * Browse and Search Endpoints
 * Handles public content browsing, trending pitches, and search functionality
 */

import { pitches, users } from '../../db/schema';
import { eq, desc, sql, and, like, or, count } from 'drizzle-orm';

export class BrowseEndpoints {
  private cache: any;

  constructor(cache: any) {
    this.cache = cache;
  }

  /**
   * Handle browse and search requests
   */
  async handleBrowseRequest(
    request: Request,
    pathname: string,
    auth: any,
    sqlConnection: any
  ): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;

    // Unified browse endpoint with tab support
    if (pathname === '/api/browse' && method === 'GET') {
      return this.handleBrowseWithTabs(url.searchParams, sqlConnection);
    }

    // Trending pitches
    if (pathname === '/api/browse/trending' && method === 'GET') {
      return this.getTrending(sqlConnection);
    }

    // Featured pitches
    if (pathname === '/api/browse/featured' && method === 'GET') {
      return this.getFeatured(sqlConnection);
    }

    // New releases
    if (pathname === '/api/browse/new-releases' && method === 'GET') {
      return this.getNewReleases(sqlConnection);
    }

    // Search pitches
    if (pathname === '/api/search/pitches' && method === 'GET') {
      return this.searchPitches(url.searchParams, sqlConnection);
    }

    // Get all pitches (with filters)
    if (pathname === '/api/pitches' && method === 'GET') {
      return this.getPitches(url.searchParams, sqlConnection);
    }

    // Legacy endpoints for frontend compatibility (must come before generic pitch handler)
    if (pathname === '/api/pitches/trending' && method === 'GET') {
      return this.getTrending(sqlConnection);
    }

    if (pathname === '/api/pitches/new' && method === 'GET') {
      return this.getNewReleases(sqlConnection);
    }

    if (pathname === '/api/pitches/public' && method === 'GET') {
      return this.getPitches(url.searchParams, sqlConnection);
    }

    // Get specific pitch (must come after specific endpoints)
    if (pathname.startsWith('/api/pitches/') && method === 'GET') {
      const pitchId = pathname.split('/').pop();
      return this.getPitchById(pitchId, auth, sqlConnection);
    }

    // Debug database connection
    if (pathname === '/api/debug/db' && method === 'GET') {
      return this.debugDatabase(sqlConnection);
    }
    
    // Simple test endpoint
    if (pathname === '/api/debug/simple' && method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Simple endpoint working',
        sqlConnection: sqlConnection ? 'exists' : 'null'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Search users
    if (pathname === '/api/search/users' && method === 'GET') {
      return this.searchUsers(url.searchParams, sqlConnection);
    }

    return null;
  }

  /**
   * Handle browse with tabs (Trending, New, Popular)
   */
  private async handleBrowseWithTabs(params: URLSearchParams, sqlConnection: any): Promise<Response> {
    try {
      const tab = params.get('tab') || 'trending';
      const genre = params.get('genre');
      const format = params.get('format');
      const budgetRange = params.get('budgetRange');
      const riskLevel = params.get('riskLevel');
      const productionStage = params.get('productionStage');
      const limit = parseInt(params.get('limit') || '24');
      const page = parseInt(params.get('page') || '1');
      const offset = (page - 1) * limit;

      // Base query for all tabs
      let query = sqlConnection
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          formatCategory: pitches.formatCategory,
          formatSubtype: pitches.formatSubtype,
          budget: pitches.budgetBracket,
          viewCount: pitches.viewCount,
          likeCount: pitches.likeCount,
          ndaCount: pitches.ndaCount,
          createdAt: pitches.createdAt,
          status: pitches.status,
          expectedROI: pitches.expectedROI,
          productionStage: pitches.productionStage,
          attachedTalent: pitches.attachedTalent,
          investmentTarget: pitches.investmentTarget,
          riskLevel: pitches.riskLevel,
          similarProjects: pitches.similarProjects,
          creator: users.username,
          creatorId: users.id,
          creatorType: users.userType,
          companyName: users.companyName
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(
          or(eq(pitches.status, 'published'), eq(pitches.status, 'active')),
          eq(pitches.visibility, 'public')
        ));

      // Apply filters
      const conditions = [];
      if (genre) conditions.push(eq(pitches.genre, genre));
      if (format) conditions.push(eq(pitches.format, format));
      if (riskLevel) conditions.push(eq(pitches.riskLevel, riskLevel));
      if (productionStage) conditions.push(eq(pitches.productionStage, productionStage));
      
      // Budget range filter
      if (budgetRange) {
        switch (budgetRange) {
          case 'under-5m':
            conditions.push(sql`CAST(REGEXP_REPLACE(${pitches.budgetBracket}, '[^0-9]', '', 'g') AS INTEGER) < 5000000`);
            break;
          case '5m-15m':
            conditions.push(sql`CAST(REGEXP_REPLACE(${pitches.budgetBracket}, '[^0-9]', '', 'g') AS INTEGER) BETWEEN 5000000 AND 15000000`);
            break;
          case '15m-50m':
            conditions.push(sql`CAST(REGEXP_REPLACE(${pitches.budgetBracket}, '[^0-9]', '', 'g') AS INTEGER) BETWEEN 15000001 AND 50000000`);
            break;
          case 'over-50m':
            conditions.push(sql`CAST(REGEXP_REPLACE(${pitches.budgetBracket}, '[^0-9]', '', 'g') AS INTEGER) > 50000000`);
            break;
        }
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Apply sorting based on tab
      switch (tab) {
        case 'trending':
          // Trending: Sort by a combination of views, likes, and recency
          query = query.orderBy(
            desc(sql`${pitches.viewCount} * 0.5 + ${pitches.likeCount} * 2 + 
                    EXTRACT(EPOCH FROM (NOW() - ${pitches.createdAt})) / -86400`)
          );
          break;
        case 'new':
          // New: Sort by creation date (newest first)
          query = query.orderBy(desc(pitches.createdAt));
          break;
        case 'popular':
          // Popular: Sort by view count
          query = query.orderBy(desc(pitches.viewCount));
          break;
        default:
          // Default to newest
          query = query.orderBy(desc(pitches.createdAt));
          break;
      }

      query = query.limit(limit).offset(offset);
      const results = await query;

      // Format the response
      const formattedResults = results.map(pitch => ({
        id: pitch.id,
        title: pitch.title,
        logline: pitch.logline,
        genre: pitch.genre,
        format: pitch.format,
        formatCategory: pitch.formatCategory,
        formatSubtype: pitch.formatSubtype,
        budget: pitch.budget || '$0',
        viewCount: pitch.viewCount || 0,
        likeCount: pitch.likeCount || 0,
        ndaCount: pitch.ndaCount || 0,
        createdAt: pitch.createdAt?.toISOString(),
        status: pitch.status,
        expectedROI: pitch.expectedROI || '10-20%',
        productionStage: pitch.productionStage || 'Development',
        attachedTalent: pitch.attachedTalent ? 
          (typeof pitch.attachedTalent === 'string' ? 
            pitch.attachedTalent.split(',').map(t => t.trim()) : 
            pitch.attachedTalent) : [],
        investmentTarget: pitch.investmentTarget || '$1M - $5M',
        riskLevel: pitch.riskLevel || 'medium',
        similarProjects: pitch.similarProjects ? 
          (typeof pitch.similarProjects === 'string' ? 
            pitch.similarProjects.split(',').map(p => p.trim()) : 
            pitch.similarProjects) : [],
        creator: {
          id: pitch.creatorId,
          username: pitch.creator,
          userType: pitch.creatorType,
          companyName: pitch.companyName
        }
      }));

      return new Response(JSON.stringify({
        success: true,
        items: formattedResults,
        tab: tab,
        message: `Found ${formattedResults.length} ${tab} pitches`,
        pagination: {
          page,
          limit,
          hasMore: formattedResults.length === limit
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Browse with tabs error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load pitches', code: 'BROWSE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get trending pitches
   */
  private async getTrending(sqlConnection: any): Promise<Response> {
    try {
      const trending = await this.cache.get('trending-pitches', async () => {
        const trendingPitches = await sqlConnection
          .select({
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
            genre: pitches.genre,
            format: pitches.format,
            viewCount: pitches.viewCount,
            likeCount: pitches.likeCount,
            posterUrl: pitches.posterUrl,
            createdAt: pitches.createdAt,
            creator: users.username,
            creatorId: users.id
          })
          .from(pitches)
          .leftJoin(users, eq(pitches.userId, users.id))
          .where(and(
            or(eq(pitches.status, 'published'), eq(pitches.status, 'active')),
            eq(pitches.visibility, 'public')
          ))
          .orderBy(desc(pitches.viewCount))
          .limit(12);

        return trendingPitches.map(pitch => ({
          id: pitch.id,
          title: pitch.title,
          logline: pitch.logline,
          genre: pitch.genre,
          format: pitch.format,
          viewCount: pitch.viewCount,
          likeCount: pitch.likeCount,
          posterUrl: pitch.posterUrl,
          createdAt: pitch.createdAt?.toISOString(),
          creator: {
            id: pitch.creatorId,
            username: pitch.creator
          }
        }));
      }, 'static');

      return new Response(JSON.stringify({
        success: true,
        items: trending,
        message: `Found ${trending.length} trending pitches`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Trending error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load trending pitches', code: 'TRENDING_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get featured pitches
   */
  private async getFeatured(sqlConnection: any): Promise<Response> {
    try {
      const featured = await this.cache.get('featured-pitches', async () => {
        const featuredPitches = await sqlConnection
          .select({
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
            genre: pitches.genre,
            format: pitches.format,
            viewCount: pitches.viewCount,
            posterUrl: pitches.posterUrl,
            createdAt: pitches.createdAt,
            creator: users.username,
            creatorId: users.id
          })
          .from(pitches)
          .leftJoin(users, eq(pitches.userId, users.id))
          .where(and(
            or(eq(pitches.status, 'published'), eq(pitches.status, 'active')),
            eq(pitches.visibility, 'public')
          ))
          .orderBy(desc(pitches.likeCount))
          .limit(8);

        return featuredPitches.map(pitch => ({
          id: pitch.id,
          title: pitch.title,
          logline: pitch.logline,
          genre: pitch.genre,
          format: pitch.format,
          viewCount: pitch.viewCount,
          posterUrl: pitch.posterUrl,
          createdAt: pitch.createdAt?.toISOString(),
          creator: {
            id: pitch.creatorId,
            username: pitch.creator
          }
        }));
      }, 'static');

      return new Response(JSON.stringify({
        success: true,
        items: featured,
        message: `Found ${featured.length} featured pitches`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Featured error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load featured pitches', code: 'FEATURED_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get new releases
   */
  private async getNewReleases(sqlConnection: any): Promise<Response> {
    try {
      const newReleases = await sqlConnection
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          viewCount: pitches.viewCount,
          posterUrl: pitches.posterUrl,
          createdAt: pitches.createdAt,
          creator: users.username,
          creatorId: users.id
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(
          eq(pitches.status, 'published'),
          eq(pitches.visibility, 'public')
        ))
        .orderBy(desc(pitches.createdAt))
        .limit(10);

      const formattedReleases = newReleases.map(pitch => ({
        id: pitch.id,
        title: pitch.title,
        logline: pitch.logline,
        genre: pitch.genre,
        format: pitch.format,
        viewCount: pitch.viewCount,
        posterUrl: pitch.posterUrl,
        createdAt: pitch.createdAt?.toISOString(),
        creator: {
          id: pitch.creatorId,
          username: pitch.creator
        }
      }));

      return new Response(JSON.stringify({
        success: true,
        items: formattedReleases,
        message: `Found ${formattedReleases.length} new releases`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('New releases error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load new releases', code: 'NEW_RELEASES_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Search pitches
   */
  private async searchPitches(params: URLSearchParams, sqlConnection: any): Promise<Response> {
    try {
      const query = params.get('q') || '';
      const genre = params.get('genre');
      const format = params.get('format');
      const sortBy = params.get('sort') || 'relevance';
      const limit = parseInt(params.get('limit') || '20');
      const offset = parseInt(params.get('offset') || '0');

      let searchQuery = sqlConnection
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          viewCount: pitches.viewCount,
          posterUrl: pitches.posterUrl,
          createdAt: pitches.createdAt,
          creator: users.username,
          creatorId: users.id
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(
          eq(pitches.status, 'published'),
          eq(pitches.visibility, 'public')
        ));

      // Apply search filters
      if (query) {
        searchQuery = searchQuery.where(
          or(
            like(pitches.title, `%${query}%`),
            like(pitches.logline, `%${query}%`),
            like(pitches.description, `%${query}%`)
          )
        );
      }

      if (genre) {
        searchQuery = searchQuery.where(eq(pitches.genre, genre));
      }

      if (format) {
        searchQuery = searchQuery.where(eq(pitches.format, format));
      }

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          searchQuery = searchQuery.orderBy(desc(pitches.createdAt));
          break;
        case 'popular':
          searchQuery = searchQuery.orderBy(desc(pitches.viewCount));
          break;
        case 'relevance':
        default:
          searchQuery = searchQuery.orderBy(desc(pitches.viewCount));
          break;
      }

      searchQuery = searchQuery.limit(limit).offset(offset);

      const results = await searchQuery;

      // Get total count for pagination
      let countQuery = sqlConnection
        .select({ count: count() })
        .from(pitches)
        .where(and(
          eq(pitches.status, 'published'),
          eq(pitches.visibility, 'public')
        ));

      if (query) {
        countQuery = countQuery.where(
          or(
            like(pitches.title, `%${query}%`),
            like(pitches.logline, `%${query}%`),
            like(pitches.description, `%${query}%`)
          )
        );
      }

      if (genre) {
        countQuery = countQuery.where(eq(pitches.genre, genre));
      }

      if (format) {
        countQuery = countQuery.where(eq(pitches.format, format));
      }

      const totalResult = await countQuery;

      return new Response(JSON.stringify({
        success: true,
        data: {
          pitches: results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt?.toISOString(),
            creator: {
              id: pitch.creatorId,
              username: pitch.creator
            }
          })),
          pagination: {
            total: totalResult[0]?.count || 0,
            limit,
            offset,
            hasMore: (offset + limit) < (totalResult[0]?.count || 0)
          }
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Search error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Search failed', code: 'SEARCH_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get pitches with filters
   */
  private async getPitches(params: URLSearchParams, sqlConnection: any): Promise<Response> {
    try {
      const genre = params.get('genre');
      const format = params.get('format');
      const sortBy = params.get('sort') || 'newest';
      const limit = parseInt(params.get('limit') || '20');
      const offset = parseInt(params.get('offset') || '0');

      let query = sqlConnection
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          viewCount: pitches.viewCount,
          posterUrl: pitches.posterUrl,
          createdAt: pitches.createdAt,
          creator: users.username,
          creatorId: users.id
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(
          eq(pitches.status, 'published'),
          eq(pitches.visibility, 'public')
        ));

      // Apply filters
      if (genre) {
        query = query.where(eq(pitches.genre, genre));
      }

      if (format) {
        query = query.where(eq(pitches.format, format));
      }

      // Apply sorting
      switch (sortBy) {
        case 'popular':
          query = query.orderBy(desc(pitches.viewCount));
          break;
        case 'newest':
        default:
          query = query.orderBy(desc(pitches.createdAt));
          break;
      }

      query = query.limit(limit).offset(offset);

      const results = await query;

      return new Response(JSON.stringify({
        success: true,
        data: {
          pitches: results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt?.toISOString(),
            creator: {
              id: pitch.creatorId,
              username: pitch.creator
            }
          }))
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get pitches error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load pitches', code: 'PITCHES_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get pitch by ID
   */
  private async getPitchById(pitchId: string | undefined, auth: any, sqlConnection: any): Promise<Response> {
    try {
      if (!pitchId || isNaN(parseInt(pitchId))) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Invalid pitch ID', code: 'INVALID_ID' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const pitch = await sqlConnection
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          shortSynopsis: pitches.shortSynopsis,
          longSynopsis: pitches.longSynopsis,
          genre: pitches.genre,
          format: pitches.format,
          targetAudience: pitches.targetAudience,
          themes: pitches.themes,
          characters: pitches.characters,
          budgetBracket: pitches.budgetBracket,
          viewCount: pitches.viewCount,
          likeCount: pitches.likeCount,
          posterUrl: pitches.posterUrl,
          videoUrl: pitches.videoUrl,
          requireNda: pitches.requireNda,
          seekingInvestment: pitches.seekingInvestment,
          createdAt: pitches.createdAt,
          creator: users.username,
          creatorId: users.id,
          creatorAvatar: users.profileImageUrl
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(
          eq(pitches.id, parseInt(pitchId)),
          eq(pitches.status, 'active')
        ))
        .limit(1);

      if (pitch.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Pitch not found', code: 'NOT_FOUND' }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const pitchData = pitch[0];

      // Increment view count if user is authenticated
      if (auth && auth.userId !== pitchData.creatorId?.toString()) {
        await sqlConnection
          .update(pitches)
          .set({ viewCount: sql`${pitches.viewCount} + 1` })
          .where(eq(pitches.id, parseInt(pitchId)));
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          pitch: {
            id: pitchData.id,
            title: pitchData.title,
            logline: pitchData.logline,
            shortSynopsis: pitchData.shortSynopsis,
            longSynopsis: pitchData.longSynopsis,
            genre: pitchData.genre,
            format: pitchData.format,
            targetAudience: pitchData.targetAudience,
            themes: pitchData.themes,
            characters: pitchData.characters ? JSON.parse(pitchData.characters) : [],
            budgetBracket: pitchData.budgetBracket,
            viewCount: pitchData.viewCount + (auth ? 1 : 0),
            likeCount: pitchData.likeCount,
            posterUrl: pitchData.posterUrl,
            videoUrl: pitchData.videoUrl,
            requireNda: pitchData.requireNda,
            seekingInvestment: pitchData.seekingInvestment,
            createdAt: pitchData.createdAt?.toISOString(),
            creator: {
              id: pitchData.creatorId,
              username: pitchData.creator,
              avatar: pitchData.creatorAvatar
            }
          }
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get pitch error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load pitch', code: 'PITCH_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Search users
   */
  private async searchUsers(params: URLSearchParams, sqlConnection: any): Promise<Response> {
    try {
      const query = params.get('q') || '';
      const userType = params.get('type');
      const limit = parseInt(params.get('limit') || '20');

      if (!query) {
        return new Response(JSON.stringify({
          success: true,
          data: { users: [] }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let searchQuery = sqlConnection
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          userType: users.userType,
          bio: users.bio,
          profileImageUrl: users.profileImageUrl,
          companyName: users.companyName
        })
        .from(users)
        .where(and(
          eq(users.isActive, true),
          or(
            like(users.username, `%${query}%`),
            like(users.firstName, `%${query}%`),
            like(users.lastName, `%${query}%`),
            like(users.companyName, `%${query}%`)
          )
        ));

      if (userType) {
        searchQuery = searchQuery.where(eq(users.userType, userType));
      }

      searchQuery = searchQuery.limit(limit);

      const results = await searchQuery;

      return new Response(JSON.stringify({
        success: true,
        data: {
          users: results.map(user => ({
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            userType: user.userType,
            bio: user.bio,
            profileImageUrl: user.profileImageUrl,
            companyName: user.companyName
          }))
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('User search error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'User search failed', code: 'USER_SEARCH_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Debug database connection
   */
  private async debugDatabase(sqlConnection: any): Promise<Response> {
    try {
      // Test very basic raw query first
      let result;
      try {
        result = await sqlConnection.execute(sql`SELECT 1 as test`);
        console.log('Basic test result:', result);
      } catch (err) {
        console.error('Basic test failed:', err);
        return new Response(JSON.stringify({
          success: false,
          error: { 
            message: 'Basic SQL test failed', 
            details: err.message,
            step: 'basic_test'
          }
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Try simple table check
      let tableTest;
      try {
        tableTest = await sqlConnection.execute(sql`SELECT COUNT(*) as count FROM pitches`);
        console.log('Table test result:', tableTest);
      } catch (err) {
        console.error('Table test failed:', err);
        return new Response(JSON.stringify({
          success: false,
          error: { 
            message: 'Table access failed', 
            details: err.message,
            step: 'table_test'
          }
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        debug: {
          basicTest: result[0] || 'no result',
          pitchCount: tableTest[0]?.count || 'no count'
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Database debug error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { 
          message: 'Database connection failed', 
          details: error.message,
          code: 'DB_DEBUG_ERROR' 
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}