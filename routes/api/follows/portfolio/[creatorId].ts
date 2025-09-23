import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { pitches, users, follows } from "../../../../src/db/schema.ts";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req, ctx) {
    try {
      const creatorId = parseInt(ctx.params.creatorId);
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const status = url.searchParams.get("status") || "published"; // published, draft, all

      // Verify creator exists
      const creator = await db.select({
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
      })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

      if (!creator.length) {
        return new Response(JSON.stringify({ error: "Creator not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get authentication status
      let viewerId = null;
      let isOwner = false;
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (token) {
        viewerId = await verifyToken(token);
        isOwner = viewerId === creatorId;
      }

      // Build status filter
      let statusFilter;
      if (status === "all" && isOwner) {
        // Only owner can see all statuses
        statusFilter = undefined;
      } else if (status === "draft" && isOwner) {
        // Only owner can see drafts
        statusFilter = eq(pitches.status, "draft");
      } else {
        // Public can only see published
        statusFilter = eq(pitches.status, "published");
      }

      // Get creator's pitches
      const creatorPitchesQuery = db.select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        shortSynopsis: pitches.shortSynopsis,
        longSynopsis: pitches.longSynopsis,
        characters: pitches.characters,
        themes: pitches.themes,
        budgetBracket: pitches.budgetBracket,
        titleImage: pitches.titleImage,
        lookbookUrl: pitches.lookbookUrl,
        pitchDeckUrl: pitches.pitchDeckUrl,
        trailerUrl: pitches.trailerUrl,
        additionalMedia: pitches.additionalMedia,
        visibilitySettings: pitches.visibilitySettings,
        status: pitches.status,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        ndaCount: pitches.ndaCount,
        createdAt: pitches.createdAt,
        publishedAt: pitches.publishedAt,
        updatedAt: pitches.updatedAt,
      })
      .from(pitches)
      .where(eq(pitches.userId, creatorId))
      .orderBy(desc(pitches.publishedAt), desc(pitches.createdAt))
      .limit(limit)
      .offset(offset);

      if (statusFilter) {
        creatorPitchesQuery.where(statusFilter);
      }

      const creatorPitches = await creatorPitchesQuery;

      // Get total counts
      const statsQuery = db.select({
        totalPitches: sql<number>`COUNT(CASE WHEN status = 'published' THEN 1 END)::int`.as("total_published"),
        totalDrafts: sql<number>`COUNT(CASE WHEN status = 'draft' THEN 1 END)::int`.as("total_drafts"),
        totalViews: sql<number>`COALESCE(SUM(view_count), 0)::int`.as("total_views"),
        totalLikes: sql<number>`COALESCE(SUM(like_count), 0)::int`.as("total_likes"),
        totalNdas: sql<number>`COALESCE(SUM(nda_count), 0)::int`.as("total_ndas"),
      })
      .from(pitches)
      .where(eq(pitches.userId, creatorId));

      const stats = await statsQuery;

      // Get follower count
      const followerCountResult = await db.select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(follows)
      .where(eq(follows.creatorId, creatorId))
      .where(isNull(follows.pitchId));

      const followerCount = followerCountResult[0]?.count || 0;

      // Get following count (how many creators this creator follows)
      const followingCountResult = await db.select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(follows)
      .where(eq(follows.followerId, creatorId))
      .where(isNull(follows.pitchId));

      const followingCount = followingCountResult[0]?.count || 0;

      // Check if viewer is following this creator
      let isFollowing = false;
      if (viewerId && viewerId !== creatorId) {
        const followCheck = await db.select()
          .from(follows)
          .where(and(
            eq(follows.followerId, viewerId),
            eq(follows.creatorId, creatorId),
            isNull(follows.pitchId)
          ))
          .limit(1);
        
        isFollowing = followCheck.length > 0;
      }

      // Calculate total count for pagination
      const totalCountQuery = db.select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(pitches)
      .where(eq(pitches.userId, creatorId));

      if (statusFilter) {
        totalCountQuery.where(statusFilter);
      }

      const totalCountResult = await totalCountQuery;
      const totalCount = totalCountResult[0]?.count || 0;

      // Genre distribution
      const genreStats = await db.select({
        genre: pitches.genre,
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(pitches)
      .where(eq(pitches.userId, creatorId))
      .where(eq(pitches.status, "published"))
      .groupBy(pitches.genre)
      .orderBy(desc(sql`COUNT(*)`));

      // Recent activity (last 30 days)
      const recentActivity = await db.select({
        date: sql<string>`DATE(created_at)`.as("date"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(pitches)
      .where(eq(pitches.userId, creatorId))
      .where(sql`created_at >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at) DESC`);

      return new Response(JSON.stringify({
        success: true,
        creator: creator[0],
        pitches: creatorPitches,
        stats: stats[0],
        socialStats: {
          followers: followerCount,
          following: followingCount,
        },
        isFollowing,
        isOwner,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: (offset + limit) < totalCount,
        },
        insights: {
          genreDistribution: genreStats,
          recentActivity,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching creator portfolio:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};