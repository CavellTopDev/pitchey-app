import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows, users } from "../../../src/db/schema.ts";
import { eq, desc, isNull, sql } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const creatorId = url.searchParams.get("creatorId");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      
      if (!creatorId) {
        return new Response(JSON.stringify({ 
          error: "creatorId parameter is required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify creator exists
      const creator = await db.select().from(users)
        .where(eq(users.id, parseInt(creatorId)))
        .limit(1);

      if (!creator.length) {
        return new Response(JSON.stringify({ error: "Creator not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get followers (users who follow this creator directly, not just their pitches)
      const followers = await db.select({
        id: users.id,
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
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.creatorId, parseInt(creatorId)))
      .where(isNull(follows.pitchId)) // Only direct creator follows, not pitch follows
      .orderBy(desc(follows.followedAt))
      .limit(limit)
      .offset(offset);

      // Get total follower count
      const totalFollowersResult = await db.select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(follows)
      .where(eq(follows.creatorId, parseInt(creatorId)))
      .where(isNull(follows.pitchId));

      const totalFollowers = totalFollowersResult[0]?.count || 0;

      // Check if the requesting user is following this creator (if authenticated)
      let isFollowing = false;
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (token) {
        const userId = await verifyToken(token);
        if (userId) {
          const followCheck = await db.select()
            .from(follows)
            .where(eq(follows.followerId, userId))
            .where(eq(follows.creatorId, parseInt(creatorId)))
            .where(isNull(follows.pitchId))
            .limit(1);
          
          isFollowing = followCheck.length > 0;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        creator: {
          id: creator[0].id,
          username: creator[0].username,
          firstName: creator[0].firstName,
          lastName: creator[0].lastName,
          userType: creator[0].userType,
          companyName: creator[0].companyName,
          profileImage: creator[0].profileImage,
          bio: creator[0].bio,
          location: creator[0].location,
        },
        followers,
        pagination: {
          limit,
          offset,
          total: totalFollowers,
          hasMore: (offset + limit) < totalFollowers,
        },
        isFollowing,
        followerCount: totalFollowers,
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