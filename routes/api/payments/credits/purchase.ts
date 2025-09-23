import { HandlerContext } from "$fresh/server.ts";
import stripe, { CREDIT_PACKAGES, getCreditsFromPriceId } from "../../../../utils/stripe.ts";
import { db } from "@/db/client.ts";
import { users, payments } from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.middleware.ts";

interface PurchaseRequest {
  package: keyof typeof CREDIT_PACKAGES;
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
      const body: PurchaseRequest = await req.json();

      // Validate package
      if (!Object.keys(CREDIT_PACKAGES).includes(body.package)) {
        return new Response(JSON.stringify({ error: "Invalid credit package" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const creditPackage = CREDIT_PACKAGES[body.package];

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

      // Create Stripe checkout session for one-time payment
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${creditPackage.credits} Credits`,
                description: `Purchase ${creditPackage.credits} credits for Pitchey platform`,
                images: [`${Deno.env.get("APP_URL") || "http://localhost:8000"}/logo.svg`],
              },
              unit_amount: creditPackage.price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${Deno.env.get("APP_URL") || "http://localhost:8000"}/dashboard?credits_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${Deno.env.get("APP_URL") || "http://localhost:8000"}/dashboard?credits_canceled=true`,
        metadata: {
          userId: String(userId),
          package: body.package,
          credits: String(creditPackage.credits),
        },
        billing_address_collection: "auto",
      });

      // Create pending payment record
      await db.insert(payments).values({
        userId,
        type: "credits",
        amount: String(creditPackage.price / 100), // Convert cents to dollars
        currency: "usd",
        stripeSessionId: session.id,
        stripeCustomerId: customerId,
        status: "pending",
        description: `Purchase ${creditPackage.credits} credits (${body.package} package)`,
        metadata: {
          creditAmount: creditPackage.credits,
        },
      });

      return new Response(JSON.stringify({
        sessionId: session.id,
        url: session.url,
        package: body.package,
        credits: creditPackage.credits,
        price: creditPackage.price,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Credit purchase error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to create credit purchase",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};