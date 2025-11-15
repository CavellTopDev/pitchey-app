/**
 * Investor Dashboard Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { pitches, users, follows, investments, savedPitches, ndaRequests, notifications } from "../db/schema.ts";
import { eq, and, sql, desc, count, inArray, or } from "npm:drizzle-orm@0.35.3";
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

// Get investor dashboard overview
export const getInvestorDashboard: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    // Verify user is an investor
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "investor") {
      return errorResponse("Access denied - investors only", 403);
    }

    // Get investment portfolio stats
    const portfolioStats = await db
      .select({
        total_investments: sql<number>`count(*)`,
        total_amount_invested: sql<number>`coalesce(sum(${investments.amount}), 0)`,
        active_investments: sql<number>`sum(case when ${investments.status} = 'active' then 1 else 0 end)`,
        pending_investments: sql<number>`sum(case when ${investments.status} = 'pending' then 1 else 0 end)`,
      })
      .from(investments)
      .where(eq(investments.investorId, user.userId));

    // Get saved pitches count
    const savedPitchesStats = await db
      .select({ 
        saved_count: sql<number>`count(*)` 
      })
      .from(savedPitches)
      .where(eq(savedPitches.userId, user.userId));

    // Get following count (creators being followed)
    const followingStats = await db
      .select({ 
        following_count: sql<number>`count(*)` 
      })
      .from(follows)
      .where(eq(follows.followerId, user.userId));

    // Get recent investments
    const recentInvestments = await db
      .select({
        id: investments.id,
        amount: investments.amount,
        status: investments.status,
        pitch_title: pitches.title,
        pitch_id: pitches.id,
        creator_name: users.firstName,
        created_at: investments.createdAt,
      })
      .from(investments)
      .innerJoin(pitches, eq(investments.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(eq(investments.investorId, user.userId))
      .orderBy(desc(investments.createdAt))
      .limit(5);

    // Get recommended pitches (trending in investor's interests)
    const recommendedPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        budgetRange: pitches.budgetRange,
        viewCount: pitches.viewCount,
        creator_name: users.firstName,
        company_name: users.companyName,
      })
      .from(pitches)
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(eq(pitches.status, "published"))
      .orderBy(desc(pitches.viewCount))
      .limit(6);

    const dashboard = {
      stats: {
        ...(portfolioStats[0] || { 
          total_investments: 0, 
          total_amount_invested: 0, 
          active_investments: 0, 
          pending_investments: 0 
        }),
        saved_pitches_count: savedPitchesStats[0]?.saved_count || 0,
        following_count: followingStats[0]?.following_count || 0,
      },
      recent_investments: recentInvestments,
      recommended_pitches: recommendedPitches,
      generated_at: new Date(),
    };

    return successResponse(dashboard);

  } catch (error) {
    telemetry.logger.error("Get investor dashboard error", error);
    return errorResponse("Failed to fetch investor dashboard", 500);
  }
};

// Get investor's investment portfolio
export const getInvestmentPortfolio: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Verify user is an investor
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "investor") {
      return errorResponse("Access denied - investors only", 403);
    }

    let whereConditions = [eq(investments.investorId, user.userId)];

    if (status) {
      whereConditions.push(eq(investments.status, status));
    }

    const portfolio = await db
      .select({
        id: investments.id,
        amount: investments.amount,
        equity_percentage: investments.equityPercentage,
        status: investments.status,
        pitch_id: pitches.id,
        pitch_title: pitches.title,
        pitch_genre: pitches.genre,
        pitch_budget_range: pitches.budgetRange,
        creator_name: users.firstName,
        company_name: users.companyName,
        invested_at: investments.createdAt,
      })
      .from(investments)
      .innerJoin(pitches, eq(investments.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(investments.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(investments)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      investments: portfolio,
      filters: { status },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get investment portfolio error", error);
    return errorResponse("Failed to fetch investment portfolio", 500);
  }
};

// Get saved pitches
export const getSavedPitches: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const savedPitchesList = await db
      .select({
        id: savedPitches.id,
        pitch_id: pitches.id,
        pitch_title: pitches.title,
        pitch_logline: pitches.logline,
        pitch_genre: pitches.genre,
        pitch_budget_range: pitches.budgetRange,
        creator_name: users.firstName,
        company_name: users.companyName,
        saved_at: savedPitches.createdAt,
      })
      .from(savedPitches)
      .innerJoin(pitches, eq(savedPitches.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(eq(savedPitches.userId, user.userId))
      .orderBy(desc(savedPitches.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedPitches)
      .where(eq(savedPitches.userId, user.userId));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      saved_pitches: savedPitchesList,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get saved pitches error", error);
    return errorResponse("Failed to fetch saved pitches", 500);
  }
};

// Save a pitch
export const savePitch: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { pitchId } = await request.json();

    if (!pitchId) {
      return errorResponse("Pitch ID is required", 400);
    }

    // Check if pitch exists
    const pitchExists = await db
      .select({ id: pitches.id })
      .from(pitches)
      .where(eq(pitches.id, pitchId));

    if (pitchExists.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    // Check if already saved
    const existingSave = await db
      .select({ id: savedPitches.id })
      .from(savedPitches)
      .where(
        and(
          eq(savedPitches.userId, user.userId),
          eq(savedPitches.pitchId, pitchId)
        )
      );

    if (existingSave.length > 0) {
      return errorResponse("Pitch already saved", 409);
    }

    // Save the pitch
    const newSave = await db
      .insert(savedPitches)
      .values({
        userId: user.userId,
        pitchId,
        createdAt: new Date(),
      })
      .returning();

    telemetry.logger.info("Pitch saved", { 
      userId: user.userId, 
      pitchId 
    });

    return successResponse({
      saved_pitch: newSave[0],
      message: "Pitch saved successfully"
    });

  } catch (error) {
    telemetry.logger.error("Save pitch error", error);
    return errorResponse("Failed to save pitch", 500);
  }
};

// Remove saved pitch
export const removeSavedPitch: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const pitchId = params?.pitchId;

    if (!pitchId) {
      return errorResponse("Pitch ID is required", 400);
    }

    // Remove the saved pitch
    const deleted = await db
      .delete(savedPitches)
      .where(
        and(
          eq(savedPitches.userId, user.userId),
          eq(savedPitches.pitchId, parseInt(pitchId))
        )
      )
      .returning();

    if (deleted.length === 0) {
      return errorResponse("Saved pitch not found", 404);
    }

    telemetry.logger.info("Saved pitch removed", { 
      userId: user.userId, 
      pitchId 
    });

    return successResponse({
      message: "Pitch removed from saved list"
    });

  } catch (error) {
    telemetry.logger.error("Remove saved pitch error", error);
    return errorResponse("Failed to remove saved pitch", 500);
  }
};

// Get investor's NDA requests
export const getInvestorNdaRequests: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let whereConditions = [eq(ndaRequests.requesterId, user.userId)];

    if (status) {
      whereConditions.push(eq(ndaRequests.status, status));
    }

    const ndaRequestsList = await db
      .select({
        id: ndaRequests.id,
        pitch_id: pitches.id,
        pitch_title: pitches.title,
        creator_name: users.firstName,
        company_name: users.companyName,
        status: ndaRequests.status,
        requested_at: ndaRequests.createdAt,
        responded_at: ndaRequests.respondedAt,
      })
      .from(ndaRequests)
      .innerJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(ndaRequests.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ndaRequests)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      nda_requests: ndaRequestsList,
      filters: { status },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get investor NDA requests error", error);
    return errorResponse("Failed to fetch NDA requests", 500);
  }
};

// Get investor notifications
export const getInvestorNotifications: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unread") === "true";

    let whereConditions = [eq(notifications.userId, user.userId)];

    if (unreadOnly) {
      whereConditions.push(eq(notifications.read, false));
    }

    const notificationsList = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        read: notifications.read,
        created_at: notifications.createdAt,
        data: notifications.data,
      })
      .from(notifications)
      .where(and(...whereConditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      notifications: notificationsList,
      filters: { unread_only: unreadOnly },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get investor notifications error", error);
    return errorResponse("Failed to fetch notifications", 500);
  }
};

// Mark notification as read
export const markNotificationRead: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const notificationId = params?.id;

    if (!notificationId) {
      return errorResponse("Notification ID is required", 400);
    }

    const updated = await db
      .update(notifications)
      .set({ 
        read: true, 
        readAt: new Date() 
      })
      .where(
        and(
          eq(notifications.id, parseInt(notificationId)),
          eq(notifications.userId, user.userId)
        )
      )
      .returning();

    if (updated.length === 0) {
      return errorResponse("Notification not found", 404);
    }

    return successResponse({
      message: "Notification marked as read"
    });

  } catch (error) {
    telemetry.logger.error("Mark notification read error", error);
    return errorResponse("Failed to mark notification as read", 500);
  }
};

// Get investor statistics
export const getInvestorStats: RouteHandler = async (request, url) => {
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

    // All-time investment statistics
    const allTimeStats = await db
      .select({
        total_investments: sql<number>`count(*)`,
        total_amount_invested: sql<number>`coalesce(sum(${investments.amount}), 0)`,
        active_investments: sql<number>`sum(case when ${investments.status} = 'active' then 1 else 0 end)`,
        average_investment: sql<number>`coalesce(avg(${investments.amount}), 0)`,
      })
      .from(investments)
      .where(eq(investments.investorId, user.userId));

    // Recent stats within timeframe
    const recentStats = await db
      .select({
        recent_investments: sql<number>`count(*)`,
        recent_amount_invested: sql<number>`coalesce(sum(${investments.amount}), 0)`,
      })
      .from(investments)
      .where(
        and(
          eq(investments.investorId, user.userId),
          sql`${investments.createdAt} >= ${dateFilter}`
        )
      );

    // Portfolio performance by genre
    const genreBreakdown = await db
      .select({
        genre: pitches.genre,
        investment_count: sql<number>`count(*)`,
        total_invested: sql<number>`coalesce(sum(${investments.amount}), 0)`,
      })
      .from(investments)
      .innerJoin(pitches, eq(investments.pitchId, pitches.id))
      .where(eq(investments.investorId, user.userId))
      .groupBy(pitches.genre)
      .orderBy(desc(sql<number>`coalesce(sum(${investments.amount}), 0)`));

    const stats = {
      timeframe,
      all_time: allTimeStats[0] || {
        total_investments: 0,
        total_amount_invested: 0,
        active_investments: 0,
        average_investment: 0,
      },
      recent: recentStats[0] || {
        recent_investments: 0,
        recent_amount_invested: 0,
      },
      genre_breakdown: genreBreakdown,
      generated_at: new Date(),
    };

    return successResponse({ stats });

  } catch (error) {
    telemetry.logger.error("Get investor stats error", error);
    return errorResponse("Failed to fetch investor statistics", 500);
  }
};