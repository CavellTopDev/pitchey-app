import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows, pitches, users } from "../../../src/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
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

      // Get all pitches the user is following
      const followingPitches = await db.select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        shortSynopsis: pitches.shortSynopsis,
        titleImage: pitches.titleImage,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        ndaCount: pitches.ndaCount,
        status: pitches.status,
        createdAt: pitches.createdAt,
        publishedAt: pitches.publishedAt,
        followedAt: follows.followedAt,
        creator: {
          id: users.id,
          username: users.username,
          userType: users.userType,
          companyName: users.companyName,
        },
      })
      .from(follows)
      .innerJoin(pitches, eq(follows.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.followedAt));

      // Format the response
      const formattedPitches = followingPitches.map(pitch => ({
        ...pitch,
        isFollowing: true, // Always true since these are followed pitches
      }));

      return new Response(JSON.stringify({
        success: true,
        pitches: formattedPitches,
        totalFollowing: formattedPitches.length,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching following pitches:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};