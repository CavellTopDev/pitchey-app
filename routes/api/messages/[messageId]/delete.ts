import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { messages } from "../../../../src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { getUserFromToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  async DELETE(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await getUserFromToken(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const messageId = parseInt(ctx.params.messageId);
      if (isNaN(messageId)) {
        return new Response(JSON.stringify({ error: "Invalid message ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if message exists and user owns it
      const message = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        conversationId: messages.conversationId,
        content: messages.content,
        sentAt: messages.sentAt,
        isDeleted: messages.isDeleted,
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

      if (message.length === 0) {
        return new Response(JSON.stringify({ error: "Message not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (message[0].senderId !== user.id) {
        return new Response(JSON.stringify({ error: "You can only delete your own messages" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (message[0].isDeleted) {
        return new Response(JSON.stringify({ error: "Message is already deleted" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if message is too old to delete (24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (message[0].sentAt < twentyFourHoursAgo) {
        return new Response(JSON.stringify({ error: "Message is too old to delete" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Soft delete the message
      await db.update(messages)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          content: '[Message deleted]',
        })
        .where(eq(messages.id, messageId));

      // Here you would broadcast the deletion via WebSocket
      // This requires access to the WebSocket broadcast function
      // For now, we'll just return success

      return new Response(JSON.stringify({
        success: true,
        messageId,
        deletedAt: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};