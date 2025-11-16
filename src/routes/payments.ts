/**
 * Payments Routes Module - Stripe payment processing and subscription management
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { stripeService, SUBSCRIPTION_TIERS } from "../services/stripe-service.ts";
import { db } from "../db/client.ts";
import { users, payments, subscriptionHistory, paymentMethods } from "../db/schema.ts";
import { eq, desc } from "drizzle-orm";
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

// GET /api/payments/subscription-tiers - Get available subscription tiers
export const getSubscriptionTiers: RouteHandler = async (request, url) => {
  try {
    const userType = url.searchParams.get("userType");
    
    let tiers = SUBSCRIPTION_TIERS;
    if (userType) {
      tiers = tiers.filter(tier => tier.userType === userType);
    }

    return successResponse({ tiers });
  } catch (error) {
    telemetry.logger.error("Error fetching subscription tiers:", error);
    return errorResponse("Failed to fetch subscription tiers", 500);
  }
};

// POST /api/payments/create-customer - Create Stripe customer
export const createCustomer: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const userId = user.userId;

    const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRecord[0]) {
      return errorResponse("User not found", 404);
    }

    const customerId = await stripeService.createOrGetCustomer(
      userId,
      userRecord[0].email,
      `${userRecord[0].firstName || ""} ${userRecord[0].lastName || ""}`.trim()
    );

    return successResponse({ customerId });
  } catch (error) {
    telemetry.logger.error("Error creating customer:", error);
    return errorResponse("Failed to create customer", 500);
  }
};

// POST /api/payments/create-subscription - Subscribe to plan
export const createSubscription: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { tierID, paymentMethodId } = await request.json();

    if (!tierID) {
      return errorResponse("Subscription tier ID is required", 400);
    }

    // Validate tier exists
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierID);
    if (!tier) {
      return errorResponse("Invalid subscription tier", 400);
    }

    const result = await stripeService.createSubscription(user.userId, tierID, paymentMethodId);

    return successResponse({
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        current_period_start: result.subscription.current_period_start,
        current_period_end: result.subscription.current_period_end,
        clientSecret: result.clientSecret
      },
      tier
    });
  } catch (error) {
    telemetry.logger.error("Error creating subscription:", error);
    return errorResponse(error.message || "Failed to create subscription", 500);
  }
};

// POST /api/payments/create-checkout - One-time payment checkout
export const createCheckout: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { amount, description, successUrl, cancelUrl, metadata } = await request.json();

    if (!amount || amount <= 0) {
      return errorResponse("Valid amount is required", 400);
    }

    if (!description) {
      return errorResponse("Description is required", 400);
    }

    if (!successUrl || !cancelUrl) {
      return errorResponse("Success and cancel URLs are required", 400);
    }

    const session = await stripeService.createCheckoutSession(
      user.userId,
      amount,
      description,
      successUrl,
      cancelUrl,
      metadata
    );

    return successResponse({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    telemetry.logger.error("Error creating checkout session:", error);
    return errorResponse(error.message || "Failed to create checkout session", 500);
  }
};

// POST /api/payments/cancel-subscription - Cancel subscription
export const cancelSubscription: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    await stripeService.cancelSubscription(user.userId);

    return successResponse({ message: "Subscription canceled successfully" });
  } catch (error) {
    telemetry.logger.error("Error canceling subscription:", error);
    return errorResponse(error.message || "Failed to cancel subscription", 500);
  }
};

// GET /api/payments/invoices - Get user invoices
export const getInvoices: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const invoices = await stripeService.getUserInvoices(user.userId, limit);

    return successResponse({
      invoices: invoices.map(invoice => ({
        id: invoice.id,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status,
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
        created: invoice.created,
        due_date: invoice.due_date,
        period_start: invoice.period_start,
        period_end: invoice.period_end
      }))
    });
  } catch (error) {
    telemetry.logger.error("Error fetching invoices:", error);
    return errorResponse(error.message || "Failed to fetch invoices", 500);
  }
};

// GET /api/payments/subscription-status - Get user's current subscription
export const getSubscriptionStatus: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    const userRecord = await db.select({
      subscriptionTier: users.subscriptionTier,
      subscriptionStartDate: users.subscriptionStartDate,
      subscriptionEndDate: users.subscriptionEndDate,
      stripeSubscriptionId: users.stripeSubscriptionId
    }).from(users).where(eq(users.id, user.userId)).limit(1);

    if (!userRecord[0]) {
      return errorResponse("User not found", 404);
    }

    const currentTier = SUBSCRIPTION_TIERS.find(t => t.id === userRecord[0].subscriptionTier);

    return successResponse({
      subscription: {
        tier: userRecord[0].subscriptionTier,
        tierDetails: currentTier,
        startDate: userRecord[0].subscriptionStartDate,
        endDate: userRecord[0].subscriptionEndDate,
        isActive: userRecord[0].subscriptionTier !== "free"
      }
    });
  } catch (error) {
    telemetry.logger.error("Error fetching subscription status:", error);
    return errorResponse("Failed to fetch subscription status", 500);
  }
};

// GET /api/payments/subscription-history - Get subscription history
export const getSubscriptionHistory: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    const history = await db.select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.userId, user.userId))
      .orderBy(desc(subscriptionHistory.timestamp))
      .limit(20);

    return successResponse({ history });
  } catch (error) {
    telemetry.logger.error("Error fetching subscription history:", error);
    return errorResponse("Failed to fetch subscription history", 500);
  }
};

// GET /api/payments/payment-methods - Get user's payment methods
export const getPaymentMethods: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    const methods = await db.select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, user.userId))
      .orderBy(desc(paymentMethods.createdAt));

    return successResponse({
      paymentMethods: methods.map(method => ({
        id: method.id,
        type: method.type,
        brand: method.brand,
        lastFour: method.lastFour,
        expMonth: method.expMonth,
        expYear: method.expYear,
        isDefault: method.isDefault,
        isActive: method.isActive,
        createdAt: method.createdAt
      }))
    });
  } catch (error) {
    telemetry.logger.error("Error fetching payment methods:", error);
    return errorResponse("Failed to fetch payment methods", 500);
  }
};

// POST /api/payments/process-investment - Process investment transaction
export const processInvestment: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { creatorId, pitchId, amount } = await request.json();

    if (!creatorId || !pitchId || !amount || amount <= 0) {
      return errorResponse("Creator ID, pitch ID, and valid amount are required", 400);
    }

    const result = await stripeService.processInvestmentTransaction(
      user.userId,
      creatorId,
      pitchId,
      amount
    );

    return successResponse({
      transferId: result.transferId,
      feeAmount: result.feeAmount,
      creatorAmount: amount - result.feeAmount
    });
  } catch (error) {
    telemetry.logger.error("Error processing investment:", error);
    return errorResponse(error.message || "Failed to process investment", 500);
  }
};

// POST /api/payments/webhook - Handle Stripe webhooks (no auth required)
export const handleWebhook: RouteHandler = async (request, url) => {
  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return errorResponse("Missing stripe-signature header", 400);
    }

    // Get raw body for webhook verification
    const body = await request.text();

    await stripeService.handleWebhook(body, signature);

    return successResponse({ message: "Webhook processed successfully" });
  } catch (error) {
    telemetry.logger.error("Error processing webhook:", error);
    return errorResponse("Webhook processing failed", 400);
  }
};