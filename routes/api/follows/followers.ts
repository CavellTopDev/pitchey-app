import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows, users } from "../../../src/db/schema.ts";
import { eq, desc, isNull, sql } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const userId = url.searchParams.get("userId");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      
      // If no userId provided, get the authenticated user's followers
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

      // Get followers (users who follow this user directly, not just their pitches)
      const followersData = await db.select({
        id: follows.id,
        followerId: follows.followerId,
        creatorId: follows.creatorId,
        pitchId: follows.pitchId,
        followedAt: follows.followedAt,
        follower: {
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
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.creatorId, targetUserId))
      .where(isNull(follows.pitchId)) // Only direct creator follows, not pitch follows
      .orderBy(desc(follows.followedAt))
      .limit(limit)
      .offset(offset);

      // Get total follower count
      const totalFollowersResult = await db.select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(follows)
      .where(eq(follows.creatorId, targetUserId))
      .where(isNull(follows.pitchId));

      const totalFollowers = totalFollowersResult[0]?.count || 0;

      return new Response(JSON.stringify({
        success: true,
        followers: followersData,
        total: totalFollowers,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching followers:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};