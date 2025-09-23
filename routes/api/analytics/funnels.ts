import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { 
  conversionFunnels,
  funnelEvents,
  analyticsEvents,
  userSessions,
  users
} from "../../../src/db/schema.ts";
import { eq, and, sql, desc, gte, lte, asc } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface CreateFunnelRequest {
  name: string;
  description?: string;
  stages: Array<{
    stageId: string;
    name: string;
    description?: string;
    eventType: string;
    filters?: Record<string, any>;
    timeoutMinutes?: number;
  }>;
  timeWindowHours?: number;
  experimentId?: string;
}

interface FunnelAnalysisRequest {
  funnelId: number;
  startDate: string;
  endDate: string;
  groupBy?: "day" | "hour" | "week";
  segmentBy?: "country" | "deviceType" | "userType";
}

export const handler: Handlers = {
  // Create or update funnel
  async POST(req) {
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

      // Check user permissions (admin or production users can create funnels)
      const user = await db.select().from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length || !["production", "investor"].includes(user[0].userType)) {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body: CreateFunnelRequest = await req.json();
      const { 
        name, 
        description, 
        stages, 
        timeWindowHours = 24, 
        experimentId 
      } = body;

      if (!name || !stages || stages.length < 2) {
        return new Response(JSON.stringify({ 
          error: "name and at least 2 stages are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate stages
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        if (!stage.stageId || !stage.name || !stage.eventType) {
          return new Response(JSON.stringify({ 
            error: `Stage ${i + 1} is missing required fields (stageId, name, eventType)` 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      const funnel = await db.insert(conversionFunnels).values({
        name,
        description,
        stages,
        timeWindowHours,
        experimentId,
        isActive: true,
      }).returning();

      return new Response(JSON.stringify({
        success: true,
        funnel: funnel[0],
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating funnel:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Get funnels or funnel analysis
  async GET(req) {
    try {
      const url = new URL(req.url);
      const funnelId = url.searchParams.get("funnelId");
      const analysis = url.searchParams.get("analysis");

      if (funnelId && analysis === "true") {
        return await getFunnelAnalysis(req, parseInt(funnelId));
      } else if (funnelId) {
        return await getFunnel(req, parseInt(funnelId));
      } else {
        return await getFunnels(req);
      }
    } catch (error) {
      console.error("Error handling GET request:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Update funnel
  async PUT(req) {
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

      const url = new URL(req.url);
      const funnelId = parseInt(url.searchParams.get("funnelId") || "0");

      if (!funnelId) {
        return new Response(JSON.stringify({ error: "funnelId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const updates: any = {};

      if (body.name) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.stages) updates.stages = body.stages;
      if (body.timeWindowHours) updates.timeWindowHours = body.timeWindowHours;
      if (body.isActive !== undefined) updates.isActive = body.isActive;

      updates.updatedAt = new Date();

      const funnel = await db.update(conversionFunnels)
        .set(updates)
        .where(eq(conversionFunnels.id, funnelId))
        .returning();

      if (!funnel.length) {
        return new Response(JSON.stringify({ error: "Funnel not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        funnel: funnel[0],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error updating funnel:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Get all funnels
async function getFunnels(req: Request) {
  const funnels = await db.select({
    id: conversionFunnels.id,
    name: conversionFunnels.name,
    description: conversionFunnels.description,
    stages: conversionFunnels.stages,
    timeWindowHours: conversionFunnels.timeWindowHours,
    isActive: conversionFunnels.isActive,
    experimentId: conversionFunnels.experimentId,
    createdAt: conversionFunnels.createdAt,
    updatedAt: conversionFunnels.updatedAt,
  })
  .from(conversionFunnels)
  .where(eq(conversionFunnels.isActive, true))
  .orderBy(desc(conversionFunnels.createdAt));

  return new Response(JSON.stringify({
    success: true,
    funnels,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Get specific funnel
async function getFunnel(req: Request, funnelId: number) {
  const funnel = await db.select()
    .from(conversionFunnels)
    .where(eq(conversionFunnels.id, funnelId))
    .limit(1);

  if (!funnel.length) {
    return new Response(JSON.stringify({ error: "Funnel not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    funnel: funnel[0],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Get funnel analysis
async function getFunnelAnalysis(req: Request, funnelId: number) {
  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const groupBy = url.searchParams.get("groupBy") as "day" | "hour" | "week" || "day";
  const segmentBy = url.searchParams.get("segmentBy") as "country" | "deviceType" | "userType";

  if (!startDate || !endDate) {
    return new Response(JSON.stringify({ 
      error: "startDate and endDate are required for analysis" 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get funnel definition
  const funnel = await db.select()
    .from(conversionFunnels)
    .where(eq(conversionFunnels.id, funnelId))
    .limit(1);

  if (!funnel.length) {
    return new Response(JSON.stringify({ error: "Funnel not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const funnelDef = funnel[0];
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  // Process funnel events for the time period
  await processFunnelEvents(funnelId, funnelDef, startDateObj, endDateObj);

  // Get funnel conversion rates
  const conversionRates = await calculateConversionRates(
    funnelId, 
    startDateObj, 
    endDateObj, 
    groupBy, 
    segmentBy
  );

  // Get drop-off analysis
  const dropOffAnalysis = await calculateDropOffAnalysis(
    funnelId, 
    startDateObj, 
    endDateObj, 
    segmentBy
  );

  // Get time-to-convert analysis
  const timeToConvert = await calculateTimeToConvert(
    funnelId, 
    startDateObj, 
    endDateObj
  );

  return new Response(JSON.stringify({
    success: true,
    funnel: funnelDef,
    analysis: {
      period: { startDate, endDate },
      conversionRates,
      dropOffAnalysis,
      timeToConvert,
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Process events into funnel progression
async function processFunnelEvents(
  funnelId: number,
  funnelDef: any,
  startDate: Date,
  endDate: Date
) {
  // Get all relevant events for this funnel in the time period
  const stages = funnelDef.stages;
  const eventTypes = stages.map((s: any) => s.eventType);

  const events = await db.select({
    eventId: analyticsEvents.eventId,
    eventType: analyticsEvents.eventType,
    userId: analyticsEvents.userId,
    sessionId: analyticsEvents.sessionId,
    anonymousId: analyticsEvents.anonymousId,
    pitchId: analyticsEvents.pitchId,
    timestamp: analyticsEvents.timestamp,
    eventData: analyticsEvents.eventData,
  })
  .from(analyticsEvents)
  .where(and(
    sql`${analyticsEvents.eventType} = ANY(${eventTypes})`,
    gte(analyticsEvents.timestamp, startDate),
    lte(analyticsEvents.timestamp, endDate)
  ))
  .orderBy(asc(analyticsEvents.timestamp));

  // Group events by user/session
  const userSessions = new Map<string, any[]>();
  
  for (const event of events) {
    const key = event.userId ? `user:${event.userId}` : `session:${event.sessionId}`;
    if (!userSessions.has(key)) {
      userSessions.set(key, []);
    }
    userSessions.get(key)!.push(event);
  }

  // Process each user session through the funnel
  for (const [userKey, sessionEvents] of userSessions) {
    await processUserFunnelJourney(funnelId, funnelDef, userKey, sessionEvents);
  }
}

// Process a single user's journey through the funnel
async function processUserFunnelJourney(
  funnelId: number,
  funnelDef: any,
  userKey: string,
  events: any[]
) {
  const stages = funnelDef.stages;
  const timeWindowMs = funnelDef.timeWindowHours * 60 * 60 * 1000;
  const funnelSessionId = `${userKey}:${Date.now()}`;

  let currentStageIndex = 0;
  let funnelStartTime: Date | null = null;

  for (const event of events) {
    if (currentStageIndex >= stages.length) break;

    const currentStage = stages[currentStageIndex];
    
    // Check if event matches current stage
    if (event.eventType === currentStage.eventType) {
      // Check filters if any
      if (currentStage.filters && !matchesFilters(event, currentStage.filters)) {
        continue;
      }

      // Check time window (events must be within window from funnel start)
      if (funnelStartTime && (event.timestamp.getTime() - funnelStartTime.getTime()) > timeWindowMs) {
        break; // Funnel timeout
      }

      if (!funnelStartTime) {
        funnelStartTime = event.timestamp;
      }

      // Create funnel event
      await db.insert(funnelEvents).values({
        funnelId,
        stageId: currentStage.stageId,
        userId: event.userId,
        sessionId: event.sessionId,
        anonymousId: event.anonymousId,
        eventId: event.eventId,
        pitchId: event.pitchId,
        funnelSessionId,
        stageOrder: currentStageIndex + 1,
        isCompleted: currentStageIndex === stages.length - 1,
        timeToComplete: funnelStartTime ? 
          Math.floor((event.timestamp.getTime() - funnelStartTime.getTime()) / 1000) : 0,
        timestamp: event.timestamp,
      });

      currentStageIndex++;
    }
  }
}

// Check if event matches stage filters
function matchesFilters(event: any, filters: Record<string, any>): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (key === "pitchId" && event.pitchId !== value) return false;
    if (key === "eventData" && typeof value === "object") {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        if (event.eventData?.[dataKey] !== dataValue) return false;
      }
    }
  }
  return true;
}

// Calculate conversion rates
async function calculateConversionRates(
  funnelId: number,
  startDate: Date,
  endDate: Date,
  groupBy: string,
  segmentBy?: string
) {
  const groupByClause = getGroupByClause(groupBy);
  const segmentClause = segmentBy ? `, ${getSegmentClause(segmentBy)}` : "";

  const query = `
    WITH funnel_stages AS (
      SELECT 
        stage_order,
        ${groupByClause} as time_period${segmentClause},
        COUNT(DISTINCT funnel_session_id) as users_at_stage
      FROM funnel_events fe
      LEFT JOIN analytics_events ae ON fe.event_id = ae.event_id
      LEFT JOIN user_sessions us ON ae.session_id = us.session_id
      WHERE fe.funnel_id = $1 
        AND fe.timestamp >= $2 
        AND fe.timestamp <= $3
      GROUP BY stage_order, time_period${segmentClause}
    )
    SELECT 
      stage_order,
      time_period${segmentClause},
      users_at_stage,
      LAG(users_at_stage) OVER (
        PARTITION BY time_period${segmentClause ? `, ${segmentBy}` : ""} 
        ORDER BY stage_order
      ) as previous_stage_users,
      CASE 
        WHEN LAG(users_at_stage) OVER (
          PARTITION BY time_period${segmentClause ? `, ${segmentBy}` : ""} 
          ORDER BY stage_order
        ) > 0 THEN
          (users_at_stage::float / LAG(users_at_stage) OVER (
            PARTITION BY time_period${segmentClause ? `, ${segmentBy}` : ""} 
            ORDER BY stage_order
          )) * 100
        ELSE 0
      END as conversion_rate
    FROM funnel_stages
    ORDER BY time_period, stage_order
  `;

  const result = await db.execute(sql.raw(query, [funnelId, startDate, endDate]));
  return result.rows;
}

// Calculate drop-off analysis
async function calculateDropOffAnalysis(
  funnelId: number,
  startDate: Date,
  endDate: Date,
  segmentBy?: string
) {
  const segmentClause = segmentBy ? `, ${getSegmentClause(segmentBy)}` : "";

  const query = `
    WITH stage_counts AS (
      SELECT 
        stage_order,
        ${segmentClause ? segmentClause.substring(2) : "'all' as segment"},
        COUNT(DISTINCT funnel_session_id) as users
      FROM funnel_events fe
      LEFT JOIN analytics_events ae ON fe.event_id = ae.event_id
      LEFT JOIN user_sessions us ON ae.session_id = us.session_id
      WHERE fe.funnel_id = $1 
        AND fe.timestamp >= $2 
        AND fe.timestamp <= $3
      GROUP BY stage_order${segmentClause}
    )
    SELECT 
      stage_order,
      ${segmentClause ? segmentBy : "'all'"} as segment,
      users,
      LAG(users) OVER (
        PARTITION BY ${segmentClause ? segmentBy : "'all'"} 
        ORDER BY stage_order
      ) as previous_users,
      CASE 
        WHEN LAG(users) OVER (
          PARTITION BY ${segmentClause ? segmentBy : "'all'"} 
          ORDER BY stage_order
        ) > 0 THEN
          LAG(users) OVER (
            PARTITION BY ${segmentClause ? segmentBy : "'all'"} 
            ORDER BY stage_order
          ) - users
        ELSE 0
      END as drop_off
    FROM stage_counts
    ORDER BY ${segmentClause ? segmentBy + ", " : ""}stage_order
  `;

  const result = await db.execute(sql.raw(query, [funnelId, startDate, endDate]));
  return result.rows;
}

// Calculate time to convert
async function calculateTimeToConvert(
  funnelId: number,
  startDate: Date,
  endDate: Date
) {
  const completedFunnels = await db.select({
    timeToComplete: funnelEvents.timeToComplete,
  })
  .from(funnelEvents)
  .where(and(
    eq(funnelEvents.funnelId, funnelId),
    eq(funnelEvents.isCompleted, true),
    gte(funnelEvents.timestamp, startDate),
    lte(funnelEvents.timestamp, endDate)
  ));

  const times = completedFunnels
    .map(f => f.timeToComplete)
    .filter(t => t !== null && t > 0)
    .sort((a, b) => a - b);

  if (times.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      p90: 0,
      p95: 0,
    };
  }

  const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const p90 = times[Math.floor(times.length * 0.9)];
  const p95 = times[Math.floor(times.length * 0.95)];

  return {
    count: times.length,
    mean,
    median,
    p90,
    p95,
  };
}

// Helper functions for SQL clauses
function getGroupByClause(groupBy: string): string {
  switch (groupBy) {
    case "hour":
      return "DATE_TRUNC('hour', fe.timestamp)";
    case "day":
      return "DATE_TRUNC('day', fe.timestamp)";
    case "week":
      return "DATE_TRUNC('week', fe.timestamp)";
    default:
      return "DATE_TRUNC('day', fe.timestamp)";
  }
}

function getSegmentClause(segmentBy: string): string {
  switch (segmentBy) {
    case "country":
      return "ae.country";
    case "deviceType":
      return "ae.device_type";
    case "userType":
      return "(SELECT user_type FROM users WHERE id = ae.user_id)";
    default:
      return "'all'";
  }
}