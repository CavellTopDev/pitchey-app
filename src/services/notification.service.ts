import { db } from "../db/client.ts";
import { notifications, users } from "../db/schema.ts";
import { eq, and, desc, isNull } from "npm:drizzle-orm";

export interface CreateNotificationData {
  userId: number;
  type: "message" | "investment" | "follow" | "pitch_update" | "nda_request" | "system";
  title: string;
  message?: string;
  metadata?: Record<string, any>;
  relatedId?: number;
}

export class NotificationService {
  // Create a new notification
  static async create(data: CreateNotificationData) {
    try {
      const [notification] = await db.insert(notifications)
        .values({
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          metadata: data.metadata || {},
          relatedId: data.relatedId,
          isRead: false,
          createdAt: new Date(),
        })
        .returning();

      // TODO: Send real-time notification via WebSocket if user is online
      // TODO: Send email notification if user has email notifications enabled

      return { success: true, notification };
    } catch (error) {
      console.error("Error creating notification:", error);
      return { success: false, error: error.message };
    }
  }

  // Get notifications for a user
  static async getUserNotifications(userId: number, limit = 50, onlyUnread = false) {
    try {
      const conditions = [eq(notifications.userId, userId)];
      
      if (onlyUnread) {
        conditions.push(eq(notifications.isRead, false));
      }

      const userNotifications = await db.query.notifications.findMany({
        where: and(...conditions),
        orderBy: [desc(notifications.createdAt)],
        limit,
      });

      return {
        success: true,
        notifications: userNotifications,
      };
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return { success: false, error: error.message, notifications: [] };
    }
  }

  // Get notification counts
  static async getNotificationCounts(userId: number) {
    try {
      const allNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        columns: {
          type: true,
          isRead: true,
        },
      });

      const counts = {
        total: allNotifications.length,
        unread: allNotifications.filter(n => !n.isRead).length,
        messages: allNotifications.filter(n => n.type === "message" && !n.isRead).length,
        investments: allNotifications.filter(n => n.type === "investment" && !n.isRead).length,
        follows: allNotifications.filter(n => n.type === "follow" && !n.isRead).length,
        updates: allNotifications.filter(n => n.type === "pitch_update" && !n.isRead).length,
        ndas: allNotifications.filter(n => n.type === "nda_request" && !n.isRead).length,
        system: allNotifications.filter(n => n.type === "system" && !n.isRead).length,
      };

      return {
        success: true,
        counts,
      };
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      return {
        success: false,
        error: error.message,
        counts: {
          total: 0,
          unread: 0,
          messages: 0,
          investments: 0,
          follows: 0,
          updates: 0,
          ndas: 0,
          system: 0,
        },
      };
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: number, userId: number) {
    try {
      const [updated] = await db.update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ))
        .returning();

      return { success: true, notification: updated };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return { success: false, error: error.message };
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: number) {
    try {
      await db.update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));

      return { success: true };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return { success: false, error: error.message };
    }
  }

  // Delete a notification
  static async delete(notificationId: number, userId: number) {
    try {
      await db.delete(notifications)
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ));

      return { success: true };
    } catch (error) {
      console.error("Error deleting notification:", error);
      return { success: false, error: error.message };
    }
  }

  // Create specific notification types
  static async notifyNewMessage(receiverId: number, senderId: number, messagePreview: string) {
    const sender = await db.query.users.findFirst({
      where: eq(users.id, senderId),
      columns: {
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    const senderName = sender?.firstName && sender?.lastName 
      ? `${sender.firstName} ${sender.lastName}`
      : sender?.username || "Someone";

    return this.create({
      userId: receiverId,
      type: "message",
      title: `New message from ${senderName}`,
      message: messagePreview.substring(0, 100),
      metadata: { senderId },
      relatedId: senderId,
    });
  }

  static async notifyNewInvestment(creatorId: number, investorId: number, pitchId: number, amount: number) {
    const investor = await db.query.users.findFirst({
      where: eq(users.id, investorId),
      columns: {
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    const investorName = investor?.firstName && investor?.lastName 
      ? `${investor.firstName} ${investor.lastName}`
      : investor?.username || "An investor";

    return this.create({
      userId: creatorId,
      type: "investment",
      title: `New investment from ${investorName}`,
      message: `$${amount.toLocaleString()} invested in your pitch`,
      metadata: { investorId, pitchId, amount },
      relatedId: pitchId,
    });
  }

  static async notifyNewFollower(userId: number, followerId: number) {
    const follower = await db.query.users.findFirst({
      where: eq(users.id, followerId),
      columns: {
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    const followerName = follower?.firstName && follower?.lastName 
      ? `${follower.firstName} ${follower.lastName}`
      : follower?.username || "Someone";

    return this.create({
      userId,
      type: "follow",
      title: `${followerName} started following you`,
      metadata: { followerId },
      relatedId: followerId,
    });
  }

  static async notifyPitchUpdate(followerId: number, pitchId: number, updateTitle: string) {
    return this.create({
      userId: followerId,
      type: "pitch_update",
      title: updateTitle,
      message: "A pitch you're following has been updated",
      metadata: { pitchId },
      relatedId: pitchId,
    });
  }

  static async notifyNDARequest(creatorId: number, requesterId: number, pitchId: number) {
    const requester = await db.query.users.findFirst({
      where: eq(users.id, requesterId),
      columns: {
        username: true,
        firstName: true,
        lastName: true,
        userType: true,
      },
    });

    const requesterName = requester?.firstName && requester?.lastName 
      ? `${requester.firstName} ${requester.lastName}`
      : requester?.username || "Someone";

    return this.create({
      userId: creatorId,
      type: "nda_request",
      title: `NDA request from ${requesterName}`,
      message: `${requesterName} (${requester?.userType}) wants to view your protected content`,
      metadata: { requesterId, pitchId },
      relatedId: pitchId,
    });
  }
}