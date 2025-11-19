/**
 * Creator Endpoints Module
 * Handles creator-specific functionality including pitch management, portfolio, analytics
 */

import { AuthPayload } from '../../shared/auth-utils';
import { CachingService } from '../../caching-strategy';
import { eq, and, desc, asc, count, sql as drizzleSql } from 'drizzle-orm';
import { users, pitches, follows, investments, ndas } from '../../db/schema';

export class CreatorEndpoints {
  private cache: CachingService;

  constructor(cache: CachingService) {
    this.cache = cache;
  }

  /**
   * Handle creator-specific requests
   */
  async handleCreatorRequest(request: Request, pathname: string, auth: AuthPayload, sql: any): Promise<Response | null> {
    const method = request.method;
    const url = new URL(request.url);

    try {
      // Creator Dashboard
      if (pathname === '/api/creator/dashboard' && method === 'GET') {
        return this.getDashboard(auth, sql);
      }

      // My Pitches - Creator's own pitches
      if (pathname === '/api/creator/pitches' && method === 'GET') {
        return this.getMyPitches(auth, url.searchParams, sql);
      }

      // Create new pitch
      if (pathname === '/api/creator/pitches' && method === 'POST') {
        return this.createPitch(request, auth, sql);
      }

      // Update specific pitch
      if (pathname.startsWith('/api/creator/pitches/') && method === 'PUT') {
        const pitchId = pathname.split('/')[4];
        return this.updatePitch(request, auth, pitchId, sql);
      }

      // Delete specific pitch
      if (pathname.startsWith('/api/creator/pitches/') && method === 'DELETE') {
        const pitchId = pathname.split('/')[4];
        return this.deletePitch(auth, pitchId, sql);
      }

      // Creator Analytics
      if (pathname === '/api/creator/analytics' && method === 'GET') {
        return this.getAnalytics(auth, url.searchParams, sql);
      }

      // Collaboration Requests
      if (pathname === '/api/creator/collaborations' && method === 'GET') {
        return this.getCollaborations(auth, sql);
      }

      // Followers Management  
      if (pathname === '/api/creator/followers' && method === 'GET') {
        return this.getFollowers(auth, url.searchParams, sql);
      }

      return null; // Endpoint not handled by creator service

    } catch (error) {
      console.error('Creator endpoints error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Creator service error', code: 'CREATOR_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get creator dashboard data
   */
  private async getDashboard(auth: AuthPayload, sql: any): Promise<Response> {
    const userId = auth.userId;
    const cacheKey = `creator:dashboard:${userId}`;

    const dashboardData = await this.cache.get(cacheKey, async () => {
      // Get creator stats
      const stats = await this.getCreatorStats(userId, sql);
      
      // Get recent activity
      const recentActivity = await this.getRecentActivity(userId, sql);
      
      // Get pitch performance
      const pitchPerformance = await this.getPitchPerformance(userId, sql);

      return {
        stats,
        recentActivity,
        pitchPerformance,
        timestamp: new Date().toISOString()
      };
    }, 'dashboard', 300); // 5-minute cache

    return new Response(JSON.stringify({
      success: true,
      data: dashboardData
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get creator statistics
   */
  private async getCreatorStats(userId: string, sql: any) {
    // Total pitches count
    const pitchesResult = await sql.select({ count: count() })
      .from(pitches)
      .where(eq(pitches.creatorId, userId));

    // Total followers count
    const followersResult = await sql.select({ count: count() })
      .from(follows)
      .where(eq(follows.followingId, userId));

    // Total views across all pitches
    const viewsResult = await sql.select({ 
      totalViews: drizzleSql`SUM(${pitches.viewCount})` 
    })
      .from(pitches)
      .where(eq(pitches.creatorId, userId));

    // Total funding received
    const fundingResult = await sql.select({ 
      totalFunding: drizzleSql`SUM(${investments.amount})` 
    })
      .from(investments)
      .innerJoin(pitches, eq(pitches.id, investments.pitchId))
      .where(eq(pitches.creatorId, userId));

    return {
      totalPitches: pitchesResult[0]?.count || 0,
      totalFollowers: followersResult[0]?.count || 0,
      totalViews: parseInt(viewsResult[0]?.totalViews) || 0,
      totalFunding: parseFloat(fundingResult[0]?.totalFunding) || 0
    };
  }

  /**
   * Get recent activity for creator
   */
  private async getRecentActivity(userId: string, sql: any) {
    // Recent follows
    const recentFollows = await sql.select({
      id: follows.id,
      followerName: users.name,
      followerAvatar: users.avatar,
      createdAt: follows.createdAt
    })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followerId))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(5);

    // Recent investments  
    const recentInvestments = await sql.select({
      id: investments.id,
      amount: investments.amount,
      investorName: users.name,
      pitchTitle: pitches.title,
      createdAt: investments.createdAt
    })
      .from(investments)
      .innerJoin(pitches, eq(pitches.id, investments.pitchId))
      .innerJoin(users, eq(users.id, investments.investorId))
      .where(eq(pitches.creatorId, userId))
      .orderBy(desc(investments.createdAt))
      .limit(5);

    return {
      recentFollows: recentFollows.map(follow => ({
        ...follow,
        type: 'follow'
      })),
      recentInvestments: recentInvestments.map(investment => ({
        ...investment,
        type: 'investment'
      }))
    };
  }

  /**
   * Get pitch performance metrics
   */
  private async getPitchPerformance(userId: string, sql: any) {
    const pitchStats = await sql.select({
      id: pitches.id,
      title: pitches.title,
      viewCount: pitches.viewCount,
      status: pitches.status,
      createdAt: pitches.createdAt,
      investmentCount: drizzleSql`COUNT(DISTINCT ${investments.id})`.as('investmentCount'),
      totalFunding: drizzleSql`COALESCE(SUM(${investments.amount}), 0)`.as('totalFunding')
    })
      .from(pitches)
      .leftJoin(investments, eq(pitches.id, investments.pitchId))
      .where(eq(pitches.creatorId, userId))
      .groupBy(pitches.id, pitches.title, pitches.viewCount, pitches.status, pitches.createdAt)
      .orderBy(desc(pitches.createdAt))
      .limit(10);

    return pitchStats;
  }

  /**
   * Get creator's pitches with pagination
   */
  private async getMyPitches(auth: AuthPayload, searchParams: URLSearchParams, sql: any): Promise<Response> {
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    const offset = (page - 1) * limit;

    let whereCondition = eq(pitches.creatorId, auth.userId);
    if (status) {
      whereCondition = and(whereCondition, eq(pitches.status, status));
    }

    const orderColumn = sortBy === 'title' ? pitches.title : 
                       sortBy === 'viewCount' ? pitches.viewCount :
                       sortBy === 'status' ? pitches.status :
                       pitches.createdAt;

    const orderDirection = order === 'asc' ? asc(orderColumn) : desc(orderColumn);

    // Get total count
    const totalResult = await sql.select({ count: count() })
      .from(pitches)
      .where(whereCondition);

    const total = totalResult[0]?.count || 0;

    // Get paginated pitches
    const pitchesData = await sql.select({
      id: pitches.id,
      title: pitches.title,
      tagline: pitches.tagline,
      genre: pitches.genre,
      status: pitches.status,
      viewCount: pitches.viewCount,
      thumbnail: pitches.thumbnail,
      createdAt: pitches.createdAt,
      updatedAt: pitches.updatedAt
    })
      .from(pitches)
      .where(whereCondition)
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);

    return new Response(JSON.stringify({
      success: true,
      data: {
        pitches: pitchesData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Create new pitch
   */
  private async createPitch(request: Request, auth: AuthPayload, sql: any): Promise<Response> {
    try {
      const body = await request.json();
      const { title, tagline, description, genre, budget, timeline, targetAudience } = body;

      // Validate required fields
      if (!title || !description || !genre) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Title, description, and genre are required', code: 'VALIDATION_ERROR' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Insert new pitch
      const newPitch = await sql.insert(pitches).values({
        creatorId: auth.userId,
        title,
        tagline: tagline || '',
        description,
        genre,
        budget: budget || null,
        timeline: timeline || '',
        targetAudience: targetAudience || '',
        status: 'draft',
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      // Clear cache
      await this.cache.delete(`creator:dashboard:${auth.userId}`);

      return new Response(JSON.stringify({
        success: true,
        data: { pitch: newPitch[0] },
        message: 'Pitch created successfully'
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Create pitch error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to create pitch', code: 'CREATE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Update existing pitch
   */
  private async updatePitch(request: Request, auth: AuthPayload, pitchId: string, sql: any): Promise<Response> {
    try {
      const body = await request.json();
      
      // Verify pitch ownership
      const existingPitch = await sql.select()
        .from(pitches)
        .where(and(eq(pitches.id, pitchId), eq(pitches.creatorId, auth.userId)))
        .limit(1);

      if (!existingPitch.length) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Pitch not found or access denied', code: 'NOT_FOUND' }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update pitch
      const updatedPitch = await sql.update(pitches)
        .set({
          ...body,
          updatedAt: new Date()
        })
        .where(eq(pitches.id, pitchId))
        .returning();

      // Clear cache
      await this.cache.delete(`creator:dashboard:${auth.userId}`);
      await this.cache.delete(`pitch:${pitchId}`);

      return new Response(JSON.stringify({
        success: true,
        data: { pitch: updatedPitch[0] },
        message: 'Pitch updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Update pitch error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to update pitch', code: 'UPDATE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Delete pitch
   */
  private async deletePitch(auth: AuthPayload, pitchId: string, sql: any): Promise<Response> {
    try {
      // Verify pitch ownership
      const existingPitch = await sql.select()
        .from(pitches)
        .where(and(eq(pitches.id, pitchId), eq(pitches.creatorId, auth.userId)))
        .limit(1);

      if (!existingPitch.length) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Pitch not found or access denied', code: 'NOT_FOUND' }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Delete pitch
      await sql.delete(pitches).where(eq(pitches.id, pitchId));

      // Clear cache
      await this.cache.delete(`creator:dashboard:${auth.userId}`);
      await this.cache.delete(`pitch:${pitchId}`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Pitch deleted successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Delete pitch error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to delete pitch', code: 'DELETE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get creator analytics
   */
  private async getAnalytics(auth: AuthPayload, searchParams: URLSearchParams, sql: any): Promise<Response> {
    const period = searchParams.get('period') || '30'; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const cacheKey = `creator:analytics:${auth.userId}:${period}`;

    const analyticsData = await this.cache.get(cacheKey, async () => {
      // View trends
      const viewTrends = await sql.select({
        date: drizzleSql`DATE(${pitches.createdAt})`.as('date'),
        views: drizzleSql`SUM(${pitches.viewCount})`.as('views')
      })
        .from(pitches)
        .where(and(
          eq(pitches.creatorId, auth.userId),
          drizzleSql`${pitches.createdAt} >= ${startDate}`
        ))
        .groupBy(drizzleSql`DATE(${pitches.createdAt})`)
        .orderBy(asc(drizzleSql`DATE(${pitches.createdAt})`));

      // Investment trends
      const investmentTrends = await sql.select({
        date: drizzleSql`DATE(${investments.createdAt})`.as('date'),
        amount: drizzleSql`SUM(${investments.amount})`.as('amount'),
        count: count()
      })
        .from(investments)
        .innerJoin(pitches, eq(pitches.id, investments.pitchId))
        .where(and(
          eq(pitches.creatorId, auth.userId),
          drizzleSql`${investments.createdAt} >= ${startDate}`
        ))
        .groupBy(drizzleSql`DATE(${investments.createdAt})`)
        .orderBy(asc(drizzleSql`DATE(${investments.createdAt})`));

      return {
        period,
        viewTrends,
        investmentTrends,
        generatedAt: new Date().toISOString()
      };
    }, 'analytics', 3600); // 1-hour cache

    return new Response(JSON.stringify({
      success: true,
      data: analyticsData
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get collaborations for creator
   */
  private async getCollaborations(auth: AuthPayload, sql: any): Promise<Response> {
    // This would integrate with a collaborations/partnerships system
    // For now, return placeholder data
    return new Response(JSON.stringify({
      success: true,
      data: {
        pending: [],
        active: [],
        completed: []
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get followers for creator
   */
  private async getFollowers(auth: AuthPayload, searchParams: URLSearchParams, sql: any): Promise<Response> {
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Get total count
    const totalResult = await sql.select({ count: count() })
      .from(follows)
      .where(eq(follows.followingId, auth.userId));

    const total = totalResult[0]?.count || 0;

    // Get followers with user info
    const followersData = await sql.select({
      id: follows.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      userType: users.userType,
      createdAt: follows.createdAt
    })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followerId))
      .where(eq(follows.followingId, auth.userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset);

    return new Response(JSON.stringify({
      success: true,
      data: {
        followers: followersData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}