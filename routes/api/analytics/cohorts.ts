import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { 
  userCohorts,
  cohortUsers,
  users,
  analyticsEvents,
  userSessions,
  payments,
  deals
} from "../../../src/db/schema.ts";
import { eq, and, sql, desc, gte, lte, asc, count } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface CreateCohortRequest {
  name: string;
  description?: string;
  cohortType: string;
  periodStart: string;
  periodEnd: string;
  filters?: {
    userType?: string[];
    country?: string[];
    deviceType?: string[];
    utmSource?: string[];
    minEngagementScore?: number;
    [key: string]: any;
  };
}

interface CohortAnalysisRequest {
  cohortId: number;
  retentionPeriods?: string[]; // ["day1", "day7", "day30", "day90", "day365"]
  metrics?: string[]; // ["retention", "revenue", "engagement", "activity"]
}

export const handler: Handlers = {
  // Create new cohort
  async POST(req) {
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

      // Check permissions (admin/production users can create cohorts)
      const user = await db.select().from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || !["production", "investor"].includes(user[0].userType)) {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body: CreateCohortRequest = await req.json();
      const { 
        name, 
        description, 
        cohortType, 
        periodStart, 
        periodEnd, 
        filters = {} 
      } = body;

      if (!name || !cohortType || !periodStart || !periodEnd) {
        return new Response(JSON.stringify({ 
          error: "name, cohortType, periodStart, and periodEnd are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create cohort
      const cohort = await db.insert(userCohorts).values({
        name,
        description,
        cohortType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        filters,
        totalUsers: 0, // Will be calculated
        activeUsers: 0, // Will be calculated
      }).returning();

      // Populate cohort with users
      const populationResult = await populateCohort(cohort[0].id, {
        cohortType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        filters
      });

      // Update cohort with user counts
      await db.update(userCohorts)
        .set({
          totalUsers: populationResult.totalUsers,
          activeUsers: populationResult.activeUsers,
          updatedAt: new Date(),
        })
        .where(eq(userCohorts.id, cohort[0].id));

      return new Response(JSON.stringify({
        success: true,
        cohort: {
          ...cohort[0],
          totalUsers: populationResult.totalUsers,
          activeUsers: populationResult.activeUsers,
        },
        populationResult,
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating cohort:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Get cohorts or cohort analysis
  async GET(req) {
    try {
      const url = new URL(req.url);
      const cohortId = url.searchParams.get("cohortId");
      const analysis = url.searchParams.get("analysis");

      if (cohortId && analysis === "true") {
        return await getCohortAnalysis(req, parseInt(cohortId));
      } else if (cohortId) {
        return await getCohort(req, parseInt(cohortId));
      } else {
        return await getCohorts(req);
      }
    } catch (error) {
      console.error("Error handling GET request:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Update cohort (refresh data)
  async PUT(req) {
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

      const url = new URL(req.url);
      const cohortId = parseInt(url.searchParams.get("cohortId") || "0");

      if (!cohortId) {
        return new Response(JSON.stringify({ error: "cohortId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get cohort
      const cohort = await db.select().from(userCohorts)
        .where(eq(userCohorts.id, cohortId))
        .limit(1);

      if (!cohort.length) {
        return new Response(JSON.stringify({ error: "Cohort not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Refresh cohort data
      await refreshCohortData(cohortId);

      const updatedCohort = await db.select().from(userCohorts)
        .where(eq(userCohorts.id, cohortId))
        .limit(1);

      return new Response(JSON.stringify({
        success: true,
        cohort: updatedCohort[0],
        message: "Cohort data refreshed",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error updating cohort:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Get all cohorts
async function getCohorts(req: Request) {
  const cohorts = await db.select()
    .from(userCohorts)
    .orderBy(desc(userCohorts.createdAt));

  return new Response(JSON.stringify({
    success: true,
    cohorts,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Get specific cohort
async function getCohort(req: Request, cohortId: number) {
  const cohort = await db.select()
    .from(userCohorts)
    .where(eq(userCohorts.id, cohortId))
    .limit(1);

  if (!cohort.length) {
    return new Response(JSON.stringify({ error: "Cohort not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get cohort users summary
  const usersSummary = await db.select({
    totalUsers: count(),
    retainedUsers: sql<number>`COUNT(*) FILTER (WHERE ${cohortUsers.isRetained} = true)`,
    avgLifetimeValue: sql<number>`AVG(${cohortUsers.lifetimeValue})`,
    totalLifetimeValue: sql<number>`SUM(${cohortUsers.lifetimeValue})`,
  })
  .from(cohortUsers)
  .where(eq(cohortUsers.cohortId, cohortId));

  return new Response(JSON.stringify({
    success: true,
    cohort: cohort[0],
    summary: usersSummary[0] || {
      totalUsers: 0,
      retainedUsers: 0,
      avgLifetimeValue: 0,
      totalLifetimeValue: 0,
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Get cohort analysis
async function getCohortAnalysis(req: Request, cohortId: number) {
  const url = new URL(req.url);
  const retentionPeriods = url.searchParams.get("retentionPeriods")?.split(",") || 
    ["day1", "day7", "day30", "day90"];
  const metrics = url.searchParams.get("metrics")?.split(",") || 
    ["retention", "revenue", "engagement"];

  // Get cohort
  const cohort = await db.select().from(userCohorts)
    .where(eq(userCohorts.id, cohortId))
    .limit(1);

  if (!cohort.length) {
    return new Response(JSON.stringify({ error: "Cohort not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const analysis: any = {
    cohort: cohort[0],
    metrics: {},
  };

  // Calculate retention analysis
  if (metrics.includes("retention")) {
    analysis.metrics.retention = await calculateRetentionAnalysis(cohortId, retentionPeriods);
  }

  // Calculate revenue analysis
  if (metrics.includes("revenue")) {
    analysis.metrics.revenue = await calculateRevenueAnalysis(cohortId);
  }

  // Calculate engagement analysis
  if (metrics.includes("engagement")) {
    analysis.metrics.engagement = await calculateEngagementAnalysis(cohortId);
  }

  // Calculate activity analysis
  if (metrics.includes("activity")) {
    analysis.metrics.activity = await calculateActivityAnalysis(cohortId);
  }

  return new Response(JSON.stringify({
    success: true,
    analysis,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Populate cohort with users based on criteria
async function populateCohort(cohortId: number, criteria: {
  cohortType: string;
  periodStart: Date;
  periodEnd: Date;
  filters: any;
}) {
  // Clear existing cohort users
  await db.delete(cohortUsers)
    .where(eq(cohortUsers.cohortId, cohortId));

  let baseQuery = db.select({
    id: users.id,
    joinedAt: getJoinedAtField(criteria.cohortType),
  }).from(users);

  // Apply filters based on cohort type
  const conditions = [];

  // Date range condition
  const joinedAtField = getJoinedAtField(criteria.cohortType);
  conditions.push(gte(joinedAtField, criteria.periodStart));
  conditions.push(lte(joinedAtField, criteria.periodEnd));

  // Additional filters
  if (criteria.filters.userType && criteria.filters.userType.length > 0) {
    conditions.push(sql`${users.userType} = ANY(${criteria.filters.userType})`);
  }

  // Apply conditions
  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions));
  }

  const cohortUsersList = await baseQuery.execute();

  // Insert cohort users
  if (cohortUsersList.length > 0) {
    await db.insert(cohortUsers).values(
      cohortUsersList.map(user => ({
        cohortId,
        userId: user.id,
        joinedAt: user.joinedAt,
        lastActiveAt: null, // Will be calculated
        isRetained: false, // Will be calculated
        retentionPeriods: {},
        lifetimeValue: "0",
        totalEvents: 0,
        totalSessions: 0,
      }))
    );

    // Calculate initial metrics for all cohort users
    await calculateCohortUserMetrics(cohortId);
  }

  return {
    totalUsers: cohortUsersList.length,
    activeUsers: 0, // Will be calculated in metrics
  };
}

// Get joined date field based on cohort type
function getJoinedAtField(cohortType: string) {
  switch (cohortType) {
    case "registration":
      return users.createdAt;
    case "first_pitch":
      // Would need to join with pitches table
      return users.createdAt; // Fallback
    case "first_nda":
      // Would need to join with NDAs table
      return users.createdAt; // Fallback
    default:
      return users.createdAt;
  }
}

// Calculate metrics for all users in a cohort
async function calculateCohortUserMetrics(cohortId: number) {
  const cohortUsersList = await db.select()
    .from(cohortUsers)
    .where(eq(cohortUsers.cohortId, cohortId));

  for (const cohortUser of cohortUsersList) {
    await calculateSingleUserMetrics(cohortUser.cohortId, cohortUser.userId, cohortUser.joinedAt);
  }
}

// Calculate metrics for a single cohort user
async function calculateSingleUserMetrics(cohortId: number, userId: number, joinedAt: Date) {
  // Calculate total events and sessions
  const eventStats = await db.select({
    totalEvents: count(),
  })
  .from(analyticsEvents)
  .where(eq(analyticsEvents.userId, userId));

  const sessionStats = await db.select({
    totalSessions: count(),
    lastActiveAt: sql<Date>`MAX(${userSessions.lastActivity})`,
  })
  .from(userSessions)
  .where(eq(userSessions.userId, userId));

  // Calculate lifetime value from payments and deals
  const revenueStats = await db.select({
    totalPayments: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
  })
  .from(payments)
  .where(and(
    eq(payments.userId, userId),
    eq(payments.status, "completed")
  ));

  const dealStats = await db.select({
    totalDeals: sql<number>`COALESCE(SUM(${deals.successFeeAmount}), 0)`,
  })
  .from(deals)
  .where(and(
    eq(deals.investorId, userId),
    eq(deals.status, "paid")
  ));

  const lifetimeValue = (revenueStats[0]?.totalPayments || 0) + (dealStats[0]?.totalDeals || 0);

  // Calculate retention periods
  const retentionPeriods = await calculateRetentionPeriods(userId, joinedAt);

  // Determine if user is retained (active in last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const isRetained = sessionStats[0]?.lastActiveAt && 
    new Date(sessionStats[0].lastActiveAt) > thirtyDaysAgo;

  // Update cohort user record
  await db.update(cohortUsers)
    .set({
      lastActiveAt: sessionStats[0]?.lastActiveAt || null,
      isRetained: isRetained || false,
      retentionPeriods,
      lifetimeValue: lifetimeValue.toString(),
      totalEvents: eventStats[0]?.totalEvents || 0,
      totalSessions: sessionStats[0]?.totalSessions || 0,
    })
    .where(and(
      eq(cohortUsers.cohortId, cohortId),
      eq(cohortUsers.userId, userId)
    ));
}

// Calculate retention periods for a user
async function calculateRetentionPeriods(userId: number, joinedAt: Date) {
  const retentionPeriods: any = {};
  
  const periods = [
    { key: "day1", days: 1 },
    { key: "day7", days: 7 },
    { key: "day30", days: 30 },
    { key: "day90", days: 90 },
    { key: "day365", days: 365 },
  ];

  for (const period of periods) {
    const periodStart = new Date(joinedAt.getTime() + period.days * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000); // Next day

    const activity = await db.select({ count: count() })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.userId, userId),
        gte(analyticsEvents.timestamp, periodStart),
        lte(analyticsEvents.timestamp, periodEnd)
      ));

    retentionPeriods[period.key] = (activity[0]?.count || 0) > 0;
  }

  return retentionPeriods;
}

// Calculate retention analysis for cohort
async function calculateRetentionAnalysis(cohortId: number, retentionPeriods: string[]) {
  const totalUsers = await db.select({
    count: count(),
  })
  .from(cohortUsers)
  .where(eq(cohortUsers.cohortId, cohortId));

  const total = totalUsers[0]?.count || 0;
  if (total === 0) return { totalUsers: 0, periods: [] };

  const results = [];

  for (const period of retentionPeriods) {
    const retainedUsers = await db.select({
      count: count(),
    })
    .from(cohortUsers)
    .where(and(
      eq(cohortUsers.cohortId, cohortId),
      sql`${cohortUsers.retentionPeriods}->>'${period}' = 'true'`
    ));

    const retained = retainedUsers[0]?.count || 0;
    
    results.push({
      period,
      retainedUsers: retained,
      retentionRate: total > 0 ? (retained / total) * 100 : 0,
    });
  }

  return {
    totalUsers: total,
    periods: results,
  };
}

// Calculate revenue analysis for cohort
async function calculateRevenueAnalysis(cohortId: number) {
  const revenueStats = await db.select({
    totalRevenue: sql<number>`SUM(${cohortUsers.lifetimeValue}::numeric)`,
    avgRevenue: sql<number>`AVG(${cohortUsers.lifetimeValue}::numeric)`,
    payingUsers: sql<number>`COUNT(*) FILTER (WHERE ${cohortUsers.lifetimeValue}::numeric > 0)`,
    totalUsers: count(),
  })
  .from(cohortUsers)
  .where(eq(cohortUsers.cohortId, cohortId));

  const stats = revenueStats[0] || {
    totalRevenue: 0,
    avgRevenue: 0,
    payingUsers: 0,
    totalUsers: 0,
  };

  return {
    totalRevenue: stats.totalRevenue || 0,
    averageRevenue: stats.avgRevenue || 0,
    payingUsers: stats.payingUsers || 0,
    totalUsers: stats.totalUsers || 0,
    conversionRate: stats.totalUsers > 0 ? (stats.payingUsers / stats.totalUsers) * 100 : 0,
  };
}

// Calculate engagement analysis for cohort
async function calculateEngagementAnalysis(cohortId: number) {
  const engagementStats = await db.select({
    avgEvents: sql<number>`AVG(${cohortUsers.totalEvents})`,
    avgSessions: sql<number>`AVG(${cohortUsers.totalSessions})`,
    totalEvents: sql<number>`SUM(${cohortUsers.totalEvents})`,
    totalSessions: sql<number>`SUM(${cohortUsers.totalSessions})`,
    activeUsers: sql<number>`COUNT(*) FILTER (WHERE ${cohortUsers.isRetained} = true)`,
    totalUsers: count(),
  })
  .from(cohortUsers)
  .where(eq(cohortUsers.cohortId, cohortId));

  const stats = engagementStats[0] || {
    avgEvents: 0,
    avgSessions: 0,
    totalEvents: 0,
    totalSessions: 0,
    activeUsers: 0,
    totalUsers: 0,
  };

  return {
    averageEventsPerUser: stats.avgEvents || 0,
    averageSessionsPerUser: stats.avgSessions || 0,
    totalEvents: stats.totalEvents || 0,
    totalSessions: stats.totalSessions || 0,
    activeUsers: stats.activeUsers || 0,
    totalUsers: stats.totalUsers || 0,
    activityRate: stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0,
  };
}

// Calculate activity analysis for cohort
async function calculateActivityAnalysis(cohortId: number) {
  // Get activity distribution by week since joining
  const weeklyActivity = await db.execute(sql`
    WITH cohort_users_with_weeks AS (
      SELECT 
        cu.user_id,
        cu.joined_at,
        EXTRACT(WEEK FROM ae.timestamp) - EXTRACT(WEEK FROM cu.joined_at) as weeks_since_join,
        COUNT(*) as events
      FROM cohort_users cu
      LEFT JOIN analytics_events ae ON cu.user_id = ae.user_id
      WHERE cu.cohort_id = ${cohortId}
        AND ae.timestamp >= cu.joined_at
      GROUP BY cu.user_id, cu.joined_at, weeks_since_join
    )
    SELECT 
      weeks_since_join,
      COUNT(DISTINCT user_id) as active_users,
      SUM(events) as total_events,
      AVG(events) as avg_events_per_user
    FROM cohort_users_with_weeks
    WHERE weeks_since_join IS NOT NULL
      AND weeks_since_join >= 0 
      AND weeks_since_join <= 12
    GROUP BY weeks_since_join
    ORDER BY weeks_since_join
  `);

  return weeklyActivity.rows;
}

// Refresh cohort data
async function refreshCohortData(cohortId: number) {
  // Recalculate all metrics for cohort users
  await calculateCohortUserMetrics(cohortId);

  // Update cohort summary
  const summary = await db.select({
    totalUsers: count(),
    activeUsers: sql<number>`COUNT(*) FILTER (WHERE ${cohortUsers.isRetained} = true)`,
  })
  .from(cohortUsers)
  .where(eq(cohortUsers.cohortId, cohortId));

  await db.update(userCohorts)
    .set({
      totalUsers: summary[0]?.totalUsers || 0,
      activeUsers: summary[0]?.activeUsers || 0,
      updatedAt: new Date(),
    })
    .where(eq(userCohorts.id, cohortId));
}