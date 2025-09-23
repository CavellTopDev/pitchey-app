import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { 
  analyticsEvents,
  userSessions,
  pitches,
  users,
  realtimeAnalytics
} from "../../../src/db/schema.ts";
import { eq, and, sql, desc, gte, count } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface RealtimeMetrics {
  activeUsers: number;
  currentViews: number;
  trendingPitches: Array<{
    pitchId: number;
    title: string;
    viewsLast15Min: number;
    viewsLast1Hour: number;
    momentum: number;
  }>;
  geographicDistribution: Array<{
    country: string;
    users: number;
    percentage: number;
  }>;
  trafficSources: Array<{
    source: string;
    sessions: number;
    percentage: number;
  }>;
  deviceBreakdown: Array<{
    deviceType: string;
    users: number;
    percentage: number;
  }>;
  liveEvents: Array<{
    eventId: string;
    eventType: string;
    timestamp: Date;
    pitchTitle?: string;
    userId?: number;
  }>;
}

export const handler: Handlers = {
  // Get real-time analytics
  async GET(req) {
    try {
      const url = new URL(req.url);
      const metric = url.searchParams.get("metric");
      const refreshCache = url.searchParams.get("refresh") === "true";

      // Check cache first (unless refresh requested)
      if (!refreshCache && metric) {
        const cached = await getCachedMetric(metric);
        if (cached) {
          return new Response(JSON.stringify({
            success: true,
            data: cached.data,
            cached: true,
            lastUpdated: cached.lastUpdated,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      let data;
      const now = new Date();

      switch (metric) {
        case "active-users":
          data = await getActiveUsers();
          await cacheMetric("active-users", data, 30); // Cache for 30 seconds
          break;
        case "current-views":
          data = await getCurrentViews();
          await cacheMetric("current-views", data, 15); // Cache for 15 seconds
          break;
        case "trending-pitches":
          data = await getTrendingPitches();
          await cacheMetric("trending-pitches", data, 60); // Cache for 1 minute
          break;
        case "geographic":
          data = await getGeographicDistribution();
          await cacheMetric("geographic", data, 120); // Cache for 2 minutes
          break;
        case "traffic-sources":
          data = await getTrafficSources();
          await cacheMetric("traffic-sources", data, 120); // Cache for 2 minutes
          break;
        case "devices":
          data = await getDeviceBreakdown();
          await cacheMetric("devices", data, 120); // Cache for 2 minutes
          break;
        case "live-events":
          data = await getLiveEvents();
          // Don't cache live events
          break;
        case "dashboard":
        default:
          data = await getRealtimeDashboard();
          break;
      }

      return new Response(JSON.stringify({
        success: true,
        data,
        timestamp: now.toISOString(),
        cached: false,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching real-time analytics:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Clear cache (admin only)
  async DELETE(req) {
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

      // Check admin permissions
      const user = await db.select().from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || user[0].userType !== "production") {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Clear expired cache entries
      await db.delete(realtimeAnalytics)
        .where(sql`${realtimeAnalytics.expiresAt} < NOW()`);

      return new Response(JSON.stringify({
        success: true,
        message: "Cache cleared",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error clearing cache:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Get complete real-time dashboard
async function getRealtimeDashboard(): Promise<RealtimeMetrics> {
  const [
    activeUsers,
    currentViews,
    trendingPitches,
    geographicDistribution,
    trafficSources,
    deviceBreakdown,
    liveEvents
  ] = await Promise.all([
    getActiveUsers(),
    getCurrentViews(),
    getTrendingPitches(),
    getGeographicDistribution(),
    getTrafficSources(),
    getDeviceBreakdown(),
    getLiveEvents()
  ]);

  return {
    activeUsers,
    currentViews,
    trendingPitches,
    geographicDistribution,
    trafficSources,
    deviceBreakdown,
    liveEvents,
  };
}

// Get active users (last 5 minutes)
async function getActiveUsers(): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  const result = await db.select({
    activeUsers: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`,
  })
  .from(analyticsEvents)
  .where(gte(analyticsEvents.timestamp, fiveMinutesAgo));

  return result[0]?.activeUsers || 0;
}

// Get current views (active sessions viewing content)
async function getCurrentViews(): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  const result = await db.select({
    currentViews: count(),
  })
  .from(analyticsEvents)
  .where(and(
    eq(analyticsEvents.eventType, "view"),
    gte(analyticsEvents.timestamp, fiveMinutesAgo)
  ));

  return result[0]?.currentViews || 0;
}

// Get trending pitches (based on recent activity)
async function getTrendingPitches() {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const result = await db.select({
    pitchId: analyticsEvents.pitchId,
    title: pitches.title,
    viewsLast15Min: sql<number>`COUNT(*) FILTER (WHERE ${analyticsEvents.timestamp} >= ${fifteenMinutesAgo})`,
    viewsLast1Hour: sql<number>`COUNT(*) FILTER (WHERE ${analyticsEvents.timestamp} >= ${oneHourAgo})`,
  })
  .from(analyticsEvents)
  .innerJoin(pitches, eq(analyticsEvents.pitchId, pitches.id))
  .where(and(
    eq(analyticsEvents.eventType, "view"),
    gte(analyticsEvents.timestamp, oneHourAgo),
    sql`${analyticsEvents.pitchId} IS NOT NULL`
  ))
  .groupBy(analyticsEvents.pitchId, pitches.title)
  .orderBy(desc(sql`COUNT(*) FILTER (WHERE ${analyticsEvents.timestamp} >= ${fifteenMinutesAgo})`))
  .limit(10);

  return result.map(pitch => ({
    ...pitch,
    momentum: pitch.viewsLast15Min > 0 && pitch.viewsLast1Hour > 0 
      ? (pitch.viewsLast15Min / (pitch.viewsLast1Hour / 4)) // Compare 15min rate to hourly rate
      : pitch.viewsLast15Min > 0 ? 2 : 0, // If no hour data but 15min data, assume high momentum
  })).sort((a, b) => b.momentum - a.momentum);
}

// Get geographic distribution (last hour)
async function getGeographicDistribution() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const result = await db.select({
    country: analyticsEvents.country,
    users: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`,
  })
  .from(analyticsEvents)
  .where(and(
    gte(analyticsEvents.timestamp, oneHourAgo),
    sql`${analyticsEvents.country} IS NOT NULL`
  ))
  .groupBy(analyticsEvents.country)
  .orderBy(desc(sql`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`))
  .limit(10);

  const totalUsers = result.reduce((sum, item) => sum + item.users, 0);

  return result.map(item => ({
    country: item.country || "Unknown",
    users: item.users,
    percentage: totalUsers > 0 ? (item.users / totalUsers) * 100 : 0,
  }));
}

// Get traffic sources (last hour)
async function getTrafficSources() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const result = await db.select({
    source: sql<string>`CASE 
      WHEN ${userSessions.utmSource} IS NOT NULL THEN ${userSessions.utmSource}
      WHEN ${userSessions.referrer} LIKE '%google%' THEN 'Google'
      WHEN ${userSessions.referrer} LIKE '%facebook%' THEN 'Facebook'
      WHEN ${userSessions.referrer} LIKE '%twitter%' THEN 'Twitter'
      WHEN ${userSessions.referrer} LIKE '%linkedin%' THEN 'LinkedIn'
      WHEN ${userSessions.referrer} IS NOT NULL THEN 'Referral'
      ELSE 'Direct'
    END`,
    sessions: count(),
  })
  .from(userSessions)
  .where(gte(userSessions.startTime, oneHourAgo))
  .groupBy(sql`CASE 
    WHEN ${userSessions.utmSource} IS NOT NULL THEN ${userSessions.utmSource}
    WHEN ${userSessions.referrer} LIKE '%google%' THEN 'Google'
    WHEN ${userSessions.referrer} LIKE '%facebook%' THEN 'Facebook'
    WHEN ${userSessions.referrer} LIKE '%twitter%' THEN 'Twitter'
    WHEN ${userSessions.referrer} LIKE '%linkedin%' THEN 'LinkedIn'
    WHEN ${userSessions.referrer} IS NOT NULL THEN 'Referral'
    ELSE 'Direct'
  END`)
  .orderBy(desc(count()))
  .limit(10);

  const totalSessions = result.reduce((sum, item) => sum + item.sessions, 0);

  return result.map(item => ({
    source: item.source,
    sessions: item.sessions,
    percentage: totalSessions > 0 ? (item.sessions / totalSessions) * 100 : 0,
  }));
}

// Get device breakdown (last hour)
async function getDeviceBreakdown() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const result = await db.select({
    deviceType: analyticsEvents.deviceType,
    users: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`,
  })
  .from(analyticsEvents)
  .where(and(
    gte(analyticsEvents.timestamp, oneHourAgo),
    sql`${analyticsEvents.deviceType} IS NOT NULL`
  ))
  .groupBy(analyticsEvents.deviceType)
  .orderBy(desc(sql`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}::text, ${analyticsEvents.sessionId}))`));

  const totalUsers = result.reduce((sum, item) => sum + item.users, 0);

  return result.map(item => ({
    deviceType: item.deviceType || "Unknown",
    users: item.users,
    percentage: totalUsers > 0 ? (item.users / totalUsers) * 100 : 0,
  }));
}

// Get live events (last 2 minutes)
async function getLiveEvents() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  
  const result = await db.select({
    eventId: analyticsEvents.eventId,
    eventType: analyticsEvents.eventType,
    timestamp: analyticsEvents.timestamp,
    pitchTitle: pitches.title,
    userId: analyticsEvents.userId,
  })
  .from(analyticsEvents)
  .leftJoin(pitches, eq(analyticsEvents.pitchId, pitches.id))
  .where(gte(analyticsEvents.timestamp, twoMinutesAgo))
  .orderBy(desc(analyticsEvents.timestamp))
  .limit(20);

  return result.map(event => ({
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    pitchTitle: event.pitchTitle,
    userId: event.userId,
  }));
}

// Cache management functions
async function getCachedMetric(cacheKey: string) {
  try {
    const cached = await db.select()
      .from(realtimeAnalytics)
      .where(and(
        eq(realtimeAnalytics.cacheKey, cacheKey),
        sql`${realtimeAnalytics.expiresAt} > NOW()`
      ))
      .limit(1);

    return cached.length > 0 ? cached[0] : null;
  } catch (error) {
    console.error("Error getting cached metric:", error);
    return null;
  }
}

async function cacheMetric(cacheKey: string, data: any, ttlSeconds: number) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    
    // Upsert cache entry
    await db.insert(realtimeAnalytics).values({
      cacheKey,
      data,
      expiresAt,
      lastUpdated: new Date(),
      version: 1,
    }).onConflictDoUpdate({
      target: realtimeAnalytics.cacheKey,
      set: {
        data,
        expiresAt,
        lastUpdated: new Date(),
        version: sql`${realtimeAnalytics.version} + 1`,
      },
    });
  } catch (error) {
    console.error("Error caching metric:", error);
  }
}