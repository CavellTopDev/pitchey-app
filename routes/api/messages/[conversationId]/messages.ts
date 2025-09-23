import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { 
  conversations, 
  conversationParticipants, 
  messages, 
  users,
  messageReadReceipts
} from "../../../../src/db/schema.ts";
import { eq, and, desc, asc } from "drizzle-orm";
import { getUserFromToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req, ctx) {
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

      const conversationId = parseInt(ctx.params.conversationId);
      if (isNaN(conversationId)) {
        return new Response(JSON.stringify({ error: "Invalid conversation ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify user is participant in this conversation
      const participation = await db
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, user.id),
            eq(conversationParticipants.isActive, true)
          )
        )
        .limit(1);

      if (participation.length === 0) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get URL parameters for pagination
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const beforeMessageId = url.searchParams.get("before");

      // Build query conditions
      let whereConditions = [eq(messages.conversationId, conversationId)];
      
      if (beforeMessageId) {
        whereConditions.push(sql`${messages.id} < ${parseInt(beforeMessageId)}`);
      }

      // Get messages with sender information
      const conversationMessages = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          receiverId: messages.receiverId,
          parentMessageId: messages.parentMessageId,
          subject: messages.subject,
          content: messages.content,
          messageType: messages.messageType,
          attachments: messages.attachments,
          isRead: messages.isRead,
          isEdited: messages.isEdited,
          isDeleted: messages.isDeleted,
          sentAt: messages.sentAt,
          editedAt: messages.editedAt,
          senderName: users.username,
          senderFirstName: users.firstName,
          senderLastName: users.lastName,
          senderUserType: users.userType,
          senderCompanyName: users.companyName,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(and(...whereConditions))
        .orderBy(desc(messages.sentAt))
        .limit(limit)
        .offset(offset);

      // Get read receipts for messages
      const messageIds = conversationMessages.map(m => m.id);
      const readReceipts = messageIds.length > 0 ? await db
        .select({
          messageId: messageReadReceipts.messageId,
          userId: messageReadReceipts.userId,
          deliveredAt: messageReadReceipts.deliveredAt,
          readAt: messageReadReceipts.readAt,
          userName: users.username,
        })
        .from(messageReadReceipts)
        .innerJoin(users, eq(messageReadReceipts.userId, users.id))
        .where(sql`${messageReadReceipts.messageId} IN (${messageIds.join(',')})`) : [];

      // Format messages with read receipts
      const formattedMessages = conversationMessages.map(msg => ({
        id: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        parentMessageId: msg.parentMessageId,
        subject: msg.subject,
        content: msg.content,
        messageType: msg.messageType,
        attachments: msg.attachments,
        isRead: msg.isRead,
        isEdited: msg.isEdited,
        isDeleted: msg.isDeleted,
        sentAt: msg.sentAt,
        editedAt: msg.editedAt,
        sender: {
          id: msg.senderId,
          name: msg.senderCompanyName || `${msg.senderFirstName} ${msg.senderLastName}`.trim() || msg.senderName,
          username: msg.senderName,
          userType: msg.senderUserType,
        },
        readReceipts: readReceipts
          .filter(r => r.messageId === msg.id)
          .map(r => ({
            userId: r.userId,
            userName: r.userName,
            deliveredAt: r.deliveredAt,
            readAt: r.readAt,
          })),
      })).reverse(); // Reverse to show oldest first

      // Mark messages as read for current user (only if they're the receiver)
      const unreadMessageIds = conversationMessages
        .filter(msg => msg.receiverId === user.id && !msg.isRead)
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        // Update messages as read
        await db
          .update(messages)
          .set({ isRead: true, readAt: new Date() })
          .where(sql`${messages.id} IN (${unreadMessageIds.join(',')})`);

        // Create/update read receipts
        const existingReceipts = await db
          .select({ messageId: messageReadReceipts.messageId })
          .from(messageReadReceipts)
          .where(
            and(
              sql`${messageReadReceipts.messageId} IN (${unreadMessageIds.join(',')})`,
              eq(messageReadReceipts.userId, user.id)
            )
          );

        const existingMessageIds = new Set(existingReceipts.map(r => r.messageId));
        const newReceiptMessageIds = unreadMessageIds.filter(id => !existingMessageIds.has(id));

        if (newReceiptMessageIds.length > 0) {
          await db.insert(messageReadReceipts).values(
            newReceiptMessageIds.map(messageId => ({
              messageId,
              userId: user.id,
              deliveredAt: new Date(),
              readAt: new Date(),
            }))
          );
        } else {
          // Update existing receipts
          await db
            .update(messageReadReceipts)
            .set({ readAt: new Date() })
            .where(
              and(
                sql`${messageReadReceipts.messageId} IN (${unreadMessageIds.join(',')})`,
                eq(messageReadReceipts.userId, user.id)
              )
            );
        }
      }

      return new Response(JSON.stringify({
        success: true,
        messages: formattedMessages,
        pagination: {
          limit,
          offset,
          hasMore: conversationMessages.length === limit,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};