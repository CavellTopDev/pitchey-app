import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { 
  analyticsEvents, 
  userSessions, 
  eventTypeEnum,
  users 
} from "../../../src/db/schema.ts";
import { eq, and, sql, desc } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface TrackEventRequest {
  eventType: string;
  category?: string;
  sessionId: string;
  anonymousId?: string;
  
  // Context
  pitchId?: number;
  conversationId?: number;
  messageId?: number;
  pathname?: string;
  
  // Event-specific data
  eventData?: {
    // View events
    viewDuration?: number;
    scrollDepth?: number;
    
    // Video events
    videoPosition?: number;
    videoDuration?: number;
    
    // Click events
    elementId?: string;
    elementText?: string;
    clickPosition?: { x: number; y: number };
    
    // Search events
    query?: string;
    resultsCount?: number;
    filters?: Record<string, any>;
    
    // Conversion events
    value?: number;
    currency?: string;
    
    // Additional metadata
    [key: string]: any;
  };
  
  // A/B testing
  experiments?: Array<{
    experimentId: string;
    variantId: string;
  }>;
  
  // UTM parameters
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export const handler: Handlers = {
  // Track a single event
  async POST(req) {
    try {
      const body: TrackEventRequest = await req.json();
      const { 
        eventType, 
        category = "interaction",
        sessionId,
        anonymousId,
        pitchId,
        conversationId,
        messageId,
        pathname,
        eventData = {},
        experiments = [],
        utmSource,
        utmMedium,
        utmCampaign
      } = body;

      // Validate required fields
      if (!eventType || !sessionId) {
        return new Response(JSON.stringify({ 
          error: "eventType and sessionId are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get user if authenticated
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      let userId: number | null = null;
      if (token) {
        userId = await verifyToken(token);
      }

      // Extract technical information
      const ipAddress = req.headers.get("x-forwarded-for") || 
                       req.headers.get("x-real-ip") || 
                       "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      const referrer = req.headers.get("referer") || null;

      // Parse user agent for device info (simplified)
      const deviceInfo = parseUserAgent(userAgent);

      // Create or update session
      await upsertSession({
        sessionId,
        userId,
        anonymousId,
        ipAddress,
        userAgent,
        referrer,
        pathname,
        utmSource,
        utmMedium,
        utmCampaign,
        deviceInfo
      });

      // Create analytics event
      const event = await db.insert(analyticsEvents).values({
        eventType: eventType as any,
        category,
        userId,
        sessionId,
        anonymousId,
        pitchId,
        conversationId,
        messageId,
        ipAddress: ipAddress.substring(0, 45),
        userAgent: userAgent.substring(0, 500),
        referrer,
        pathname,
        country: deviceInfo.country,
        region: deviceInfo.region,
        city: deviceInfo.city,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        eventData,
        experiments: experiments.length > 0 ? experiments : null,
        timestamp: new Date(),
      }).returning();

      return new Response(JSON.stringify({
        success: true,
        eventId: event[0].eventId,
        timestamp: event[0].timestamp,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error tracking event:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Batch track multiple events
  async PUT(req) {
    try {
      const body: { events: TrackEventRequest[] } = await req.json();
      const { events } = body;

      if (!events || !Array.isArray(events) || events.length === 0) {
        return new Response(JSON.stringify({ 
          error: "events array is required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Limit batch size
      if (events.length > 100) {
        return new Response(JSON.stringify({ 
          error: "Maximum 100 events per batch" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get user if authenticated
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      let userId: number | null = null;
      if (token) {
        userId = await verifyToken(token);
      }

      // Extract technical information
      const ipAddress = req.headers.get("x-forwarded-for") || 
                       req.headers.get("x-real-ip") || 
                       "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      const referrer = req.headers.get("referer") || null;

      const deviceInfo = parseUserAgent(userAgent);
      const processedEvents = [];

      // Process each event
      for (const event of events) {
        try {
          // Update session for each unique sessionId
          await upsertSession({
            sessionId: event.sessionId,
            userId,
            anonymousId: event.anonymousId,
            ipAddress,
            userAgent,
            referrer,
            pathname: event.pathname,
            utmSource: event.utmSource,
            utmMedium: event.utmMedium,
            utmCampaign: event.utmCampaign,
            deviceInfo
          });

          const eventRecord = await db.insert(analyticsEvents).values({
            eventType: event.eventType as any,
            category: event.category || "interaction",
            userId,
            sessionId: event.sessionId,
            anonymousId: event.anonymousId,
            pitchId: event.pitchId,
            conversationId: event.conversationId,
            messageId: event.messageId,
            ipAddress: ipAddress.substring(0, 45),
            userAgent: userAgent.substring(0, 500),
            referrer,
            pathname: event.pathname,
            country: deviceInfo.country,
            region: deviceInfo.region,
            city: deviceInfo.city,
            deviceType: deviceInfo.deviceType,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            eventData: event.eventData || {},
            experiments: event.experiments && event.experiments.length > 0 ? event.experiments : null,
            timestamp: new Date(),
          }).returning();

          processedEvents.push({
            eventId: eventRecord[0].eventId,
            timestamp: eventRecord[0].timestamp,
          });
        } catch (error) {
          console.error("Error processing event:", error);
          processedEvents.push({
            error: "Failed to process event",
            originalEvent: event,
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processedCount: processedEvents.filter(e => !e.error).length,
        totalCount: events.length,
        events: processedEvents,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error batch tracking events:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Get events for a user (with pagination)
  async GET(req) {
    try {
      const url = new URL(req.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 1000);
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const sessionId = url.searchParams.get("sessionId");
      const eventType = url.searchParams.get("eventType");
      const pitchId = url.searchParams.get("pitchId");

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

      // Build query conditions
      const conditions = [eq(analyticsEvents.userId, userId)];
      
      if (sessionId) {
        conditions.push(eq(analyticsEvents.sessionId, sessionId));
      }
      if (eventType) {
        conditions.push(eq(analyticsEvents.eventType, eventType as any));
      }
      if (pitchId) {
        conditions.push(eq(analyticsEvents.pitchId, parseInt(pitchId)));
      }

      const events = await db.select({
        eventId: analyticsEvents.eventId,
        eventType: analyticsEvents.eventType,
        category: analyticsEvents.category,
        sessionId: analyticsEvents.sessionId,
        pitchId: analyticsEvents.pitchId,
        eventData: analyticsEvents.eventData,
        timestamp: analyticsEvents.timestamp,
      })
      .from(analyticsEvents)
      .where(and(...conditions))
      .orderBy(desc(analyticsEvents.timestamp))
      .limit(limit)
      .offset(offset);

      return new Response(JSON.stringify({
        success: true,
        events,
        pagination: {
          limit,
          offset,
          hasMore: events.length === limit,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching events:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Helper function to create or update session
async function upsertSession({
  sessionId,
  userId,
  anonymousId,
  ipAddress,
  userAgent,
  referrer,
  pathname,
  utmSource,
  utmMedium,
  utmCampaign,
  deviceInfo
}: {
  sessionId: string;
  userId: number | null;
  anonymousId?: string;
  ipAddress: string;
  userAgent: string;
  referrer: string | null;
  pathname?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  deviceInfo: any;
}) {
  try {
    // Try to get existing session
    const existingSession = await db.select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId))
      .limit(1);

    if (existingSession.length > 0) {
      // Update existing session
      await db.update(userSessions)
        .set({
          lastActivity: new Date(),
          isActive: true,
          eventCount: sql`${userSessions.eventCount} + 1`,
          exitPage: pathname,
          // Update user ID if session was anonymous and now has user
          ...(userId && !existingSession[0].userId ? { userId } : {}),
        })
        .where(eq(userSessions.sessionId, sessionId));
    } else {
      // Create new session
      await db.insert(userSessions).values({
        sessionId,
        userId,
        anonymousId,
        startTime: new Date(),
        lastActivity: new Date(),
        pageViews: 1,
        eventCount: 1,
        entryPage: pathname,
        exitPage: pathname,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        ipAddress: ipAddress.substring(0, 45),
        userAgent: userAgent.substring(0, 500),
        country: deviceInfo.country,
        region: deviceInfo.region,
        city: deviceInfo.city,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        bounced: true, // Will be updated if more events come
        converted: false,
        engagementScore: 0,
        isActive: true,
      });
    }
  } catch (error) {
    console.error("Error upserting session:", error);
  }
}

// Simple user agent parser (in a real app, use a library like ua-parser-js)
function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  
  let deviceType = "desktop";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    deviceType = "mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "tablet";
  }
  
  let browser = "unknown";
  if (ua.includes("chrome")) browser = "chrome";
  else if (ua.includes("firefox")) browser = "firefox";
  else if (ua.includes("safari")) browser = "safari";
  else if (ua.includes("edge")) browser = "edge";
  
  let os = "unknown";
  if (ua.includes("windows")) os = "windows";
  else if (ua.includes("mac")) os = "macos";
  else if (ua.includes("linux")) os = "linux";
  else if (ua.includes("android")) os = "android";
  else if (ua.includes("ios")) os = "ios";
  
  return {
    deviceType,
    browser,
    os,
    country: "US", // Would use IP geolocation service in production
    region: "Unknown",
    city: "Unknown",
  };
}