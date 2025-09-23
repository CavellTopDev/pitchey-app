import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { 
  analyticsEvents,
  analyticsAggregates,
  pitches,
  pitchViews,
  ndas,
  deals,
  users,
  userSessions,
  payments
} from "../../../../src/db/schema.ts";
import { eq, and, sql, desc, gte, count, avg, sum } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

interface ProductionDashboardMetrics {
  platformOverview: {
    totalUsers: number;
    activeUsers: number;
    totalPitches: number;
    publishedPitches: number;
    userGrowth: number;
    contentGrowth: number;
    engagementRate: number;
  };
  acquisitionFunnel: {
    visitors: number;
    signups: number;
    activatedUsers: number;
    publishedCreators: number;
    conversionRates: {
      visitorToSignup: number;
      signupToActivation: number;
      activationToPublish: number;
    };
    funnelSteps: Array<{
      step: string;
      count: number;
      conversionRate: number;
      dropOffRate: number;
    }>;
  };
  contentPipeline: {
    draftPitches: number;
    reviewQueue: number;
    publishedThisPeriod: number;
    averageTimeToPublish: number; // days
    contentQuality: {
      averageEngagement: number;
      ndaConversionRate: number;
      qualityScore: number;
    };
    topPerformers: Array<{
      pitchId: number;
      title: string;
      creator: string;
      views: number;
      engagement: number;
      deals: number;
    }>;
  };
  userSegments: {
    creators: {
      total: number;
      active: number;
      topPerformers: number;
      avgPitchesPerCreator: number;
    };
    investors: {
      total: number;
      active: number;
      avgDealsPerInvestor: number;
      totalInvestmentVolume: number;
    };
    viewers: {
      total: number;
      engaged: number;
      conversionToSignup: number;
    };
  };
  revenueMetrics: {
    totalRevenue: number;
    revenueGrowth: number;
    avgRevenuePerUser: number;
    successFeeRevenue: number;
    subscriptionRevenue: number;
    revenueBySegment: Array<{
      segment: string;
      revenue: number;
      percentage: number;
    }>;
  };
  operationalMetrics: {
    systemPerformance: {
      avgPageLoadTime: number;
      errorRate: number;
      uptime: number;
    };
    contentModeration: {
      flaggedContent: number;
      reviewsPending: number;
      moderationAccuracy: number;
    };
    supportMetrics: {
      ticketsCreated: number;
      ticketsResolved: number;
      avgResolutionTime: number; // hours
      satisfactionScore: number;
    };
  };
  insights: Array<{
    type: "trend" | "anomaly" | "opportunity" | "risk";
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    recommendation: string;
    metrics?: Record<string, number>;
  }>;
}

