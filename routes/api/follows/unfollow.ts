import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows } from "../../../src/db/schema.ts";
import { eq, and, isNull } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  // Unfollow a creator or pitch
  async POST(req) {
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

      const { followingId, followType } = await req.json();

      if (!followingId || !followType) {
        return new Response(JSON.stringify({ 
          error: "followingId and followType are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!["user", "pitch"].includes(followType)) {
        return new Response(JSON.stringify({ 
          error: "followType must be 'user' or 'pitch'" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Build the where condition based on follow type
      let whereCondition;
      if (followType === "pitch") {
        whereCondition = and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, followingId)
        );
      } else {
        // followType === "user" - unfollow creator directly
        whereCondition = and(
          eq(follows.followerId, userId),
          eq(follows.creatorId, followingId),
          isNull(follows.pitchId)
        );
      }

      // Delete follow relationship
      const deleteResult = await db.delete(follows)
        .where(whereCondition);

      return new Response(JSON.stringify({
        success: true,
        message: `Successfully unfollowed ${followType}`,
        followType,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error unfollowing:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};