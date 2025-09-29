import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows, pitches, users } from "../../../src/db/schema.ts";
import { eq, desc, isNull, isNotNull, sql, or } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const userId = url.searchParams.get("userId");
      const type = url.searchParams.get("type") || "all"; // all, user, pitch
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      // If no userId provided, get the authenticated user's following
      let targetUserId;
      if (userId) {
        targetUserId = parseInt(userId);
      } else {
        const token = req.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) {
          return new Response(JSON.stringify({ 
            error: "Authentication required when userId not provided" 
          }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        targetUserId = await verifyToken(token);
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "Invalid token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Verify user exists
      const user = await db.select().from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!user.length) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      let following = [];
      let totalCount = 0;

      if (type === "all" || type === "user") {
        // Get followed users (creators)
        const followedUsers = await db.select({
          id: follows.id,
          followerId: follows.followerId,
          followingId: follows.creatorId,
          followType: sql<string>`'user'`.as("followType"),
          createdAt: follows.followedAt,
          following: {
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            userType: users.userType,
            companyName: users.companyName,
            profileImage: users.profileImage,
            bio: users.bio,
            location: users.location,
            createdAt: users.createdAt,
          }
        })
        .from(follows)
        .innerJoin(users, eq(follows.creatorId, users.id))
        .where(eq(follows.followerId, targetUserId))
        .where(isNull(follows.pitchId))
        .orderBy(desc(follows.followedAt))
        .limit(type === "user" ? limit : Math.floor(limit / 2))
        .offset(offset);

        following.push(...followedUsers);
      }

      if (type === "all" || type === "pitch") {
        // Get followed pitches
        const followedPitches = await db.select({
          id: follows.id,
          followerId: follows.followerId,
          followingId: follows.pitchId,
          followType: sql<string>`'pitch'`.as("followType"),
          createdAt: follows.followedAt,
          following: {
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
            genre: pitches.genre,
            format: pitches.format,
            titleImage: pitches.titleImage,
            status: pitches.status,
            userId: pitches.userId,
            viewCount: pitches.viewCount,
            likeCount: pitches.likeCount,
            createdAt: pitches.createdAt,
          }
        })
        .from(follows)
        .innerJoin(pitches, eq(follows.pitchId, pitches.id))
        .where(eq(follows.followerId, targetUserId))
        .where(isNotNull(follows.pitchId))
        .orderBy(desc(follows.followedAt))
        .limit(type === "pitch" ? limit : Math.floor(limit / 2))
        .offset(offset);

        following.push(...followedPitches);
      }

      // Get total count
      const totalResult = await db.select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(follows)
      .where(eq(follows.followerId, targetUserId));

      totalCount = totalResult[0]?.count || 0;

      // Sort combined results by followed date
      following.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return new Response(JSON.stringify({
        success: true,
        following: following,
        total: totalCount,
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