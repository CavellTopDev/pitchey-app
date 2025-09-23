import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { follows } from "../../../../src/db/schema.ts";
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

      const pitchId = parseInt(ctx.params.pitchId);

      // Delete follow relationship
      const result = await db.delete(follows)
        .where(and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, pitchId)
        ));

      return new Response(JSON.stringify({
        success: true,
        message: "Successfully unfollowed pitch",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error unfollowing pitch:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};