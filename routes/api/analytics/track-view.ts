import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitchViews, pitches, ndas } from "../../../src/db/schema.ts";
import { eq, and, sql } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async POST(req) {
    try {
      const body = await req.json();
      const { pitchId, viewType = "teaser", sessionId } = body;

      // Get user if authenticated
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      let userId: number | null = null;
      if (token) {
        userId = await verifyToken(token);
      }

      // Get IP and user agent for tracking
      const ipAddress = req.headers.get("x-forwarded-for") || 
                       req.headers.get("x-real-ip") || 
                       "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      const referrer = req.headers.get("referer") || null;

      // Check if pitch exists
      const pitch = await db.select().from(pitches)
        .where(eq(pitches.id, pitchId))
        .limit(1);

      if (!pitch.length) {
        return new Response(JSON.stringify({ error: "Pitch not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Determine view type based on NDA status if user is authenticated
      let actualViewType = viewType;
      if (userId) {
        const hasNDA = await db.select().from(ndas)
          .where(and(
            eq(ndas.pitchId, pitchId),
            eq(ndas.signerId, userId),
            eq(ndas.accessGranted, true)
          ))
          .limit(1);

        if (hasNDA.length) {
          actualViewType = "nda_signed";
        } else {
          actualViewType = "full";
        }
      }

      // Create view record
      const viewRecord = await db.insert(pitchViews).values({
        pitchId,
        viewerId: userId,
        viewType: actualViewType,
        ipAddress: ipAddress.substring(0, 45), // Limit to DB field size
        userAgent: userAgent.substring(0, 500), // Limit for storage
        referrer,
        sessionId: sessionId || crypto.randomUUID(),
        viewedAt: new Date(),
      }).returning();

      // Increment view count on pitch
      await db.update(pitches)
        .set({
          viewCount: sql`${pitches.viewCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(pitches.id, pitchId));

      return new Response(JSON.stringify({
        success: true,
        viewId: viewRecord[0].id,
        sessionId: viewRecord[0].sessionId,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error tracking view:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};