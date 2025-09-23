import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches, pitchViews, ndas, follows } from "../../../src/db/schema.ts";
import { eq, and, gte, sql, desc } from "drizzle-orm";
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

      // Get date ranges
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Get user's pitches
      const userPitches = await db.select({ id: pitches.id })
        .from(pitches)
        .where(eq(pitches.userId, userId));
      
      const pitchIds = userPitches.map(p => p.id);

      if (pitchIds.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          analytics: {
            totalViews: 0,
            totalLikes: 0,
            totalNDAs: 0,
            totalFollowers: 0,
            viewsChange: 0,
            likesChange: 0,
            ndasChange: 0,
            followersChange: 0,
            topPitch: null,
            recentActivity: [],
            viewsTrend: [],
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get total metrics
      const totalMetrics = await db.select({
        totalViews: sql<number>`COALESCE(SUM(${pitches.viewCount}), 0)`,
        totalLikes: sql<number>`COALESCE(SUM(${pitches.likeCount}), 0)`,
        totalNDAs: sql<number>`COALESCE(SUM(${pitches.ndaCount}), 0)`,
      })
      .from(pitches)
      .where(eq(pitches.userId, userId));

      // Get follower count
      const followerCount = await db.select({
        count: sql<number>`COUNT(*)`,
      })
      .from(follows)
      .where(sql`${follows.pitchId} IN ${pitchIds}`);

      // Get metrics from last 30 days
      const recentViews = await db.select({
        count: sql<number>`COUNT(*)`,
      })
      .from(pitchViews)
      .where(and(
        sql`${pitchViews.pitchId} IN ${pitchIds}`,
        gte(pitchViews.viewedAt, thirtyDaysAgo)
      ));

      // Get metrics from previous 30 days (30-60 days ago)
      const previousViews = await db.select({
        count: sql<number>`COUNT(*)`,
      })
      .from(pitchViews)
      .where(and(
        sql`${pitchViews.pitchId} IN ${pitchIds}`,
        gte(pitchViews.viewedAt, sixtyDaysAgo),
        sql`${pitchViews.viewedAt} < ${thirtyDaysAgo}`
      ));

      // Calculate percentage changes
      const currentViewCount = recentViews[0]?.count || 0;
      const previousViewCount = previousViews[0]?.count || 0;
      const viewsChange = previousViewCount > 0 
        ? ((currentViewCount - previousViewCount) / previousViewCount) * 100 
        : 0;

      // Get recent NDA count
      const recentNDAs = await db.select({
        count: sql<number>`COUNT(*)`,
      })
      .from(ndas)
      .where(and(
        sql`${ndas.pitchId} IN ${pitchIds}`,
        gte(ndas.signedAt, thirtyDaysAgo)
      ));

      const previousNDAs = await db.select({
        count: sql<number>`COUNT(*)`,
      })
      .from(ndas)
      .where(and(
        sql`${ndas.pitchId} IN ${pitchIds}`,
        gte(ndas.signedAt, sixtyDaysAgo),
        sql`${ndas.signedAt} < ${thirtyDaysAgo}`
      ));

      const currentNDACount = recentNDAs[0]?.count || 0;
      const previousNDACount = previousNDAs[0]?.count || 0;
      const ndasChange = previousNDACount > 0 
        ? ((currentNDACount - previousNDACount) / previousNDACount) * 100 
        : 0;

      // Get top performing pitch
      const topPitch = await db.select({
        id: pitches.id,
        title: pitches.title,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        ndaCount: pitches.ndaCount,
      })
      .from(pitches)
      .where(eq(pitches.userId, userId))
      .orderBy(desc(pitches.viewCount))
      .limit(1);

      // Get recent activity (last 10 views)
      const recentActivity = await db.select({
        id: sql<string>`${pitchViews.id}::text`,
        type: sql<string>`'view'`,
        pitchTitle: pitches.title,
        timestamp: pitchViews.viewedAt,
      })
      .from(pitchViews)
      .innerJoin(pitches, eq(pitchViews.pitchId, pitches.id))
      .where(sql`${pitchViews.pitchId} IN ${pitchIds}`)
      .orderBy(desc(pitchViews.viewedAt))
      .limit(10);

      // Format dates for activity
      const formattedActivity = recentActivity.map(a => ({
        ...a,
        timestamp: getRelativeTime(new Date(a.timestamp)),
      }));

      return new Response(JSON.stringify({
        success: true,
        analytics: {
          totalViews: totalMetrics[0]?.totalViews || 0,
          totalLikes: totalMetrics[0]?.totalLikes || 0,
          totalNDAs: totalMetrics[0]?.totalNDAs || 0,
          totalFollowers: followerCount[0]?.count || 0,
          viewsChange: Math.round(viewsChange * 10) / 10,
          likesChange: 0, // Would need like tracking implementation
          ndasChange: Math.round(ndasChange * 10) / 10,
          followersChange: 0, // Would need follower tracking implementation
          topPitch: topPitch[0] || null,
          recentActivity: formattedActivity,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}