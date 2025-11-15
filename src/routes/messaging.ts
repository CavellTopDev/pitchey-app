/**
 * Messaging and Communications Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { conversations, messages, notifications, users, infoRequests } from "../db/schema.ts";
import { eq, and, sql, desc, count, or, asc } from "npm:drizzle-orm@0.35.3";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { validateEnvironment } from "../utils/env-validation.ts";

const envConfig = validateEnvironment();
const JWT_SECRET = envConfig.JWT_SECRET;

// Middleware to extract user from JWT token
async function getUserFromToken(request: Request): Promise<any> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No token provided");
  }

  const token = authHeader.slice(7);
  const payload = await verify(
    token,
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
  );

  return payload;
}

// Get user's conversations
export const getUserConversations: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const conversationsList = await db
      .select({
        id: conversations.id,
        participant1_id: conversations.participant1Id,
        participant2_id: conversations.participant2Id,
        participant1_name: sql<string>`p1.first_name`,
        participant2_name: sql<string>`p2.first_name`,
        participant1_type: sql<string>`p1.user_type`,
        participant2_type: sql<string>`p2.user_type`,
        last_message: conversations.lastMessage,
        last_message_at: conversations.lastMessageAt,
        unread_count: conversations.unreadCount,
        created_at: conversations.createdAt,
      })
      .from(conversations)
      .leftJoin(
        sql`users p1`,
        sql`p1.id = ${conversations.participant1Id}`
      )
      .leftJoin(
        sql`users p2`, 
        sql`p2.id = ${conversations.participant2Id}`
      )
      .where(
        or(
          eq(conversations.participant1Id, user.userId),
          eq(conversations.participant2Id, user.userId)
        )
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        or(
          eq(conversations.participant1Id, user.userId),
          eq(conversations.participant2Id, user.userId)
        )
      );

    const total = totalResult[0]?.count || 0;

    return successResponse({
      conversations: conversationsList,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get user conversations error", error);
    return errorResponse("Failed to fetch conversations", 500);
  }
};

// Get conversation messages
export const getConversationMessages: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const conversationId = params?.id;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    if (!conversationId) {
      return errorResponse("Conversation ID is required", 400);
    }

    // Verify user is part of this conversation
    const conversationCheck = await db
      .select({
        participant1Id: conversations.participant1Id,
        participant2Id: conversations.participant2Id,
      })
      .from(conversations)
      .where(eq(conversations.id, parseInt(conversationId)));

    if (conversationCheck.length === 0) {
      return errorResponse("Conversation not found", 404);
    }

    const conversation = conversationCheck[0];
    if (conversation.participant1Id !== user.userId && conversation.participant2Id !== user.userId) {
      return errorResponse("Access denied - not a participant in this conversation", 403);
    }

    // Get messages
    const messagesList = await db
      .select({
        id: messages.id,
        content: messages.content,
        sender_id: messages.senderId,
        sender_name: users.firstName,
        sender_type: users.userType,
        message_type: messages.messageType,
        read: messages.read,
        created_at: messages.createdAt,
        metadata: messages.metadata,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, parseInt(conversationId)))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Mark messages as read for this user
    await db
      .update(messages)
      .set({ read: true })
      .where(
        and(
          eq(messages.conversationId, parseInt(conversationId)),
          eq(messages.read, false),
          sql`${messages.senderId} != ${user.userId}`
        )
      );

    // Update conversation unread count
    const otherParticipantId = conversation.participant1Id === user.userId 
      ? conversation.participant2Id 
      : conversation.participant1Id;
    
    await db
      .update(conversations)
      .set({ unreadCount: 0 })
      .where(eq(conversations.id, parseInt(conversationId)));

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, parseInt(conversationId)));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      messages: messagesList.reverse(), // Return in chronological order
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get conversation messages error", error);
    return errorResponse("Failed to fetch messages", 500);
  }
};

// Send message
export const sendMessage: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { conversationId, content, messageType = "text", metadata } = await request.json();

    if (!conversationId || !content?.trim()) {
      return errorResponse("Conversation ID and message content are required", 400);
    }

    // Verify user is part of this conversation
    const conversationCheck = await db
      .select({
        participant1Id: conversations.participant1Id,
        participant2Id: conversations.participant2Id,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (conversationCheck.length === 0) {
      return errorResponse("Conversation not found", 404);
    }

    const conversation = conversationCheck[0];
    if (conversation.participant1Id !== user.userId && conversation.participant2Id !== user.userId) {
      return errorResponse("Access denied - not a participant in this conversation", 403);
    }

    // Create message
    const newMessage = await db
      .insert(messages)
      .values({
        conversationId,
        senderId: user.userId,
        content: content.trim(),
        messageType,
        metadata: metadata ? JSON.stringify(metadata) : null,
        read: false,
        createdAt: new Date(),
      })
      .returning();

    // Update conversation with last message info
    await db
      .update(conversations)
      .set({
        lastMessage: content.trim(),
        lastMessageAt: new Date(),
        unreadCount: sql`${conversations.unreadCount} + 1`,
      })
      .where(eq(conversations.id, conversationId));

    // Create notification for the other participant
    const otherParticipantId = conversation.participant1Id === user.userId 
      ? conversation.participant2Id 
      : conversation.participant1Id;

    const senderInfo = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, user.userId));

    if (senderInfo.length > 0) {
      await db
        .insert(notifications)
        .values({
          userId: otherParticipantId,
          type: "message",
          title: "New Message",
          message: `${senderInfo[0].firstName} sent you a message`,
          read: false,
          data: JSON.stringify({ 
            conversationId, 
            messageId: newMessage[0].id 
          }),
          createdAt: new Date(),
        });
    }

    telemetry.logger.info("Message sent", { 
      messageId: newMessage[0].id,
      conversationId,
      senderId: user.userId 
    });

    return successResponse({
      message: newMessage[0],
      success: "Message sent successfully"
    });

  } catch (error) {
    telemetry.logger.error("Send message error", error);
    return errorResponse("Failed to send message", 500);
  }
};

// Start conversation
export const startConversation: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { participantId, initialMessage } = await request.json();

    if (!participantId) {
      return errorResponse("Participant ID is required", 400);
    }

    if (participantId === user.userId) {
      return errorResponse("Cannot start conversation with yourself", 400);
    }

    // Check if participant exists
    const participantCheck = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, participantId));

    if (participantCheck.length === 0) {
      return errorResponse("Participant not found", 404);
    }

    // Check if conversation already exists
    const existingConversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        or(
          and(
            eq(conversations.participant1Id, user.userId),
            eq(conversations.participant2Id, participantId)
          ),
          and(
            eq(conversations.participant1Id, participantId),
            eq(conversations.participant2Id, user.userId)
          )
        )
      );

    let conversationId;

    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id;
    } else {
      // Create new conversation
      const newConversation = await db
        .insert(conversations)
        .values({
          participant1Id: user.userId,
          participant2Id: participantId,
          lastMessage: initialMessage || "",
          lastMessageAt: new Date(),
          unreadCount: 0,
          createdAt: new Date(),
        })
        .returning();

      conversationId = newConversation[0].id;
    }

    // Send initial message if provided
    if (initialMessage?.trim()) {
      await db
        .insert(messages)
        .values({
          conversationId,
          senderId: user.userId,
          content: initialMessage.trim(),
          messageType: "text",
          read: false,
          createdAt: new Date(),
        });

      // Update conversation with message info
      await db
        .update(conversations)
        .set({
          lastMessage: initialMessage.trim(),
          lastMessageAt: new Date(),
          unreadCount: 1,
        })
        .where(eq(conversations.id, conversationId));
    }

    telemetry.logger.info("Conversation started", { 
      conversationId,
      participant1Id: user.userId,
      participant2Id: participantId
    });

    return successResponse({
      conversationId,
      message: "Conversation started successfully"
    });

  } catch (error) {
    telemetry.logger.error("Start conversation error", error);
    return errorResponse("Failed to start conversation", 500);
  }
};

// Get user notifications
export const getUserNotifications: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unread") === "true";

    let whereConditions = [eq(notifications.userId, user.userId)];

    if (unreadOnly) {
      whereConditions.push(eq(notifications.read, false));
    }

    const notificationsList = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        read: notifications.read,
        data: notifications.data,
        created_at: notifications.createdAt,
        read_at: notifications.readAt,
      })
      .from(notifications)
      .where(and(...whereConditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get unread count
    const unreadResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.userId),
          eq(notifications.read, false)
        )
      );

    const unreadCount = unreadResult[0]?.count || 0;

    return successResponse({
      notifications: notificationsList,
      unread_count: unreadCount,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get user notifications error", error);
    return errorResponse("Failed to fetch notifications", 500);
  }
};

// Mark notification as read
export const markNotificationRead: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const notificationId = params?.id;

    if (!notificationId) {
      return errorResponse("Notification ID is required", 400);
    }

    const updated = await db
      .update(notifications)
      .set({ 
        read: true, 
        readAt: new Date() 
      })
      .where(
        and(
          eq(notifications.id, parseInt(notificationId)),
          eq(notifications.userId, user.userId)
        )
      )
      .returning();

    if (updated.length === 0) {
      return errorResponse("Notification not found", 404);
    }

    return successResponse({
      message: "Notification marked as read"
    });

  } catch (error) {
    telemetry.logger.error("Mark notification read error", error);
    return errorResponse("Failed to mark notification as read", 500);
  }
};

// Mark all notifications as read
export const markAllNotificationsRead: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    const updated = await db
      .update(notifications)
      .set({ 
        read: true, 
        readAt: new Date() 
      })
      .where(
        and(
          eq(notifications.userId, user.userId),
          eq(notifications.read, false)
        )
      )
      .returning();

    return successResponse({
      updated_count: updated.length,
      message: "All notifications marked as read"
    });

  } catch (error) {
    telemetry.logger.error("Mark all notifications read error", error);
    return errorResponse("Failed to mark all notifications as read", 500);
  }
};

// Get information requests
export const getInfoRequests: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const type = url.searchParams.get("type"); // 'incoming' or 'outgoing'

    let whereConditions = [];

    if (type === "incoming") {
      whereConditions.push(eq(infoRequests.recipientId, user.userId));
    } else if (type === "outgoing") {
      whereConditions.push(eq(infoRequests.requesterId, user.userId));
    } else {
      // Show both incoming and outgoing
      whereConditions.push(
        or(
          eq(infoRequests.recipientId, user.userId),
          eq(infoRequests.requesterId, user.userId)
        )
      );
    }

    const requestsList = await db
      .select({
        id: infoRequests.id,
        type: infoRequests.type,
        status: infoRequests.status,
        message: infoRequests.message,
        requester_id: infoRequests.requesterId,
        recipient_id: infoRequests.recipientId,
        requester_name: sql<string>`req.first_name`,
        recipient_name: sql<string>`rec.first_name`,
        created_at: infoRequests.createdAt,
        responded_at: infoRequests.respondedAt,
      })
      .from(infoRequests)
      .leftJoin(
        sql`users req`,
        sql`req.id = ${infoRequests.requesterId}`
      )
      .leftJoin(
        sql`users rec`,
        sql`rec.id = ${infoRequests.recipientId}`
      )
      .where(and(...whereConditions))
      .orderBy(desc(infoRequests.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(infoRequests)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      info_requests: requestsList,
      filters: { type },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get info requests error", error);
    return errorResponse("Failed to fetch information requests", 500);
  }
};

// Send information request
export const sendInfoRequest: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { recipientId, type, message } = await request.json();

    if (!recipientId || !type || !message?.trim()) {
      return errorResponse("Recipient ID, type, and message are required", 400);
    }

    // Check if recipient exists
    const recipientCheck = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, recipientId));

    if (recipientCheck.length === 0) {
      return errorResponse("Recipient not found", 404);
    }

    // Create info request
    const newRequest = await db
      .insert(infoRequests)
      .values({
        requesterId: user.userId,
        recipientId,
        type,
        message: message.trim(),
        status: "pending",
        createdAt: new Date(),
      })
      .returning();

    // Create notification for recipient
    const requesterInfo = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, user.userId));

    if (requesterInfo.length > 0) {
      await db
        .insert(notifications)
        .values({
          userId: recipientId,
          type: "info_request",
          title: "Information Request",
          message: `${requesterInfo[0].firstName} sent you an information request`,
          read: false,
          data: JSON.stringify({ 
            infoRequestId: newRequest[0].id,
            type
          }),
          createdAt: new Date(),
        });
    }

    telemetry.logger.info("Information request sent", { 
      requestId: newRequest[0].id,
      requesterId: user.userId,
      recipientId,
      type
    });

    return successResponse({
      info_request: newRequest[0],
      message: "Information request sent successfully"
    });

  } catch (error) {
    telemetry.logger.error("Send info request error", error);
    return errorResponse("Failed to send information request", 500);
  }
};