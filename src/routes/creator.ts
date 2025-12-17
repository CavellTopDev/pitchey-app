/**
 * Creator Dashboard Routes Module
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

// Get creator dashboard overview
export const getCreatorDashboard: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    // Verify user is a creator
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "creator") {
      return errorResponse("Access denied - creators only", 403);
    }

    // Get creator's pitches stats
    const pitchStats = await db.execute(`
      SELECT 
        count(*) as total_pitches,
        sum(case when status = 'published' then 1 else 0 end) as published_pitches,
        sum(case when status = 'draft' then 1 else 0 end) as draft_pitches,
        coalesce(sum(view_count), 0) as total_views
      FROM pitches WHERE user_id = $1
    `, [user.userId]);

    // Get followers count
    const followersStats = await db.execute(`
      SELECT count(*) as followers_count 
      FROM follows WHERE following_id = $1
    `, [user.userId]);

    // Get recent pitches
    const recentPitches = await db.execute(`
      SELECT id, title, logline, genre, status, view_count, created_at
      FROM pitches 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [user.userId]);

    // Get recent activity (views on pitches)
    const recentActivity = await db.execute(`
      SELECT 
        p.title as pitch_title,
        count(*) as view_count,
        max(pv.viewed_at) as last_view
      FROM pitch_views pv
      INNER JOIN pitches p ON pv.pitch_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id, p.title
      ORDER BY max(pv.viewed_at) DESC
      LIMIT 10
    `, [user.userId]);

    const dashboard = {
      stats: {
        ...(pitchStats.rows[0] || { total_pitches: 0, published_pitches: 0, draft_pitches: 0, total_views: 0 }),
        followers_count: followersStats.rows[0]?.followers_count || 0,
      },
      recent_pitches: recentPitches.rows,
      recent_activity: recentActivity.rows,
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
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "creator") {
      return errorResponse("Access denied - creators only", 403);
    }

    let whereClause = "user_id = $1";
    let params = [user.userId];

    if (status) {
      whereClause += " AND status = $2";
      params.push(status);
    }

    const userPitches = await db.execute(`
      SELECT id, title, logline, genre, format, budget_range, stage, status, 
             view_count, created_at, updated_at
      FROM pitches
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM pitches WHERE ${whereClause}
    `, params);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      pitches: userPitches.rows,
      filters: { status },
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
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
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "creator") {
      return errorResponse("Access denied - creators only", 403);
    }

    if (!title || !logline) {
      return errorResponse("Title and logline are required", 400);
    }

    const newPitch = await db.execute(`
      INSERT INTO pitches (title, logline, description, genre, format, budget_range, stage, status, user_id, view_count, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [title, logline, description, genre, format, budgetRange, stage, status, user.userId, 0]);

    telemetry.logger.info("Pitch created", { 
      pitchId: newPitch.rows[0].id, 
      userId: user.userId, 
      title 
    });

    return successResponse({
      pitch: newPitch.rows[0],
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
    const pitchResults = await db.execute(`
      SELECT user_id, status FROM pitches WHERE id = $1
    `, [parseInt(pitchId)]);

    if (pitchResults.rows.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    if (pitchResults.rows[0].user_id !== user.userId) {
      return errorResponse("Access denied - you can only edit your own pitches", 403);
    }

    // Prepare update data
    const allowedFields = [
      'title', 'logline', 'description', 'genre', 'format', 
      'budget_range', 'stage', 'status'
    ];
    
    const validFields = Object.entries(updateData)
      .filter(([key, value]) => allowedFields.includes(key) && value !== undefined);

    if (validFields.length === 0) {
      return errorResponse("No valid fields to update", 400);
    }

    const fields = validFields.map(([key]) => key);
    const values = validFields.map(([, value]) => value);
    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');

    const updatedPitch = await db.execute(`
      UPDATE pitches 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
      RETURNING *
    `, [...values, parseInt(pitchId)]);

    telemetry.logger.info("Pitch updated", { 
      pitchId: parseInt(pitchId), 
      userId: user.userId 
    });

    return successResponse({
      pitch: updatedPitch.rows[0],
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
    const pitchResults = await db.execute(`
      SELECT user_id, title FROM pitches WHERE id = $1
    `, [parseInt(pitchId)]);

    if (pitchResults.rows.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    if (pitchResults.rows[0].user_id !== user.userId) {
      return errorResponse("Access denied - you can only delete your own pitches", 403);
    }

    await db.execute(`
      DELETE FROM pitches WHERE id = $1
    `, [parseInt(pitchId)]);

    telemetry.logger.info("Pitch deleted", { 
      pitchId: parseInt(pitchId), 
      userId: user.userId,
      title: pitchResults.rows[0].title
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
    const followers = await db.execute(`
      SELECT 
        f.id,
        f.follower_id,
        u.first_name as follower_name,
        u.email as follower_email,
        u.user_type as follower_type,
        f.created_at as followed_at
      FROM follows f
      INNER JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.userId, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM follows WHERE following_id = $1
    `, [user.userId]);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      followers: followers.rows,
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
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
    const allTimeStats = await db.execute(`
      SELECT 
        count(*) as total_pitches,
        sum(case when status = 'published' then 1 else 0 end) as published_pitches,
        sum(case when status = 'draft' then 1 else 0 end) as draft_pitches,
        coalesce(sum(view_count), 0) as total_views
      FROM pitches WHERE user_id = $1
    `, [user.userId]);

    // Recent stats within timeframe
    const recentStats = await db.execute(`
      SELECT 
        count(*) as new_pitches,
        coalesce(sum(view_count), 0) as new_views
      FROM pitches 
      WHERE user_id = $1 AND created_at >= $2
    `, [user.userId, dateFilter]);

    // Followers stats
    const followersStats = await db.execute(`
      SELECT 
        count(*) as total_followers,
        sum(case when created_at >= $2 then 1 else 0 end) as new_followers
      FROM follows 
      WHERE following_id = $1
    `, [user.userId, dateFilter]);

    // Top performing pitches
    const topPitches = await db.execute(`
      SELECT id, title, view_count, genre
      FROM pitches 
      WHERE user_id = $1 AND status = 'published'
      ORDER BY view_count DESC
      LIMIT 5
    `, [user.userId]);

    const stats = {
      timeframe,
      all_time: allTimeStats.rows[0] || {
        total_pitches: 0,
        published_pitches: 0,
        draft_pitches: 0,
        total_views: 0,
      },
      recent: recentStats.rows[0] || {
        new_pitches: 0,
        new_views: 0,
      },
      followers: followersStats.rows[0] || {
        total_followers: 0,
        new_followers: 0,
      },
      top_pitches: topPitches.rows,
      generated_at: new Date(),
    };

    return successResponse({ stats });

  } catch (error) {
    telemetry.logger.error("Get creator stats error", error);
    return errorResponse("Failed to fetch creator statistics", 500);
  }
};