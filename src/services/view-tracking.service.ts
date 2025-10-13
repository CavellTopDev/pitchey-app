import { db } from "../db/client.ts";
import { pitchViews, users, pitches } from "../db/schema.ts";
import { and, eq, desc, gte, sql, count } from "npm:drizzle-orm";

export class ViewTrackingService {
  static async trackView(
    pitchId: number,
    viewerId: number | null,
    userType: string | null,
    viewType: string = 'full',
    ipAddress?: string,
    userAgent?: string,
    referrer?: string,
    sessionId?: string
  ) {
    try {
      // Record the view using Drizzle ORM
      await db.insert(pitchViews).values({
        pitchId: pitchId,
        userId: viewerId,
        viewType: viewType,
        ipAddress: ipAddress,
        userAgent: userAgent,
        referrer: referrer,
        sessionId: sessionId,
        createdAt: new Date()
      });

      // Increment view count on the pitch
      await db.update(pitches)
        .set({ 
          viewCount: sql`COALESCE(${pitches.viewCount}, 0) + 1`,
          updatedAt: new Date()
        })
        .where(eq(pitches.id, pitchId));

      return { success: true };
    } catch (error) {
      console.error("Error tracking view:", error);
      return { success: false, error };
    }
  }

  static async getViewDemographics(pitchId: number) {
    try {
      // Get all views with user types using Drizzle ORM
      const viewsWithUsers = await db
        .select({
          userType: users.userType,
          viewCount: count(pitchViews.id).as('view_count')
        })
        .from(pitchViews)
        .leftJoin(users, eq(pitchViews.userId, users.id))
        .where(eq(pitchViews.pitchId, pitchId))
        .groupBy(users.userType);
      
      // Calculate demographics
      const totalViews = viewsWithUsers.reduce((sum, row) => sum + Number(row.viewCount), 0);
      
      const demographics = {
        investors: 0,
        productions: 0,
        creators: 0,
        anonymous: 0
      };

      viewsWithUsers.forEach((row) => {
        const count = Number(row.viewCount);
        if (row.userType === 'investor') {
          demographics.investors = count;
        } else if (row.userType === 'production') {
          demographics.productions = count;
        } else if (row.userType === 'creator') {
          demographics.creators = count;
        } else {
          demographics.anonymous = count;
        }
      });

      // Convert to percentages
      const demographicsPercentages = {
        investors: totalViews > 0 ? Math.round((demographics.investors / totalViews) * 100) : 0,
        productions: totalViews > 0 ? Math.round((demographics.productions / totalViews) * 100) : 0,
        creators: totalViews > 0 ? Math.round((demographics.creators / totalViews) * 100) : 0
      };

      return {
        totalViews,
        demographics: demographicsPercentages,
        rawCounts: demographics
      };
    } catch (error) {
      console.error("Error getting view demographics:", error);
      return {
        totalViews: 0,
        demographics: {
          investors: 0,
          productions: 0,
          creators: 0
        },
        rawCounts: {
          investors: 0,
          productions: 0,
          creators: 0,
          anonymous: 0
        }
      };
    }
  }

  static async getViewsByDate(pitchId: number, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = await db
        .select({
          date: sql`DATE(${pitchViews.createdAt})`.as('date'),
          views: count(pitchViews.id).as('views')
        })
        .from(pitchViews)
        .where(
          and(
            eq(pitchViews.pitchId, pitchId),
            gte(pitchViews.createdAt, startDate.toISOString())
          )
        )
        .groupBy(sql`DATE(${pitchViews.createdAt})`)
        .orderBy(sql`DATE(${pitchViews.createdAt})`);

      return results.map((row) => ({
        date: row.date,
        views: Number(row.views)
      }));
    } catch (error) {
      console.error("Error getting views by date:", error);
      return [];
    }
  }

  static async getUniqueViewCount(pitchId: number) {
    try {
      const result = await db
        .select({
          uniqueViews: sql`COUNT(DISTINCT COALESCE(${pitchViews.userId}::text, ${pitchViews.ipAddress}))`.as('unique_views')
        })
        .from(pitchViews)
        .where(eq(pitchViews.pitchId, pitchId));

      return Number(result[0]?.uniqueViews) || 0;
    } catch (error) {
      console.error("Error getting unique view count:", error);
      return 0;
    }
  }
}