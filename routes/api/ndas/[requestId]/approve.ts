import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { ndaRequests, ndas, pitches } from "../../../../src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const requestId = parseInt(ctx.params.requestId);
      
      // Get the NDA request
      const request = await db.select().from(ndaRequests)
        .where(eq(ndaRequests.id, requestId))
        .limit(1);

      if (!request.length) {
        return new Response(JSON.stringify({ error: "Request not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify the user is the owner of the pitch
      if (request[0].ownerId !== userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if already processed
      if (request[0].status !== "pending") {
        return new Response(JSON.stringify({ error: "Request already processed" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Start transaction
      await db.transaction(async (tx) => {
        // Update request status
        await tx.update(ndaRequests)
          .set({
            status: "approved",
            respondedAt: new Date(),
          })
          .where(eq(ndaRequests.id, requestId));

        // Create NDA record
        await tx.insert(ndas).values({
          pitchId: request[0].pitchId,
          signerId: request[0].requesterId,
          ndaType: request[0].ndaType,
          signedAt: new Date(),
          accessGranted: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        });

        // Increment NDA count on pitch
        await tx.update(pitches)
          .set({
            ndaCount: pitches.ndaCount + 1,
          })
          .where(eq(pitches.id, request[0].pitchId));
      });

      return new Response(JSON.stringify({
        success: true,
        message: "NDA request approved",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error approving NDA request:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};