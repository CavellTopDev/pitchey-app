/**
 * Enhanced Analytics Service
 * Provides advanced analytics, trending analysis, and business intelligence
 */

import { db } from "../db/client.ts";
import { analyticsEvents, pitches, users, follows, ndaRequests, messages } from "../db/schema.ts";
import { eq, sql, desc, and, gte, between, count, sum, avg, max, inArray } from "drizzle-orm";

export interface DashboardAnalytics {
  overview: {
    totalViews: number;
    totalEngagement: number;
    growthRate: number;
    topPerformingPitch: any;
  };
  trends: {
    viewsTrend: Array<{ date: string; views: number; engagement: number }>;
    topGenres: Array<{ genre: string; count: number; growth: number }>;
    audienceGrowth: Array<{ date: string; followers: number; newFollowers: number }>;
  };
  performance: {
    avgResponseTime: number;
    conversionRate: number;
    engagementMetrics: {
      likes: number;
      saves: number;
      ndaRequests: number;
      messages: number;
    };
  };
  insights: {
    bestPerformingTimes: Array<{ hour: number; avgViews: number }>;
    audienceSegments: Array<{ segment: string; percentage: number; engagement: number }>;
    recommendations: Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low' }>;
  };
}

export interface InvestorAnalytics {
  portfolio: {
    totalInvestments: number;
    portfolioValue: number;
    roi: number;
    diversification: Array<{ genre: string; percentage: number; value: number }>;
  };
  activity: {
    pitchesViewed: number;
    ndasSigned: number;
    messagesExchanged: number;
    watchlistSize: number;
  };
  trends: {
    investmentTrend: Array<{ date: string; amount: number; count: number }>;
    interestAreas: Array<{ genre: string; viewCount: number; conversionRate: number }>;
    networkGrowth: Array<{ date: string; connections: number }>;
  };
  opportunities: {
    trending: Array<{ pitch: any; score: number; reason: string }>;
    recommended: Array<{ pitch: any; matchScore: number; reasons: string[] }>;
    urgent: Array<{ pitch: any; deadline: string; reason: string }>;
  };
}

export interface ProductionAnalytics {
  projects: {
    active: number;
    inProduction: number;
    completed: number;
    totalBudget: number;
  };
  pipeline: {
    pitchesInReview: number;
    averageDecisionTime: number;
    successRate: number;
    averageBudget: number;
  };
  performance: {
    onTimeDelivery: number;
    budgetVariance: number;
    clientSatisfaction: number;
    crewUtilization: number;
  };
  insights: {
    profitableGenres: Array<{ genre: string; profit: number; margin: number }>;
    seasonalTrends: Array<{ month: string; activity: number; revenue: number }>;
    recommendations: Array<{ type: string; impact: string; priority: number }>;
  };
}

