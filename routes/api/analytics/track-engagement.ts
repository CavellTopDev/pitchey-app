import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitchViews } from "../../../src/db/schema.ts";
import { eq } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async POST(req) {
    try {
      const body = await req.json();
      const { 
        viewId, 
        sessionId, 
        viewDuration, 
        scrollDepth, 
        clickedWatchThis 
      } = body;

      // Validate input
      if (!viewId && !sessionId) {
        return new Response(JSON.stringify({ 
          error: "View ID or Session ID required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Find the view record
      let viewRecord;
      if (viewId) {
        viewRecord = await db.select().from(pitchViews)
          .where(eq(pitchViews.id, viewId))
          .limit(1);
      } else {
        viewRecord = await db.select().from(pitchViews)
          .where(eq(pitchViews.sessionId, sessionId))
          .limit(1);
      }

      if (!viewRecord.length) {
        return new Response(JSON.stringify({ error: "View not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Update engagement metrics
      const updates: any = {};
      if (viewDuration !== undefined) {
        updates.viewDuration = viewDuration;
      }
      if (scrollDepth !== undefined) {
        updates.scrollDepth = Math.min(100, Math.max(0, scrollDepth)); // Clamp to 0-100
      }
      if (clickedWatchThis !== undefined) {
        updates.clickedWatchThis = clickedWatchThis;
      }

      if (Object.keys(updates).length > 0) {
        await db.update(pitchViews)
          .set(updates)
          .where(eq(pitchViews.id, viewRecord[0].id));
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Engagement metrics updated",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error tracking engagement:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};