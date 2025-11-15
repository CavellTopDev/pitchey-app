/**
 * Analytics Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { pitches, users, follows, investments } from "../db/schema.ts";
import { eq, and, sql, desc, gte, between } from "npm:drizzle-orm@0.35.3";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { validateEnvironment } from "../utils/env-validation.ts";

const envConfig = validateEnvironment();
const JWT_SECRET = envConfig.JWT_SECRET;

// Middleware to extract user from JWT token
async function getUserFromToken(request: Request): Promise<any> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No token provided");
  }

  const token = authHeader.slice(7);
  const payload = await verify(
    token,
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
  );

  return payload;
}

// Get user analytics (for creators and investors)
export const getUserAnalytics: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const timeframe = url.searchParams.get("timeframe") || "30d";

    // Calculate date range
    let dateFilter;
    const now = new Date();
    switch (timeframe) {
      case "7d":
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get user pitches statistics
    const pitchStats = await db
      .select({
        total_pitches: sql<number>`count(*)`,
        total_views: sql<number>`sum(${pitches.view_count})`,
        published_pitches: sql<number>`sum(case when ${pitches.status} = 'published' then 1 else 0 end)`,
        draft_pitches: sql<number>`sum(case when ${pitches.status} = 'draft' then 1 else 0 end)`,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.user_id, user.userId),
          gte(pitches.created_at, dateFilter)
        )
      );

    // Get follower statistics
    const followerStats = await db
      .select({
        total_followers: sql<number>`count(*)`,
        new_followers: sql<number>`sum(case when ${follows.created_at} >= ${dateFilter} then 1 else 0 end)`,
      })
      .from(follows)
      .where(eq(follows.following_id, user.userId));

    // Get following statistics
    const followingStats = await db
      .select({
        total_following: sql<number>`count(*)`,
        new_following: sql<number>`sum(case when ${follows.created_at} >= ${dateFilter} then 1 else 0 end)`,
      })
      .from(follows)
      .where(eq(follows.follower_id, user.userId));

    // Get top performing pitches
    const topPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        view_count: pitches.view_count,
        created_at: pitches.created_at,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.user_id, user.userId),
          eq(pitches.status, "published")
        )
      )
      .orderBy(desc(pitches.view_count))
      .limit(5);

    const analytics = {
      timeframe,
      period: { start: dateFilter, end: now },
      overview: {
        total_pitches: pitchStats[0]?.total_pitches || 0,
        total_views: pitchStats[0]?.total_views || 0,
        published_pitches: pitchStats[0]?.published_pitches || 0,
        draft_pitches: pitchStats[0]?.draft_pitches || 0,
        total_followers: followerStats[0]?.total_followers || 0,
        new_followers: followerStats[0]?.new_followers || 0,
        total_following: followingStats[0]?.total_following || 0,
        new_following: followingStats[0]?.new_following || 0,
      },
      top_pitches: topPitches,
    };

    return successResponse({ analytics });

  } catch (error) {
    telemetry.logger.error("Get user analytics error", error);
    return errorResponse("Failed to fetch analytics", 500);
  }
};

// Get creator analytics (detailed metrics for content creators)
export const getCreatorAnalytics: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const timeframe = url.searchParams.get("timeframe") || "30d";

    // Check if user is a creator
    const userResult = await db
      .select({ user_type: users.user_type })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].user_type !== "creator") {
      return errorResponse("Access denied - creators only", 403);
    }

    // Calculate date range
    const now = new Date();
    let dateFilter;
    switch (timeframe) {
      case "7d":
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Detailed pitch statistics
    const detailedPitchStats = await db
      .select({
        total_pitches: sql<number>`count(*)`,
        total_views: sql<number>`sum(${pitches.view_count})`,
        avg_views: sql<number>`avg(${pitches.view_count})`,
        published_pitches: sql<number>`sum(case when ${pitches.status} = 'published' then 1 else 0 end)`,
        draft_pitches: sql<number>`sum(case when ${pitches.status} = 'draft' then 1 else 0 end)`,
        pending_pitches: sql<number>`sum(case when ${pitches.status} = 'pending' then 1 else 0 end)`,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.user_id, user.userId),
          gte(pitches.created_at, dateFilter)
        )
      );

    // Genre breakdown
    const genreStats = await db
      .select({
        genre: pitches.genre,
        count: sql<number>`count(*)`,
        total_views: sql<number>`sum(${pitches.view_count})`,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.user_id, user.userId),
          eq(pitches.status, "published")
        )
      )
      .groupBy(pitches.genre)
      .orderBy(desc(sql<number>`count(*)`));

    // Format breakdown
    const formatStats = await db
      .select({
        format: pitches.format,
        count: sql<number>`count(*)`,
        total_views: sql<number>`sum(${pitches.view_count})`,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.user_id, user.userId),
          eq(pitches.status, "published")
        )
      )
      .groupBy(pitches.format)
      .orderBy(desc(sql<number>`count(*)`));

    // Recent performance (last 7 days)
    const recentPerformance = await db
      .select({
        date: sql<string>`DATE(${pitches.created_at})`,
        pitches_created: sql<number>`count(*)`,
        total_views: sql<number>`sum(${pitches.view_count})`,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.user_id, user.userId),
          gte(pitches.created_at, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(sql<string>`DATE(${pitches.created_at})`)
      .orderBy(sql<string>`DATE(${pitches.created_at})`);

    // Top performing pitches
    const topPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        genre: pitches.genre,
        format: pitches.format,
        view_count: pitches.view_count,
        created_at: pitches.created_at,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.user_id, user.userId),
          eq(pitches.status, "published")
        )
      )
      .orderBy(desc(pitches.view_count))
      .limit(10);

    const analytics = {
      timeframe,
      period: { start: dateFilter, end: now },
      overview: detailedPitchStats[0] || {
        total_pitches: 0,
        total_views: 0,
        avg_views: 0,
        published_pitches: 0,
        draft_pitches: 0,
        pending_pitches: 0,
      },
      breakdowns: {
        by_genre: genreStats,
        by_format: formatStats,
      },
      performance: {
        recent_daily: recentPerformance,
        top_pitches: topPitches,
      },
    };

    return successResponse({ analytics });

  } catch (error) {
    telemetry.logger.error("Get creator analytics error", error);
    return errorResponse("Failed to fetch creator analytics", 500);
  }
};

// Get platform analytics (general platform statistics)
export const getPlatformAnalytics: RouteHandler = async (request, url) => {
  try {
    // General platform stats - no authentication required for basic stats

    // Total platform statistics
    const platformStats = await db
      .select({
        total_users: sql<number>`count(*)`,
        creators: sql<number>`sum(case when ${users.user_type} = 'creator' then 1 else 0 end)`,
        investors: sql<number>`sum(case when ${users.user_type} = 'investor' then 1 else 0 end)`,
        production_companies: sql<number>`sum(case when ${users.user_type} = 'production' then 1 else 0 end)`,
      })
      .from(users);

    // Pitch statistics
    const pitchStats = await db
      .select({
        total_pitches: sql<number>`count(*)`,
        published_pitches: sql<number>`sum(case when ${pitches.status} = 'published' then 1 else 0 end)`,
        total_views: sql<number>`sum(${pitches.view_count})`,
      })
      .from(pitches);

    // Popular genres
    const popularGenres = await db
      .select({
        genre: pitches.genre,
        count: sql<number>`count(*)`,
        total_views: sql<number>`sum(${pitches.view_count})`,
      })
      .from(pitches)
      .where(eq(pitches.status, "published"))
      .groupBy(pitches.genre)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    // Popular formats
    const popularFormats = await db
      .select({
        format: pitches.format,
        count: sql<number>`count(*)`,
        total_views: sql<number>`sum(${pitches.view_count})`,
      })
      .from(pitches)
      .where(eq(pitches.status, "published"))
      .groupBy(pitches.format)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivity = await db
      .select({
        new_users: sql<number>`count(*)`,
      })
      .from(users)
      .where(gte(users.created_at, thirtyDaysAgo));

    const recentPitches = await db
      .select({
        new_pitches: sql<number>`count(*)`,
      })
      .from(pitches)
      .where(
        and(
          gte(pitches.created_at, thirtyDaysAgo),
          eq(pitches.status, "published")
        )
      );

    const analytics = {
      overview: {
        ...platformStats[0],
        ...pitchStats[0],
      },
      trends: {
        popular_genres: popularGenres,
        popular_formats: popularFormats,
      },
      recent_activity: {
        period: "30 days",
        new_users: recentActivity[0]?.new_users || 0,
        new_pitches: recentPitches[0]?.new_pitches || 0,
      },
      generated_at: new Date(),
    };

    return successResponse({ analytics });

  } catch (error) {
    telemetry.logger.error("Get platform analytics error", error);
    return errorResponse("Failed to fetch platform analytics", 500);
  }
};

// Get investment analytics (for investors)
export const getInvestmentAnalytics: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const timeframe = url.searchParams.get("timeframe") || "30d";

    // Check if user is an investor
    const userResult = await db
      .select({ user_type: users.user_type })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].user_type !== "investor") {
      return errorResponse("Access denied - investors only", 403);
    }

    // This would typically involve an investments table
    // For now, return placeholder data
    const analytics = {
      timeframe,
      portfolio: {
        total_investments: 0,
        total_amount_invested: 0,
        active_investments: 0,
        completed_investments: 0,
      },
      performance: {
        roi: 0,
        best_performing: [],
        recent_activity: [],
      },
      opportunities: {
        available: 0,
        matching_preferences: 0,
      },
    };

    return successResponse({ analytics });

  } catch (error) {
    telemetry.logger.error("Get investment analytics error", error);
    return errorResponse("Failed to fetch investment analytics", 500);
  }
};