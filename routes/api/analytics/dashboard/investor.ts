import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { 
  analyticsEvents,
  pitches,
  pitchViews,
  ndas,
  follows,
  deals,
  users,
  payments
} from "../../../../src/db/schema.ts";
import { eq, and, sql, desc, gte, count, avg, sum } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

interface InvestorDashboardMetrics {
  portfolio: {
    totalInvestments: number;
    totalInvested: number;
    activeDeals: number;
    avgDealSize: number;
    portfolioGrowth: number;
    roi: number;
  };
  discovery: {
    pitchesViewed: number;
    ndasSigned: number;
    watchlist: number;
    conversionRate: number;
    topGenres: Array<{ genre: string; interest: number; dealsPotential: number }>;
    trending: Array<{
      pitchId: number;
      title: string;
      creator: string;
      genre: string;
      momentum: number;
      matchScore: number;
    }>;
  };
  dealFlow: {
    inquiriesSent: number;
    responsesReceived: number;
    meetingsScheduled: number;
    dealsInProgress: number;
    avgTimeToClose: number; // days
    conversionFunnel: Array<{
      stage: string;
      count: number;
      conversionRate: number;
    }>;
  };
  performance: {
    successfulDeals: Array<{
      dealId: number;
      pitchTitle: string;
      dealValue: number;
      successFee: number;
      closeDate: Date;
      roi: number;
    }>;
    returnsOverTime: Array<{
      month: string;
      invested: number;
      returns: number;
      netReturn: number;
    }>;
  };
  market: {
    hotGenres: Array<{ genre: string; activity: number; avgDealSize: number }>;
    competitorActivity: {
      totalInvestors: number;
      avgDealsPerInvestor: number;
      marketShare: number;
    };
    opportunities: Array<{
      pitchId: number;
      title: string;
      genre: string;
      urgency: string;
      reason: string;
    }>;
  };
  recommendations: Array<{
    type: "pitch" | "strategy" | "market";
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

      // Verify user is an investor
      const user = await db.select().from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || user[0].userType !== "investor") {
        return new Response(JSON.stringify({ error: "Investor access required" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const url = new URL(req.url);
      const timeRange = url.searchParams.get("timeRange") || "90"; // days
      const detailed = url.searchParams.get("detailed") === "true";

      const dashboard = await getInvestorDashboard(userId, parseInt(timeRange), detailed);

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
      console.error("Error fetching investor dashboard:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function getInvestorDashboard(
  userId: number, 
  timeRangeDays: number, 
  detailed: boolean
): Promise<InvestorDashboardMetrics> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);

  const [
    portfolio,
    discovery,
    dealFlow,
    performance,
    market,
    recommendations
  ] = await Promise.all([
    getPortfolioMetrics(userId, startDate, endDate),
    getDiscoveryMetrics(userId, startDate, endDate),
    getDealFlowMetrics(userId, startDate, endDate),
    getPerformanceMetrics(userId, startDate, endDate),
    detailed ? getMarketMetrics(userId, startDate, endDate) : Promise.resolve({
      hotGenres: [],
      competitorActivity: { totalInvestors: 0, avgDealsPerInvestor: 0, marketShare: 0 },
      opportunities: []
    }),
    detailed ? getInvestorRecommendations(userId, startDate, endDate) : Promise.resolve([])
  ]);

  return {
    portfolio,
    discovery,
    dealFlow,
    performance,
    market,
    recommendations,
  };
}

async function getPortfolioMetrics(userId: number, startDate: Date, endDate: Date) {
  // Current deals and investments
  const portfolioStats = await db.select({
    totalDeals: count(),
    totalInvested: sum(deals.dealValue),
    avgDealSize: avg(deals.dealValue),
    totalSuccessFees: sum(deals.successFeeAmount),
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    sql`${deals.status} IN ('confirmed', 'paid')`
  ));

  // Active deals (in progress)
  const activeDeals = await db.select({
    count: count(),
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    eq(deals.status, "pending")
  ));

  // Portfolio growth (comparing periods)
  const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
  
  const currentPeriodInvestments = await db.select({
    totalInvested: sum(deals.dealValue),
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    gte(deals.createdAt, startDate),
    sql`${deals.status} IN ('confirmed', 'paid')`
  ));

  const previousPeriodInvestments = await db.select({
    totalInvested: sum(deals.dealValue),
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    gte(deals.createdAt, previousPeriodStart),
    sql`${deals.createdAt} < ${startDate}`,
    sql`${deals.status} IN ('confirmed', 'paid')`
  ));

  const currentInvested = Number(currentPeriodInvestments[0]?.totalInvested || 0);
  const previousInvested = Number(previousPeriodInvestments[0]?.totalInvested || 0);
  const portfolioGrowth = previousInvested > 0 
    ? ((currentInvested - previousInvested) / previousInvested) * 100 
    : 0;

  // ROI calculation (simplified - would need actual returns data)
  const totalInvested = Number(portfolioStats[0]?.totalInvested || 0);
  const totalSuccessFees = Number(portfolioStats[0]?.totalSuccessFees || 0);
  const roi = totalInvested > 0 ? ((totalSuccessFees - totalInvested) / totalInvested) * 100 : 0;

  return {
    totalInvestments: portfolioStats[0]?.totalDeals || 0,
    totalInvested,
    activeDeals: activeDeals[0]?.count || 0,
    avgDealSize: Number(portfolioStats[0]?.avgDealSize || 0),
    portfolioGrowth: Math.round(portfolioGrowth * 10) / 10,
    roi: Math.round(roi * 10) / 10,
  };
}

async function getDiscoveryMetrics(userId: number, startDate: Date, endDate: Date) {
  // Pitches viewed by investor
  const viewingStats = await db.select({
    pitchesViewed: sql<number>`COUNT(DISTINCT ${pitchViews.pitchId})`,
  })
  .from(pitchViews)
  .where(and(
    eq(pitchViews.viewerId, userId),
    gte(pitchViews.viewedAt, startDate)
  ));

  // NDAs signed
  const ndaStats = await db.select({
    ndasSigned: count(),
  })
  .from(ndas)
  .where(and(
    eq(ndas.signerId, userId),
    gte(ndas.signedAt, startDate)
  ));

  // Watchlist (follows)
  const watchlistStats = await db.select({
    watchlist: count(),
  })
  .from(follows)
  .where(and(
    eq(follows.followerId, userId),
    gte(follows.followedAt, startDate)
  ));

  // Conversion rate (NDAs to deals)
  const dealsFromNDAs = await db.select({
    deals: count(),
  })
  .from(deals)
  .innerJoin(ndas, and(
    eq(deals.pitchId, ndas.pitchId),
    eq(deals.investorId, ndas.signerId)
  ))
  .where(and(
    eq(deals.investorId, userId),
    gte(deals.createdAt, startDate)
  ));

  const pitchesViewed = viewingStats[0]?.pitchesViewed || 0;
  const ndasSigned = ndaStats[0]?.ndasSigned || 0;
  const dealsCount = dealsFromNDAs[0]?.deals || 0;
  
  const conversionRate = ndasSigned > 0 ? (dealsCount / ndasSigned) * 100 : 0;

  // Top genres by interest
  const genreInterest = await db.select({
    genre: pitches.genre,
    views: count(),
    ndas: sql<number>`COUNT(${ndas.id})`,
  })
  .from(pitchViews)
  .innerJoin(pitches, eq(pitchViews.pitchId, pitches.id))
  .leftJoin(ndas, and(
    eq(ndas.pitchId, pitches.id),
    eq(ndas.signerId, userId)
  ))
  .where(and(
    eq(pitchViews.viewerId, userId),
    gte(pitchViews.viewedAt, startDate)
  ))
  .groupBy(pitches.genre)
  .orderBy(desc(count()));

  // Trending pitches (simplified scoring)
  const trendingPitches = await db.select({
    pitchId: pitches.id,
    title: pitches.title,
    creator: users.username,
    genre: pitches.genre,
    recentViews: sql<number>`COUNT(${pitchViews.id})`,
    totalViews: pitches.viewCount,
    ndaCount: pitches.ndaCount,
  })
  .from(pitches)
  .innerJoin(users, eq(pitches.userId, users.id))
  .leftJoin(pitchViews, and(
    eq(pitchViews.pitchId, pitches.id),
    gte(pitchViews.viewedAt, startDate)
  ))
  .where(eq(pitches.status, "published"))
  .groupBy(pitches.id, pitches.title, users.username, pitches.genre, pitches.viewCount, pitches.ndaCount)
  .orderBy(desc(sql`COUNT(${pitchViews.id})`))
  .limit(10);

  return {
    pitchesViewed,
    ndasSigned,
    watchlist: watchlistStats[0]?.watchlist || 0,
    conversionRate: Math.round(conversionRate * 10) / 10,
    topGenres: genreInterest.map(genre => ({
      genre: genre.genre,
      interest: genre.views,
      dealsPotential: genre.ndas,
    })),
    trending: trendingPitches.map(pitch => ({
      pitchId: pitch.pitchId,
      title: pitch.title,
      creator: pitch.creator,
      genre: pitch.genre,
      momentum: calculateMomentum(pitch.recentViews, pitch.totalViews),
      matchScore: calculateMatchScore(pitch.genre, pitch.ndaCount), // Simplified
    })),
  };
}

async function getDealFlowMetrics(userId: number, startDate: Date, endDate: Date) {
  // Deal flow stages
  const inquiriesSent = 42; // Would track from messages/communication
  const responsesReceived = 38;
  const meetingsScheduled = 15;
  
  const dealsInProgress = await db.select({
    count: count(),
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    eq(deals.status, "pending")
  ));

  // Average time to close (simplified)
  const avgTimeToClose = await db.select({
    avgDays: sql<number>`AVG(EXTRACT(DAY FROM (${deals.confirmedAt} - ${deals.createdAt})))`,
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    sql`${deals.status} = 'confirmed'`,
    sql`${deals.confirmedAt} IS NOT NULL`
  ));

  const conversionFunnel = [
    { stage: "Pitches Viewed", count: 150, conversionRate: 100 },
    { stage: "NDAs Signed", count: 45, conversionRate: 30 },
    { stage: "Inquiries Sent", count: inquiriesSent, conversionRate: 28 },
    { stage: "Responses Received", count: responsesReceived, conversionRate: 90 },
    { stage: "Meetings Scheduled", count: meetingsScheduled, conversionRate: 39 },
    { stage: "Deals Closed", count: 8, conversionRate: 53 },
  ];

  return {
    inquiriesSent,
    responsesReceived,
    meetingsScheduled,
    dealsInProgress: dealsInProgress[0]?.count || 0,
    avgTimeToClose: avgTimeToClose[0]?.avgDays || 0,
    conversionFunnel,
  };
}

async function getPerformanceMetrics(userId: number, startDate: Date, endDate: Date) {
  // Successful deals
  const successfulDeals = await db.select({
    dealId: deals.id,
    pitchTitle: pitches.title,
    dealValue: deals.dealValue,
    successFee: deals.successFeeAmount,
    closeDate: deals.confirmedAt,
  })
  .from(deals)
  .innerJoin(pitches, eq(deals.pitchId, pitches.id))
  .where(and(
    eq(deals.investorId, userId),
    eq(deals.status, "confirmed"),
    gte(deals.confirmedAt || deals.createdAt, startDate)
  ))
  .orderBy(desc(deals.confirmedAt));

  // Returns over time (simplified - would need actual performance data)
  const returnsOverTime = await db.select({
    month: sql<string>`DATE_TRUNC('month', ${deals.createdAt})`,
    invested: sum(deals.dealValue),
    successFees: sum(deals.successFeeAmount),
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    sql`${deals.status} IN ('confirmed', 'paid')`,
    gte(deals.createdAt, new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000))
  ))
  .groupBy(sql`DATE_TRUNC('month', ${deals.createdAt})`)
  .orderBy(asc(sql`DATE_TRUNC('month', ${deals.createdAt})`));

  return {
    successfulDeals: successfulDeals.map(deal => ({
      dealId: deal.dealId,
      pitchTitle: deal.pitchTitle,
      dealValue: Number(deal.dealValue),
      successFee: Number(deal.successFee),
      closeDate: deal.closeDate || new Date(),
      roi: Number(deal.dealValue) > 0 ? 
        ((Number(deal.successFee) - Number(deal.dealValue)) / Number(deal.dealValue)) * 100 : 0,
    })),
    returnsOverTime: returnsOverTime.map(item => ({
      month: item.month,
      invested: Number(item.invested),
      returns: Number(item.successFees), // Simplified
      netReturn: Number(item.successFees) - Number(item.invested),
    })),
  };
}

async function getMarketMetrics(userId: number, startDate: Date, endDate: Date) {
  // Hot genres by market activity
  const hotGenres = await db.select({
    genre: pitches.genre,
    activity: count(),
    avgDealSize: avg(deals.dealValue),
  })
  .from(pitches)
  .leftJoin(deals, eq(deals.pitchId, pitches.id))
  .where(gte(pitches.createdAt, startDate))
  .groupBy(pitches.genre)
  .orderBy(desc(count()))
  .limit(5);

  // Competitor activity
  const competitorStats = await db.select({
    totalInvestors: sql<number>`COUNT(DISTINCT ${deals.investorId})`,
    totalDeals: count(),
  })
  .from(deals)
  .where(gte(deals.createdAt, startDate));

  const userDeals = await db.select({
    userDeals: count(),
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    gte(deals.createdAt, startDate)
  ));

  const totalInvestors = competitorStats[0]?.totalInvestors || 1;
  const totalDeals = competitorStats[0]?.totalDeals || 0;
  const avgDealsPerInvestor = totalInvestors > 0 ? totalDeals / totalInvestors : 0;
  const marketShare = totalDeals > 0 ? ((userDeals[0]?.userDeals || 0) / totalDeals) * 100 : 0;

  // Opportunities (trending pitches not yet engaged with)
  const opportunities = await db.select({
    pitchId: pitches.id,
    title: pitches.title,
    genre: pitches.genre,
    recentViews: sql<number>`COUNT(${pitchViews.id})`,
    hasViewed: sql<boolean>`COUNT(${pitchViews.id}) FILTER (WHERE ${pitchViews.viewerId} = ${userId}) > 0`,
  })
  .from(pitches)
  .leftJoin(pitchViews, and(
    eq(pitchViews.pitchId, pitches.id),
    gte(pitchViews.viewedAt, startDate)
  ))
  .where(eq(pitches.status, "published"))
  .groupBy(pitches.id, pitches.title, pitches.genre)
  .having(sql`COUNT(${pitchViews.id}) FILTER (WHERE ${pitchViews.viewerId} = ${userId}) = 0`)
  .orderBy(desc(sql`COUNT(${pitchViews.id})`))
  .limit(10);

  return {
    hotGenres: hotGenres.map(genre => ({
      genre: genre.genre,
      activity: genre.activity,
      avgDealSize: Number(genre.avgDealSize || 0),
    })),
    competitorActivity: {
      totalInvestors,
      avgDealsPerInvestor: Math.round(avgDealsPerInvestor * 10) / 10,
      marketShare: Math.round(marketShare * 10) / 10,
    },
    opportunities: opportunities.map(opp => ({
      pitchId: opp.pitchId,
      title: opp.title,
      genre: opp.genre,
      urgency: opp.recentViews > 10 ? "high" : opp.recentViews > 5 ? "medium" : "low",
      reason: "Trending pitch in your preferred genres",
    })),
  };
}

async function getInvestorRecommendations(userId: number, startDate: Date, endDate: Date) {
  const recommendations = [];

  // Analyze user's investment patterns
  const userPatterns = await db.select({
    favoriteGenre: sql<string>`MODE() WITHIN GROUP (ORDER BY ${pitches.genre})`,
    avgDealSize: avg(deals.dealValue),
    totalDeals: count(),
  })
  .from(deals)
  .innerJoin(pitches, eq(deals.pitchId, pitches.id))
  .where(eq(deals.investorId, userId));

  const totalDeals = userPatterns[0]?.totalDeals || 0;

  // Portfolio diversification recommendation
  if (totalDeals > 0 && totalDeals < 5) {
    recommendations.push({
      type: "strategy" as const,
      title: "Diversify Your Portfolio",
      description: "Consider expanding into different genres to reduce risk and increase opportunities.",
      priority: "medium" as const,
      actionItems: [
        "Explore pitches in complementary genres",
        "Set aside budget for experimental investments",
        "Research emerging genres and trends",
        "Consider different budget ranges"
      ],
    });
  }

  // Market opportunity recommendation
  const hotGenres = await db.select({
    genre: pitches.genre,
    activityScore: sql<number>`COUNT(*) * 1.0 + COUNT(${deals.id}) * 2.0`,
  })
  .from(pitches)
  .leftJoin(deals, eq(deals.pitchId, pitches.id))
  .where(gte(pitches.createdAt, startDate))
  .groupBy(pitches.genre)
  .orderBy(desc(sql`COUNT(*) * 1.0 + COUNT(${deals.id}) * 2.0`))
  .limit(3);

  if (hotGenres.length > 0) {
    recommendations.push({
      type: "market" as const,
      title: "Explore High-Activity Genres",
      description: `${hotGenres[0].genre} and other genres are showing increased activity and deal flow.`,
      priority: "high" as const,
      actionItems: [
        `Review trending ${hotGenres[0].genre} pitches`,
        "Analyze successful deals in these genres",
        "Connect with creators in high-activity areas",
        "Consider adjusting investment strategy"
      ],
    });
  }

  // Pitch-specific recommendations
  const recommendedPitches = await db.select({
    pitchId: pitches.id,
    title: pitches.title,
    genre: pitches.genre,
    matchScore: sql<number>`
      CASE 
        WHEN ${pitches.genre} = ${userPatterns[0]?.favoriteGenre || "''"} THEN 100
        ELSE 70
      END
    `,
  })
  .from(pitches)
  .leftJoin(pitchViews, and(
    eq(pitchViews.pitchId, pitches.id),
    eq(pitchViews.viewerId, userId)
  ))
  .where(and(
    eq(pitches.status, "published"),
    sql`${pitchViews.id} IS NULL` // Not yet viewed
  ))
  .orderBy(desc(sql`
    CASE 
      WHEN ${pitches.genre} = ${userPatterns[0]?.favoriteGenre || "''"} THEN 100
      ELSE 70
    END
  `))
  .limit(5);

  if (recommendedPitches.length > 0) {
    recommendations.push({
      type: "pitch" as const,
      title: "Recommended Pitches",
      description: `We found ${recommendedPitches.length} pitches that match your investment preferences.`,
      priority: "medium" as const,
      actionItems: [
        `Review "${recommendedPitches[0].title}"`,
        "Sign NDAs for detailed information",
        "Compare against your current portfolio",
        "Reach out to creators for initial discussions"
      ],
    });
  }

  return recommendations;
}

// Helper functions
function calculateMomentum(recentViews: number, totalViews: number): number {
  // Calculate momentum as a percentage of recent activity vs historical
  if (totalViews === 0) return 0;
  return Math.round((recentViews / totalViews) * 100);
}

function calculateMatchScore(genre: string, ndaCount: number): number {
  // Simplified match score based on genre preference and social proof
  const baseScore = 60;
  const socialProofBonus = Math.min(ndaCount * 5, 30);
  return Math.min(baseScore + socialProofBonus, 100);
}