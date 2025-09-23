import { HandlerContext } from "$fresh/server.ts";
import stripe, { SUBSCRIPTION_PRICES, SUBSCRIPTION_TIERS, getTierFromPriceId } from "../../../utils/stripe.ts";
import { db } from "@/db/client.ts";
import { users, payments, subscriptionHistory } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.middleware.ts";

interface SubscribeRequest {
  tier: keyof typeof SUBSCRIPTION_TIERS;
  billingInterval?: "monthly" | "yearly";
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
      const body: SubscribeRequest = await req.json();

      // Validate tier
      if (!Object.values(SUBSCRIPTION_TIERS).includes(body.tier)) {
        return new Response(JSON.stringify({ error: "Invalid subscription tier" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Basic tier is free
      if (body.tier === SUBSCRIPTION_TIERS.BASIC) {
        return new Response(JSON.stringify({ error: "Basic tier is free" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

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

      // Get price ID for tier
      const priceId = SUBSCRIPTION_PRICES[body.tier];
      if (!priceId) {
        return new Response(JSON.stringify({ error: "Price not found for tier" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          metadata: {
            userId: String(userId),
          },
        });
        customerId = customer.id;

        // Update user with customer ID
        await db.update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, userId));
      }

      // Check if user already has an active subscription
      if (user.stripeSubscriptionId) {
        // Cancel current subscription and create new one
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${Deno.env.get("APP_URL") || "http://localhost:8000"}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${Deno.env.get("APP_URL") || "http://localhost:8000"}/settings?canceled=true`,
        metadata: {
          userId: String(userId),
          tier: body.tier,
        },
        allow_promotion_codes: true,
        billing_address_collection: "auto",
      });

      // Create pending payment record
      await db.insert(payments).values({
        userId,
        type: "subscription",
        amount: String(session.amount_total || 0),
        currency: session.currency || "usd",
        stripeSessionId: session.id,
        stripeCustomerId: customerId,
        status: "pending",
        description: `${body.tier} subscription`,
        metadata: {
          subscriptionTier: body.tier,
        },
      });

      return new Response(JSON.stringify({
        sessionId: session.id,
        url: session.url,
        tier: body.tier,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Subscription error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to create subscription",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};