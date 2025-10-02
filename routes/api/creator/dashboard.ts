import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches, pitchViews, ndas, follows, users } from "../../../src/db/schema.ts";
import { eq, desc, sql, and } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      // Get auth token
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required",
          metadata: {
            timestamp: new Date().toISOString(),
            details: { code: "AUTH_REQUIRED" }
          }
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify token and get user ID
      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ 
          success: false,
          error: "Invalid token",
          metadata: {
            timestamp: new Date().toISOString(),
            details: { code: "INVALID_TOKEN" }
          }
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify user is a creator
      const user = await db.select().from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || user[0].userType !== "creator") {
        return new Response(JSON.stringify({ 
          success: false,
          error: "Creator access required",
          metadata: {
            timestamp: new Date().toISOString(),
            details: { code: "CREATOR_ACCESS_REQUIRED" }
          }
        }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get creator's pitches
      const creatorPitches = await db.select({
        id: pitches.id,
        title: pitches.title,
        status: pitches.status,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        ndaCount: pitches.ndaCount,
        createdAt: pitches.createdAt,
        publishedAt: pitches.publishedAt,
        thumbnailUrl: pitches.thumbnailUrl,
        genre: pitches.genre,
        format: pitches.format,
      })
      .from(pitches)
      .where(eq(pitches.userId, userId))
      .orderBy(desc(pitches.createdAt))
      .limit(10);

      // Calculate stats
      const totalPitches = creatorPitches.length;
      const publishedPitches = creatorPitches.filter(p => p.status === 'published').length;
      const draftPitches = creatorPitches.filter(p => p.status === 'draft').length;
      
      const totalViews = creatorPitches.reduce((sum, p) => sum + (p.viewCount || 0), 0);
      const totalLikes = creatorPitches.reduce((sum, p) => sum + (p.likeCount || 0), 0);
      const totalNDAs = creatorPitches.reduce((sum, p) => sum + (p.ndaCount || 0), 0);

      // Calculate engagement rate
      const avgEngagementRate = totalViews > 0 
        ? Math.round(((totalLikes + totalNDAs) / totalViews) * 100) 
        : 0;

      // Mock monthly growth (would need historical data for real calculation)
      const monthlyGrowth = 15.5;

      // Mock notifications (would come from a notifications table)
      const notifications = [
        {
          id: 1,
          type: 'pitch_view',
          title: 'New Views',
          message: 'Your pitch "Quantum Paradox" received 25 new views',
          relatedId: creatorPitches[0]?.id || 1,
          relatedType: 'pitch',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          type: 'nda_request',
          title: 'NDA Request',
          message: 'An investor requested access to "The Last Colony"',
          relatedId: creatorPitches[1]?.id || 2,
          relatedType: 'pitch',
          isRead: false,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ];

      // Mock recent activities
      const activities = creatorPitches.slice(0, 5).map((pitch, index) => ({
        id: index + 1,
        type: pitch.status === 'published' ? 'pitch_published' : 'pitch_created',
        description: `${pitch.status === 'published' ? 'Published' : 'Created'} "${pitch.title}"`,
        metadata: { pitchId: pitch.id, genre: pitch.genre },
        createdAt: pitch.createdAt?.toISOString() || new Date().toISOString(),
      }));

      const dashboardData = {
        stats: {
          totalPitches,
          publishedPitches,
          draftPitches,
          totalViews,
          totalLikes,
          totalNDAs,
          avgEngagementRate,
          monthlyGrowth,
        },
        recentPitches: creatorPitches.map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          viewCount: p.viewCount || 0,
          likeCount: p.likeCount || 0,
          ndaCount: p.ndaCount || 0,
          createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
          publishedAt: p.publishedAt?.toISOString() || null,
          thumbnailUrl: p.thumbnailUrl,
          genre: p.genre,
          format: p.format,
        })),
        notifications,
        activities,
      };

      return new Response(JSON.stringify({
        success: true,
        dashboard: dashboardData,
        data: { dashboard: dashboardData }, // Also include in data for backward compatibility
        metadata: {
          timestamp: new Date().toISOString(),
        }
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
      });
    } catch (error) {
      console.error("Error fetching creator dashboard:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Internal server error",
        metadata: {
          timestamp: new Date().toISOString(),
          details: { 
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Unknown error"
          }
        }
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
      });
    }
  },

  // Handle OPTIONS for CORS preflight
  OPTIONS() {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  },
};