import { db } from '../db/client.ts';
import { pitches, pitchViews, users } from '../db/schema.ts';
import { eq, sql, count, desc, gte, and } from 'npm:drizzle-orm@0.35.3';

// Simple view tracking service using Drizzle ORM
export class ViewTrackingServiceSimple {

  static async trackView(
    pitchId: number,
    viewerId: number | null,
    userType: string | null,
    viewType: string = 'full'
  ) {
    try {
      // First check if the viewer is the pitch owner
      if (viewerId) {
        const pitch = await db.select({ userId: pitches.userId })
          .from(pitches)
          .where(eq(pitches.id, pitchId))
          .limit(1);
        
        if (pitch.length > 0 && pitch[0].userId === viewerId) {
          console.log(`Skipping view tracking: User ${viewerId} is viewing their own pitch ${pitchId}`);
          return { success: true, message: "Own pitch view not tracked" };
        }
      }

      // Insert view record
      await db.insert(pitchViews).values({
        pitchId: pitchId,
        userId: viewerId,
        viewType: viewType,
        createdAt: new Date()
      });

      // Update pitch view count
      await db.update(pitches)
        .set({ viewCount: sql`COALESCE(${pitches.viewCount}, 0) + 1` })
        .where(eq(pitches.id, pitchId));

      return { success: true, message: "View tracked successfully" };
    } catch (error) {
      console.error("Error tracking view:", error);
      return { success: false, error };
    }
  }

  static async getViewDemographics(pitchId: number) {
    try {
      // Get view counts by user type using Drizzle
      const results = await db
        .select({
          userType: users.userType,
          viewCount: sql<number>`cast(count(${pitchViews.id}) as int)`
        })
        .from(pitchViews)
        .leftJoin(users, eq(pitchViews.userId, users.id))
        .where(eq(pitchViews.pitchId, pitchId))
        .groupBy(users.userType);

      // Calculate totals and percentages
      let totalViews = 0;
      const demographics = {
        investors: 0,
        productions: 0,
        creators: 0
      };

      for (const row of results) {
        const count = row.viewCount;
        totalViews += count;
        
        if (row.userType === 'investor') {
          demographics.investors = count;
        } else if (row.userType === 'production') {
          demographics.productions = count;
        } else if (row.userType === 'creator') {
          demographics.creators = count;
        }
      }

      // Convert to percentages
      if (totalViews > 0) {
        demographics.investors = Math.round((demographics.investors / totalViews) * 100);
        demographics.productions = Math.round((demographics.productions / totalViews) * 100);
        demographics.creators = Math.round((demographics.creators / totalViews) * 100);
      }

      return {
        totalViews,
        demographics
      };
    } catch (error) {
      console.error("Error getting demographics:", error);
      return {
        totalViews: 0,
        demographics: { investors: 0, productions: 0, creators: 0 }
      };
    }
  }

  static async getViewsByDate(pitchId: number, days: number = 30) {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      
      const results = await db
        .select({
          date: sql<string>`DATE(${pitchViews.createdAt})`,
          views: sql<number>`cast(count(${pitchViews.id}) as int)`
        })
        .from(pitchViews)
        .where(
          and(
            eq(pitchViews.pitchId, pitchId),
            gte(pitchViews.createdAt, dateThreshold)
          )
        )
        .groupBy(sql`DATE(${pitchViews.createdAt})`)
        .orderBy(sql`DATE(${pitchViews.createdAt})`);

      return results.map(row => ({
        date: row.date,
        views: row.views
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
          uniqueViews: sql<number>`cast(COUNT(DISTINCT ${pitchViews.userId}) as int)`
        })
        .from(pitchViews)
        .where(eq(pitchViews.pitchId, pitchId));

      return result[0]?.uniqueViews || 0;
    } catch (error) {
      console.error("Error getting unique views:", error);
      return 0;
    }
  }
}