import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { messages, users, pitches } from "../../../src/db/schema.ts";
import { eq, or, and, desc } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
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
      const type = url.searchParams.get("type") || "inbox"; // inbox, sent, or all
      const pitchId = url.searchParams.get("pitchId");

      let query = db.select({
        id: messages.id,
        pitchId: messages.pitchId,
        pitchTitle: pitches.title,
        senderId: messages.senderId,
        senderName: users.username,
        senderCompany: users.companyName,
        receiverId: messages.receiverId,
        subject: messages.subject,
        content: messages.content,
        isRead: messages.isRead,
        offPlatformRequested: messages.offPlatformRequested,
        offPlatformApproved: messages.offPlatformApproved,
        sentAt: messages.sentAt,
        readAt: messages.readAt,
      })
      .from(messages)
      .innerJoin(pitches, eq(messages.pitchId, pitches.id))
      .innerJoin(users, eq(messages.senderId, users.id));

      // Filter by type
      if (type === "inbox") {
        query = query.where(eq(messages.receiverId, userId));
      } else if (type === "sent") {
        query = query.where(eq(messages.senderId, userId));
      } else {
        query = query.where(or(
          eq(messages.receiverId, userId),
          eq(messages.senderId, userId)
        ));
      }

      // Filter by pitch if specified
      if (pitchId) {
        query = query.where(and(
          eq(messages.pitchId, parseInt(pitchId)),
          or(
            eq(messages.receiverId, userId),
            eq(messages.senderId, userId)
          )
        ));
      }

      const messageList = await query.orderBy(desc(messages.sentAt));

      // Get unread count
      const unreadCount = await db.select({
        count: messages.id,
      })
      .from(messages)
      .where(and(
        eq(messages.receiverId, userId),
        eq(messages.isRead, false)
      ));

      return new Response(JSON.stringify({
        success: true,
        messages: messageList,
        unreadCount: unreadCount.length,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};