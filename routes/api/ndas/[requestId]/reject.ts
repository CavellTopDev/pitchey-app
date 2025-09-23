import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { ndaRequests } from "../../../../src/db/schema.ts";
import { eq } from "drizzle-orm";
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
      const body = await req.json();
      const { rejectionReason } = body;
      
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

      // Update request status
      await db.update(ndaRequests)
        .set({
          status: "rejected",
          rejectionReason,
          respondedAt: new Date(),
        })
        .where(eq(ndaRequests.id, requestId));

      return new Response(JSON.stringify({
        success: true,
        message: "NDA request rejected",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error rejecting NDA request:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};