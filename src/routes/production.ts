/**
 * Production Company Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { pitches, users, investments, notifications } from "../db/schema.ts";
import { eq, and, sql, desc, count, or } from "npm:drizzle-orm@0.35.3";
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
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "production") {
      return errorResponse("Access denied - production companies only", 403);
    }

    // Get investment/acquisition stats
    const acquisitionStats = await db
      .select({
        total_acquisitions: sql<number>`count(*)`,
        active_investments: sql<number>`sum(case when ${investments.status} = 'active' then 1 else 0 end)`,
        completed_investments: sql<number>`sum(case when ${investments.status} = 'completed' then 1 else 0 end)`,
        pending_investments: sql<number>`sum(case when ${investments.status} = 'pending' then 1 else 0 end)`,
      })
      .from(investments)
      .where(eq(investments.investorId, user.userId));

    // Get investment/acquisition pipeline stats
    const pipelineStats = await db
      .select({
        total_investments: sql<number>`count(*)`,
        pending_investments: sql<number>`sum(case when ${investments.status} = 'pending' then 1 else 0 end)`,
        active_investments: sql<number>`sum(case when ${investments.status} = 'active' then 1 else 0 end)`,
        total_amount_invested: sql<number>`coalesce(sum(${investments.amount}), 0)`,
      })
      .from(investments)
      .where(eq(investments.investorId, user.userId));

    // Get recent investments/acquisitions
    const recentInvestments = await db
      .select({
        id: investments.id,
        amount: investments.amount,
        status: investments.status,
        pitch_id: pitches.id,
        pitch_title: pitches.title,
        pitch_genre: pitches.genre,
        creator_name: users.firstName,
        invested_at: investments.createdAt,
      })
      .from(investments)
      .innerJoin(pitches, eq(investments.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(eq(investments.investorId, user.userId))
      .orderBy(desc(investments.createdAt))
      .limit(5);

    // Get potential acquisitions (trending pitches)
    const potentialAcquisitions = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        budgetRange: pitches.budgetRange,
        stage: pitches.stage,
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
        ...(acquisitionStats[0] || { 
          total_acquisitions: 0, 
          active_investments: 0, 
          completed_investments: 0, 
          pending_investments: 0 
        }),
        ...(pipelineStats[0] || { 
          total_investments: 0, 
          pending_investments: 0, 
          active_investments: 0, 
          total_amount_invested: 0 
        }),
      },
      recent_investments: recentInvestments,
      potential_acquisitions: potentialAcquisitions,
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
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "production") {
      return errorResponse("Access denied - production companies only", 403);
    }

    let whereConditions = [eq(investments.investorId, user.userId)];

    if (status) {
      whereConditions.push(eq(investments.status, status));
    }

    const investmentsList = await db
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
        updated_at: investments.updatedAt,
      })
      .from(investments)
      .innerJoin(pitches, eq(investments.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(investments.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(investments)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      investments: investmentsList,
      filters: { status },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
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
    const investmentResults = await db
      .select({ investorId: investments.investorId })
      .from(investments)
      .where(eq(investments.id, parseInt(investmentId)));

    if (investmentResults.length === 0) {
      return errorResponse("Investment not found", 404);
    }

    if (investmentResults[0].investorId !== user.userId) {
      return errorResponse("Access denied - you can only update your own investments", 403);
    }

    const updatedInvestment = await db
      .update(investments)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(investments.id, parseInt(investmentId)))
      .returning();

    telemetry.logger.info("Investment status updated", { 
      investmentId: parseInt(investmentId), 
      userId: user.userId,
      status
    });

    return successResponse({
      investment: updatedInvestment[0],
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
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "production") {
      return errorResponse("Access denied - production companies only", 403);
    }

    let whereConditions = [eq(pitches.status, "published")];

    if (stage) {
      whereConditions.push(eq(pitches.stage, stage));
    }

    if (genre) {
      whereConditions.push(eq(pitches.genre, genre));
    }

    if (budgetRange) {
      whereConditions.push(eq(pitches.budgetRange, budgetRange));
    }

    const pipeline = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        description: pitches.description,
        genre: pitches.genre,
        format: pitches.format,
        budgetRange: pitches.budgetRange,
        stage: pitches.stage,
        viewCount: pitches.viewCount,
        creator_name: users.firstName,
        company_name: users.companyName,
        creator_email: users.email,
        created_at: pitches.createdAt,
      })
      .from(pitches)
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(pitches.viewCount))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pitches)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      pitches: pipeline,
      filters: { stage, genre, budget_range: budgetRange },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
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
    const userResult = await db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].userType !== "production") {
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
    const allTimeInvestmentStats = await db
      .select({
        total_investments: sql<number>`count(*)`,
        active_investments: sql<number>`sum(case when ${investments.status} = 'active' then 1 else 0 end)`,
        completed_investments: sql<number>`sum(case when ${investments.status} = 'completed' then 1 else 0 end)`,
        total_invested: sql<number>`coalesce(sum(${investments.amount}), 0)`,
      })
      .from(investments)
      .where(eq(investments.investorId, user.userId));

    // Recent investment activity
    const recentInvestmentStats = await db
      .select({
        new_investments: sql<number>`count(*)`,
        recent_amount: sql<number>`coalesce(sum(${investments.amount}), 0)`,
      })
      .from(investments)
      .where(
        and(
          eq(investments.investorId, user.userId),
          sql`${investments.createdAt} >= ${dateFilter}`
        )
      );

    // Investment breakdown by genre (via pitches)
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
      .orderBy(desc(sql<number>`count(*)`));

    const analytics = {
      timeframe,
      investments: {
        all_time: allTimeInvestmentStats[0] || {
          total_investments: 0,
          active_investments: 0,
          completed_investments: 0,
          total_invested: 0,
        },
        recent: recentInvestmentStats[0] || {
          new_investments: 0,
          recent_amount: 0,
        },
        genre_breakdown: genreBreakdown,
      },
      generated_at: new Date(),
    };

    return successResponse({ analytics });

  } catch (error) {
    telemetry.logger.error("Get production analytics error", error);
    return errorResponse("Failed to fetch production analytics", 500);
  }
};