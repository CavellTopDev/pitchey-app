import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows, pitches, users } from "../../../src/db/schema.ts";
import { eq, and, isNull } from "drizzle-orm";
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

      // Can't follow yourself
      if (followType === "user" && followingId === userId) {
        return new Response(JSON.stringify({ 
          error: "Cannot follow yourself" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify the target exists
      if (followType === "pitch") {
        const pitch = await db.select({
          id: pitches.id,
          userId: pitches.userId
        }).from(pitches)
          .where(eq(pitches.id, followingId))
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
      } else {
        // followType === "user" - verify user exists
        const user = await db.select().from(users)
          .where(eq(users.id, followingId))
          .limit(1);

        if (!user.length) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Check if already following
      let existingFollowCondition;
      if (followType === "pitch") {
        existingFollowCondition = and(
          eq(follows.followerId, userId),
          eq(follows.pitchId, followingId)
        );
      } else {
        existingFollowCondition = and(
          eq(follows.followerId, userId),
          eq(follows.creatorId, followingId),
          isNull(follows.pitchId)
        );
      }

      const existingFollow = await db.select().from(follows)
        .where(existingFollowCondition)
        .limit(1);

      if (existingFollow.length) {
        return new Response(JSON.stringify({ 
          error: `Already following this ${followType}` 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create follow relationship
      const insertData: any = {
        followerId: userId,
        followedAt: new Date(),
      };

      if (followType === "pitch") {
        insertData.pitchId = followingId;
        insertData.creatorId = null;
      } else {
        insertData.creatorId = followingId;
        insertData.pitchId = null;
      }

      await db.insert(follows).values(insertData);

      return new Response(JSON.stringify({
        success: true,
        message: `Successfully followed ${followType}`,
        followType,
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
};