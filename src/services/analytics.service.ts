import { db } from "../db/client.ts";
import { 
  analyticsEvents, 
  userSessions, 
  analyticsAggregates,
  pitchViews,
  pitches,
  users,
  ndas,
  messages
} from "../db/schema.ts";
import { eq, and, gte, lte, desc, sql, count } from "npm:drizzle-orm";

export class AnalyticsService {
  static async trackEvent(data: {
    eventType: string;
    userId?: number;
    sessionId?: string;
    pitchId?: number;
    eventData?: any;
    ipAddress?: string;
    userAgent?: string;
    pathname?: string;
  }) {
    try {
      const [event] = await db.insert(analyticsEvents)
        .values({
          eventType: data.eventType as any,
          userId: data.userId,
          sessionId: data.sessionId,
          pitchId: data.pitchId,
          eventData: data.eventData || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          pathname: data.pathname,
          timestamp: new Date()
        })
        .returning();

      return event;
    } catch (error) {
      console.error("Error tracking event:", error);
      return null;
    }
  }

  static async trackPitchView(data: {
    pitchId: number;
    viewerId?: number;
    viewType: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }) {
    try {
      // Create pitch view record
      const [pitchView] = await db.insert(pitchViews)
        .values({
          pitchId: data.pitchId,
          viewerId: data.viewerId,
          viewType: data.viewType,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          sessionId: data.sessionId
        })
        .returning();

      // Increment pitch view count
      await db.update(pitches)
        .set({ 
          viewCount: sql`${pitches.viewCount} + 1` 
        })
        .where(eq(pitches.id, data.pitchId));

      // Track analytics event
      await this.trackEvent({
        eventType: "view",
        userId: data.viewerId,
        pitchId: data.pitchId,
        sessionId: data.sessionId,
        eventData: {
          viewType: data.viewType
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      });

      return pitchView;
    } catch (error) {
      console.error("Error tracking pitch view:", error);
      return null;
    }
  }

  static async getPitchAnalytics(pitchId: number, ownerId: number) {
    try {
      // Verify ownership
      const pitch = await db.query.pitches.findFirst({
        where: and(
          eq(pitches.id, pitchId),
          eq(pitches.userId, ownerId)
        )
      });

      if (!pitch) {
        throw new Error("Pitch not found or access denied");
      }

      // Get view analytics for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const views = await db.query.pitchViews.findMany({
        where: and(
          eq(pitchViews.pitchId, pitchId),
          gte(pitchViews.viewedAt, thirtyDaysAgo)
        ),
        orderBy: desc(pitchViews.viewedAt)
      });

      // Get events for this pitch
      const events = await db.query.analyticsEvents.findMany({
        where: and(
          eq(analyticsEvents.pitchId, pitchId),
          gte(analyticsEvents.timestamp, thirtyDaysAgo)
        ),
        orderBy: desc(analyticsEvents.timestamp)
      });

      // Calculate metrics
      const totalViews = views.length;
      const uniqueViewers = new Set(views.filter(v => v.viewerId).map(v => v.viewerId)).size;
      const anonymousViews = views.filter(v => !v.viewerId).length;

      // Group views by date
      const viewsByDate: Record<string, number> = {};
      views.forEach(view => {
        const date = view.viewedAt.toISOString().split('T')[0];
        viewsByDate[date] = (viewsByDate[date] || 0) + 1;
      });

      // Group views by viewer type
      const viewsByType: Record<string, number> = {};
      views.forEach(view => {
        viewsByType[view.viewType || 'unknown'] = (viewsByType[view.viewType || 'unknown'] || 0) + 1;
      });

      return {
        pitchId,
        totalViews,
        uniqueViewers,
        anonymousViews,
        viewsByDate,
        viewsByType,
        recentViews: views.slice(0, 10),
        events: events.slice(0, 20)
      };
    } catch (error) {
      console.error("Error getting pitch analytics:", error);
      throw error;
    }
  }

  static async getUserAnalytics(userId: number) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get user's pitches
      const userPitches = await db.query.pitches.findMany({
        where: eq(pitches.userId, userId),
        columns: {
          id: true,
          title: true,
          viewCount: true,
          likeCount: true,
          ndaCount: true
        }
      });

      // Get total views across all pitches
      const totalViews = userPitches.reduce((sum, pitch) => sum + (pitch.viewCount || 0), 0);
      const totalLikes = userPitches.reduce((sum, pitch) => sum + (pitch.likeCount || 0), 0);
      const totalNDAs = userPitches.reduce((sum, pitch) => sum + (pitch.ndaCount || 0), 0);

      // Get recent events for user's pitches
      const recentEvents = await db.query.analyticsEvents.findMany({
        where: and(
          eq(analyticsEvents.userId, userId),
          gte(analyticsEvents.timestamp, sevenDaysAgo)
        ),
        orderBy: desc(analyticsEvents.timestamp),
        limit: 50
      });

      // Group events by type
      const eventsByType: Record<string, number> = {};
      recentEvents.forEach(event => {
        eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      });

      // Get recent views on user's pitches
      const recentViewsResult = await db
        .select({
          view: pitchViews,
          pitch: {
            id: pitches.id,
            title: pitches.title,
          },
          viewer: {
            id: users.id,
            username: users.username,
            userType: users.userType,
          },
        })
        .from(pitchViews)
        .leftJoin(pitches, eq(pitchViews.pitchId, pitches.id))
        .leftJoin(users, eq(pitchViews.viewerId, users.id))
        .where(and(
          sql`${pitchViews.pitchId} IN (SELECT id FROM pitches WHERE user_id = ${userId})`,
          gte(pitchViews.viewedAt, sevenDaysAgo)
        ))
        .orderBy(desc(pitchViews.viewedAt))
        .limit(20);

      const recentViews = recentViewsResult.map(row => ({
        ...row.view,
        pitch: row.pitch,
        viewer: row.viewer,
      }));

      return {
        summary: {
          totalPitches: userPitches.length,
          totalViews,
          totalLikes,
          totalNDAs
        },
        pitches: userPitches,
        recentViews,
        eventsByType,
        recentEvents: recentEvents.slice(0, 10)
      };
    } catch (error) {
      console.error("Error getting user analytics:", error);
      throw error;
    }
  }

  static async getDashboardAnalytics(userId: number, userType: string) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let analytics: any = {
        timeframe: "Last 7 days",
        events: []
      };

      if (userType === "creator") {
        // Creator analytics
        const creatorPitches = await db.query.pitches.findMany({
          where: eq(pitches.userId, userId)
        });

        const totalViews = await db
          .select({ count: sql<number>`count(*)` })
          .from(pitchViews)
          .where(and(
            sql`${pitchViews.pitchId} IN (SELECT id FROM pitches WHERE user_id = ${userId})`,
            gte(pitchViews.viewedAt, sevenDaysAgo)
          ));

        analytics = {
          ...analytics,
          pitchCount: creatorPitches.length,
          weeklyViews: totalViews[0]?.count || 0,
          totalViews: creatorPitches.reduce((sum, p) => sum + (p.viewCount || 0), 0)
        };
      } else if (userType === "investor" || userType === "production") {
        // Investor/Production analytics
        const viewedPitches = await db.query.pitchViews.findMany({
          where: and(
            eq(pitchViews.viewerId, userId),
            gte(pitchViews.viewedAt, sevenDaysAgo)
          )
        });

        const signedNDAs = await db.query.ndas.findMany({
          where: eq(ndas.signerId, userId)
        });

        analytics = {
          ...analytics,
          weeklyViews: viewedPitches.length,
          totalNDAs: signedNDAs.length
        };
      }

      return analytics;
    } catch (error) {
      console.error("Error getting dashboard analytics:", error);
      return {
        timeframe: "Last 7 days",
        events: [],
        error: "Failed to load analytics"
      };
    }
  }

  static async createSession(data: {
    sessionId: string;
    userId?: number;
    ipAddress?: string;
    userAgent?: string;
    entryPage?: string;
    referrer?: string;
  }) {
    try {
      const [session] = await db.insert(userSessions)
        .values({
          sessionId: data.sessionId,
          userId: data.userId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          entryPage: data.entryPage,
          referrer: data.referrer,
          startTime: new Date(),
          lastActivity: new Date()
        })
        .returning();

      return session;
    } catch (error) {
      console.error("Error creating session:", error);
      return null;
    }
  }

  static async updateSessionActivity(sessionId: string) {
    try {
      await db.update(userSessions)
        .set({ 
          lastActivity: new Date(),
          isActive: true 
        })
        .where(eq(userSessions.sessionId, sessionId));
    } catch (error) {
      console.error("Error updating session activity:", error);
    }
  }

  static async endSession(sessionId: string) {
    try {
      const session = await db.query.userSessions.findFirst({
        where: eq(userSessions.sessionId, sessionId)
      });

      if (session) {
        const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
        
        await db.update(userSessions)
          .set({
            endTime: new Date(),
            duration,
            isActive: false
          })
          .where(eq(userSessions.sessionId, sessionId));
      }
    } catch (error) {
      console.error("Error ending session:", error);
    }
  }

  // Toggle like/unlike for a pitch
  static async toggleLike(pitchId: number, userId: number) {
    try {
      // Check if user already liked this pitch
      const existingLike = await db.query.analyticsEvents.findFirst({
        where: and(
          eq(analyticsEvents.pitchId, pitchId),
          eq(analyticsEvents.userId, userId),
          eq(analyticsEvents.eventType, "like")
        ),
        orderBy: desc(analyticsEvents.timestamp)
      });

      let isLiked = false;

      if (existingLike) {
        // User has liked before, now unlike
        await this.trackEvent({
          eventType: "unlike",
          userId,
          pitchId,
          eventData: { previousLikeId: existingLike.id }
        });
        
        // Update pitch like count (decrement)
        await db.update(pitches)
          .set({ 
            likeCount: sql`GREATEST(${pitches.likeCount} - 1, 0)` 
          })
          .where(eq(pitches.id, pitchId));
          
        isLiked = false;
      } else {
        // User hasn't liked, now like
        await this.trackEvent({
          eventType: "like",
          userId,
          pitchId,
          eventData: {}
        });
        
        // Update pitch like count (increment)
        await db.update(pitches)
          .set({ 
            likeCount: sql`${pitches.likeCount} + 1` 
          })
          .where(eq(pitches.id, pitchId));
          
        isLiked = true;
      }

      return { success: true, isLiked };
    } catch (error) {
      console.error("Error toggling like:", error);
      return { success: false, error: error.message };
    }
  }

  // Check if user has liked a pitch
  static async hasUserLikedPitch(pitchId: number, userId: number) {
    try {
      const like = await db.query.analyticsEvents.findFirst({
        where: and(
          eq(analyticsEvents.pitchId, pitchId),
          eq(analyticsEvents.userId, userId),
          eq(analyticsEvents.eventType, "like")
        )
      });
      
      return !!like;
    } catch (error) {
      console.error("Error checking like status:", error);
      return false;
    }
  }
}