export const handler: Handlers = {
  async GET(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify user is production/admin
      const user = await db.select().from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || user[0].userType !== "production") {
        return new Response(JSON.stringify({ error: "Production access required" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const url = new URL(req.url);
      const timeRange = url.searchParams.get("timeRange") || "30"; // days
      const detailed = url.searchParams.get("detailed") === "true";

      const dashboard = await getProductionDashboard(parseInt(timeRange), detailed);

      return new Response(JSON.stringify({
        success: true,
        dashboard,
        timeRange: parseInt(timeRange),
        generatedAt: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching production dashboard:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function getProductionDashboard(
  timeRangeDays: number, 
  detailed: boolean
): Promise<ProductionDashboardMetrics> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(startDate.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);

  const [
    platformOverview,
    acquisitionFunnel,
    contentPipeline,
    userSegments,
    revenueMetrics,
    operationalMetrics,
    insights
  ] = await Promise.all([
    getPlatformOverview(startDate, endDate, previousStartDate),
    getAcquisitionFunnel(startDate, endDate),
    getContentPipeline(startDate, endDate),
    getUserSegments(startDate, endDate),
    getRevenueMetrics(startDate, endDate, previousStartDate),
    detailed ? getOperationalMetrics(startDate, endDate) : Promise.resolve({
      systemPerformance: { avgPageLoadTime: 0, errorRate: 0, uptime: 0 },
      contentModeration: { flaggedContent: 0, reviewsPending: 0, moderationAccuracy: 0 },
      supportMetrics: { ticketsCreated: 0, ticketsResolved: 0, avgResolutionTime: 0, satisfactionScore: 0 }
    }),
    detailed ? getProductionInsights(startDate, endDate) : Promise.resolve([])
  ]);

  return {
    platformOverview,
    acquisitionFunnel,
    contentPipeline,
    userSegments,
    revenueMetrics,
    operationalMetrics,
    insights,
  };
}

async function getPlatformOverview(startDate: Date, endDate: Date, previousStartDate: Date) {
  // Total users and growth
  const totalUsers = await db.select({
    count: count(),
  }).from(users);

  const newUsers = await db.select({
    count: count(),
  })
  .from(users)
  .where(gte(users.createdAt, startDate));

  const previousNewUsers = await db.select({
    count: count(),
  })
  .from(users)
  .where(and(
    gte(users.createdAt, previousStartDate),
    sql`${users.createdAt} < ${startDate}`
  ));

  // Active users (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeUsers = await db.select({
    count: sql<number>`COUNT(DISTINCT ${userSessions.userId})`,
  })
  .from(userSessions)
  .where(gte(userSessions.lastActivity, thirtyDaysAgo));

  // Pitch metrics
  const totalPitches = await db.select({
    total: count(),
    published: sql<number>`COUNT(*) FILTER (WHERE ${pitches.status} = 'published')`,
  }).from(pitches);

  const newPitches = await db.select({
    count: count(),
  })
  .from(pitches)
  .where(gte(pitches.createdAt, startDate));

  const previousNewPitches = await db.select({
    count: count(),
  })
  .from(pitches)
  .where(and(
    gte(pitches.createdAt, previousStartDate),
    sql`${pitches.createdAt} < ${startDate}`
  ));

  // Engagement metrics
  const engagementStats = await db.select({
    totalSessions: count(),
    engagedSessions: sql<number>`COUNT(*) FILTER (WHERE ${userSessions.eventCount} > 5)`,
  })
  .from(userSessions)
  .where(gte(userSessions.startTime, startDate));

  const currentNewUsers = newUsers[0]?.count || 0;
  const prevNewUsers = previousNewUsers[0]?.count || 0;
  const userGrowth = prevNewUsers > 0 ? ((currentNewUsers - prevNewUsers) / prevNewUsers) * 100 : 0;

  const currentNewPitches = newPitches[0]?.count || 0;
  const prevNewPitches = previousNewPitches[0]?.count || 0;
  const contentGrowth = prevNewPitches > 0 ? ((currentNewPitches - prevNewPitches) / prevNewPitches) * 100 : 0;

  const totalSessions = engagementStats[0]?.totalSessions || 0;
  const engagedSessions = engagementStats[0]?.engagedSessions || 0;
  const engagementRate = totalSessions > 0 ? (engagedSessions / totalSessions) * 100 : 0;

  return {
    totalUsers: totalUsers[0]?.count || 0,
    activeUsers: activeUsers[0]?.count || 0,
    totalPitches: totalPitches[0]?.total || 0,
    publishedPitches: totalPitches[0]?.published || 0,
    userGrowth: Math.round(userGrowth * 10) / 10,
    contentGrowth: Math.round(contentGrowth * 10) / 10,
    engagementRate: Math.round(engagementRate * 10) / 10,
  };
}

async function getAcquisitionFunnel(startDate: Date, endDate: Date) {
  // Simplified funnel metrics
  const visitors = await db.select({
    count: sql<number>`COUNT(DISTINCT ${userSessions.sessionId})`,
  })
  .from(userSessions)
  .where(gte(userSessions.startTime, startDate));

  const signups = await db.select({
    count: count(),
  })
  .from(users)
  .where(gte(users.createdAt, startDate));

  // Activated users (users who have performed meaningful actions)
  const activatedUsers = await db.select({
    count: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})`,
  })
  .from(analyticsEvents)
  .where(and(
    gte(analyticsEvents.timestamp, startDate),
    sql`${analyticsEvents.userId} IS NOT NULL`,
    sql`${analyticsEvents.eventType} IN ('view', 'nda_request', 'follow')`
  ));

  // Published creators
  const publishedCreators = await db.select({
    count: sql<number>`COUNT(DISTINCT ${pitches.userId})`,
  })
  .from(pitches)
  .where(and(
    gte(pitches.createdAt, startDate),
    eq(pitches.status, "published")
  ));

  const visitorCount = visitors[0]?.count || 0;
  const signupCount = signups[0]?.count || 0;
  const activatedCount = activatedUsers[0]?.count || 0;
  const publishedCount = publishedCreators[0]?.count || 0;

  const funnelSteps = [
    {
      step: "Visitors",
      count: visitorCount,
      conversionRate: 100,
      dropOffRate: 0,
    },
    {
      step: "Signups",
      count: signupCount,
      conversionRate: visitorCount > 0 ? (signupCount / visitorCount) * 100 : 0,
      dropOffRate: visitorCount > 0 ? ((visitorCount - signupCount) / visitorCount) * 100 : 0,
    },
    {
      step: "Activated Users",
      count: activatedCount,
      conversionRate: signupCount > 0 ? (activatedCount / signupCount) * 100 : 0,
      dropOffRate: signupCount > 0 ? ((signupCount - activatedCount) / signupCount) * 100 : 0,
    },
    {
      step: "Published Creators",
      count: publishedCount,
      conversionRate: activatedCount > 0 ? (publishedCount / activatedCount) * 100 : 0,
      dropOffRate: activatedCount > 0 ? ((activatedCount - publishedCount) / activatedCount) * 100 : 0,
    },
  ];

  return {
    visitors: visitorCount,
    signups: signupCount,
    activatedUsers: activatedCount,
    publishedCreators: publishedCount,
    conversionRates: {
      visitorToSignup: funnelSteps[1].conversionRate,
      signupToActivation: funnelSteps[2].conversionRate,
      activationToPublish: funnelSteps[3].conversionRate,
    },
    funnelSteps,
  };
}

async function getContentPipeline(startDate: Date, endDate: Date) {
  // Content status breakdown
  const contentStats = await db.select({
    drafts: sql<number>`COUNT(*) FILTER (WHERE ${pitches.status} = 'draft')`,
    published: sql<number>`COUNT(*) FILTER (WHERE ${pitches.status} = 'published' AND ${pitches.publishedAt} >= ${startDate})`,
    total: count(),
  }).from(pitches);

  // Average time to publish (simplified)
  const timeToPublish = await db.select({
    avgDays: sql<number>`AVG(EXTRACT(DAY FROM (${pitches.publishedAt} - ${pitches.createdAt})))`,
  })
  .from(pitches)
  .where(and(
    sql`${pitches.publishedAt} IS NOT NULL`,
    gte(pitches.publishedAt || pitches.createdAt, startDate)
  ));

  // Content quality metrics
  const qualityStats = await db.select({
    avgViews: avg(pitches.viewCount),
    avgNDAs: avg(pitches.ndaCount),
    totalViews: sum(pitches.viewCount),
    totalNDAs: sum(pitches.ndaCount),
  })
  .from(pitches)
  .where(and(
    eq(pitches.status, "published"),
    gte(pitches.publishedAt || pitches.createdAt, startDate)
  ));

  // Top performers
  const topPerformers = await db.select({
    pitchId: pitches.id,
    title: pitches.title,
    creator: users.username,
    views: pitches.viewCount,
    ndas: pitches.ndaCount,
    deals: sql<number>`(SELECT COUNT(*) FROM deals WHERE deals.pitch_id = pitches.id)`,
  })
  .from(pitches)
  .innerJoin(users, eq(pitches.userId, users.id))
  .where(and(
    eq(pitches.status, "published"),
    gte(pitches.publishedAt || pitches.createdAt, startDate)
  ))
  .orderBy(desc(pitches.viewCount))
  .limit(10);

  const avgViews = Number(qualityStats[0]?.avgViews || 0);
  const totalViews = Number(qualityStats[0]?.totalViews || 0);
  const totalNDAs = Number(qualityStats[0]?.totalNDAs || 0);
  const ndaConversionRate = totalViews > 0 ? (totalNDAs / totalViews) * 100 : 0;

  return {
    draftPitches: contentStats[0]?.drafts || 0,
    reviewQueue: 0, // Would implement review queue
    publishedThisPeriod: contentStats[0]?.published || 0,
    averageTimeToPublish: timeToPublish[0]?.avgDays || 0,
    contentQuality: {
      averageEngagement: avgViews,
      ndaConversionRate: Math.round(ndaConversionRate * 100) / 100,
      qualityScore: calculateQualityScore(avgViews, ndaConversionRate),
    },
    topPerformers: topPerformers.map(performer => ({
      pitchId: performer.pitchId,
      title: performer.title,
      creator: performer.creator,
      views: performer.views,
      engagement: calculateEngagementScore(performer.views, performer.ndas),
      deals: performer.deals,
    })),
  };
}

async function getUserSegments(startDate: Date, endDate: Date) {
  // Creator metrics
  const creatorStats = await db.select({
    total: count(),
    withPitches: sql<number>`COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM pitches WHERE pitches.user_id = users.id) > 0)`,
  })
  .from(users)
  .where(eq(users.userType, "creator"));

  const creatorActivity = await db.select({
    activeCreators: sql<number>`COUNT(DISTINCT ${pitches.userId})`,
    avgPitches: avg(sql<number>`(SELECT COUNT(*) FROM pitches p2 WHERE p2.user_id = pitches.user_id)`),
  })
  .from(pitches)
  .where(gte(pitches.createdAt, startDate));

  // Investor metrics
  const investorStats = await db.select({
    total: count(),
  })
  .from(users)
  .where(eq(users.userType, "investor"));

  const investorActivity = await db.select({
    activeInvestors: sql<number>`COUNT(DISTINCT ${deals.investorId})`,
    avgDeals: avg(sql<number>`(SELECT COUNT(*) FROM deals d2 WHERE d2.investor_id = deals.investor_id)`),
    totalVolume: sum(deals.dealValue),
  })
  .from(deals)
  .where(gte(deals.createdAt, startDate));

  // Viewer metrics
  const viewerStats = await db.select({
    total: count(),
  })
  .from(users)
  .where(eq(users.userType, "viewer"));

  const viewerActivity = await db.select({
    engaged: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})`,
  })
  .from(analyticsEvents)
  .innerJoin(users, eq(analyticsEvents.userId, users.id))
  .where(and(
    eq(users.userType, "viewer"),
    gte(analyticsEvents.timestamp, startDate)
  ));

  return {
    creators: {
      total: creatorStats[0]?.total || 0,
      active: creatorActivity[0]?.activeCreators || 0,
      topPerformers: Math.round((creatorStats[0]?.withPitches || 0) * 0.1), // Top 10%
      avgPitchesPerCreator: Number(creatorActivity[0]?.avgPitches || 0),
    },
    investors: {
      total: investorStats[0]?.total || 0,
      active: investorActivity[0]?.activeInvestors || 0,
      avgDealsPerInvestor: Number(investorActivity[0]?.avgDeals || 0),
      totalInvestmentVolume: Number(investorActivity[0]?.totalVolume || 0),
    },
    viewers: {
      total: viewerStats[0]?.total || 0,
      engaged: viewerActivity[0]?.engaged || 0,
      conversionToSignup: 0.05, // 5% simplified conversion rate
    },
  };
}

async function getRevenueMetrics(startDate: Date, endDate: Date, previousStartDate: Date) {
  // Current period revenue
  const currentRevenue = await db.select({
    totalRevenue: sum(payments.amount),
    subscriptionRevenue: sql<number>`SUM(${payments.amount}) FILTER (WHERE ${payments.type} = 'subscription')`,
    successFeeRevenue: sql<number>`SUM(${payments.amount}) FILTER (WHERE ${payments.type} = 'success_fee')`,
  })
  .from(payments)
  .where(and(
    eq(payments.status, "completed"),
    gte(payments.createdAt, startDate)
  ));

  // Previous period revenue for growth calculation
  const previousRevenue = await db.select({
    totalRevenue: sum(payments.amount),
  })
  .from(payments)
  .where(and(
    eq(payments.status, "completed"),
    gte(payments.createdAt, previousStartDate),
    sql`${payments.createdAt} < ${startDate}`
  ));

  // Revenue per user
  const totalUsers = await db.select({
    count: count(),
  }).from(users);

  const currentTotal = Number(currentRevenue[0]?.totalRevenue || 0);
  const previousTotal = Number(previousRevenue[0]?.totalRevenue || 0);
  const revenueGrowth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
  const avgRevenuePerUser = (totalUsers[0]?.count || 0) > 0 ? currentTotal / (totalUsers[0]?.count || 1) : 0;

  // Revenue by segment
  const subscriptionRev = Number(currentRevenue[0]?.subscriptionRevenue || 0);
  const successFeeRev = Number(currentRevenue[0]?.successFeeRevenue || 0);

  return {
    totalRevenue: currentTotal,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    avgRevenuePerUser: Math.round(avgRevenuePerUser * 100) / 100,
    successFeeRevenue: successFeeRev,
    subscriptionRevenue: subscriptionRev,
    revenueBySegment: [
      {
        segment: "Subscriptions",
        revenue: subscriptionRev,
        percentage: currentTotal > 0 ? (subscriptionRev / currentTotal) * 100 : 0,
      },
      {
        segment: "Success Fees",
        revenue: successFeeRev,
        percentage: currentTotal > 0 ? (successFeeRev / currentTotal) * 100 : 0,
      },
    ],
  };
}

async function getOperationalMetrics(startDate: Date, endDate: Date) {
  // These would be connected to actual monitoring systems in production
  return {
    systemPerformance: {
      avgPageLoadTime: 1.2, // seconds
      errorRate: 0.05, // 0.05%
      uptime: 99.9, // 99.9%
    },
    contentModeration: {
      flaggedContent: 5,
      reviewsPending: 2,
      moderationAccuracy: 94.5, // 94.5%
    },
    supportMetrics: {
      ticketsCreated: 23,
      ticketsResolved: 21,
      avgResolutionTime: 4.5, // hours
      satisfactionScore: 4.2, // out of 5
    },
  };
}

async function getProductionInsights(startDate: Date, endDate: Date) {
  const insights = [];

  // Trend analysis
  const userGrowthTrend = await db.select({
    currentPeriod: count(),
  })
  .from(users)
  .where(gte(users.createdAt, startDate));

  const previousPeriod = await db.select({
    count: count(),
  })
  .from(users)
  .where(and(
    gte(users.createdAt, new Date(startDate.getTime() - (Date.now() - startDate.getTime()))),
    sql`${users.createdAt} < ${startDate}`
  ));

  const currentUsers = userGrowthTrend[0]?.currentPeriod || 0;
  const prevUsers = previousPeriod[0]?.count || 0;

  if (currentUsers > prevUsers * 1.2) {
    insights.push({
      type: "trend" as const,
      title: "Strong User Growth",
      description: "User acquisition is accelerating significantly above previous periods.",
      impact: "high" as const,
      recommendation: "Scale marketing efforts and ensure infrastructure can handle growth.",
      metrics: { growth: ((currentUsers - prevUsers) / prevUsers) * 100 },
    });
  }

  // Content quality analysis
  const lowEngagementPitches = await db.select({
    count: count(),
  })
  .from(pitches)
  .where(and(
    eq(pitches.status, "published"),
    gte(pitches.publishedAt || pitches.createdAt, startDate),
    sql`${pitches.viewCount} < 10`
  ));

  if ((lowEngagementPitches[0]?.count || 0) > 5) {
    insights.push({
      type: "risk" as const,
      title: "Content Quality Concerns",
      description: "Multiple recent pitches are receiving low engagement.",
      impact: "medium" as const,
      recommendation: "Implement content quality guidelines and creator education programs.",
      metrics: { lowEngagementCount: lowEngagementPitches[0]?.count || 0 },
    });
  }

  // Opportunity identification
  const topGenres = await db.select({
    genre: pitches.genre,
    avgEngagement: sql<number>`AVG(${pitches.viewCount} + ${pitches.ndaCount} * 5)`,
    pitchCount: count(),
  })
  .from(pitches)
  .where(and(
    eq(pitches.status, "published"),
    gte(pitches.publishedAt || pitches.createdAt, startDate)
  ))
  .groupBy(pitches.genre)
  .orderBy(desc(sql`AVG(${pitches.viewCount} + ${pitches.ndaCount} * 5)`))
  .limit(1);

  if (topGenres.length > 0) {
    insights.push({
      type: "opportunity" as const,
      title: `${topGenres[0].genre} Genre Performing Well`,
      description: `${topGenres[0].genre} content is showing above-average engagement.`,
      impact: "medium" as const,
      recommendation: `Focus marketing efforts on attracting more ${topGenres[0].genre} creators.`,
      metrics: { avgEngagement: topGenres[0].avgEngagement },
    });
  }

  return insights;
}

// Helper functions
function calculateQualityScore(avgViews: number, ndaConversionRate: number): number {
  // Simple quality score combining views and conversion
  const viewScore = Math.min(avgViews / 100, 1) * 50; // Max 50 points for 100+ views
  const conversionScore = Math.min(ndaConversionRate / 5, 1) * 50; // Max 50 points for 5%+ conversion
  return Math.round(viewScore + conversionScore);
}

function calculateEngagementScore(views: number, ndas: number): number {
  // Engagement score based on views and NDAs
  return views + ndas * 10; // NDAs weighted 10x
}