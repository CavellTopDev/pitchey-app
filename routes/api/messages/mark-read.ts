import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { messages, messageReadReceipts } from "../../../src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { getUserFromToken } from "../../../utils/auth.ts";
import { broadcastToUserEnhanced } from "./ws.ts";

export const handler: Handlers = {
  async POST(req) {
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

      const body = await req.json();
      const { messageId, conversationId } = body;

      if (messageId) {
        // Mark specific message as read
        const message = await db.select({
          id: messages.id,
          senderId: messages.senderId,
          conversationId: messages.conversationId,
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

        // Can't mark your own message as read
        if (message[0].senderId === user.id) {
          return new Response(JSON.stringify({ error: "Cannot mark your own message as read" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Update read receipt
        await db.update(messageReadReceipts)
          .set({ readAt: new Date() })
          .where(and(
            eq(messageReadReceipts.messageId, messageId),
            eq(messageReadReceipts.userId, user.id)
          ));

        // Update message as read
        await db.update(messages)
          .set({ isRead: true, readAt: new Date() })
          .where(and(
            eq(messages.id, messageId),
            eq(messages.receiverId, user.id)
          ));

        // Notify sender that message was read
        try {
          await broadcastToUserEnhanced(message[0].senderId, {
            type: 'message_read',
            messageId,
            conversationId: message[0].conversationId,
            readBy: user.id,
            readByName: user.username || `${user.firstName} ${user.lastName}`.trim(),
            readAt: new Date().toISOString(),
          });
        } catch (broadcastError) {
          console.warn("Failed to broadcast read receipt:", broadcastError);
        }

        return new Response(JSON.stringify({
          success: true,
          messageId,
          readAt: new Date().toISOString(),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      } else if (conversationId) {
        // Mark all messages in conversation as read
        const unreadMessages = await db.select({
          id: messages.id,
          senderId: messages.senderId,
        })
        .from(messages)
        .leftJoin(messageReadReceipts, and(
          eq(messages.id, messageReadReceipts.messageId),
          eq(messageReadReceipts.userId, user.id)
        ))
        .where(and(
          eq(messages.conversationId, conversationId),
          eq(messages.receiverId, user.id),
          eq(messages.isRead, false)
        ));

        if (unreadMessages.length > 0) {
          // Update all read receipts
          const messageIds = unreadMessages.map(m => m.id);
          await db.update(messageReadReceipts)
            .set({ readAt: new Date() })
            .where(and(
              eq(messageReadReceipts.userId, user.id),
              // Use inArray for multiple messageIds
              // inArray(messageReadReceipts.messageId, messageIds)
            ));

          // Update all messages as read
          await db.update(messages)
            .set({ isRead: true, readAt: new Date() })
            .where(and(
              eq(messages.conversationId, conversationId),
              eq(messages.receiverId, user.id),
              eq(messages.isRead, false)
            ));

          // Notify senders of read messages
          const uniqueSenders = [...new Set(unreadMessages.map(m => m.senderId))];
          for (const senderId of uniqueSenders) {
            try {
              await broadcastToUserEnhanced(senderId, {
                type: 'conversation_read',
                conversationId,
                readBy: user.id,
                readByName: user.username || `${user.firstName} ${user.lastName}`.trim(),
                readCount: unreadMessages.filter(m => m.senderId === senderId).length,
                readAt: new Date().toISOString(),
              });
            } catch (broadcastError) {
              console.warn(`Failed to broadcast read receipt to user ${senderId}:`, broadcastError);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          conversationId,
          markedCount: unreadMessages.length,
          readAt: new Date().toISOString(),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ error: "Either messageId or conversationId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      console.error("Error marking message(s) as read:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};