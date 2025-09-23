import { HandlerContext } from "$fresh/server.ts";
import stripe from "../../../utils/stripe.ts";
import { db } from "@/db/client.ts";
import { users, subscriptionHistory } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.middleware.ts";

interface CancelRequest {
  immediately?: boolean;
  reason?: string;
}

export const handler = {
  async POST(req: Request, ctx: HandlerContext) {
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
      const body: CancelRequest = await req.json().catch(() => ({}));

      // Get user
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!user.stripeSubscriptionId) {
        return new Response(JSON.stringify({ error: "No active subscription found" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      let canceledSubscription;

      if (body.immediately) {
        // Cancel immediately
        canceledSubscription = await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        
        // Update user immediately
        await db.update(users)
          .set({
            subscriptionTier: "free",
            stripeSubscriptionId: null,
            subscriptionEndDate: new Date(),
          })
          .where(eq(users.id, userId));

      } else {
        // Cancel at period end
        canceledSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }

      // Update subscription history
      await db.insert(subscriptionHistory).values({
        userId,
        tier: user.subscriptionTier as any || "PRO",
        stripeSubscriptionId: user.stripeSubscriptionId,
        startDate: user.subscriptionStartDate || new Date(),
        endDate: body.immediately ? new Date() : new Date(canceledSubscription.current_period_end * 1000),
        status: "canceled",
        amount: String(canceledSubscription.items.data[0]?.price.unit_amount || 0),
        currency: canceledSubscription.currency,
        billingInterval: canceledSubscription.items.data[0]?.price.recurring?.interval || "monthly",
        canceledAt: new Date(),
        metadata: {
          cancelReason: body.reason || "User requested",
        },
      });

      const response = {
        success: true,
        canceledImmediately: body.immediately,
        subscription: {
          id: canceledSubscription.id,
          status: canceledSubscription.status,
          cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
          currentPeriodEnd: new Date(canceledSubscription.current_period_end * 1000),
        },
        message: body.immediately 
          ? "Subscription canceled immediately"
          : "Subscription will be canceled at the end of the current billing period",
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Cancel subscription error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to cancel subscription",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};