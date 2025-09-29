import { db } from "../db/client-optimized.ts";
import { pitchViews, users, pitches } from "../db/schema.ts";
import { and, eq, desc, gte, sql, count } from "drizzle-orm";

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
      // Record the view using raw SQL
      await db.execute(sql`
        INSERT INTO pitch_views (pitch_id, user_id, view_type, ip_address, user_agent, referrer, session_id, created_at)
        VALUES (${pitchId}, ${viewerId}, ${viewType}, ${ipAddress}, ${userAgent}, ${referrer}, ${sessionId}, NOW())
      `);

      // Increment view count on the pitch
      await db.execute(sql`
        UPDATE pitches 
        SET view_count = COALESCE(view_count, 0) + 1,
            updated_at = NOW()
        WHERE id = ${pitchId}
      `);

      return { success: true };
    } catch (error) {
      console.error("Error tracking view:", error);
      return { success: false, error };
    }
  }

  static async getViewDemographics(pitchId: number) {
    try {
      // Get all views with user types using raw SQL due to column mapping issues
      const result = await db.execute(sql`
        SELECT u.user_type, COUNT(*) as view_count
        FROM pitch_views pv
        LEFT JOIN users u ON pv.user_id = u.id
        WHERE pv.pitch_id = ${pitchId}
        GROUP BY u.user_type
      `);
      
      const viewsWithUsers = result.rows || [];
      
      // Calculate demographics
      const totalViews = viewsWithUsers.reduce((sum, row: any) => sum + Number(row.view_count), 0);
      
      const demographics = {
        investors: 0,
        productions: 0,
        creators: 0,
        anonymous: 0
      };

      viewsWithUsers.forEach((row: any) => {
        const count = Number(row.view_count);
        if (row.user_type === 'investor') {
          demographics.investors = count;
        } else if (row.user_type === 'production') {
          demographics.productions = count;
        } else if (row.user_type === 'creator') {
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

      const result = await db.execute(sql`
        SELECT DATE(created_at) as date, COUNT(*) as views
        FROM pitch_views
        WHERE pitch_id = ${pitchId}
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `);

      return (result.rows || []).map((row: any) => ({
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
      const result = await db.execute(sql`
        SELECT COUNT(DISTINCT COALESCE(user_id::text, ip_address)) as unique_views
        FROM pitch_views
        WHERE pitch_id = ${pitchId}
      `);

      return result.rows?.[0]?.unique_views || 0;
    } catch (error) {
      console.error("Error getting unique view count:", error);
      return 0;
    }
  }
}