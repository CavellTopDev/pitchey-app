/**
 * Investor Dashboard Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
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
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "investor") {
      return errorResponse("Access denied - investors only", 403);
    }

    // Get investment portfolio stats
    const portfolioStats = await db.execute(`
      SELECT 
        count(*) as total_investments,
        coalesce(sum(amount), 0) as total_amount_invested,
        sum(case when status = 'active' then 1 else 0 end) as active_investments,
        sum(case when status = 'pending' then 1 else 0 end) as pending_investments
      FROM investments WHERE investor_id = $1
    `, [user.userId]);

    // Get saved pitches count
    const savedPitchesStats = await db.execute(`
      SELECT count(*) as saved_count 
      FROM saved_pitches WHERE user_id = $1
    `, [user.userId]);

    // Get following count (creators being followed)
    const followingStats = await db.execute(`
      SELECT count(*) as following_count 
      FROM follows WHERE follower_id = $1
    `, [user.userId]);

    // Get recent investments
    const recentInvestments = await db.execute(`
      SELECT 
        i.id,
        i.amount,
        i.status,
        p.title as pitch_title,
        p.id as pitch_id,
        u.first_name as creator_name,
        i.created_at
      FROM investments i
      INNER JOIN pitches p ON i.pitch_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE i.investor_id = $1
      ORDER BY i.created_at DESC
      LIMIT 5
    `, [user.userId]);

    // Get recommended pitches (trending in investor's interests)
    const recommendedPitches = await db.execute(`
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.budget_range,
        p.view_count,
        u.first_name as creator_name,
        u.company_name
      FROM pitches p
      INNER JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.view_count DESC
      LIMIT 6
    `, []);

    const dashboard = {
      stats: {
        ...(portfolioStats.rows[0] || { 
          total_investments: 0, 
          total_amount_invested: 0, 
          active_investments: 0, 
          pending_investments: 0 
        }),
        saved_pitches_count: savedPitchesStats.rows[0]?.saved_count || 0,
        following_count: followingStats.rows[0]?.following_count || 0,
      },
      recent_investments: recentInvestments.rows,
      recommended_pitches: recommendedPitches.rows,
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
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "investor") {
      return errorResponse("Access denied - investors only", 403);
    }

    let whereClause = "i.investor_id = $1";
    let params = [user.userId];

    if (status) {
      whereClause += " AND i.status = $2";
      params.push(status);
    }

    const portfolio = await db.execute(`
      SELECT 
        i.id,
        i.amount,
        i.equity_percentage,
        i.status,
        p.id as pitch_id,
        p.title as pitch_title,
        p.genre as pitch_genre,
        p.budget_range as pitch_budget_range,
        u.first_name as creator_name,
        u.company_name,
        i.created_at as invested_at
      FROM investments i
      INNER JOIN pitches p ON i.pitch_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM investments i WHERE ${whereClause}
    `, params);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      investments: portfolio.rows,
      filters: { status },
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
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

    const savedPitchesList = await db.execute(`
      SELECT 
        sp.id,
        p.id as pitch_id,
        p.title as pitch_title,
        p.logline as pitch_logline,
        p.genre as pitch_genre,
        p.budget_range as pitch_budget_range,
        u.first_name as creator_name,
        u.company_name,
        sp.created_at as saved_at
      FROM saved_pitches sp
      INNER JOIN pitches p ON sp.pitch_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE sp.user_id = $1
      ORDER BY sp.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.userId, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM saved_pitches WHERE user_id = $1
    `, [user.userId]);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      saved_pitches: savedPitchesList.rows,
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
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
    const pitchExists = await db.execute(`
      SELECT id FROM pitches WHERE id = $1
    `, [pitchId]);

    if (pitchExists.rows.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    // Check if already saved
    const existingSave = await db.execute(`
      SELECT id FROM saved_pitches 
      WHERE user_id = $1 AND pitch_id = $2
    `, [user.userId, pitchId]);

    if (existingSave.rows.length > 0) {
      return errorResponse("Pitch already saved", 409);
    }

    // Save the pitch
    const newSave = await db.execute(`
      INSERT INTO saved_pitches (user_id, pitch_id, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      RETURNING *
    `, [user.userId, pitchId]);

    telemetry.logger.info("Pitch saved", { 
      userId: user.userId, 
      pitchId 
    });

    return successResponse({
      saved_pitch: newSave.rows[0],
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
    const deleted = await db.execute(`
      DELETE FROM saved_pitches 
      WHERE user_id = $1 AND pitch_id = $2
      RETURNING *
    `, [user.userId, parseInt(pitchId)]);

    if (deleted.rows.length === 0) {
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

    let whereClause = "nr.requester_id = $1";
    let params = [user.userId];

    if (status) {
      whereClause += " AND nr.status = $2";
      params.push(status);
    }

    const ndaRequestsList = await db.execute(`
      SELECT 
        nr.id,
        p.id as pitch_id,
        p.title as pitch_title,
        u.first_name as creator_name,
        u.company_name,
        nr.status,
        nr.created_at as requested_at,
        nr.responded_at
      FROM nda_requests nr
      INNER JOIN pitches p ON nr.pitch_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE ${whereClause}
      ORDER BY nr.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM nda_requests nr WHERE ${whereClause}
    `, params);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      nda_requests: ndaRequestsList.rows,
      filters: { status },
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
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

    let whereClause = "user_id = $1";
    let params = [user.userId];

    if (unreadOnly) {
      whereClause += " AND read = false";
    }

    const notificationsList = await db.execute(`
      SELECT 
        id,
        type,
        title,
        message,
        read,
        created_at,
        data
      FROM notifications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}
    `, params);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      notifications: notificationsList.rows,
      filters: { unread_only: unreadOnly },
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
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

    const updated = await db.execute(`
      UPDATE notifications 
      SET read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [parseInt(notificationId), user.userId]);

    if (updated.rows.length === 0) {
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
    const allTimeStats = await db.execute(`
      SELECT 
        count(*) as total_investments,
        coalesce(sum(amount), 0) as total_amount_invested,
        sum(case when status = 'active' then 1 else 0 end) as active_investments,
        coalesce(avg(amount), 0) as average_investment
      FROM investments WHERE investor_id = $1
    `, [user.userId]);

    // Recent stats within timeframe
    const recentStats = await db.execute(`
      SELECT 
        count(*) as recent_investments,
        coalesce(sum(amount), 0) as recent_amount_invested
      FROM investments 
      WHERE investor_id = $1 AND created_at >= $2
    `, [user.userId, dateFilter]);

    // Portfolio performance by genre
    const genreBreakdown = await db.execute(`
      SELECT 
        p.genre,
        count(*) as investment_count,
        coalesce(sum(i.amount), 0) as total_invested
      FROM investments i
      INNER JOIN pitches p ON i.pitch_id = p.id
      WHERE i.investor_id = $1
      GROUP BY p.genre
      ORDER BY coalesce(sum(i.amount), 0) DESC
    `, [user.userId]);

    const stats = {
      timeframe,
      all_time: allTimeStats.rows[0] || {
        total_investments: 0,
        total_amount_invested: 0,
        active_investments: 0,
        average_investment: 0,
      },
      recent: recentStats.rows[0] || {
        recent_investments: 0,
        recent_amount_invested: 0,
      },
      genre_breakdown: genreBreakdown.rows,
      generated_at: new Date(),
    };

    return successResponse({ stats });

  } catch (error) {
    telemetry.logger.error("Get investor stats error", error);
    return errorResponse("Failed to fetch investor statistics", 500);
  }
};