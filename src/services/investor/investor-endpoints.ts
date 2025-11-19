/**
 * Investor Service Endpoints
 * Handles investor dashboard, opportunities, and portfolio management
 */

import { AuthPayload } from '../../shared/auth-utils';
import { users, pitches, follows, investments, ndas } from '../../db/schema';
import { eq, desc, sql, and, count, avg, sum } from 'drizzle-orm';

export interface InvestorDashboardData {
  stats: {
    totalInvestments: number;
    activeInvestments: number;
    totalInvested: number;
    portfolioValue: number;
    avgROI: number;
    pitchesViewed: number;
    pitchesLiked: number;
    ndaSigned: number;
  };
  recentOpportunities: Array<{
    id: number;
    title: string;
    genre: string;
    format: string;
    logline: string;
    creator: string;
    viewCount: number;
    seeking_investment: boolean;
    created_at: string;
  }>;
  portfolio: {
    totalValue: number;
    totalInvested: number;
    totalReturns: number;
    investments: Array<{
      id: number;
      pitch_title: string;
      amount: number;
      date: string;
      status: string;
      current_value: number;
    }>;
    performance: Array<{
      month: string;
      value: number;
      growth: number;
    }>;
    diversification: Array<{
      genre: string;
      percentage: number;
      value: number;
    }>;
  };
  watchlist: Array<{
    id: number;
    pitch_id: number;
    pitch_title: string;
    creator: string;
    genre: string;
    added_date: string;
  }>;
  activities: Array<{
    id: number;
    type: string;
    description: string;
    date: string;
    pitch_id?: number;
  }>;
}

export class InvestorEndpoints {
  private cache: any;

  constructor(cache: any) {
    this.cache = cache;
  }

  /**
   * Handle investor service requests
   */
  async handleInvestorRequest(
    request: Request, 
    pathname: string, 
    auth: AuthPayload, 
    sql: any
  ): Promise<Response | null> {
    const method = request.method;
    const url = new URL(request.url);

    // Dashboard endpoint
    if (pathname === '/api/investor/dashboard' && method === 'GET') {
      return this.getDashboard(auth, sql);
    }

    // Investment opportunities
    if (pathname === '/api/investor/opportunities' && method === 'GET') {
      return this.getOpportunities(url.searchParams, auth, sql);
    }

    // Portfolio data
    if (pathname === '/api/investor/portfolio' && method === 'GET') {
      return this.getPortfolio(auth, sql);
    }

    // Watchlist
    if (pathname === '/api/investor/watchlist' && method === 'GET') {
      return this.getWatchlist(auth, sql);
    }

    // Add to watchlist
    if (pathname === '/api/investor/watchlist' && method === 'POST') {
      return this.addToWatchlist(request, auth, sql);
    }

    // Remove from watchlist
    if (pathname.startsWith('/api/investor/watchlist/') && method === 'DELETE') {
      const pitchId = pathname.split('/').pop();
      return this.removeFromWatchlist(pitchId, auth, sql);
    }

    // Investment analytics
    if (pathname === '/api/investor/analytics' && method === 'GET') {
      return this.getAnalytics(url.searchParams, auth, sql);
    }

    return null;
  }

