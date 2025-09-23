import { HandlerContext } from "$fresh/server.ts";
import { db } from "@/db/client.ts";
import { payments, creditTransactions, subscriptionHistory } from "@/db/schema.ts";
import { eq, desc, and, gte, lte } from "drizzle-orm";
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
      const url = new URL(req.url);
      
      // Parse query parameters
      const type = url.searchParams.get("type"); // subscription, credits, success_fee, all
      const status = url.searchParams.get("status");
      const fromDate = url.searchParams.get("fromDate");
      const toDate = url.searchParams.get("toDate");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      // Build where conditions
      let whereConditions = [eq(payments.userId, userId)];

      if (type && type !== "all") {
        whereConditions.push(eq(payments.type, type as any));
      }

      if (status) {
        whereConditions.push(eq(payments.status, status as any));
      }

      if (fromDate) {
        whereConditions.push(gte(payments.createdAt, new Date(fromDate)));
      }

      if (toDate) {
        whereConditions.push(lte(payments.createdAt, new Date(toDate)));
      }

      const whereCondition = whereConditions.length > 1 
        ? and(...whereConditions)
        : whereConditions[0];

      // Get payments
      const userPayments = await db.query.payments.findMany({
        where: whereCondition,
        orderBy: [desc(payments.createdAt)],
        limit,
        offset,
      });

      // Get credit transactions for additional context
      const creditTransactionHistory = await db.query.creditTransactions.findMany({
        where: eq(creditTransactions.userId, userId),
        orderBy: [desc(creditTransactions.createdAt)],
        limit: 20,
      });

      // Get subscription history
      const subscriptionHistoryData = await db.query.subscriptionHistory.findMany({
        where: eq(subscriptionHistory.userId, userId),
        orderBy: [desc(subscriptionHistory.createdAt)],
        limit: 10,
      });

      // Calculate summary statistics
      const totalSpent = userPayments
        .filter(p => p.status === "completed")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const creditsPurchased = userPayments
        .filter(p => p.type === "credits" && p.status === "completed")
        .reduce((sum, p) => sum + (p.metadata?.creditAmount || 0), 0);

      const subscriptionSpent = userPayments
        .filter(p => p.type === "subscription" && p.status === "completed")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const successFeesEarned = userPayments
        .filter(p => p.type === "success_fee" && p.status === "completed")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const response = {
        payments: userPayments.map(payment => ({
          id: payment.id,
          type: payment.type,
          amount: parseFloat(payment.amount),
          currency: payment.currency,
          status: payment.status,
          description: payment.description,
          metadata: payment.metadata,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          stripeInvoiceId: payment.stripeInvoiceId,
          stripeSessionId: payment.stripeSessionId,
          failureReason: payment.failureReason,
          createdAt: payment.createdAt,
          completedAt: payment.completedAt,
          failedAt: payment.failedAt,
        })),
        creditTransactions: creditTransactionHistory.map(tx => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          usageType: tx.usageType,
          pitchId: tx.pitchId,
          metadata: tx.metadata,
          createdAt: tx.createdAt,
        })),
        subscriptionHistory: subscriptionHistoryData.map(sub => ({
          id: sub.id,
          tier: sub.tier,
          status: sub.status,
          startDate: sub.startDate,
          endDate: sub.endDate,
          amount: sub.amount ? parseFloat(sub.amount) : null,
          currency: sub.currency,
          billingInterval: sub.billingInterval,
          metadata: sub.metadata,
          createdAt: sub.createdAt,
          canceledAt: sub.canceledAt,
        })),
        summary: {
          totalSpent,
          creditsPurchased,
          subscriptionSpent,
          successFeesEarned,
          totalTransactions: userPayments.length,
          completedTransactions: userPayments.filter(p => p.status === "completed").length,
          failedTransactions: userPayments.filter(p => p.status === "failed").length,
          pendingTransactions: userPayments.filter(p => p.status === "pending").length,
        },
        pagination: {
          limit,
          offset,
          hasMore: userPayments.length === limit,
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Payment history error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to get payment history",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};