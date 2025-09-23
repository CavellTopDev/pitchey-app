import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { follows, pitches, users } from "../../../src/db/schema.ts";
import { eq, desc, isNull, sql, and, or } from "drizzle-orm";
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
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const timeframe = url.searchParams.get("timeframe") || "7d"; // 1d, 7d, 30d, all
      
      // Calculate time filter
      let timeFilter;
      switch (timeframe) {
        case "1d":
          timeFilter = sql`published_at >= NOW() - INTERVAL '1 day'`;
          break;
        case "7d":
          timeFilter = sql`published_at >= NOW() - INTERVAL '7 days'`;
          break;
        case "30d":
          timeFilter = sql`published_at >= NOW() - INTERVAL '30 days'`;
          break;
        default:
          timeFilter = undefined;
      }

      // Get creators that the user follows
      const followedCreators = await db.select({
        creatorId: follows.creatorId,
      })
      .from(follows)
      .where(eq(follows.followerId, userId))
      .where(isNull(follows.pitchId)); // Only direct creator follows

      const followedCreatorIds = followedCreators.map(f => f.creatorId);

      if (followedCreatorIds.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          updates: [],
          pagination: {
            limit,
            offset,
            total: 0,
            hasMore: false,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get recent updates from followed creators
      let updatesQuery = db.select({
        id: pitches.id,
        type: sql<string>`'new_pitch'`.as("type"),
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
        publishedAt: pitches.publishedAt,
        createdAt: pitches.createdAt,
        creator: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          userType: users.userType,
          companyName: users.companyName,
          profileImage: users.profileImage,
        },
        // Calculate how long ago this was published
        timeAgo: sql<string>`
          CASE 
            WHEN published_at >= NOW() - INTERVAL '1 hour' THEN 
              EXTRACT(EPOCH FROM (NOW() - published_at))/60 || ' minutes ago'
            WHEN published_at >= NOW() - INTERVAL '1 day' THEN 
              EXTRACT(EPOCH FROM (NOW() - published_at))/3600 || ' hours ago'
            WHEN published_at >= NOW() - INTERVAL '7 days' THEN 
              EXTRACT(EPOCH FROM (NOW() - published_at))/86400 || ' days ago'
            ELSE 
              TO_CHAR(published_at, 'Mon DD, YYYY')
          END
        `.as("time_ago"),
      })
      .from(pitches)
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(
        sql`user_id = ANY(${followedCreatorIds})`,
        eq(pitches.status, "published")
      ))
      .orderBy(desc(pitches.publishedAt))
      .limit(limit)
      .offset(offset);

      if (timeFilter) {
        updatesQuery = updatesQuery.where(timeFilter);
      }

      const updates = await updatesQuery;

      // Get total count for pagination
      let totalCountQuery = db.select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(pitches)
      .where(and(
        sql`user_id = ANY(${followedCreatorIds})`,
        eq(pitches.status, "published")
      ));

      if (timeFilter) {
        totalCountQuery = totalCountQuery.where(timeFilter);
      }

      const totalCountResult = await totalCountQuery;
      const totalCount = totalCountResult[0]?.count || 0;

      // Get activity summary for the timeframe
      const activitySummary = await db.select({
        newPitches: sql<number>`COUNT(*)::int`.as("new_pitches"),
        activeCreators: sql<number>`COUNT(DISTINCT user_id)::int`.as("active_creators"),
      })
      .from(pitches)
      .where(and(
        sql`user_id = ANY(${followedCreatorIds})`,
        eq(pitches.status, "published"),
        timeFilter || sql`published_at >= NOW() - INTERVAL '7 days'`
      ));

      // Get trending genres from followed creators
      const trendingGenres = await db.select({
        genre: pitches.genre,
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(pitches)
      .where(and(
        sql`user_id = ANY(${followedCreatorIds})`,
        eq(pitches.status, "published"),
        sql`published_at >= NOW() - INTERVAL '30 days'`
      ))
      .groupBy(pitches.genre)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);

      // Check if there are any unread updates
      const unreadCount = await db.select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(pitches)
      .where(and(
        sql`user_id = ANY(${followedCreatorIds})`,
        eq(pitches.status, "published"),
        sql`published_at >= NOW() - INTERVAL '7 days'`
      ));

      return new Response(JSON.stringify({
        success: true,
        updates,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: (offset + limit) < totalCount,
        },
        activitySummary: activitySummary[0] || { newPitches: 0, activeCreators: 0 },
        trendingGenres,
        unreadCount: unreadCount[0]?.count || 0,
        timeframe,
        followingCount: followedCreatorIds.length,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching updates:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};