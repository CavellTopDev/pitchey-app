import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows } from "../../../src/db/schema.ts";
import { eq, and, isNull } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const creatorId = url.searchParams.get("creatorId");
      const pitchId = url.searchParams.get("pitchId");

      if (!creatorId && !pitchId) {
        return new Response(JSON.stringify({ 
          error: "Either creatorId or pitchId must be provided" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if user is authenticated
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ 
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
          isFollowing: false,
          isAuthenticated: false 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Build the where condition based on what we're checking
      let whereCondition;
      if (pitchId) {
        // Check if following a specific pitch
        whereCondition = and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, parseInt(pitchId))
        );
      } else {
        // Check if following a creator directly (not through their pitches)
        whereCondition = and(
          eq(follows.followerId, userId),
          eq(follows.creatorId, parseInt(creatorId)),
          isNull(follows.pitchId)
        );
      }

      const follow = await db.select().from(follows)
        .where(whereCondition)
        .limit(1);

      const isFollowing = follow.length > 0;

      // If checking a creator, also check if following any of their pitches
      let followingPitchCount = 0;
      if (creatorId && !pitchId) {
        const pitchFollows = await db.select()
          .from(follows)
          .where(and(
            eq(follows.followerId, userId),
            eq(follows.creatorId, parseInt(creatorId))
          ));
        
        followingPitchCount = pitchFollows.length;
      }

      return new Response(JSON.stringify({
        isFollowing,
        isAuthenticated: true,
        followType: pitchId ? "pitch" : "creator",
        ...(creatorId && !pitchId && { followingPitchCount }),
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