import { db } from "../src/db/client.ts";
import { notifications, users, pitches } from "../src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";

// WebSocket connections store
const wsConnections = new Map<number, WebSocket>();

// Store WebSocket connection for a user
export function setWebSocketConnection(userId: number, ws: WebSocket) {
  wsConnections.set(userId, ws);
}

// Remove WebSocket connection for a user
export function removeWebSocketConnection(userId: number) {
  wsConnections.delete(userId);
}

// Get WebSocket connection for a user
export function getWebSocketConnection(userId: number): WebSocket | undefined {
  return wsConnections.get(userId);
}

// Broadcast message to specific user via WebSocket
export async function broadcastToUser(userId: number, message: any) {
  const ws = wsConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send WebSocket message to user ${userId}:`, error);
      wsConnections.delete(userId);
      return false;
    }
  }
  return false;
}

// Broadcast message to multiple users
export async function broadcastToUsers(userIds: number[], message: any) {
  const results = await Promise.allSettled(
    userIds.map(userId => broadcastToUser(userId, message))
  );
  return results.map((result, index) => ({
    userId: userIds[index],
    success: result.status === 'fulfilled' && result.value === true
  }));
}

// Broadcast message for real-time messaging
export async function broadcastMessage(messageData: any) {
  // Broadcast to receiver
  if (messageData.receiverId) {
    await broadcastToUser(messageData.receiverId, messageData);
  }
  
  // If it's a conversation message, broadcast to all participants
  if (messageData.conversationId) {
    // This would require getting all conversation participants
    // For now, we'll just broadcast to the receiver
  }
}

interface NotificationData {
  userId: number;
  type: 'nda_request' | 'nda_approved' | 'nda_rejected' | 'message' | 'follow' | 'off_platform_approved';
  title: string;
  message: string;
  relatedPitchId?: number;
  relatedUserId?: number;
  relatedNdaRequestId?: number;
  actionUrl?: string;
}

export async function createNotification(data: NotificationData) {
  try {
    await db.insert(notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      relatedPitchId: data.relatedPitchId || null,
      relatedUserId: data.relatedUserId || null,
      relatedNdaRequestId: data.relatedNdaRequestId || null,
      actionUrl: data.actionUrl || null,
      isRead: false,
      createdAt: new Date(),
    });
    return true;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return false;
  }
}

export async function notifyNDARequest(
  requestId: number,
  pitchId: number,
  requesterId: number,
  ownerId: number
) {
  try {
    // Get requester and pitch details
    const [requester, pitch] = await Promise.all([
      db.select({
        username: users.username,
        companyName: users.companyName,
      }).from(users).where(eq(users.id, requesterId)).limit(1),
      
      db.select({
        title: pitches.title,
      }).from(pitches).where(eq(pitches.id, pitchId)).limit(1),
    ]);

    if (requester.length && pitch.length) {
      const requesterName = requester[0].companyName || requester[0].username;
      await createNotification({
        userId: ownerId,
        type: 'nda_request',
        title: 'New NDA Request',
        message: `${requesterName} has requested NDA access to "${pitch[0].title}"`,
        relatedPitchId: pitchId,
        relatedUserId: requesterId,
        relatedNdaRequestId: requestId,
        actionUrl: `/production/dashboard#ndas`,
      });
    }
  } catch (error) {
    console.error("Failed to notify NDA request:", error);
  }
}

export async function notifyNDAApproval(
  requestId: number,
  pitchId: number,
  requesterId: number,
  ownerId: number
) {
  try {
    // Get owner and pitch details
    const [owner, pitch] = await Promise.all([
      db.select({
        username: users.username,
        companyName: users.companyName,
      }).from(users).where(eq(users.id, ownerId)).limit(1),
      
      db.select({
        title: pitches.title,
      }).from(pitches).where(eq(pitches.id, pitchId)).limit(1),
    ]);

    if (owner.length && pitch.length) {
      const ownerName = owner[0].companyName || owner[0].username;
      await createNotification({
        userId: requesterId,
        type: 'nda_approved',
        title: 'NDA Request Approved',
        message: `${ownerName} has approved your NDA request for "${pitch[0].title}". You now have access to protected content.`,
        relatedPitchId: pitchId,
        relatedUserId: ownerId,
        relatedNdaRequestId: requestId,
        actionUrl: `/pitch/${pitchId}`,
      });
    }
  } catch (error) {
    console.error("Failed to notify NDA approval:", error);
  }
}

export async function notifyNDARejection(
  requestId: number,
  pitchId: number,
  requesterId: number,
  ownerId: number,
  reason?: string
) {
  try {
    // Get owner and pitch details
    const [owner, pitch] = await Promise.all([
      db.select({
        username: users.username,
        companyName: users.companyName,
      }).from(users).where(eq(users.id, ownerId)).limit(1),
      
      db.select({
        title: pitches.title,
      }).from(pitches).where(eq(pitches.id, pitchId)).limit(1),
    ]);

    if (owner.length && pitch.length) {
      const ownerName = owner[0].companyName || owner[0].username;
      const rejectionMessage = reason 
        ? `${ownerName} has declined your NDA request for "${pitch[0].title}". Reason: ${reason}`
        : `${ownerName} has declined your NDA request for "${pitch[0].title}".`;
      
      await createNotification({
        userId: requesterId,
        type: 'nda_rejected',
        title: 'NDA Request Declined',
        message: rejectionMessage,
        relatedPitchId: pitchId,
        relatedUserId: ownerId,
        relatedNdaRequestId: requestId,
        actionUrl: `/production/dashboard#ndas`,
      });
    }
  } catch (error) {
    console.error("Failed to notify NDA rejection:", error);
  }
}

export async function notifyNewMessage(
  senderId: number,
  receiverId: number,
  pitchId: number,
  subject?: string
) {
  try {
    // Get sender and pitch details
    const [sender, pitch] = await Promise.all([
      db.select({
        username: users.username,
        companyName: users.companyName,
      }).from(users).where(eq(users.id, senderId)).limit(1),
      
      db.select({
        title: pitches.title,
      }).from(pitches).where(eq(pitches.id, pitchId)).limit(1),
    ]);

    if (sender.length && pitch.length) {
      const senderName = sender[0].companyName || sender[0].username;
      const messageTitle = subject || 'New Message';
      
      await createNotification({
        userId: receiverId,
        type: 'message',
        title: messageTitle,
        message: `${senderName} sent you a message about "${pitch[0].title}"`,
        relatedPitchId: pitchId,
        relatedUserId: senderId,
        actionUrl: `/messages`,
      });
    }
  } catch (error) {
    console.error("Failed to notify new message:", error);
  }
}

export async function notifyOffPlatformApproval(
  senderId: number,
  receiverId: number,
  pitchId: number
) {
  try {
    // Get approver and pitch details
    const [approver, pitch] = await Promise.all([
      db.select({
        username: users.username,
        companyName: users.companyName,
      }).from(users).where(eq(users.id, senderId)).limit(1),
      
      db.select({
        title: pitches.title,
      }).from(pitches).where(eq(pitches.id, pitchId)).limit(1),
    ]);

    if (approver.length && pitch.length) {
      const approverName = approver[0].companyName || approver[0].username;
      
      await createNotification({
        userId: receiverId,
        type: 'off_platform_approved',
        title: 'Off-Platform Communication Approved',
        message: `${approverName} has approved off-platform communication for "${pitch[0].title}". Check your messages for contact details.`,
        relatedPitchId: pitchId,
        relatedUserId: senderId,
        actionUrl: `/messages`,
      });
    }
  } catch (error) {
    console.error("Failed to notify off-platform approval:", error);
  }
}