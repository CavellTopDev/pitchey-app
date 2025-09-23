import { HandlerContext } from "$fresh/server.ts";
import stripe from "../../../utils/stripe.ts";
import { db } from "@/db/client.ts";
import { users, subscriptionHistory } from "@/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.middleware.ts";

export const handler = {
  async GET(req: Request, ctx: HandlerContext) {
    try {
      // Authenticate user
      const authResult = await authMiddleware(req);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = authResult.userId!;

      // Get user with subscription info
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get subscription history
      const history = await db.query.subscriptionHistory.findMany({
        where: eq(subscriptionHistory.userId, userId),
        orderBy: [desc(subscriptionHistory.createdAt)],
        limit: 10,
      });

      let stripeSubscription = null;
      let subscriptionStatus = "inactive";
      let currentPeriodEnd = null;
      let cancelAtPeriodEnd = false;

      // If user has active Stripe subscription, get details from Stripe
      if (user.stripeSubscriptionId) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          subscriptionStatus = stripeSubscription.status;
          currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
          cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
        } catch (error) {
          console.error("Error fetching Stripe subscription:", error);
          // Subscription might have been deleted, update user record
          await db.update(users)
            .set({
              stripeSubscriptionId: null,
              subscriptionTier: "free",
            })
            .where(eq(users.id, userId));
        }
      }

      // Determine effective tier
      let effectiveTier = user.subscriptionTier || "free";
      if (subscriptionStatus === "active" && stripeSubscription) {
        // Get tier from subscription
        const priceId = stripeSubscription.items.data[0]?.price.id;
        if (priceId) {
          // Map price ID to tier - this should be improved with a proper lookup
          if (priceId.includes("pro")) effectiveTier = "pro";
          else if (priceId.includes("enterprise")) effectiveTier = "enterprise";
        }
      }

      const response = {
        tier: effectiveTier,
        status: subscriptionStatus,
        stripeSubscriptionId: user.stripeSubscriptionId,
        stripeCustomerId: user.stripeCustomerId,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        history: history.map(h => ({
          id: h.id,
          tier: h.tier,
          status: h.status,
          startDate: h.startDate,
          endDate: h.endDate,
          amount: h.amount,
          currency: h.currency,
          billingInterval: h.billingInterval,
          createdAt: h.createdAt,
          canceledAt: h.canceledAt,
        })),
        subscription: stripeSubscription ? {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          plan: {
            id: stripeSubscription.items.data[0]?.price.id,
            amount: stripeSubscription.items.data[0]?.price.unit_amount,
            currency: stripeSubscription.items.data[0]?.price.currency,
            interval: stripeSubscription.items.data[0]?.price.recurring?.interval,
          },
        } : null,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Subscription status error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to get subscription status",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};