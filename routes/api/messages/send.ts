import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { messages, pitches, ndas, conversations, conversationParticipants, messageReadReceipts } from "../../../src/db/schema.ts";
import { eq, and, or } from "drizzle-orm";
import { verifyToken, getUserFromToken } from "../../../utils/auth.ts";
import { broadcastMessage } from "../../../utils/notifications.ts";

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
      const { 
        pitchId, 
        receiverId, 
        conversationId,
        subject, 
        content,
        parentMessageId,
        attachments = [],
        messageType = "text",
        offPlatformRequested = false 
      } = body;

      // Validate required fields
      if (!content || (!receiverId && !conversationId)) {
        return new Response(JSON.stringify({ 
          error: "Content and either receiver ID or conversation ID are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // If pitchId is provided, check access permissions
      if (pitchId) {
        const pitch = await db.select().from(pitches)
          .where(eq(pitches.id, pitchId))
          .limit(1);

        if (!pitch.length) {
          return new Response(JSON.stringify({ error: "Pitch not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Check if sender has NDA access (unless they're the pitch owner)
        if (pitch[0].userId !== user.id) {
          const hasNDA = await db.select().from(ndas)
            .where(and(
              eq(ndas.pitchId, pitchId),
              eq(ndas.signerId, user.id),
              eq(ndas.accessGranted, true)
            ))
            .limit(1);

          if (!hasNDA.length) {
            return new Response(JSON.stringify({ 
              error: "You must have an approved NDA to send messages about this pitch" 
            }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }

      let finalConversationId = conversationId;
      let finalReceiverId = receiverId;

      // If no conversation ID provided, find or create conversation
      if (!finalConversationId && receiverId) {
        // Look for existing conversation between users
        const existingConversation = await db.select({
          id: conversations.id,
        })
        .from(conversations)
        .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
        .where(and(
          eq(conversationParticipants.userId, user.id),
          pitchId ? eq(conversations.pitchId, pitchId) : eq(conversations.pitchId, null)
        ))
        .limit(1);

        if (existingConversation.length > 0) {
          // Check if receiver is also in this conversation
          const receiverInConversation = await db.select()
            .from(conversationParticipants)
            .where(and(
              eq(conversationParticipants.conversationId, existingConversation[0].id),
              eq(conversationParticipants.userId, receiverId)
            ))
            .limit(1);

          if (receiverInConversation.length > 0) {
            finalConversationId = existingConversation[0].id;
          }
        }

        // Create new conversation if none found
        if (!finalConversationId) {
          const newConversation = await db.insert(conversations).values({
            pitchId: pitchId || null,
            createdById: user.id,
            title: subject || `Conversation about ${pitchId ? 'pitch' : 'general topic'}`,
            lastMessageAt: new Date(),
          }).returning();

          finalConversationId = newConversation[0].id;

          // Add participants
          await db.insert(conversationParticipants).values([
            {
              conversationId: finalConversationId,
              userId: user.id,
            },
            {
              conversationId: finalConversationId,
              userId: receiverId,
            }
          ]);
        }
      }

      // If using existing conversation, get other participants
      if (finalConversationId && !finalReceiverId) {
        const participants = await db.select({
          userId: conversationParticipants.userId,
        })
        .from(conversationParticipants)
        .where(and(
          eq(conversationParticipants.conversationId, finalConversationId),
          eq(conversationParticipants.isActive, true)
        ));

        // Find the other participant (not the sender)
        const otherParticipant = participants.find(p => p.userId !== user.id);
        if (otherParticipant) {
          finalReceiverId = otherParticipant.userId;
        }
      }

      // Create message
      const newMessage = await db.insert(messages).values({
        conversationId: finalConversationId,
        pitchId: pitchId || null,
        senderId: user.id,
        receiverId: finalReceiverId,
        parentMessageId: parentMessageId || null,
        subject,
        content,
        messageType,
        attachments: attachments.length > 0 ? attachments : null,
        offPlatformRequested,
        sentAt: new Date(),
      }).returning();

      // Update conversation last message time
      if (finalConversationId) {
        await db.update(conversations)
          .set({ 
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, finalConversationId));
      }

      // Create delivery receipts for all participants
      if (finalConversationId) {
        const participants = await db.select({
          userId: conversationParticipants.userId,
        })
        .from(conversationParticipants)
        .where(and(
          eq(conversationParticipants.conversationId, finalConversationId),
          eq(conversationParticipants.isActive, true)
        ));

        const deliveryReceipts = participants
          .filter(p => p.userId !== user.id)
          .map(p => ({
            messageId: newMessage[0].id,
            userId: p.userId,
            deliveredAt: new Date(),
          }));

        if (deliveryReceipts.length > 0) {
          await db.insert(messageReadReceipts).values(deliveryReceipts);
        }
      }

      // Broadcast message via WebSocket
      if (finalReceiverId) {
        try {
          await broadcastMessage({
            type: 'new_message',
            messageId: newMessage[0].id,
            conversationId: finalConversationId,
            senderId: user.id,
            senderName: user.username || `${user.firstName} ${user.lastName}`.trim(),
            receiverId: finalReceiverId,
            content,
            subject,
            attachments,
            timestamp: newMessage[0].sentAt.toISOString(),
            pitchId,
          });
        } catch (broadcastError) {
          console.warn("Failed to broadcast message via WebSocket:", broadcastError);
          // Continue execution - message was saved successfully
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: {
          ...newMessage[0],
          senderName: user.username || `${user.firstName} ${user.lastName}`.trim(),
        },
        conversationId: finalConversationId,
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error sending message:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};