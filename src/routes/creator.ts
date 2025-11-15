/**
 * Creator Dashboard Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { pitches, users, follows, pitchViews } from "../db/schema.ts";
import { eq, and, sql, desc, count } from "npm:drizzle-orm@0.35.3";
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

// Get creator dashboard overview
export const getCreatorDashboard: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    // Verify user is a creator
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "creator") {
      return errorResponse("Access denied - creators only", 403);
    }

    // Get creator's pitches stats
    const pitchStats = await db
      .select({
        total_pitches: sql<number>`count(*)`,
        published_pitches: sql<number>`sum(case when ${pitches.status} = 'published' then 1 else 0 end)`,
        draft_pitches: sql<number>`sum(case when ${pitches.status} = 'draft' then 1 else 0 end)`,
        total_views: sql<number>`coalesce(sum(${pitches.viewCount}), 0)`,
      })
      .from(pitches)
      .where(eq(pitches.userId, user.userId));

    // Get followers count
    const followersStats = await db
      .select({ 
        followers_count: sql<number>`count(*)` 
      })
      .from(follows)
      .where(eq(follows.followingId, user.userId));

    // Get recent pitches
    const recentPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        status: pitches.status,
        viewCount: pitches.viewCount,
        createdAt: pitches.createdAt,
      })
      .from(pitches)
      .where(eq(pitches.userId, user.userId))
      .orderBy(desc(pitches.createdAt))
      .limit(5);

    // Get recent activity (views on pitches)
    const recentActivity = await db
      .select({
        pitch_title: pitches.title,
        view_count: sql<number>`count(*)`,
        last_view: sql<string>`max(${pitchViews.viewedAt})`,
      })
      .from(pitchViews)
      .innerJoin(pitches, eq(pitchViews.pitchId, pitches.id))
      .where(eq(pitches.userId, user.userId))
      .groupBy(pitches.id, pitches.title)
      .orderBy(desc(sql<string>`max(${pitchViews.viewedAt})`))
      .limit(10);

    const dashboard = {
      stats: {
        ...(pitchStats[0] || { total_pitches: 0, published_pitches: 0, draft_pitches: 0, total_views: 0 }),
        followers_count: followersStats[0]?.followers_count || 0,
      },
      recent_pitches: recentPitches,
      recent_activity: recentActivity,
      generated_at: new Date(),
    };

    return successResponse(dashboard);

  } catch (error) {
    telemetry.logger.error("Get creator dashboard error", error);
    return errorResponse("Failed to fetch creator dashboard", 500);
  }
};

// Get creator's pitches
export const getCreatorPitches: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Verify user is a creator
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "creator") {
      return errorResponse("Access denied - creators only", 403);
    }

    let whereConditions = [eq(pitches.userId, user.userId)];

    if (status) {
      whereConditions.push(eq(pitches.status, status));
    }

    const userPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        budgetRange: pitches.budgetRange,
        stage: pitches.stage,
        status: pitches.status,
        viewCount: pitches.viewCount,
        createdAt: pitches.createdAt,
        updatedAt: pitches.updatedAt,
      })
      .from(pitches)
      .where(and(...whereConditions))
      .orderBy(desc(pitches.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pitches)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      pitches: userPitches,
      filters: { status },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get creator pitches error", error);
    return errorResponse("Failed to fetch creator pitches", 500);
  }
};

// Create new pitch
export const createPitch: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { 
      title, 
      logline, 
      description, 
      genre, 
      format, 
      budgetRange, 
      stage,
      status = "draft"
    } = await request.json();

    // Verify user is a creator
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "creator") {
      return errorResponse("Access denied - creators only", 403);
    }

    if (!title || !logline) {
      return errorResponse("Title and logline are required", 400);
    }

    const newPitch = await db
      .insert(pitches)
      .values({
        title,
        logline,
        description,
        genre,
        format,
        budgetRange,
        stage,
        status,
        userId: user.userId,
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    telemetry.logger.info("Pitch created", { 
      pitchId: newPitch[0].id, 
      userId: user.userId, 
      title 
    });

    return successResponse({
      pitch: newPitch[0],
      message: "Pitch created successfully"
    });

  } catch (error) {
    telemetry.logger.error("Create pitch error", error);
    return errorResponse("Failed to create pitch", 500);
  }
};

// Update pitch
export const updatePitch: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const pitchId = params?.id;
    const updateData = await request.json();

    if (!pitchId) {
      return errorResponse("Pitch ID is required", 400);
    }

    // Verify pitch exists and user owns it
    const pitchResults = await db
      .select({ userId: pitches.userId, status: pitches.status })
      .from(pitches)
      .where(eq(pitches.id, parseInt(pitchId)));

    if (pitchResults.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    if (pitchResults[0].userId !== user.userId) {
      return errorResponse("Access denied - you can only edit your own pitches", 403);
    }

    // Prepare update data
    const allowedFields = [
      'title', 'logline', 'description', 'genre', 'format', 
      'budgetRange', 'stage', 'status'
    ];
    
    const validUpdateData: any = {
      updatedAt: new Date(),
    };

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        validUpdateData[key] = value;
      }
    }

    const updatedPitch = await db
      .update(pitches)
      .set(validUpdateData)
      .where(eq(pitches.id, parseInt(pitchId)))
      .returning();

    telemetry.logger.info("Pitch updated", { 
      pitchId: parseInt(pitchId), 
      userId: user.userId 
    });

    return successResponse({
      pitch: updatedPitch[0],
      message: "Pitch updated successfully"
    });

  } catch (error) {
    telemetry.logger.error("Update pitch error", error);
    return errorResponse("Failed to update pitch", 500);
  }
};

// Delete pitch
export const deletePitch: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const pitchId = params?.id;

    if (!pitchId) {
      return errorResponse("Pitch ID is required", 400);
    }

    // Verify pitch exists and user owns it
    const pitchResults = await db
      .select({ userId: pitches.userId, title: pitches.title })
      .from(pitches)
      .where(eq(pitches.id, parseInt(pitchId)));

    if (pitchResults.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    if (pitchResults[0].userId !== user.userId) {
      return errorResponse("Access denied - you can only delete your own pitches", 403);
    }

    await db
      .delete(pitches)
      .where(eq(pitches.id, parseInt(pitchId)));

    telemetry.logger.info("Pitch deleted", { 
      pitchId: parseInt(pitchId), 
      userId: user.userId,
      title: pitchResults[0].title
    });

    return successResponse({
      message: "Pitch deleted successfully"
    });

  } catch (error) {
    telemetry.logger.error("Delete pitch error", error);
    return errorResponse("Failed to delete pitch", 500);
  }
};

// Get creator's followers
export const getCreatorFollowers: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Get followers with user details
    const followers = await db
      .select({
        id: follows.id,
        follower_id: follows.followerId,
        follower_name: users.firstName,
        follower_email: users.email,
        follower_type: users.userType,
        followed_at: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, user.userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, user.userId));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      followers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get creator followers error", error);
    return errorResponse("Failed to fetch followers", 500);
  }
};

// Get creator statistics
export const getCreatorStats: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const timeframe = url.searchParams.get("timeframe") || "30d";

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
      default:
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Comprehensive statistics
    const allTimeStats = await db
      .select({
        total_pitches: sql<number>`count(*)`,
        published_pitches: sql<number>`sum(case when ${pitches.status} = 'published' then 1 else 0 end)`,
        draft_pitches: sql<number>`sum(case when ${pitches.status} = 'draft' then 1 else 0 end)`,
        total_views: sql<number>`coalesce(sum(${pitches.viewCount}), 0)`,
      })
      .from(pitches)
      .where(eq(pitches.userId, user.userId));

    // Recent stats within timeframe
    const recentStats = await db
      .select({
        new_pitches: sql<number>`count(*)`,
        new_views: sql<number>`coalesce(sum(${pitches.viewCount}), 0)`,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.userId, user.userId),
          sql`${pitches.createdAt} >= ${dateFilter}`
        )
      );

    // Followers stats
    const followersStats = await db
      .select({
        total_followers: sql<number>`count(*)`,
        new_followers: sql<number>`sum(case when ${follows.createdAt} >= ${dateFilter} then 1 else 0 end)`,
      })
      .from(follows)
      .where(eq(follows.followingId, user.userId));

    // Top performing pitches
    const topPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        viewCount: pitches.viewCount,
        genre: pitches.genre,
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.userId, user.userId),
          eq(pitches.status, "published")
        )
      )
      .orderBy(desc(pitches.viewCount))
      .limit(5);

    const stats = {
      timeframe,
      all_time: allTimeStats[0] || {
        total_pitches: 0,
        published_pitches: 0,
        draft_pitches: 0,
        total_views: 0,
      },
      recent: recentStats[0] || {
        new_pitches: 0,
        new_views: 0,
      },
      followers: followersStats[0] || {
        total_followers: 0,
        new_followers: 0,
      },
      top_pitches: topPitches,
      generated_at: new Date(),
    };

    return successResponse({ stats });

  } catch (error) {
    telemetry.logger.error("Get creator stats error", error);
    return errorResponse("Failed to fetch creator statistics", 500);
  }
};