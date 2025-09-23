import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows, pitches, users } from "../../../src/db/schema.ts";
import { eq, desc, isNull, isNotNull, sql } from "drizzle-orm";
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

      const url = new URL(req.url);
      const type = url.searchParams.get("type") || "all"; // all, creators, pitches
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      // Get followed creators (where pitchId is null)
      let followedCreators = [];
      if (type === "all" || type === "creators") {
        followedCreators = await db.select({
          id: users.id,
          type: sql<string>`'creator'`.as("type"),
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          userType: users.userType,
          companyName: users.companyName,
          profileImage: users.profileImage,
          bio: users.bio,
          location: users.location,
          followedAt: follows.followedAt,
          createdAt: users.createdAt,
          // Count their pitches
          pitchCount: sql<number>`(
            SELECT COUNT(*)::int 
            FROM pitches p 
            WHERE p.user_id = ${users.id} 
            AND p.status = 'published'
          )`.as("pitch_count"),
        })
        .from(follows)
        .innerJoin(users, eq(follows.creatorId, users.id))
        .where(eq(follows.followerId, userId))
        .where(isNull(follows.pitchId))
        .orderBy(desc(follows.followedAt))
        .limit(limit)
        .offset(offset);
      }

      // Get followed pitches (where pitchId is not null)
      let followedPitches = [];
      if (type === "all" || type === "pitches") {
        followedPitches = await db.select({
          id: pitches.id,
          type: sql<string>`'pitch'`.as("type"),
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
            profileImage: users.profileImage,
          },
        })
        .from(follows)
        .innerJoin(pitches, eq(follows.pitchId, pitches.id))
        .innerJoin(users, eq(pitches.userId, users.id))
        .where(eq(follows.followerId, userId))
        .where(isNotNull(follows.pitchId))
        .orderBy(desc(follows.followedAt))
        .limit(limit)
        .offset(offset);
      }

      // Get total counts for pagination
      const totalCounts = await db.select({
        totalCreators: sql<number>`COUNT(CASE WHEN pitch_id IS NULL THEN 1 END)::int`.as("total_creators"),
        totalPitches: sql<number>`COUNT(CASE WHEN pitch_id IS NOT NULL THEN 1 END)::int`.as("total_pitches"),
        totalAll: sql<number>`COUNT(*)::int`.as("total_all"),
      })
      .from(follows)
      .where(eq(follows.followerId, userId));

      const counts = totalCounts[0] || { totalCreators: 0, totalPitches: 0, totalAll: 0 };

      // Combine and sort by followedAt if type is "all"
      let combinedResults = [];
      if (type === "all") {
        combinedResults = [...followedCreators, ...followedPitches]
          .sort((a, b) => new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime())
          .slice(0, limit);
      } else if (type === "creators") {
        combinedResults = followedCreators;
      } else if (type === "pitches") {
        combinedResults = followedPitches;
      }

      return new Response(JSON.stringify({
        success: true,
        following: combinedResults,
        pagination: {
          limit,
          offset,
          totalCreators: counts.totalCreators,
          totalPitches: counts.totalPitches,
          totalAll: counts.totalAll,
          hasMore: type === "all" 
            ? (offset + limit) < counts.totalAll
            : type === "creators" 
              ? (offset + limit) < counts.totalCreators
              : (offset + limit) < counts.totalPitches,
        },
        counts: {
          creators: counts.totalCreators,
          pitches: counts.totalPitches,
          total: counts.totalAll,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching following:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};