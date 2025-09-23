import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { follows, pitches } from "../../../../src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  // Follow a pitch
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

      // Check if pitch exists
      const pitch = await db.select().from(pitches)
        .where(eq(pitches.id, pitchId))
        .limit(1);

      if (!pitch.length) {
        return new Response(JSON.stringify({ error: "Pitch not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if already following
      const existingFollow = await db.select().from(follows)
        .where(and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, pitchId)
        ))
        .limit(1);

      if (existingFollow.length) {
        return new Response(JSON.stringify({ 
          error: "Already following this pitch" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create follow relationship
      await db.insert(follows).values({
        followerId: userId,
        pitchId: pitchId,
        creatorId: null, // Only following the pitch, not the creator
        followedAt: new Date(),
      });

      return new Response(JSON.stringify({
        success: true,
        message: "Successfully followed pitch",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error following pitch:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Check if following
  async GET(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ isFollowing: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ isFollowing: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const pitchId = parseInt(ctx.params.pitchId);

      const follow = await db.select().from(follows)
        .where(and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, pitchId)
        ))
        .limit(1);

      return new Response(JSON.stringify({
        isFollowing: follow.length > 0,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error checking follow status:", error);
      return new Response(JSON.stringify({ isFollowing: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};