/**
 * Payments Routes Module - Investment and transaction handling
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { investments, pitches, users } from "../db/schema.ts";
import { eq, and, sql, desc } from "npm:drizzle-orm@0.35.3";
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

// Create investment (mock implementation - would integrate with payment processor)
export const createInvestment: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { pitch_id, amount, payment_method } = await request.json();

    if (!pitch_id || !amount) {
      return errorResponse("Pitch ID and amount are required", 400);
    }

    if (amount <= 0) {
      return errorResponse("Investment amount must be positive", 400);
    }

    // Verify user is an investor
    const userResult = await db
      .select({ user_type: users.user_type })
      .from(users)
      .where(eq(users.id, user.userId));

    if (userResult.length === 0 || userResult[0].user_type !== "investor") {
      return errorResponse("Only investors can make investments", 403);
    }

    // Check if pitch exists and is published
    const pitchResults = await db
      .select({ 
        id: pitches.id, 
        user_id: pitches.user_id, 
        status: pitches.status,
        title: pitches.title 
      })
      .from(pitches)
      .where(eq(pitches.id, pitch_id));

    if (pitchResults.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    const pitch = pitchResults[0];

    if (pitch.status !== "published") {
      return errorResponse("Can only invest in published pitches", 400);
    }

    if (pitch.user_id === user.userId) {
      return errorResponse("Cannot invest in your own pitch", 400);
    }

    // Mock payment processing (in real implementation, integrate with Stripe/PayPal)
    const payment_id = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create investment record
    const newInvestment = await db
      .insert(investments)
      .values({
        pitch_id,
        investor_id: user.userId,
        amount,
        payment_method: payment_method || "card",
        payment_id,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    telemetry.logger.info("Investment created", {
      investmentId: newInvestment[0].id,
      pitchId: pitch_id,
      investorId: user.userId,
      amount
    });

    // Mock payment success (in real implementation, would be handled by webhook)
    setTimeout(async () => {
      try {
        await db
          .update(investments)
          .set({
            status: "completed",
            processed_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(investments.id, newInvestment[0].id));

        telemetry.logger.info("Investment processed", {
          investmentId: newInvestment[0].id
        });
      } catch (error) {
        telemetry.logger.error("Failed to process investment", error);
      }
    }, 2000);

    return successResponse({
      investment: newInvestment[0],
      message: "Investment created successfully"
    });

  } catch (error) {
    telemetry.logger.error("Create investment error", error);
    return errorResponse("Failed to create investment", 500);
  }
};

// Get user investments
export const getUserInvestments: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let whereConditions = [eq(investments.investor_id, user.userId)];

    if (status) {
      whereConditions.push(eq(investments.status, status));
    }

    // Get investments with pitch details
    const userInvestments = await db
      .select({
        id: investments.id,
        pitch_id: investments.pitch_id,
        amount: investments.amount,
        status: investments.status,
        payment_method: investments.payment_method,
        created_at: investments.created_at,
        processed_at: investments.processed_at,
        pitch_title: pitches.title,
        pitch_genre: pitches.genre,
        pitch_format: pitches.format,
        creator_name: users.firstName,
      })
      .from(investments)
      .leftJoin(pitches, eq(investments.pitch_id, pitches.id))
      .leftJoin(users, eq(pitches.user_id, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(investments.created_at))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(investments)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Calculate summary statistics
    const summaryResult = await db
      .select({
        total_invested: sql<number>`sum(${investments.amount})`,
        completed_investments: sql<number>`sum(case when ${investments.status} = 'completed' then 1 else 0 end)`,
        pending_investments: sql<number>`sum(case when ${investments.status} = 'pending' then 1 else 0 end)`,
      })
      .from(investments)
      .where(eq(investments.investor_id, user.userId));

    return successResponse({
      investments: userInvestments,
      summary: summaryResult[0] || {
        total_invested: 0,
        completed_investments: 0,
        pending_investments: 0,
      },
      filters: { status },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get user investments error", error);
    return errorResponse("Failed to fetch investments", 500);
  }
};

// Get investment by ID
export const getInvestmentById: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const investmentId = params?.id;

    if (!investmentId) {
      return errorResponse("Investment ID is required", 400);
    }

    const investmentResults = await db
      .select({
        id: investments.id,
        pitch_id: investments.pitch_id,
        investor_id: investments.investor_id,
        amount: investments.amount,
        status: investments.status,
        payment_method: investments.payment_method,
        payment_id: investments.payment_id,
        created_at: investments.created_at,
        processed_at: investments.processed_at,
        pitch_title: pitches.title,
        pitch_logline: pitches.logline,
        pitch_genre: pitches.genre,
        pitch_format: pitches.format,
        creator_name: users.firstName,
      })
      .from(investments)
      .leftJoin(pitches, eq(investments.pitch_id, pitches.id))
      .leftJoin(users, eq(pitches.user_id, users.id))
      .where(eq(investments.id, parseInt(investmentId)));

    if (investmentResults.length === 0) {
      return errorResponse("Investment not found", 404);
    }

    const investment = investmentResults[0];

    // Check if user owns this investment
    if (investment.investor_id !== user.userId) {
      return errorResponse("Access denied", 403);
    }

    return successResponse({ investment });

  } catch (error) {
    telemetry.logger.error("Get investment by ID error", error);
    return errorResponse("Failed to fetch investment", 500);
  }
};

// Get investments received by creator (for pitch owners)
export const getReceivedInvestments: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const pitchId = url.searchParams.get("pitch_id");
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Get pitches owned by user
    let whereConditions = [eq(pitches.user_id, user.userId)];

    if (pitchId) {
      whereConditions.push(eq(investments.pitch_id, parseInt(pitchId)));
    }

    if (status) {
      whereConditions.push(eq(investments.status, status));
    }

    // Get investments received for user's pitches
    const receivedInvestments = await db
      .select({
        id: investments.id,
        pitch_id: investments.pitch_id,
        investor_id: investments.investor_id,
        amount: investments.amount,
        status: investments.status,
        payment_method: investments.payment_method,
        created_at: investments.created_at,
        processed_at: investments.processed_at,
        pitch_title: pitches.title,
        investor_name: users.firstName,
      })
      .from(investments)
      .leftJoin(pitches, eq(investments.pitch_id, pitches.id))
      .leftJoin(users, eq(investments.investor_id, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(investments.created_at))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(investments)
      .leftJoin(pitches, eq(investments.pitch_id, pitches.id))
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get summary statistics for creator
    const summaryResult = await db
      .select({
        total_received: sql<number>`sum(${investments.amount})`,
        total_investors: sql<number>`count(distinct ${investments.investor_id})`,
        completed_investments: sql<number>`sum(case when ${investments.status} = 'completed' then 1 else 0 end)`,
      })
      .from(investments)
      .leftJoin(pitches, eq(investments.pitch_id, pitches.id))
      .where(eq(pitches.user_id, user.userId));

    return successResponse({
      investments: receivedInvestments,
      summary: summaryResult[0] || {
        total_received: 0,
        total_investors: 0,
        completed_investments: 0,
      },
      filters: { pitch_id: pitchId, status },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get received investments error", error);
    return errorResponse("Failed to fetch received investments", 500);
  }
};

// Handle payment webhook (mock implementation)
export const handlePaymentWebhook: RouteHandler = async (request, url) => {
  try {
    // This would typically verify webhook signatures from payment processor
    const { event_type, payment_id, status } = await request.json();

    if (!payment_id) {
      return errorResponse("Payment ID is required", 400);
    }

    // Find investment by payment ID
    const investmentResults = await db
      .select()
      .from(investments)
      .where(eq(investments.payment_id, payment_id));

    if (investmentResults.length === 0) {
      return errorResponse("Investment not found", 404);
    }

    const investment = investmentResults[0];

    // Update investment status based on webhook
    let newStatus;
    let processedAt = null;

    switch (status) {
      case "succeeded":
        newStatus = "completed";
        processedAt = new Date();
        break;
      case "failed":
        newStatus = "failed";
        break;
      case "pending":
        newStatus = "pending";
        break;
      default:
        newStatus = investment.status;
    }

    const updateData: any = {
      status: newStatus,
      updated_at: new Date(),
    };

    if (processedAt) {
      updateData.processed_at = processedAt;
    }

    const updatedInvestment = await db
      .update(investments)
      .set(updateData)
      .where(eq(investments.id, investment.id))
      .returning();

    telemetry.logger.info("Payment webhook processed", {
      investmentId: investment.id,
      paymentId: payment_id,
      eventType: event_type,
      newStatus
    });

    return successResponse({
      status: "processed",
      investment: updatedInvestment[0]
    });

  } catch (error) {
    telemetry.logger.error("Handle payment webhook error", error);
    return errorResponse("Failed to process webhook", 500);
  }
};

// Get payment methods (mock implementation)
export const getPaymentMethods: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    // Mock payment methods - in real implementation, would fetch from payment processor
    const paymentMethods = [
      {
        id: "card_1",
        type: "card",
        last4: "4242",
        brand: "visa",
        exp_month: 12,
        exp_year: 2025,
        is_default: true,
      },
      {
        id: "bank_1",
        type: "bank_account",
        last4: "6789",
        bank_name: "Chase Bank",
        is_default: false,
      }
    ];

    return successResponse({ payment_methods: paymentMethods });

  } catch (error) {
    telemetry.logger.error("Get payment methods error", error);
    return errorResponse("Failed to fetch payment methods", 500);
  }
};

// Get investment statistics
export const getInvestmentStats: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    // Get investor stats
    const investorStats = await db
      .select({
        total_invested: sql<number>`sum(${investments.amount})`,
        total_investments: sql<number>`count(*)`,
        active_investments: sql<number>`sum(case when ${investments.status} = 'completed' then 1 else 0 end)`,
        pending_investments: sql<number>`sum(case when ${investments.status} = 'pending' then 1 else 0 end)`,
      })
      .from(investments)
      .where(eq(investments.investor_id, user.userId));

    // Get creator stats (investments received)
    const creatorStats = await db
      .select({
        total_received: sql<number>`sum(${investments.amount})`,
        total_investors: sql<number>`count(distinct ${investments.investor_id})`,
        total_investments_received: sql<number>`count(*)`,
      })
      .from(investments)
      .leftJoin(pitches, eq(investments.pitch_id, pitches.id))
      .where(eq(pitches.user_id, user.userId));

    return successResponse({
      as_investor: investorStats[0] || {
        total_invested: 0,
        total_investments: 0,
        active_investments: 0,
        pending_investments: 0,
      },
      as_creator: creatorStats[0] || {
        total_received: 0,
        total_investors: 0,
        total_investments_received: 0,
      }
    });

  } catch (error) {
    telemetry.logger.error("Get investment stats error", error);
    return errorResponse("Failed to fetch investment statistics", 500);
  }
};