export class EnhancedAnalyticsService {
  /**
   * Get enhanced creator dashboard analytics
   */
  static async getCreatorAnalytics(userId: number, timeRange: '7d' | '30d' | '90d' = '30d'): Promise<DashboardAnalytics> {
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get user's pitches
    const userPitches = await db.select().from(pitches).where(eq(pitches.userId, userId));
    const pitchIds = userPitches.map(p => p.id);

    // Overview metrics
    if (pitchIds.length === 0) {
      // Return empty analytics if user has no pitches
      return {
        overview: { totalViews: 0, totalEngagement: 0, growthRate: 0, topPerformingPitch: null },
        trends: { viewsTrend: [], topGenres: [], audienceGrowth: [] },
        performance: { avgResponseTime: 0, conversionRate: 0, engagementMetrics: { likes: 0, saves: 0, ndaRequests: 0, messages: 0 } },
        insights: { bestPerformingTimes: [], audienceSegments: [], recommendations: [] }
      };
    }

    const totalViews = await db.select({ total: sum(analyticsEvents.viewCount) })
      .from(analyticsEvents)
      .where(and(
        inArray(analyticsEvents.pitchId, pitchIds),
        gte(analyticsEvents.createdAt, startDate)
      ));

    const engagement = await db.select({ 
      likes: count(analyticsEvents.id),
      saves: sum(sql`CASE WHEN ${analyticsEvents.eventType} = 'save' THEN 1 ELSE 0 END`),
      shares: sum(sql`CASE WHEN ${analyticsEvents.eventType} = 'share' THEN 1 ELSE 0 END`)
    })
    .from(analyticsEvents)
    .where(and(
      inArray(analyticsEvents.pitchId, pitchIds),
      gte(analyticsEvents.createdAt, startDate)
    ));

    // Top performing pitch
    const topPitch = await db.select({
      pitch: pitches,
      views: sum(analyticsEvents.viewCount)
    })
    .from(pitches)
    .leftJoin(analyticsEvents, eq(pitches.id, analyticsEvents.pitchId))
    .where(eq(pitches.userId, userId))
    .groupBy(pitches.id)
    .orderBy(desc(sum(analyticsEvents.viewCount)))
    .limit(1);

    // Views trend (last 30 days)
    const viewsTrend = await db.select({
      date: sql`DATE(${analyticsEvents.createdAt})`,
      views: sum(analyticsEvents.viewCount),
      engagement: count(analyticsEvents.id)
    })
    .from(analyticsEvents)
    .where(and(
      inArray(analyticsEvents.pitchId, pitchIds),
      gte(analyticsEvents.createdAt, startDate)
    ))
    .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
    .orderBy(sql`DATE(${analyticsEvents.createdAt})`);

    // Top genres performance
    const topGenres = await db.select({
      genre: pitches.genre,
      count: count(analyticsEvents.id),
      avgViews: avg(analyticsEvents.viewCount)
    })
    .from(pitches)
    .leftJoin(analyticsEvents, eq(pitches.id, analyticsEvents.pitchId))
    .where(eq(pitches.userId, userId))
    .groupBy(pitches.genre)
    .orderBy(desc(count(analyticsEvents.id)))
    .limit(5);

    // Audience growth
    const audienceGrowth = await db.select({
      date: sql`DATE(${follows.createdAt})`,
      followers: count(follows.id)
    })
    .from(follows)
    .where(and(
      eq(follows.followingId, userId),
      gte(follows.createdAt, startDate)
    ))
    .groupBy(sql`DATE(${follows.createdAt})`)
    .orderBy(sql`DATE(${follows.createdAt})`);

    // Best performing times
    const bestTimes = await db.select({
      hour: sql`EXTRACT(HOUR FROM ${analyticsEvents.createdAt})`,
      avgViews: avg(analyticsEvents.viewCount)
    })
    .from(analyticsEvents)
    .where(and(
      inArray(analyticsEvents.pitchId, pitchIds),
      gte(analyticsEvents.createdAt, startDate)
    ))
    .groupBy(sql`EXTRACT(HOUR FROM ${analyticsEvents.createdAt})`)
    .orderBy(desc(avg(analyticsEvents.viewCount)));

    // Generate recommendations
    const recommendations = this.generateCreatorRecommendations({
      totalViews: totalViews[0]?.total || 0,
      topGenres: topGenres.map(g => ({ genre: g.genre || 'Unknown', count: g.count, growth: 0 })),
      bestTimes: bestTimes.map(t => ({ hour: Number(t.hour), avgViews: Number(t.avgViews) }))
    });

    return {
      overview: {
        totalViews: totalViews[0]?.total || 0,
        totalEngagement: engagement[0]?.likes || 0,
        growthRate: this.calculateGrowthRate(viewsTrend),
        topPerformingPitch: topPitch[0] || null
      },
      trends: {
        viewsTrend: viewsTrend.map(v => ({
          date: v.date as string,
          views: Number(v.views) || 0,
          engagement: Number(v.engagement) || 0
        })),
        topGenres: topGenres.map(g => ({
          genre: g.genre || 'Unknown',
          count: g.count,
          growth: 0 // Calculate based on historical data
        })),
        audienceGrowth: audienceGrowth.map(a => ({
          date: a.date as string,
          followers: a.followers,
          newFollowers: a.followers // Simplified
        }))
      },
      performance: {
        avgResponseTime: 0, // Calculate from message response times
        conversionRate: this.calculateConversionRate(totalViews[0]?.total || 0, engagement[0]?.likes || 0),
        engagementMetrics: {
          likes: engagement[0]?.likes || 0,
          saves: Number(engagement[0]?.saves) || 0,
          ndaRequests: 0, // Get from NDA requests
          messages: 0 // Get from messages
        }
      },
      insights: {
        bestPerformingTimes: bestTimes.map(t => ({
          hour: Number(t.hour),
          avgViews: Number(t.avgViews)
        })),
        audienceSegments: [], // Implement audience analysis
        recommendations
      }
    };
  }

