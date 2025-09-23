import { HandlerContext } from "$fresh/server.ts";
import stripe from "../../../utils/stripe.ts";
import { db } from "@/db/client.ts";
import { users, paymentMethods } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.middleware.ts";

interface AddPaymentMethodRequest {
  paymentMethodId: string;
  setAsDefault?: boolean;
}

interface UpdatePaymentMethodRequest {
  isDefault?: boolean;
  isActive?: boolean;
}

export const handler = {
  // Get all payment methods for user
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

      // Get stored payment methods from database
      const storedPaymentMethods = await db.query.paymentMethods.findMany({
        where: eq(paymentMethods.userId, userId),
        orderBy: paymentMethods.createdAt,
      });

      // Get fresh data from Stripe if customer exists
      let stripePaymentMethods: any[] = [];
      if (user.stripeCustomerId) {
        try {
          const stripeResponse = await stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: "card",
          });
          stripePaymentMethods = stripeResponse.data;
        } catch (error) {
          console.error("Error fetching Stripe payment methods:", error);
        }
      }

      // Merge and sync data
      const paymentMethodsResponse = storedPaymentMethods.map(pm => {
        const stripeData = stripePaymentMethods.find(spm => spm.id === pm.stripePaymentMethodId);
        
        return {
          id: pm.id,
          stripePaymentMethodId: pm.stripePaymentMethodId,
          type: pm.type,
          cardBrand: pm.cardBrand,
          cardLast4: pm.cardLast4,
          cardExpMonth: pm.cardExpMonth,
          cardExpYear: pm.cardExpYear,
          isDefault: pm.isDefault,
          isActive: pm.isActive,
          createdAt: pm.createdAt,
          updatedAt: pm.updatedAt,
          // Fresh data from Stripe
          stripeData: stripeData ? {
            billing_details: stripeData.billing_details,
            card: stripeData.card,
            created: stripeData.created,
          } : null,
        };
      });

      return new Response(JSON.stringify({
        paymentMethods: paymentMethodsResponse,
        stripeCustomerId: user.stripeCustomerId,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Get payment methods error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to get payment methods",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Add new payment method
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
      const body: AddPaymentMethodRequest = await req.json();

      if (!body.paymentMethodId) {
        return new Response(JSON.stringify({ error: "Payment method ID is required" }), {
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

      // Create Stripe customer if needed
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

        await db.update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, userId));
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(body.paymentMethodId, {
        customer: customerId,
      });

      // Get payment method details from Stripe
      const stripePaymentMethod = await stripe.paymentMethods.retrieve(body.paymentMethodId);

      // If setting as default, update other payment methods
      if (body.setAsDefault) {
        await db.update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.userId, userId));

        // Set as default customer payment method in Stripe
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: body.paymentMethodId,
          },
        });
      }

      // Store payment method in database
      const [newPaymentMethod] = await db.insert(paymentMethods).values({
        userId,
        stripePaymentMethodId: body.paymentMethodId,
        stripeCustomerId: customerId,
        type: stripePaymentMethod.type,
        cardBrand: stripePaymentMethod.card?.brand,
        cardLast4: stripePaymentMethod.card?.last4,
        cardExpMonth: stripePaymentMethod.card?.exp_month,
        cardExpYear: stripePaymentMethod.card?.exp_year,
        isDefault: body.setAsDefault || false,
        isActive: true,
      }).returning();

      return new Response(JSON.stringify({
        paymentMethod: {
          id: newPaymentMethod.id,
          stripePaymentMethodId: newPaymentMethod.stripePaymentMethodId,
          type: newPaymentMethod.type,
          cardBrand: newPaymentMethod.cardBrand,
          cardLast4: newPaymentMethod.cardLast4,
          cardExpMonth: newPaymentMethod.cardExpMonth,
          cardExpYear: newPaymentMethod.cardExpYear,
          isDefault: newPaymentMethod.isDefault,
          isActive: newPaymentMethod.isActive,
          createdAt: newPaymentMethod.createdAt,
        },
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Add payment method error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to add payment method",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Update payment method
  async PUT(req: Request, ctx: HandlerContext) {
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
      const url = new URL(req.url);
      const paymentMethodId = url.searchParams.get("id");
      const body: UpdatePaymentMethodRequest = await req.json();

      if (!paymentMethodId) {
        return new Response(JSON.stringify({ error: "Payment method ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get payment method
      const paymentMethod = await db.query.paymentMethods.findFirst({
        where: and(
          eq(paymentMethods.id, parseInt(paymentMethodId)),
          eq(paymentMethods.userId, userId)
        ),
      });

      if (!paymentMethod) {
        return new Response(JSON.stringify({ error: "Payment method not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // If setting as default, update other payment methods
      if (body.isDefault) {
        await db.update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.userId, userId));

        // Update Stripe customer default payment method
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (user?.stripeCustomerId) {
          await stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethod.stripePaymentMethodId,
            },
          });
        }
      }

      // Update payment method
      const [updatedPaymentMethod] = await db.update(paymentMethods)
        .set({
          isDefault: body.isDefault ?? paymentMethod.isDefault,
          isActive: body.isActive ?? paymentMethod.isActive,
          updatedAt: new Date(),
        })
        .where(eq(paymentMethods.id, parseInt(paymentMethodId)))
        .returning();

      return new Response(JSON.stringify({
        paymentMethod: updatedPaymentMethod,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Update payment method error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to update payment method",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Delete payment method
  async DELETE(req: Request, ctx: HandlerContext) {
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
      const url = new URL(req.url);
      const paymentMethodId = url.searchParams.get("id");

      if (!paymentMethodId) {
        return new Response(JSON.stringify({ error: "Payment method ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get payment method
      const paymentMethod = await db.query.paymentMethods.findFirst({
        where: and(
          eq(paymentMethods.id, parseInt(paymentMethodId)),
          eq(paymentMethods.userId, userId)
        ),
      });

      if (!paymentMethod) {
        return new Response(JSON.stringify({ error: "Payment method not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Detach from Stripe
      try {
        await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
      } catch (error) {
        console.error("Error detaching payment method from Stripe:", error);
        // Continue with database deletion even if Stripe fails
      }

      // Delete from database
      await db.delete(paymentMethods)
        .where(eq(paymentMethods.id, parseInt(paymentMethodId)));

      return new Response(JSON.stringify({
        success: true,
        message: "Payment method deleted successfully",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Delete payment method error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to delete payment method",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};