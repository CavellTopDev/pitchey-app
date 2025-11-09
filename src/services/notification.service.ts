import { db } from "../db/client.ts";
import { notifications, users, pitches } from "../db/schema.ts";
import { eq, and, desc, isNull } from "npm:drizzle-orm@0.35.3";
import { nativeRedisService } from "./redis-native.service.ts";

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export interface CreateNotificationData {
  userId: number;
  type: "message" | "investment" | "follow" | "pitch_update" | "nda_request" | "system" | "pitch_view" | "like" | "nda_approved" | "nda_rejected";
  title: string;
  message?: string;
  metadata?: Record<string, any>;
  relatedId?: number;
  relatedPitchId?: number;
  relatedUserId?: number;
  actionUrl?: string;
}

// Global reference to WebSocket service (set during initialization)
let wsService: any = null;

export class NotificationService {
  private static get redis() { return nativeRedisService; }

  // Initialize with WebSocket service
  static initialize(webSocketService: any) {
    wsService = webSocketService;
    console.log("✅ NotificationService initialized with WebSocket support");
  }

  // Create a new notification with real-time delivery
  static async create(data: CreateNotificationData) {
    try {
      // 1. Store in PostgreSQL
      const [notification] = await db.insert(notifications)
        .values({
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          relatedPitchId: data.relatedPitchId,
          relatedUserId: data.relatedUserId,
          isRead: false,
          createdAt: new Date(),
        })
        .returning();

      // 2. Cache in Redis (last 50 notifications per user)
      await this.cacheNotification(data.userId, {
        ...notification,
        metadata: data.metadata,
        actionUrl: data.actionUrl,
      });

      // 3. Send real-time via WebSocket
      if (wsService) {
        try {
          await wsService.sendNotificationToUser(data.userId, {
            type: 'notification',
            data: {
              id: notification.id,
              type: data.type,
              title: data.title,
              message: data.message,
              relatedPitchId: data.relatedPitchId,
              relatedUserId: data.relatedUserId,
              actionUrl: data.actionUrl,
              metadata: data.metadata,
              createdAt: notification.createdAt,
              isRead: false,
            },
          });
          console.log(`🔔 Real-time notification sent to user ${data.userId}: ${data.title}`);
        } catch (wsError) {
          console.error("❌ WebSocket notification failed:", wsError);
        }
      }

      // 4. Update unread count cache
      await this.invalidateUnreadCountCache(data.userId);

      console.log(`✅ Notification created for user ${data.userId}: ${data.title}`);
      return { success: true, notification };
    } catch (error) {
      console.error("❌ Error creating notification:", error);
      const errorMessage = getErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  // Get notifications for a user (Redis first, DB fallback)
  static async getUserNotifications(userId: number, limit = 50, onlyUnread = false) {
    try {
      // Try Redis cache first for recent notifications
      if (!onlyUnread) {
        const cacheKey = `user:${userId}:notifications`;
        const cached = await (this.redis.lrange ? this.redis.lrange(cacheKey, 0, limit - 1) : []);
        
        if (cached.length > 0) {
          const parsed = cached.map((n: string) => JSON.parse(n)).slice(0, limit);
          console.log(`📋 Retrieved ${parsed.length} notifications from cache for user ${userId}`);
          return {
            success: true,
            notifications: parsed,
          };
        }
      }

      // Fallback to database
      const conditions = [eq(notifications.userId, userId)];
      
      if (onlyUnread) {
        conditions.push(eq(notifications.isRead, false));
      }

      // Query notifications without relations since relatedUser and relatedPitch don't exist
      const userNotifications = await db.select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      // Cache the result if it's the full recent list
      if (!onlyUnread && userNotifications.length > 0) {
        await this.cacheNotifications(userId, userNotifications);
      }

      console.log(`📋 Retrieved ${userNotifications.length} notifications from DB for user ${userId}`);
      return {
        success: true,
        notifications: userNotifications,
      };
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
      const errorMessage = getErrorMessage(error);
      return { success: false, error: errorMessage, notifications: [] };
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
        unread: allNotifications.filter((n: any) => !n.isRead).length,
        messages: allNotifications.filter((n: any) => n.type === "message" && !n.isRead).length,
        investments: allNotifications.filter((n: any) => n.type === "investment" && !n.isRead).length,
        follows: allNotifications.filter((n: any) => n.type === "follow" && !n.isRead).length,
        updates: allNotifications.filter((n: any) => n.type === "pitch_update" && !n.isRead).length,
        ndas: allNotifications.filter((n: any) => n.type === "nda_request" && !n.isRead).length,
        system: allNotifications.filter((n: any) => n.type === "system" && !n.isRead).length,
      };

      return {
        success: true,
        counts,
      };
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      return {
        success: false,
        error: getErrorMessage(error),
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
      return { success: false, error: getErrorMessage(error) };
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
      return { success: false, error: getErrorMessage(error) };
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
      return { success: false, error: getErrorMessage(error) };
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
      relatedPitchId: pitchId,
      relatedUserId: requesterId,
      actionUrl: `/creator/nda-requests`,
    });
  }

  // Notify pitch view
  static async notifyPitchView(pitchId: number, viewerId: number, pitchOwnerId: number) {
    if (viewerId === pitchOwnerId) return; // Don't notify self-views
    
    const [viewer, pitch] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, viewerId),
        columns: { username: true, firstName: true, lastName: true },
      }),
      db.query.pitches.findFirst({
        where: eq(pitches.id, pitchId),
        columns: { title: true },
      }),
    ]);

    if (!viewer || !pitch) return;

    const viewerName = viewer.firstName 
      ? `${viewer.firstName} ${viewer.lastName}` 
      : viewer.username;

    return this.create({
      userId: pitchOwnerId,
      type: "pitch_view",
      title: "New pitch view",
      message: `${viewerName} viewed your pitch "${pitch.title}"`,
      relatedPitchId: pitchId,
      relatedUserId: viewerId,
      actionUrl: `/pitches/${pitchId}/analytics`,
      metadata: {
        pitchTitle: pitch.title,
        viewerName,
      },
    });
  }

  // Redis caching methods
  private static async cacheNotification(userId: number, notification: any): Promise<void> {
    try {
      const cacheKey = `user:${userId}:notifications`;
      await this.redis.lpush(cacheKey, JSON.stringify(notification));
      await this.redis.ltrim(cacheKey, 0, 49); // Keep last 50
      await this.redis.expire(cacheKey, 7 * 24 * 60 * 60); // 7 days
    } catch (error) {
      console.error("❌ Failed to cache notification:", error);
    }
  }

  private static async cacheNotifications(userId: number, notifications: any[]): Promise<void> {
    try {
      const cacheKey = `user:${userId}:notifications`;
      const serialized = notifications.map(n => JSON.stringify(n));
      
      if (serialized.length > 0) {
        await this.redis.del(cacheKey); // Clear existing
        await this.redis.lpush(cacheKey, ...serialized);
        await this.redis.ltrim(cacheKey, 0, 49);
        await this.redis.expire(cacheKey, 7 * 24 * 60 * 60);
      }
    } catch (error) {
      console.error("❌ Failed to cache notifications:", error);
    }
  }

  private static async invalidateUnreadCountCache(userId: number): Promise<void> {
    try {
      const unreadCountKey = `user:${userId}:unread_count`;
      await this.redis.del(unreadCountKey);
    } catch (error) {
      console.error("❌ Failed to invalidate unread count cache:", error);
    }
  }

  // Get unread count with Redis caching
  static async getUnreadCount(userId: number): Promise<number> {
    try {
      const cacheKey = `user:${userId}:unread_count`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached !== null) {
        return parseInt(cached);
      }

      // Query database
      const result = await db.query.notifications.findMany({
        where: and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ),
        columns: { id: true },
      });

      const count = result.length;

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, count.toString());

      return count;
    } catch (error) {
      console.error("❌ Failed to get unread count:", error);
      return 0;
    }
  }
}