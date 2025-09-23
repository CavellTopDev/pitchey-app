import { HandlerContext } from "$fresh/server.ts";
import { calculateSuccessFee } from "../../../../utils/stripe.ts";
import { db } from "@/db/client.ts";
import { deals, pitches, users } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.middleware.ts";

interface TrackDealRequest {
  pitchId: number;
  investorId: number;
  dealValue: number;
  currency?: string;
  description?: string;
  dealType?: string;
  terms?: string;
  conditions?: string;
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
      const body: TrackDealRequest = await req.json();

      // Validate required fields
      if (!body.pitchId || !body.investorId || !body.dealValue || body.dealValue <= 0) {
        return new Response(JSON.stringify({ error: "Missing or invalid required fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify pitch exists and user is the creator
      const pitch = await db.query.pitches.findFirst({
        where: and(
          eq(pitches.id, body.pitchId),
          eq(pitches.userId, userId)
        ),
      });

      if (!pitch) {
        return new Response(JSON.stringify({ error: "Pitch not found or not owned by user" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify investor exists
      const investor = await db.query.users.findFirst({
        where: eq(users.id, body.investorId),
      });

      if (!investor) {
        return new Response(JSON.stringify({ error: "Investor not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if deal already exists for this pitch and investor
      const existingDeal = await db.query.deals.findFirst({
        where: and(
          eq(deals.pitchId, body.pitchId),
          eq(deals.investorId, body.investorId),
          eq(deals.creatorId, userId)
        ),
      });

      if (existingDeal) {
        return new Response(JSON.stringify({ error: "Deal already exists for this pitch and investor" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Calculate success fee
      const successFeeAmount = calculateSuccessFee(body.dealValue);

      // Create deal record
      const [deal] = await db.insert(deals).values({
        pitchId: body.pitchId,
        creatorId: userId,
        investorId: body.investorId,
        dealValue: String(body.dealValue),
        currency: body.currency || "USD",
        successFeeAmount: String(successFeeAmount),
        description: body.description,
        contractDetails: {
          dealType: body.dealType || "investment",
          terms: body.terms || "",
          conditions: body.conditions || "",
        },
      }).returning();

      const response = {
        dealId: deal.id,
        pitchId: body.pitchId,
        creatorId: userId,
        investorId: body.investorId,
        dealValue: body.dealValue,
        currency: body.currency || "USD",
        successFeePercentage: 3.0,
        successFeeAmount,
        status: "pending",
        description: body.description,
        contractDetails: deal.contractDetails,
        createdAt: deal.createdAt,
      };

      return new Response(JSON.stringify(response), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Track deal error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to track deal",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

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
      const status = url.searchParams.get("status");

      // Get deals where user is creator or investor
      let query = db.query.deals.findMany({
        where: eq(deals.creatorId, userId),
        with: {
          pitch: {
            columns: {
              id: true,
              title: true,
              logline: true,
            }
          },
          investor: {
            columns: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              companyName: true,
            }
          }
        },
        orderBy: deals.createdAt,
      });

      const creatorDeals = await query;

      // Also get deals where user is investor
      const investorDeals = await db.query.deals.findMany({
        where: eq(deals.investorId, userId),
        with: {
          pitch: {
            columns: {
              id: true,
              title: true,
              logline: true,
            }
          },
          creator: {
            columns: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            }
          }
        },
        orderBy: deals.createdAt,
      });

      const allDeals = [
        ...creatorDeals.map(deal => ({ ...deal, role: "creator" })),
        ...investorDeals.map(deal => ({ ...deal, role: "investor" })),
      ];

      // Filter by status if provided
      const filteredDeals = status 
        ? allDeals.filter(deal => deal.status === status)
        : allDeals;

      return new Response(JSON.stringify({
        deals: filteredDeals,
        counts: {
          total: allDeals.length,
          pending: allDeals.filter(d => d.status === "pending").length,
          confirmed: allDeals.filter(d => d.status === "confirmed").length,
          paid: allDeals.filter(d => d.status === "paid").length,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Get deals error:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to get deals",
        details: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};