  /**
   * Get enhanced investor analytics
   */
  static async getInvestorAnalytics(userId: number, timeRange: '7d' | '30d' | '90d' = '30d'): Promise<InvestorAnalytics> {
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Investment activity
    const viewedPitches = await db.select({ count: count(analyticsEvents.id) })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.userId, userId),
        eq(analyticsEvents.eventType, 'view'),
        gte(analyticsEvents.createdAt, startDate)
      ));

    const signedNDAs = await db.select({ count: count(ndaRequests.id) })
      .from(ndaRequests)
      .where(and(
        eq(ndaRequests.requesterId, userId),
        eq(ndaRequests.status, 'signed'),
        gte(ndaRequests.requestedAt, startDate)
      ));

    // Interest areas analysis
    const interestAreas = await db.select({
      genre: pitches.genre,
      viewCount: count(analyticsEvents.id),
      uniquePitches: sql`COUNT(DISTINCT ${analyticsEvents.pitchId})`
    })
    .from(analyticsEvents)
    .leftJoin(pitches, eq(analyticsEvents.pitchId, pitches.id))
    .where(and(
      eq(analyticsEvents.userId, userId),
      eq(analyticsEvents.eventType, 'view'),
      gte(analyticsEvents.createdAt, startDate)
    ))
    .groupBy(pitches.genre)
    .orderBy(desc(count(analyticsEvents.id)));

    // Trending opportunities (high engagement, recent)
    const trendingPitches = await db.select({
      pitch: pitches,
      score: count(analyticsEvents.id)
    })
    .from(pitches)
    .leftJoin(analyticsEvents, eq(pitches.id, analyticsEvents.pitchId))
    .where(gte(pitches.createdAt, startDate))
    .groupBy(pitches.id)
    .orderBy(desc(count(analyticsEvents.id)))
    .limit(5);

    return {
      portfolio: {
        totalInvestments: 0, // Implement investment tracking
        portfolioValue: 0,
        roi: 0,
        diversification: []
      },
      activity: {
        pitchesViewed: viewedPitches[0]?.count || 0,
        ndasSigned: signedNDAs[0]?.count || 0,
        messagesExchanged: 0, // Get from messages table
        watchlistSize: 0 // Get from saved pitches
      },
      trends: {
        investmentTrend: [],
        interestAreas: interestAreas.map(area => ({
          genre: area.genre || 'Unknown',
          viewCount: area.viewCount,
          conversionRate: 0 // Calculate conversion from view to action
        })),
        networkGrowth: []
      },
      opportunities: {
        trending: trendingPitches.map(p => ({
          pitch: p.pitch,
          score: p.score,
          reason: 'High recent engagement'
        })),
        recommended: [], // Implement ML-based recommendations
        urgent: [] // Implement deadline-based urgency
      }
    };
  }

  /**
   * Get production company analytics
   */
  static async getProductionAnalytics(userId: number): Promise<ProductionAnalytics> {
    // Implement production-specific analytics
    return {
      projects: {
        active: 0,
        inProduction: 0,
        completed: 0,
        totalBudget: 0
      },
      pipeline: {
        pitchesInReview: 0,
        averageDecisionTime: 0,
        successRate: 0,
        averageBudget: 0
      },
      performance: {
        onTimeDelivery: 0,
        budgetVariance: 0,
        clientSatisfaction: 0,
        crewUtilization: 0
      },
      insights: {
        profitableGenres: [],
        seasonalTrends: [],
        recommendations: []
      }
    };
  }

  /**
   * Generate creator recommendations based on analytics
   */
  private static generateCreatorRecommendations(data: any): Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low' }> {
    const recommendations = [];

    // Low views recommendation
    if (data.totalViews < 100) {
      recommendations.push({
        type: 'content',
        message: 'Consider improving your pitch titles and descriptions to increase visibility',
        priority: 'high' as const
      });
    }

    // Genre performance
    if (data.topGenres.length > 0) {
      const topGenre = data.topGenres[0];
      recommendations.push({
        type: 'strategy',
        message: `${topGenre.genre} is your best performing genre. Consider creating more content in this area.`,
        priority: 'medium' as const
      });
    }

    // Timing optimization
    if (data.bestTimes.length > 0) {
      const bestHour = data.bestTimes[0].hour;
      recommendations.push({
        type: 'timing',
        message: `Your content performs best around ${bestHour}:00. Consider posting during this time.`,
        priority: 'low' as const
      });
    }

    return recommendations;
  }

  /**
   * Calculate growth rate from trend data
   */
  private static calculateGrowthRate(trendData: any[]): number {
    if (trendData.length < 2) return 0;
    
    const latest = trendData[trendData.length - 1]?.views || 0;
    const previous = trendData[trendData.length - 2]?.views || 0;
    
    if (previous === 0) return 0;
    return ((latest - previous) / previous) * 100;
  }

  /**
   * Calculate conversion rate
   */
  private static calculateConversionRate(views: number, engagement: number): number {
    if (views === 0) return 0;
    return (engagement / views) * 100;
  }
}