  /**
   * Get investor dashboard data
   */
  private async getDashboard(auth: AuthPayload, sql: any): Promise<Response> {
    try {
      const userId = parseInt(auth.userId);
      const cacheKey = `investor-dashboard:${userId}`;

      const dashboardData = await this.cache.get(cacheKey, async () => {
        // Get basic stats
        const stats = await this.getInvestorStats(userId, sql);
        
        // Get recent opportunities (pitches seeking investment)
        const recentOpportunities = await this.getRecentOpportunities(sql);
        
        // Get portfolio data
        const portfolio = await this.getPortfolioData(userId, sql);
        
        // Get watchlist
        const watchlist = await this.getWatchlistData(userId, sql);
        
        // Get recent activities
        const activities = await this.getRecentActivities(userId, sql);

        return {
          stats,
          recentOpportunities,
          portfolio,
          watchlist,
          activities
        };
      }, 'dashboard');

      return new Response(JSON.stringify({
        success: true,
        data: { dashboard: dashboardData }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Dashboard error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load dashboard', code: 'DASHBOARD_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get investment opportunities
   */
  private async getOpportunities(params: URLSearchParams, auth: AuthPayload, sql: any): Promise<Response> {
    try {
      const genre = params.get('genre');
      const minInvestment = params.get('minInvestment');
      const maxInvestment = params.get('maxInvestment');
      const sortBy = params.get('sortBy') || 'popularity';
      const limit = parseInt(params.get('limit') || '20');
      const offset = parseInt(params.get('offset') || '0');

      let query = sql
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          viewCount: pitches.viewCount,
          createdAt: pitches.createdAt,
          creator: users.username,
          creatorId: users.id
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(
          eq(pitches.seekingInvestment, true),
          eq(pitches.status, 'active')
        ));

      // Apply filters
      if (genre) {
        query = query.where(eq(pitches.genre, genre));
      }

      // Apply sorting
      switch (sortBy) {
        case 'deadline':
          query = query.orderBy(desc(pitches.createdAt));
          break;
        case 'popularity':
        default:
          query = query.orderBy(desc(pitches.viewCount));
          break;
      }

      query = query.limit(limit).offset(offset);

      const opportunities = await query;

      // Get total count for pagination
      const totalResult = await sql
        .select({ count: count() })
        .from(pitches)
        .where(and(
          eq(pitches.seekingInvestment, true),
          eq(pitches.status, 'active')
        ));

      return new Response(JSON.stringify({
        success: true,
        data: {
          opportunities: opportunities.map(opp => ({
            id: opp.id,
            title: opp.title,
            logline: opp.logline,
            genre: opp.genre,
            format: opp.format,
            creator: opp.creator,
            viewCount: opp.viewCount,
            matchScore: Math.floor(Math.random() * 100), // Demo match score
            deadline: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Demo deadline
            roi: Math.floor(Math.random() * 20 + 5), // Demo ROI
            popularity: opp.viewCount
          })),
          total: totalResult[0]?.count || 0
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Opportunities error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load opportunities', code: 'OPPORTUNITIES_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get investor stats
   */
  private async getInvestorStats(userId: number, sql: any) {
    // Get investment counts (mock data for now since investments table may not have data)
    const totalInvestments = 3;
    const activeInvestments = 2;
    const totalInvested = 25000;
    const portfolioValue = 27500;

    // Get actual user activity stats
    const ndaCountResult = await sql
      .select({ count: count() })
      .from(ndas)
      .where(eq(ndas.investorId, userId));

    const followsCountResult = await sql
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followerId, userId));

    return {
      totalInvestments,
      activeInvestments,
      totalInvested,
      portfolioValue,
      avgROI: ((portfolioValue - totalInvested) / totalInvested * 100).toFixed(1),
      pitchesViewed: Math.floor(Math.random() * 50 + 10), // Mock data
      pitchesLiked: followsCountResult[0]?.count || 0,
      ndaSigned: ndaCountResult[0]?.count || 0
    };
  }

  /**
   * Get recent investment opportunities
   */
  private async getRecentOpportunities(sql: any) {
    const opportunities = await sql
      .select({
        id: pitches.id,
        title: pitches.title,
        genre: pitches.genre,
        format: pitches.format,
        logline: pitches.logline,
        viewCount: pitches.viewCount,
        seekingInvestment: pitches.seekingInvestment,
        createdAt: pitches.createdAt,
        creator: users.username
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(and(
        eq(pitches.seekingInvestment, true),
        eq(pitches.status, 'active')
      ))
      .orderBy(desc(pitches.createdAt))
      .limit(5);

    return opportunities.map(opp => ({
      id: opp.id,
      title: opp.title,
      genre: opp.genre,
      format: opp.format,
      logline: opp.logline,
      creator: opp.creator,
      viewCount: opp.viewCount,
      seeking_investment: opp.seekingInvestment,
      created_at: opp.createdAt?.toISOString()
    }));
  }

  /**
   * Get portfolio data
   */
  private async getPortfolioData(userId: number, sql: any) {
    // Mock portfolio data for now
    return {
      totalValue: 27500,
      totalInvested: 25000,
      totalReturns: 2500,
      investments: [
        {
          id: 1,
          pitch_title: "Urban Shadows",
          amount: 10000,
          date: "2024-01-15",
          status: "active",
          current_value: 11200
        },
        {
          id: 2,
          pitch_title: "Comedy Central",
          amount: 15000,
          date: "2024-02-20",
          status: "active",
          current_value: 16300
        }
      ],
      performance: [
        { month: "Jan", value: 25000, growth: 0 },
        { month: "Feb", value: 25800, growth: 3.2 },
        { month: "Mar", value: 27500, growth: 6.6 }
      ],
      diversification: [
        { genre: "Drama", percentage: 40, value: 11000 },
        { genre: "Comedy", percentage: 60, value: 16500 }
      ]
    };
  }

  /**
   * Get watchlist data
   */
  private async getWatchlistData(userId: number, sql: any) {
    const watchlist = await sql
      .select({
        id: follows.id,
        pitchId: pitches.id,
        pitchTitle: pitches.title,
        creator: users.username,
        genre: pitches.genre,
        followedAt: follows.followedAt
      })
      .from(follows)
      .leftJoin(pitches, eq(follows.pitchId, pitches.id))
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.followedAt))
      .limit(10);

    return watchlist.map(item => ({
      id: item.id,
      pitch_id: item.pitchId,
      pitch_title: item.pitchTitle,
      creator: item.creator,
      genre: item.genre,
      added_date: item.followedAt?.toISOString()
    }));
  }

  /**
   * Get recent activities
   */
  private async getRecentActivities(userId: number, sql: any) {
    // Mock activities for now - could be expanded to use analytics events
    return [
      {
        id: 1,
        type: "pitch_view",
        description: "Viewed pitch: Urban Shadows",
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        pitch_id: 1
      },
      {
        id: 2,
        type: "nda_signed",
        description: "Signed NDA for Comedy Central",
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        pitch_id: 2
      }
    ];
  }

  /**
   * Get portfolio (separate endpoint)
   */
  private async getPortfolio(auth: AuthPayload, sql: any): Promise<Response> {
    try {
      const userId = parseInt(auth.userId);
      const portfolio = await this.getPortfolioData(userId, sql);

      return new Response(JSON.stringify({
        success: true,
        data: portfolio
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load portfolio', code: 'PORTFOLIO_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get watchlist
   */
  private async getWatchlist(auth: AuthPayload, sql: any): Promise<Response> {
    try {
      const userId = parseInt(auth.userId);
      const watchlist = await this.getWatchlistData(userId, sql);

      return new Response(JSON.stringify({
        success: true,
        data: { watchlist }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load watchlist', code: 'WATCHLIST_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Add to watchlist
   */
  private async addToWatchlist(request: Request, auth: AuthPayload, sql: any): Promise<Response> {
    try {
      const body = await request.json();
      const { pitchId } = body;

      if (!pitchId) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Pitch ID required', code: 'INVALID_INPUT' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const userId = parseInt(auth.userId);

      // Check if already in watchlist
      const existing = await sql
        .select()
        .from(follows)
        .where(and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, pitchId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Already in watchlist', code: 'ALREADY_FOLLOWING' }
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add to watchlist
      await sql
        .insert(follows)
        .values({
          followerId: userId,
          pitchId: pitchId,
          followedAt: new Date(),
          createdAt: new Date()
        });

      return new Response(JSON.stringify({
        success: true,
        message: 'Added to watchlist'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to add to watchlist', code: 'WATCHLIST_ADD_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Remove from watchlist
   */
  private async removeFromWatchlist(pitchId: string | undefined, auth: AuthPayload, sql: any): Promise<Response> {
    try {
      if (!pitchId) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Pitch ID required', code: 'INVALID_INPUT' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const userId = parseInt(auth.userId);

      await sql
        .delete(follows)
        .where(and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, parseInt(pitchId))
        ));

      return new Response(JSON.stringify({
        success: true,
        message: 'Removed from watchlist'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to remove from watchlist', code: 'WATCHLIST_REMOVE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get analytics data
   */
  private async getAnalytics(params: URLSearchParams, auth: AuthPayload, sql: any): Promise<Response> {
    try {
      // Mock analytics data for now
      const analytics = {
        performance: {
          totalROI: 10.2,
          monthlyGrowth: 2.8,
          bestPerforming: "Urban Shadows",
          portfolioValue: 27500
        },
        activity: {
          pitchesViewed: 23,
          ndasSigned: 5,
          investmentsMade: 3,
          avgDealSize: 8333
        },
        trends: [
          { month: "Jan", investments: 1, value: 10000 },
          { month: "Feb", investments: 1, value: 15000 },
          { month: "Mar", investments: 1, value: 2500 }
        ]
      };

      return new Response(JSON.stringify({
        success: true,
        data: analytics
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load analytics', code: 'ANALYTICS_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}