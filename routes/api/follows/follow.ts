import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows, pitches, users } from "../../../src/db/schema.ts";
import { eq, and, sql } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  // Follow a creator or pitch
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

      const { creatorId, pitchId } = await req.json();

      if (!creatorId && !pitchId) {
        return new Response(JSON.stringify({ 
          error: "Either creatorId or pitchId must be provided" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Can't follow yourself
      if (creatorId === userId) {
        return new Response(JSON.stringify({ 
          error: "Cannot follow yourself" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // If pitchId is provided, check if pitch exists and get creator
      let targetCreatorId = creatorId;
      if (pitchId) {
        const pitch = await db.select({
          id: pitches.id,
          userId: pitches.userId
        }).from(pitches)
          .where(eq(pitches.id, pitchId))
          .limit(1);

        if (!pitch.length) {
          return new Response(JSON.stringify({ error: "Pitch not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Can't follow your own pitch
        if (pitch[0].userId === userId) {
          return new Response(JSON.stringify({ 
            error: "Cannot follow your own pitch" 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        targetCreatorId = pitch[0].userId;
      }

      // If creatorId is provided, verify creator exists
      if (creatorId) {
        const creator = await db.select().from(users)
          .where(eq(users.id, creatorId))
          .limit(1);

        if (!creator.length) {
          return new Response(JSON.stringify({ error: "Creator not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Check if already following
      const existingFollow = await db.select().from(follows)
        .where(and(
          eq(follows.followerId, userId),
          pitchId ? eq(follows.pitchId, pitchId) : sql`pitch_id IS NULL`,
          creatorId ? eq(follows.creatorId, creatorId) : eq(follows.creatorId, targetCreatorId)
        ))
        .limit(1);

      if (existingFollow.length) {
        const followType = pitchId ? "pitch" : "creator";
        return new Response(JSON.stringify({ 
          error: `Already following this ${followType}` 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create follow relationship
      await db.insert(follows).values({
        followerId: userId,
        pitchId: pitchId || null,
        creatorId: creatorId || targetCreatorId,
        followedAt: new Date(),
      });

      // Update follower count for the target creator
      await db.update(users)
        .set({ 
          updatedAt: new Date(),
          // We'll add followerCount field later via migration if needed
        })
        .where(eq(users.id, creatorId || targetCreatorId));

      return new Response(JSON.stringify({
        success: true,
        message: `Successfully followed ${pitchId ? "pitch" : "creator"}`,
        followType: pitchId ? "pitch" : "creator",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error following:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Unfollow a creator or pitch
  async DELETE(req) {
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

      // Build the where condition
      let whereCondition;
      if (pitchId) {
        whereCondition = and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, parseInt(pitchId))
        );
      } else {
        whereCondition = and(
          eq(follows.followerId, userId),
          eq(follows.creatorId, parseInt(creatorId)),
          sql`pitch_id IS NULL`
        );
      }

      // Delete follow relationship
      const deleteResult = await db.delete(follows)
        .where(whereCondition);

      return new Response(JSON.stringify({
        success: true,
        message: `Successfully unfollowed ${pitchId ? "pitch" : "creator"}`,
        followType: pitchId ? "pitch" : "creator",
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