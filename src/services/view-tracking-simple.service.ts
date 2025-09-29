import postgres from "npm:postgres";

// Simple view tracking service using direct SQL queries
export class ViewTrackingServiceSimple {
  private static getConnection() {
    const connectionString = Deno.env.get("DATABASE_URL") || 
      "postgresql://postgres:password@localhost:5432/pitchey";
    return postgres(connectionString, { 
      max: 1,  // Single connection for simplicity
      idle_timeout: 0,
      connect_timeout: 5 
    });
  }

  static async trackView(
    pitchId: number,
    viewerId: number | null,
    userType: string | null,
    viewType: string = 'full'
  ) {
    const sql = this.getConnection();
    try {
      // First check if the viewer is the pitch owner
      if (viewerId) {
        const ownerCheck = await sql`
          SELECT user_id FROM pitches WHERE id = ${pitchId}
        `;
        
        if (ownerCheck.length > 0 && ownerCheck[0].user_id === viewerId) {
          console.log(`Skipping view tracking: User ${viewerId} is viewing their own pitch ${pitchId}`);
          return { success: true, message: "Own pitch view not tracked" };
        }
      }

      // Insert view record
      await sql`
        INSERT INTO pitch_views (pitch_id, user_id, view_type, created_at)
        VALUES (${pitchId}, ${viewerId}, ${viewType}, NOW())
      `;

      // Update pitch view count
      await sql`
        UPDATE pitches 
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE id = ${pitchId}
      `;

      return { success: true, message: "View tracked successfully" };
    } catch (error) {
      console.error("Error tracking view:", error);
      return { success: false, error };
    } finally {
      await sql.end();
    }
  }

  static async getViewDemographics(pitchId: number) {
    const sql = this.getConnection();
    try {
      // Get view counts by user type
      const results = await sql`
        SELECT 
          u.user_type,
          COUNT(*) as view_count
        FROM pitch_views pv
        LEFT JOIN users u ON pv.user_id = u.id
        WHERE pv.pitch_id = ${pitchId}
        GROUP BY u.user_type
      `;

      // Calculate totals and percentages
      let totalViews = 0;
      const demographics = {
        investors: 0,
        productions: 0,
        creators: 0
      };

      for (const row of results) {
        const count = parseInt(row.view_count);
        totalViews += count;
        
        if (row.user_type === 'investor') {
          demographics.investors = count;
        } else if (row.user_type === 'production') {
          demographics.productions = count;
        } else if (row.user_type === 'creator') {
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
    } finally {
      await sql.end();
    }
  }

  static async getViewsByDate(pitchId: number, days: number = 30) {
    const sql = this.getConnection();
    try {
      const results = await sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as views
        FROM pitch_views
        WHERE pitch_id = ${pitchId}
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;

      return results.map(row => ({
        date: row.date,
        views: parseInt(row.views)
      }));
    } catch (error) {
      console.error("Error getting views by date:", error);
      return [];
    } finally {
      await sql.end();
    }
  }

  static async getUniqueViewCount(pitchId: number) {
    const sql = this.getConnection();
    try {
      const result = await sql`
        SELECT COUNT(DISTINCT COALESCE(user_id::text, ip_address)) as unique_views
        FROM pitch_views
        WHERE pitch_id = ${pitchId}
      `;

      return parseInt(result[0]?.unique_views || '0');
    } catch (error) {
      console.error("Error getting unique views:", error);
      return 0;
    } finally {
      await sql.end();
    }
  }
}