/**
 * Production Company Routes Module
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

// Get production company dashboard overview
export const getProductionDashboard: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    // Verify user is a production company
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "production") {
      return errorResponse("Access denied - production companies only", 403);
    }

    // Get investment/acquisition stats
    const acquisitionStats = await db.execute(`
      SELECT 
        count(*) as total_acquisitions,
        sum(case when status = 'active' then 1 else 0 end) as active_investments,
        sum(case when status = 'completed' then 1 else 0 end) as completed_investments,
        sum(case when status = 'pending' then 1 else 0 end) as pending_investments
      FROM investments WHERE investor_id = $1
    `, [user.userId]);

    // Get investment/acquisition pipeline stats
    const pipelineStats = await db.execute(`
      SELECT 
        count(*) as total_investments,
        sum(case when status = 'pending' then 1 else 0 end) as pending_investments,
        sum(case when status = 'active' then 1 else 0 end) as active_investments,
        coalesce(sum(amount), 0) as total_amount_invested
      FROM investments WHERE investor_id = $1
    `, [user.userId]);

    // Get recent investments/acquisitions
    const recentInvestments = await db.execute(`
      SELECT 
        i.id,
        i.amount,
        i.status,
        p.id as pitch_id,
        p.title as pitch_title,
        p.genre as pitch_genre,
        u.first_name as creator_name,
        i.created_at as invested_at
      FROM investments i
      INNER JOIN pitches p ON i.pitch_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE i.investor_id = $1
      ORDER BY i.created_at DESC
      LIMIT 5
    `, [user.userId]);

    // Get potential acquisitions (trending pitches)
    const potentialAcquisitions = await db.execute(`
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.budget_range,
        p.stage,
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
        ...(acquisitionStats.rows[0] || { 
          total_acquisitions: 0, 
          active_investments: 0, 
          completed_investments: 0, 
          pending_investments: 0 
        }),
        ...(pipelineStats.rows[0] || { 
          total_investments: 0, 
          pending_investments: 0, 
          active_investments: 0, 
          total_amount_invested: 0 
        }),
      },
      recent_investments: recentInvestments.rows,
      potential_acquisitions: potentialAcquisitions.rows,
      generated_at: new Date(),
    };

    return successResponse(dashboard);

  } catch (error) {
    telemetry.logger.error("Get production dashboard error", error);
    return errorResponse("Failed to fetch production dashboard", 500);
  }
};

// Get production company's investments
export const getProductionInvestments: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Verify user is a production company
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "production") {
      return errorResponse("Access denied - production companies only", 403);
    }

    let whereClause = "i.investor_id = $1";
    let params = [user.userId];

    if (status) {
      whereClause += " AND i.status = $2";
      params.push(status);
    }

    const investmentsList = await db.execute(`
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
        i.created_at as invested_at,
        i.updated_at
      FROM investments i
      INNER JOIN pitches p ON i.pitch_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE ${whereClause}
      ORDER BY i.updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM investments i WHERE ${whereClause}
    `, params);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      investments: investmentsList.rows,
      filters: { status },
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
      }
    });

  } catch (error) {
    telemetry.logger.error("Get production investments error", error);
    return errorResponse("Failed to fetch production investments", 500);
  }
};

// Update investment status 
export const updateInvestmentStatus: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const investmentId = params?.id;
    const { status } = await request.json();

    if (!investmentId) {
      return errorResponse("Investment ID is required", 400);
    }

    if (!status) {
      return errorResponse("Status is required", 400);
    }

    // Verify investment exists and user owns it
    const investmentResults = await db.execute(`
      SELECT investor_id FROM investments WHERE id = $1
    `, [parseInt(investmentId)]);

    if (investmentResults.rows.length === 0) {
      return errorResponse("Investment not found", 404);
    }

    if (investmentResults.rows[0].investor_id !== user.userId) {
      return errorResponse("Access denied - you can only update your own investments", 403);
    }

    const updatedInvestment = await db.execute(`
      UPDATE investments 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, parseInt(investmentId)]);

    telemetry.logger.info("Investment status updated", { 
      investmentId: parseInt(investmentId), 
      userId: user.userId,
      status
    });

    return successResponse({
      investment: updatedInvestment.rows[0],
      message: "Investment status updated successfully"
    });

  } catch (error) {
    telemetry.logger.error("Update investment status error", error);
    return errorResponse("Failed to update investment status", 500);
  }
};

// Get acquisition pipeline (potential investments)
export const getAcquisitionPipeline: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const stage = url.searchParams.get("stage");
    const genre = url.searchParams.get("genre");
    const budgetRange = url.searchParams.get("budget_range");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Verify user is a production company
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "production") {
      return errorResponse("Access denied - production companies only", 403);
    }

    let whereClause = "p.status = 'published'";
    let params: any[] = [];

    if (stage) {
      whereClause += ` AND p.stage = $${params.length + 1}`;
      params.push(stage);
    }

    if (genre) {
      whereClause += ` AND p.genre = $${params.length + 1}`;
      params.push(genre);
    }

    if (budgetRange) {
      whereClause += ` AND p.budget_range = $${params.length + 1}`;
      params.push(budgetRange);
    }

    const pipeline = await db.execute(`
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.description,
        p.genre,
        p.format,
        p.budget_range,
        p.stage,
        p.view_count,
        u.first_name as creator_name,
        u.company_name,
        u.email as creator_email,
        p.created_at
      FROM pitches p
      INNER JOIN users u ON p.user_id = u.id
      WHERE ${whereClause}
      ORDER BY p.view_count DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM pitches p WHERE ${whereClause}
    `, params);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      pitches: pipeline.rows,
      filters: { stage, genre, budget_range: budgetRange },
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
      }
    });

  } catch (error) {
    telemetry.logger.error("Get acquisition pipeline error", error);
    return errorResponse("Failed to fetch acquisition pipeline", 500);
  }
};

// Get production analytics
export const getProductionAnalytics: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const timeframe = url.searchParams.get("timeframe") || "30d";

    // Verify user is a production company
    const userResult = await db.execute(`
      SELECT user_type FROM users WHERE id = $1
    `, [user.userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].user_type !== "production") {
      return errorResponse("Access denied - production companies only", 403);
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
      default:
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Investment analytics
    const allTimeInvestmentStats = await db.execute(`
      SELECT 
        count(*) as total_investments,
        sum(case when status = 'active' then 1 else 0 end) as active_investments,
        sum(case when status = 'completed' then 1 else 0 end) as completed_investments,
        coalesce(sum(amount), 0) as total_invested
      FROM investments WHERE investor_id = $1
    `, [user.userId]);

    // Recent investment activity
    const recentInvestmentStats = await db.execute(`
      SELECT 
        count(*) as new_investments,
        coalesce(sum(amount), 0) as recent_amount
      FROM investments 
      WHERE investor_id = $1 AND created_at >= $2
    `, [user.userId, dateFilter]);

    // Investment breakdown by genre (via pitches)
    const genreBreakdown = await db.execute(`
      SELECT 
        p.genre,
        count(*) as investment_count,
        coalesce(sum(i.amount), 0) as total_invested
      FROM investments i
      INNER JOIN pitches p ON i.pitch_id = p.id
      WHERE i.investor_id = $1
      GROUP BY p.genre
      ORDER BY count(*) DESC
    `, [user.userId]);

    const analytics = {
      timeframe,
      investments: {
        all_time: allTimeInvestmentStats.rows[0] || {
          total_investments: 0,
          active_investments: 0,
          completed_investments: 0,
          total_invested: 0,
        },
        recent: recentInvestmentStats.rows[0] || {
          new_investments: 0,
          recent_amount: 0,
        },
        genre_breakdown: genreBreakdown.rows,
      },
      generated_at: new Date(),
    };

    return successResponse({ analytics });

  } catch (error) {
    telemetry.logger.error("Get production analytics error", error);
    return errorResponse("Failed to fetch production analytics", 500);
  }
};