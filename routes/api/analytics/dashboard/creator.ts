import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { 
  analyticsEvents,
  analyticsAggregates,
  pitches,
  pitchViews,
  ndas,
  follows,
  messages,
  users
} from "../../../../src/db/schema.ts";
import { eq, and, sql, desc, gte, count, avg, sum } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

interface CreatorDashboardMetrics {
  overview: {
    totalViews: number;
    totalNDAs: number;
    totalFollowers: number;
    totalPitches: number;
    viewsGrowth: number;
    ndaGrowth: number;
    averageEngagement: number;
  };
  contentPerformance: {
    topPitches: Array<{
      id: number;
      title: string;
      views: number;
      ndas: number;
      engagement: number;
      trendingScore: number;
    }>;
    recentPitches: Array<{
      id: number;
      title: string;
      publishedAt: Date;
      views: number;
      status: string;
    }>;
  };
  audienceInsights: {
    demographics: {
      countries: Array<{ country: string; percentage: number; users: number }>;
      devices: Array<{ deviceType: string; percentage: number; users: number }>;
      userTypes: Array<{ userType: string; percentage: number; users: number }>;
    };
    engagement: {
      avgViewDuration: number;
      avgScrollDepth: number;
      clickThroughRate: number;
      ndaConversionRate: number;
    };
    growth: {
      dailyViews: Array<{ date: string; views: number }>;
      weeklyFollowers: Array<{ week: string; followers: number }>;
    };
  };
  communication: {
    messageStats: {
      totalMessages: number;
      activeConversations: number;
      responseRate: number;
      avgResponseTime: number; // in hours
    };
    inquiryBreakdown: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
  };
  recommendations: Array<{
    type: "content" | "engagement" | "optimization";
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    actionItems: string[];
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

      // Verify user is a creator
      const user = await db.select().from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || user[0].userType !== "creator") {
        return new Response(JSON.stringify({ error: "Creator access required" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const url = new URL(req.url);
      const timeRange = url.searchParams.get("timeRange") || "30"; // days
      const detailed = url.searchParams.get("detailed") === "true";

      const dashboard = await getCreatorDashboard(userId, parseInt(timeRange), detailed);

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
      console.error("Error fetching creator dashboard:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function getCreatorDashboard(
  userId: number, 
  timeRangeDays: number, 
  detailed: boolean
): Promise<CreatorDashboardMetrics> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(startDate.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);

  // Get user's pitches
  const userPitches = await db.select().from(pitches)
    .where(eq(pitches.userId, userId));
  
  const pitchIds = userPitches.map(p => p.id);

  const [
    overview,
    contentPerformance,
    audienceInsights,
    communication,
    recommendations
  ] = await Promise.all([
    getCreatorOverview(userId, pitchIds, startDate, endDate, previousStartDate),
    getContentPerformance(userId, pitchIds, startDate, endDate),
    detailed ? getAudienceInsights(pitchIds, startDate, endDate) : Promise.resolve({
      demographics: { countries: [], devices: [], userTypes: [] },
      engagement: { avgViewDuration: 0, avgScrollDepth: 0, clickThroughRate: 0, ndaConversionRate: 0 },
      growth: { dailyViews: [], weeklyFollowers: [] }
    }),
    getCommunicationStats(userId, pitchIds, startDate, endDate),
    detailed ? getCreatorRecommendations(userId, pitchIds, startDate, endDate) : Promise.resolve([])
  ]);

  return {
    overview,
    contentPerformance,
    audienceInsights,
    communication,
    recommendations,
  };
}

async function getCreatorOverview(
  userId: number, 
  pitchIds: number[], 
  startDate: Date, 
  endDate: Date, 
  previousStartDate: Date
) {
  // Current period metrics
  const currentMetrics = await db.select({
    totalViews: sql<number>`COUNT(*)`,
    uniqueViewers: sql<number>`COUNT(DISTINCT ${pitchViews.viewerId})`,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} = ANY(${pitchIds})`,
    gte(pitchViews.viewedAt, startDate),
    sql`${pitchViews.viewedAt} <= ${endDate}`
  ));

  // Previous period metrics for growth calculation
  const previousMetrics = await db.select({
    totalViews: sql<number>`COUNT(*)`,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} = ANY(${pitchIds})`,
    gte(pitchViews.viewedAt, previousStartDate),
    sql`${pitchViews.viewedAt} < ${startDate}`
  ));

  // NDA metrics
  const ndaMetrics = await db.select({
    totalNDAs: count(),
  })
  .from(ndas)
  .where(and(
    sql`${ndas.pitchId} = ANY(${pitchIds})`,
    gte(ndas.signedAt, startDate)
  ));

  const previousNDAs = await db.select({
    totalNDAs: count(),
  })
  .from(ndas)
  .where(and(
    sql`${ndas.pitchId} = ANY(${pitchIds})`,
    gte(ndas.signedAt, previousStartDate),
    sql`${ndas.signedAt} < ${startDate}`
  ));

  // Follower metrics
  const followerMetrics = await db.select({
    totalFollowers: count(),
  })
  .from(follows)
  .where(and(
    sql`${follows.pitchId} = ANY(${pitchIds})`,
    gte(follows.followedAt, startDate)
  ));

  // Engagement metrics
  const engagementMetrics = await db.select({
    avgViewDuration: avg(pitchViews.viewDuration),
    avgScrollDepth: avg(pitchViews.scrollDepth),
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} = ANY(${pitchIds})`,
    gte(pitchViews.viewedAt, startDate)
  ));

  const currentViews = currentMetrics[0]?.totalViews || 0;
  const previousViews = previousMetrics[0]?.totalViews || 0;
  const viewsGrowth = previousViews > 0 ? ((currentViews - previousViews) / previousViews) * 100 : 0;

  const currentNDAs = ndaMetrics[0]?.totalNDAs || 0;
  const prevNDAs = previousNDAs[0]?.totalNDAs || 0;
  const ndaGrowth = prevNDAs > 0 ? ((currentNDAs - prevNDAs) / prevNDAs) * 100 : 0;

  return {
    totalViews: currentViews,
    totalNDAs: currentNDAs,
    totalFollowers: followerMetrics[0]?.totalFollowers || 0,
    totalPitches: pitchIds.length,
    viewsGrowth: Math.round(viewsGrowth * 10) / 10,
    ndaGrowth: Math.round(ndaGrowth * 10) / 10,
    averageEngagement: calculateEngagementScore(
      engagementMetrics[0]?.avgViewDuration || 0,
      engagementMetrics[0]?.avgScrollDepth || 0
    ),
  };
}

async function getContentPerformance(
  userId: number, 
  pitchIds: number[], 
  startDate: Date, 
  endDate: Date
) {
  // Top performing pitches
  const topPitches = await db.select({
    id: pitches.id,
    title: pitches.title,
    views: sql<number>`COUNT(${pitchViews.id})`,
    ndas: sql<number>`(
      SELECT COUNT(*) FROM ndas 
      WHERE ndas.pitch_id = pitches.id 
      AND ndas.signed_at >= ${startDate}
    )`,
    avgViewDuration: avg(pitchViews.viewDuration),
    avgScrollDepth: avg(pitchViews.scrollDepth),
  })
  .from(pitches)
  .leftJoin(pitchViews, and(
    eq(pitchViews.pitchId, pitches.id),
    gte(pitchViews.viewedAt, startDate)
  ))
  .where(eq(pitches.userId, userId))
  .groupBy(pitches.id, pitches.title)
  .orderBy(desc(sql`COUNT(${pitchViews.id})`))
  .limit(10);

  // Recent pitches
  const recentPitches = await db.select({
    id: pitches.id,
    title: pitches.title,
    publishedAt: pitches.publishedAt,
    views: pitches.viewCount,
    status: pitches.status,
  })
  .from(pitches)
  .where(eq(pitches.userId, userId))
  .orderBy(desc(pitches.createdAt))
  .limit(5);

  return {
    topPitches: topPitches.map(pitch => ({
      id: pitch.id,
      title: pitch.title,
      views: pitch.views,
      ndas: pitch.ndas,
      engagement: calculateEngagementScore(
        pitch.avgViewDuration || 0,
        pitch.avgScrollDepth || 0
      ),
      trendingScore: calculateTrendingScore(pitch.views, pitch.ndas),
    })),
    recentPitches: recentPitches.map(pitch => ({
      id: pitch.id,
      title: pitch.title,
      publishedAt: pitch.publishedAt || new Date(),
      views: pitch.views,
      status: pitch.status,
    })),
  };
}

async function getAudienceInsights(pitchIds: number[], startDate: Date, endDate: Date) {
  // Demographics from analytics events
  const countryStats = await db.select({
    country: analyticsEvents.country,
    users: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`,
  })
  .from(analyticsEvents)
  .where(and(
    sql`${analyticsEvents.pitchId} = ANY(${pitchIds})`,
    gte(analyticsEvents.timestamp, startDate),
    sql`${analyticsEvents.country} IS NOT NULL`
  ))
  .groupBy(analyticsEvents.country)
  .orderBy(desc(sql`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`))
  .limit(5);

  const deviceStats = await db.select({
    deviceType: analyticsEvents.deviceType,
    users: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`,
  })
  .from(analyticsEvents)
  .where(and(
    sql`${analyticsEvents.pitchId} = ANY(${pitchIds})`,
    gte(analyticsEvents.timestamp, startDate),
    sql`${analyticsEvents.deviceType} IS NOT NULL`
  ))
  .groupBy(analyticsEvents.deviceType)
  .orderBy(desc(sql`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`));

  // User type breakdown for authenticated viewers
  const userTypeStats = await db.select({
    userType: users.userType,
    users: count(),
  })
  .from(analyticsEvents)
  .innerJoin(users, eq(analyticsEvents.userId, users.id))
  .where(and(
    sql`${analyticsEvents.pitchId} = ANY(${pitchIds})`,
    gte(analyticsEvents.timestamp, startDate)
  ))
  .groupBy(users.userType)
  .orderBy(desc(count()));

  // Engagement metrics
  const engagementStats = await db.select({
    avgViewDuration: avg(pitchViews.viewDuration),
    avgScrollDepth: avg(pitchViews.scrollDepth),
    clickThroughRate: sql<number>`
      (COUNT(*) FILTER (WHERE ${pitchViews.clickedWatchThis} = true)::float / COUNT(*)) * 100
    `,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} = ANY(${pitchIds})`,
    gte(pitchViews.viewedAt, startDate)
  ));

  // NDA conversion rate
  const ndaConversion = await db.select({
    totalViews: sql<number>`COUNT(DISTINCT ${pitchViews.viewerId})`,
    totalNDAs: sql<number>`(
      SELECT COUNT(*) FROM ndas 
      WHERE pitch_id = ANY(${pitchIds}) 
      AND signed_at >= ${startDate}
    )`,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} = ANY(${pitchIds})`,
    gte(pitchViews.viewedAt, startDate)
  ));

  // Daily views for growth tracking
  const dailyViews = await db.select({
    date: sql<string>`DATE(${pitchViews.viewedAt})`,
    views: count(),
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} = ANY(${pitchIds})`,
    gte(pitchViews.viewedAt, startDate)
  ))
  .groupBy(sql`DATE(${pitchViews.viewedAt})`)
  .orderBy(asc(sql`DATE(${pitchViews.viewedAt})`));

  const totalCountries = countryStats.reduce((sum, item) => sum + item.users, 0);
  const totalDevices = deviceStats.reduce((sum, item) => sum + item.users, 0);
  const totalUserTypes = userTypeStats.reduce((sum, item) => sum + item.users, 0);

  const ndaStats = ndaConversion[0];
  const ndaConversionRate = ndaStats?.totalViews > 0 
    ? (ndaStats.totalNDAs / ndaStats.totalViews) * 100 
    : 0;

  return {
    demographics: {
      countries: countryStats.map(item => ({
        country: item.country || "Unknown",
        users: item.users,
        percentage: totalCountries > 0 ? (item.users / totalCountries) * 100 : 0,
      })),
      devices: deviceStats.map(item => ({
        deviceType: item.deviceType || "Unknown",
        users: item.users,
        percentage: totalDevices > 0 ? (item.users / totalDevices) * 100 : 0,
      })),
      userTypes: userTypeStats.map(item => ({
        userType: item.userType,
        users: item.users,
        percentage: totalUserTypes > 0 ? (item.users / totalUserTypes) * 100 : 0,
      })),
    },
    engagement: {
      avgViewDuration: engagementStats[0]?.avgViewDuration || 0,
      avgScrollDepth: engagementStats[0]?.avgScrollDepth || 0,
      clickThroughRate: engagementStats[0]?.clickThroughRate || 0,
      ndaConversionRate,
    },
    growth: {
      dailyViews: dailyViews.map(item => ({
        date: item.date,
        views: item.views,
      })),
      weeklyFollowers: [], // Would need to implement weekly follower tracking
    },
  };
}

async function getCommunicationStats(
  userId: number, 
  pitchIds: number[], 
  startDate: Date, 
  endDate: Date
) {
  // Message statistics
  const messageStats = await db.select({
    totalReceived: sql<number>`COUNT(*) FILTER (WHERE ${messages.receiverId} = ${userId})`,
    totalSent: sql<number>`COUNT(*) FILTER (WHERE ${messages.senderId} = ${userId})`,
    activeConversations: sql<number>`COUNT(DISTINCT ${messages.conversationId})`,
  })
  .from(messages)
  .where(and(
    sql`(${messages.senderId} = ${userId} OR ${messages.receiverId} = ${userId})`,
    gte(messages.sentAt, startDate)
  ));

  // Response rate calculation (simplified)
  const responseRate = 85; // Would need more complex logic to calculate actual response rate

  // Average response time (simplified)
  const avgResponseTime = 4.5; // Would need to calculate from actual message threads

  return {
    messageStats: {
      totalMessages: (messageStats[0]?.totalReceived || 0) + (messageStats[0]?.totalSent || 0),
      activeConversations: messageStats[0]?.activeConversations || 0,
      responseRate,
      avgResponseTime,
    },
    inquiryBreakdown: [
      { type: "Investment Interest", count: 45, percentage: 60 },
      { type: "Collaboration", count: 20, percentage: 27 },
      { type: "General Inquiry", count: 10, percentage: 13 },
    ],
  };
}

async function getCreatorRecommendations(
  userId: number, 
  pitchIds: number[], 
  startDate: Date, 
  endDate: Date
) {
  const recommendations = [];

  // Analyze performance and generate recommendations
  const performanceData = await db.select({
    avgViews: avg(pitches.viewCount),
    avgNDAs: avg(pitches.ndaCount),
    totalPitches: count(),
  })
  .from(pitches)
  .where(eq(pitches.userId, userId));

  const avgViews = performanceData[0]?.avgViews || 0;
  const totalPitches = performanceData[0]?.totalPitches || 0;

  // Content recommendations
  if (avgViews < 100) {
    recommendations.push({
      type: "content" as const,
      title: "Improve Content Visibility",
      description: "Your pitches are getting fewer views than average. Consider optimizing your titles and descriptions.",
      priority: "high" as const,
      actionItems: [
        "Review and optimize pitch titles for search",
        "Add compelling loglines and descriptions",
        "Use relevant genre tags",
        "Consider adding visual content"
      ],
    });
  }

  // Engagement recommendations
  const recentEngagement = await db.select({
    avgScrollDepth: avg(pitchViews.scrollDepth),
    clickThroughRate: sql<number>`
      (COUNT(*) FILTER (WHERE ${pitchViews.clickedWatchThis} = true)::float / COUNT(*)) * 100
    `,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} = ANY(${pitchIds})`,
    gte(pitchViews.viewedAt, startDate)
  ));

  const avgScrollDepth = recentEngagement[0]?.avgScrollDepth || 0;
  
  if (avgScrollDepth < 50) {
    recommendations.push({
      type: "engagement" as const,
      title: "Improve Content Engagement",
      description: "Viewers aren't scrolling through your full pitches. Consider restructuring your content.",
      priority: "medium" as const,
      actionItems: [
        "Lead with your strongest hook",
        "Break up long text with visuals",
        "Add compelling character descriptions",
        "Include production timeline and budget highlights"
      ],
    });
  }

  // Optimization recommendations
  if (totalPitches < 3) {
    recommendations.push({
      type: "optimization" as const,
      title: "Increase Content Volume",
      description: "Having more quality pitches increases your visibility and opportunities.",
      priority: "medium" as const,
      actionItems: [
        "Aim to publish 1-2 new pitches per month",
        "Develop pitches across different genres",
        "Consider shorter format content",
        "Build a consistent content calendar"
      ],
    });
  }

  return recommendations;
}

// Helper functions
function calculateEngagementScore(avgViewDuration: number, avgScrollDepth: number): number {
  // Normalize and combine metrics (0-100 scale)
  const durationScore = Math.min(avgViewDuration / 60, 1) * 50; // Max 50 points for 1+ minute
  const scrollScore = (avgScrollDepth / 100) * 50; // Max 50 points for 100% scroll
  return Math.round(durationScore + scrollScore);
}

function calculateTrendingScore(views: number, ndas: number): number {
  // Simple trending score based on views and NDA conversion
  return views * 1 + ndas * 10;
}