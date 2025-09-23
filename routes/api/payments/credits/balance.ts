import { HandlerContext } from "$fresh/server.ts";
import { db } from "@/db/client.ts";
import { userCredits, creditTransactions } from "@/db/schema.ts";
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

      // Get user credits balance
      let credits = await db.query.userCredits.findFirst({
        where: eq(userCredits.userId, userId),
      });

      // If no credit record exists, create one
      if (!credits) {
        await db.insert(userCredits).values({
          userId,
          balance: 0,
          totalPurchased: 0,
          totalUsed: 0,
        });

        credits = {
          id: 0,
          userId,
          balance: 0,
          totalPurchased: 0,
          totalUsed: 0,
          lastUpdated: new Date(),
        };
      }

      // Get recent transactions
      const recentTransactions = await db.query.creditTransactions.findMany({
        where: eq(creditTransactions.userId, userId),
        orderBy: [desc(creditTransactions.createdAt)],
        limit: 20,
      });

      const response = {
        balance: credits.balance,
        totalPurchased: credits.totalPurchased,
        totalUsed: credits.totalUsed,
        lastUpdated: credits.lastUpdated,
        recentTransactions: recentTransactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          usageType: tx.usageType,
          pitchId: tx.pitchId,
          createdAt: tx.createdAt,
          metadata: tx.metadata,
        })),
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Credit balance error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to get credit balance",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

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
      const body = await req.json();

      // This endpoint is for using credits
      const { amount, description, usageType, pitchId } = body;

      if (!amount || amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid credit amount" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get current balance
      let credits = await db.query.userCredits.findFirst({
        where: eq(userCredits.userId, userId),
      });

      if (!credits || credits.balance < amount) {
        return new Response(JSON.stringify({ error: "Insufficient credits" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const newBalance = credits.balance - amount;

      // Update balance
      await db.update(userCredits)
        .set({
          balance: newBalance,
          totalUsed: credits.totalUsed + amount,
          lastUpdated: new Date(),
        })
        .where(eq(userCredits.userId, userId));

      // Record transaction
      await db.insert(creditTransactions).values({
        userId,
        type: "usage",
        amount: -amount, // Negative for usage
        description: description || `Used ${amount} credits`,
        balanceBefore: credits.balance,
        balanceAfter: newBalance,
        usageType,
        pitchId,
      });

      return new Response(JSON.stringify({
        success: true,
        newBalance,
        creditsUsed: amount,
        description,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Use credits error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to use credits",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};