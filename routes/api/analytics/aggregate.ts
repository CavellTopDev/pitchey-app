import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { 
  analyticsEvents, 
  analyticsAggregates,
  userSessions,
  pitches,
  users,
  aggregationPeriodEnum,
  eventTypeEnum
} from "../../../src/db/schema.ts";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface AggregationRequest {
  period: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  startDate: string;
  endDate: string;
  dimensions?: string[]; // e.g., ["userId", "pitchId", "country", "deviceType"]
  force?: boolean; // Force re-aggregation
}

export const handler: Handlers = {
  // Trigger aggregation (admin only)
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

      // Check if user is admin (in a real app, check user role)
      const user = await db.select().from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || user[0].userType !== "production") {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body: AggregationRequest = await req.json();
      const { period, startDate, endDate, dimensions = [], force = false } = body;

      if (!period || !startDate || !endDate) {
        return new Response(JSON.stringify({ 
          error: "period, startDate, and endDate are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await performAggregation({
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        dimensions,
        force
      });

      return new Response(JSON.stringify({
        success: true,
        ...result
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error triggering aggregation:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Get aggregated data
  async GET(req) {
    try {
      const url = new URL(req.url);
      const period = url.searchParams.get("period") as "hourly" | "daily" | "weekly" | "monthly" | "yearly";
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const userId = url.searchParams.get("userId");
      const pitchId = url.searchParams.get("pitchId");
      const eventType = url.searchParams.get("eventType");
      const country = url.searchParams.get("country");
      const deviceType = url.searchParams.get("deviceType");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);

      if (!period || !startDate || !endDate) {
        return new Response(JSON.stringify({ 
          error: "period, startDate, and endDate are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Build query conditions
      const conditions = [
        eq(analyticsAggregates.period, period),
        gte(analyticsAggregates.periodStart, new Date(startDate)),
        lte(analyticsAggregates.periodEnd, new Date(endDate))
      ];

      if (userId) {
        conditions.push(eq(analyticsAggregates.userId, parseInt(userId)));
      }
      if (pitchId) {
        conditions.push(eq(analyticsAggregates.pitchId, parseInt(pitchId)));
      }
      if (eventType) {
        conditions.push(eq(analyticsAggregates.eventType, eventType as any));
      }
      if (country) {
        conditions.push(eq(analyticsAggregates.country, country));
      }
      if (deviceType) {
        conditions.push(eq(analyticsAggregates.deviceType, deviceType));
      }

      const aggregates = await db.select()
        .from(analyticsAggregates)
        .where(and(...conditions))
        .orderBy(asc(analyticsAggregates.periodStart))
        .limit(limit);

      return new Response(JSON.stringify({
        success: true,
        data: aggregates,
        meta: {
          period,
          startDate,
          endDate,
          totalRecords: aggregates.length,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching aggregates:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Main aggregation function
async function performAggregation({
  period,
  startDate,
  endDate,
  dimensions,
  force
}: {
  period: string;
  startDate: Date;
  endDate: Date;
  dimensions: string[];
  force: boolean;
}) {
  const periods = generatePeriods(period as any, startDate, endDate);
  let processedPeriods = 0;
  let skippedPeriods = 0;
  const errors: string[] = [];

  for (const { periodStart, periodEnd } of periods) {
    try {
      // Check if aggregation already exists
      if (!force) {
        const existing = await db.select()
          .from(analyticsAggregates)
          .where(and(
            eq(analyticsAggregates.period, period as any),
            eq(analyticsAggregates.periodStart, periodStart),
            eq(analyticsAggregates.periodEnd, periodEnd)
          ))
          .limit(1);

        if (existing.length > 0) {
          skippedPeriods++;
          continue;
        }
      }

      // Generate all dimension combinations
      const dimensionCombinations = generateDimensionCombinations(dimensions);

      for (const dimCombo of dimensionCombinations) {
        await aggregateForPeriodAndDimensions({
          period: period as any,
          periodStart,
          periodEnd,
          dimensions: dimCombo
        });
      }

      processedPeriods++;
    } catch (error) {
      console.error(`Error aggregating period ${periodStart} to ${periodEnd}:`, error);
      errors.push(`${periodStart.toISOString()}: ${error.message}`);
    }
  }

  return {
    processedPeriods,
    skippedPeriods,
    totalPeriods: periods.length,
    errors
  };
}

// Generate time periods for aggregation
function generatePeriods(
  period: "hourly" | "daily" | "weekly" | "monthly" | "yearly",
  startDate: Date,
  endDate: Date
) {
  const periods: Array<{ periodStart: Date; periodEnd: Date }> = [];
  let current = new Date(startDate);

  while (current < endDate) {
    const periodStart = new Date(current);
    let periodEnd: Date;

    switch (period) {
      case "hourly":
        periodEnd = new Date(current);
        periodEnd.setHours(current.getHours() + 1, 0, 0, 0);
        break;
      case "daily":
        periodEnd = new Date(current);
        periodEnd.setDate(current.getDate() + 1);
        periodEnd.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        periodEnd = new Date(current);
        periodEnd.setDate(current.getDate() + 7);
        periodEnd.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        periodEnd = new Date(current);
        periodEnd.setMonth(current.getMonth() + 1, 1);
        periodEnd.setHours(0, 0, 0, 0);
        break;
      case "yearly":
        periodEnd = new Date(current);
        periodEnd.setFullYear(current.getFullYear() + 1, 0, 1);
        periodEnd.setHours(0, 0, 0, 0);
        break;
      default:
        throw new Error(`Invalid period: ${period}`);
    }

    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }

    periods.push({ periodStart, periodEnd });
    current = new Date(periodEnd);
  }

  return periods;
}

// Generate dimension combinations
function generateDimensionCombinations(dimensions: string[]) {
  if (dimensions.length === 0) {
    return [{}]; // Single combination with no dimensions
  }

  // For now, create combinations of single dimensions plus the "all" combination
  const combinations = [{}]; // All dimensions null
  
  for (const dim of dimensions) {
    combinations.push({ [dim]: true });
  }

  return combinations;
}

// Aggregate data for a specific period and dimension combination
async function aggregateForPeriodAndDimensions({
  period,
  periodStart,
  periodEnd,
  dimensions
}: {
  period: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  periodStart: Date;
  periodEnd: Date;
  dimensions: Record<string, boolean>;
}) {
  // Delete existing aggregates for this period (if force re-aggregation)
  await db.delete(analyticsAggregates)
    .where(and(
      eq(analyticsAggregates.period, period),
      eq(analyticsAggregates.periodStart, periodStart),
      eq(analyticsAggregates.periodEnd, periodEnd)
    ));

  // Build the aggregation query based on dimensions
  let groupByFields: any[] = [];
  let selectFields: any = {
    period: sql`'${period}'`,
    periodStart: sql`'${periodStart.toISOString()}'::timestamp`,
    periodEnd: sql`'${periodEnd.toISOString()}'::timestamp`,
    eventCount: sql<number>`COUNT(*)`,
    uniqueUsers: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})`,
    uniqueSessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
    calculatedAt: sql`NOW()`,
  };

  // Add dimension fields to SELECT and GROUP BY
  if (dimensions.userId) {
    selectFields.userId = analyticsEvents.userId;
    groupByFields.push(analyticsEvents.userId);
  }
  if (dimensions.pitchId) {
    selectFields.pitchId = analyticsEvents.pitchId;
    groupByFields.push(analyticsEvents.pitchId);
  }
  if (dimensions.eventType) {
    selectFields.eventType = analyticsEvents.eventType;
    groupByFields.push(analyticsEvents.eventType);
  }
  if (dimensions.country) {
    selectFields.country = analyticsEvents.country;
    groupByFields.push(analyticsEvents.country);
  }
  if (dimensions.deviceType) {
    selectFields.deviceType = analyticsEvents.deviceType;
    groupByFields.push(analyticsEvents.deviceType);
  }

  // Execute aggregation query
  const aggregationResults = await db
    .select(selectFields)
    .from(analyticsEvents)
    .where(and(
      gte(analyticsEvents.timestamp, periodStart),
      lte(analyticsEvents.timestamp, periodEnd)
    ))
    .groupBy(...groupByFields);

  // Insert aggregated results
  if (aggregationResults.length > 0) {
    await db.insert(analyticsAggregates).values(
      aggregationResults.map((result: any) => ({
        period: period,
        periodStart,
        periodEnd,
        userId: result.userId || null,
        pitchId: result.pitchId || null,
        eventType: result.eventType || null,
        country: result.country || null,
        deviceType: result.deviceType || null,
        eventCount: result.eventCount,
        uniqueUsers: result.uniqueUsers,
        uniqueSessions: result.uniqueSessions,
        totalDuration: 0, // Would need to calculate from event data
        averageDuration: "0",
        totalScrollDepth: 0,
        averageScrollDepth: "0",
        bounceRate: "0",
        conversionRate: "0",
        totalRevenue: "0",
        averageOrderValue: "0",
        calculatedAt: new Date(),
        version: "1.0",
      }))
    );
  }

  // Calculate engagement metrics separately
  await calculateEngagementMetrics(period, periodStart, periodEnd, dimensions);
}

// Calculate engagement metrics like bounce rate, conversion rate, etc.
async function calculateEngagementMetrics(
  period: string,
  periodStart: Date,
  periodEnd: Date,
  dimensions: Record<string, boolean>
) {
  try {
    // Calculate bounce rate from sessions
    const sessionStats = await db
      .select({
        userId: dimensions.userId ? userSessions.userId : sql`NULL`,
        pitchId: sql`NULL`, // Sessions don't have pitchId directly
        country: dimensions.country ? userSessions.country : sql`NULL`,
        deviceType: dimensions.deviceType ? userSessions.deviceType : sql`NULL`,
        totalSessions: sql<number>`COUNT(*)`,
        bouncedSessions: sql<number>`COUNT(*) FILTER (WHERE ${userSessions.bounced} = true)`,
        convertedSessions: sql<number>`COUNT(*) FILTER (WHERE ${userSessions.converted} = true)`,
        avgEngagementScore: sql<number>`AVG(${userSessions.engagementScore})`,
      })
      .from(userSessions)
      .where(and(
        gte(userSessions.startTime, periodStart),
        lte(userSessions.startTime, periodEnd)
      ))
      .groupBy(
        ...(dimensions.userId ? [userSessions.userId] : []),
        ...(dimensions.country ? [userSessions.country] : []),
        ...(dimensions.deviceType ? [userSessions.deviceType] : [])
      );

    // Update aggregates with calculated metrics
    for (const stats of sessionStats) {
      const bounceRate = stats.totalSessions > 0 
        ? (stats.bouncedSessions / stats.totalSessions) * 100 
        : 0;
      const conversionRate = stats.totalSessions > 0 
        ? (stats.convertedSessions / stats.totalSessions) * 100 
        : 0;

      await db.update(analyticsAggregates)
        .set({
          bounceRate: bounceRate.toFixed(2),
          conversionRate: conversionRate.toFixed(2),
        })
        .where(and(
          eq(analyticsAggregates.period, period as any),
          eq(analyticsAggregates.periodStart, periodStart),
          eq(analyticsAggregates.periodEnd, periodEnd),
          ...(stats.userId ? [eq(analyticsAggregates.userId, stats.userId)] : [eq(analyticsAggregates.userId, null)]),
          ...(stats.country ? [eq(analyticsAggregates.country, stats.country)] : [eq(analyticsAggregates.country, null)]),
          ...(stats.deviceType ? [eq(analyticsAggregates.deviceType, stats.deviceType)] : [eq(analyticsAggregates.deviceType, null)])
        ));
    }
  } catch (error) {
    console.error("Error calculating engagement metrics:", error);
  }
}