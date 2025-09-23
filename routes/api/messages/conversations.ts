import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { 
  conversations, 
  conversationParticipants, 
  messages, 
  users, 
  pitches,
  messageReadReceipts
} from "../../../src/db/schema.ts";
import { eq, and, desc, or, count, max, sql } from "drizzle-orm";
import { getUserFromToken } from "../../../utils/auth.ts";

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

      const user = await getUserFromToken(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get conversations where user is a participant
      const userConversations = await db
        .select({
          id: conversations.id,
          title: conversations.title,
          pitchId: conversations.pitchId,
          pitchTitle: pitches.title,
          isGroup: conversations.isGroup,
          lastMessageAt: conversations.lastMessageAt,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .innerJoin(
          conversationParticipants,
          eq(conversations.id, conversationParticipants.conversationId)
        )
        .leftJoin(pitches, eq(conversations.pitchId, pitches.id))
        .where(
          and(
            eq(conversationParticipants.userId, user.id),
            eq(conversationParticipants.isActive, true)
          )
        )
        .orderBy(desc(conversations.lastMessageAt));

      // Get additional info for each conversation
      const conversationsWithDetails = await Promise.all(
        userConversations.map(async (conv) => {
          // Get other participants
          const participants = await db
            .select({
              id: users.id,
              username: users.username,
              firstName: users.firstName,
              lastName: users.lastName,
              userType: users.userType,
              companyName: users.companyName,
            })
            .from(conversationParticipants)
            .innerJoin(users, eq(conversationParticipants.userId, users.id))
            .where(
              and(
                eq(conversationParticipants.conversationId, conv.id),
                eq(conversationParticipants.isActive, true),
                sql`${users.id} != ${user.id}` // Exclude current user
              )
            );

          // Get last message
          const lastMessage = await db
            .select({
              id: messages.id,
              content: messages.content,
              senderId: messages.senderId,
              senderName: users.username,
              sentAt: messages.sentAt,
              messageType: messages.messageType,
            })
            .from(messages)
            .innerJoin(users, eq(messages.senderId, users.id))
            .where(eq(messages.conversationId, conv.id))
            .orderBy(desc(messages.sentAt))
            .limit(1);

          // Count unread messages
          const unreadCount = await db
            .select({ count: count() })
            .from(messages)
            .leftJoin(
              messageReadReceipts,
              and(
                eq(messages.id, messageReadReceipts.messageId),
                eq(messageReadReceipts.userId, user.id)
              )
            )
            .where(
              and(
                eq(messages.conversationId, conv.id),
                sql`${messages.senderId} != ${user.id}`, // Not sent by current user
                eq(messages.isRead, false),
                sql`${messageReadReceipts.readAt} IS NULL` // No read receipt
              )
            );

          return {
            id: conv.id,
            title: conv.title,
            pitchId: conv.pitchId,
            pitchTitle: conv.pitchTitle,
            isGroup: conv.isGroup,
            lastMessageAt: conv.lastMessageAt,
            createdAt: conv.createdAt,
            participants: participants.map(p => ({
              id: p.id,
              name: p.companyName || `${p.firstName} ${p.lastName}`.trim() || p.username,
              username: p.username,
              userType: p.userType,
            })),
            lastMessage: lastMessage[0] || null,
            unreadCount: unreadCount[0]?.count || 0,
          };
        })
      );

      return new Response(JSON.stringify({
        success: true,
        conversations: conversationsWithDetails,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};