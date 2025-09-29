import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows } from "../../../src/db/schema.ts";
import { eq, and, isNull } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const targetId = url.searchParams.get("targetId");
      const type = url.searchParams.get("type");

      if (!targetId || !type) {
        return new Response(JSON.stringify({ 
          error: "targetId and type are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!["user", "pitch"].includes(type)) {
        return new Response(JSON.stringify({ 
          error: "type must be 'user' or 'pitch'" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if user is authenticated
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ 
          success: true,
          isFollowing: false,
          isAuthenticated: false 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ 
          success: true,
          isFollowing: false,
          isAuthenticated: false 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Build the where condition based on what we're checking
      let whereCondition;
      if (type === "pitch") {
        // Check if following a specific pitch
        whereCondition = and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, parseInt(targetId))
        );
      } else {
        // Check if following a creator directly (not through their pitches)
        whereCondition = and(
          eq(follows.followerId, userId),
          eq(follows.creatorId, parseInt(targetId)),
          isNull(follows.pitchId)
        );
      }

      const follow = await db.select().from(follows)
        .where(whereCondition)
        .limit(1);

      const isFollowing = follow.length > 0;

      return new Response(JSON.stringify({
        success: true,
        isFollowing,
        isAuthenticated: true,
        followType: type,
        followedAt: isFollowing ? follow[0].followedAt : null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error checking follow status:", error);
      return new Response(JSON.stringify({ 
        isFollowing: false,
        isAuthenticated: false,
        error: "Internal server error" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};