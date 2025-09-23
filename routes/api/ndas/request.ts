import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { ndaRequests, users, pitches } from "../../../src/db/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";
import { notifyNDARequest } from "../../../utils/notifications.ts";

export const handler: Handlers = {
  // Create NDA request
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

      const body = await req.json();
      const { pitchId, ndaType = "basic", requestMessage, companyInfo } = body;

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

      // Check if request already exists
      const existingRequest = await db.select().from(ndaRequests)
        .where(and(
          eq(ndaRequests.pitchId, pitchId),
          eq(ndaRequests.requesterId, userId),
          eq(ndaRequests.status, "pending")
        ))
        .limit(1);

      if (existingRequest.length) {
        return new Response(JSON.stringify({ error: "Request already pending" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create NDA request
      const newRequest = await db.insert(ndaRequests).values({
        pitchId,
        requesterId: userId,
        ownerId: pitch[0].userId,
        ndaType,
        requestMessage,
        companyInfo,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }).returning();

      // Send notification to pitch owner
      await notifyNDARequest(
        newRequest[0].id,
        pitchId,
        userId,
        pitch[0].userId
      );

      return new Response(JSON.stringify({
        success: true,
        request: newRequest[0],
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating NDA request:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Get NDA requests (incoming for pitch owners, outgoing for requesters)
  async GET(req) {
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
      const type = url.searchParams.get("type") || "outgoing"; // incoming or outgoing

      let requests;
      if (type === "incoming") {
        // Get requests for pitches owned by user
        requests = await db.select({
          id: ndaRequests.id,
          pitchId: ndaRequests.pitchId,
          pitchTitle: pitches.title,
          requesterName: users.username,
          requesterCompany: users.companyName,
          ndaType: ndaRequests.ndaType,
          requestMessage: ndaRequests.requestMessage,
          companyInfo: ndaRequests.companyInfo,
          status: ndaRequests.status,
          requestedAt: ndaRequests.requestedAt,
        })
        .from(ndaRequests)
        .innerJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .innerJoin(users, eq(ndaRequests.requesterId, users.id))
        .where(eq(ndaRequests.ownerId, userId))
        .orderBy(desc(ndaRequests.requestedAt));
      } else {
        // Get requests made by user
        requests = await db.select({
          id: ndaRequests.id,
          pitchId: ndaRequests.pitchId,
          pitchTitle: pitches.title,
          ownerName: users.username,
          ownerCompany: users.companyName,
          ndaType: ndaRequests.ndaType,
          status: ndaRequests.status,
          requestedAt: ndaRequests.requestedAt,
          respondedAt: ndaRequests.respondedAt,
        })
        .from(ndaRequests)
        .innerJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .innerJoin(users, eq(ndaRequests.ownerId, users.id))
        .where(eq(ndaRequests.requesterId, userId))
        .orderBy(desc(ndaRequests.requestedAt));
      }

      return new Response(JSON.stringify({
        success: true,
        requests,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching NDA requests:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};