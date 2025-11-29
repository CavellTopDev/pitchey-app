/**
 * Notification Triggers Service
 * Handles automatic notification creation based on user actions
 */

import { notificationService } from "./notification.service";
import { db } from "../db/db";
import { users, pitches, ndaRequests, investments, follows } from "../db/schema";
import { eq } from "drizzle-orm";

export class NotificationTriggersService {
  private static instance: NotificationTriggersService;
  
  private constructor() {}
  
  static getInstance(): NotificationTriggersService {
    if (!NotificationTriggersService.instance) {
      NotificationTriggersService.instance = new NotificationTriggersService();
    }
    return NotificationTriggersService.instance;
  }
  
  /**
   * Trigger when a pitch is viewed
   */
  async onPitchViewed(pitchId: number, viewerId: number) {
    try {
      // Get pitch and viewer details
      const [pitch] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);
      const [viewer] = await db.select().from(users).where(eq(users.id, viewerId)).limit(1);
      
      if (!pitch || !viewer || pitch.userId === viewerId) return;
      
      // Don't notify for every view - implement throttling
      const recentNotificationKey = `pitch_view:${pitchId}:${viewerId}`;
      if (await this.wasRecentlyNotified(recentNotificationKey, 3600000)) { // 1 hour
        return;
      }
      
      await notificationService.createNotification({
        userId: pitch.userId,
        type: "pitch_viewed",
        title: "Your pitch was viewed",
        message: `${viewer.firstName} ${viewer.lastName} viewed your pitch "${pitch.title}"`,
        metadata: {
          pitchId,
          viewerId,
          pitchTitle: pitch.title,
          viewerName: `${viewer.firstName} ${viewer.lastName}`
        },
        relatedUserId: viewerId,
        relatedPitchId: pitchId,
        actionUrl: `/pitch/${pitchId}/analytics`,
        actionText: "View analytics",
        priority: "low"
      });
      
      await this.markRecentlyNotified(recentNotificationKey);
    } catch (error) {
      console.error("Error triggering pitch view notification:", error);
    }
  }
  
  /**
   * Trigger when a pitch is liked
   */
  async onPitchLiked(pitchId: number, userId: number) {
    try {
      const [pitch] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!pitch || !user || pitch.userId === userId) return;
      
      await notificationService.createNotification({
        userId: pitch.userId,
        type: "pitch_liked",
        title: "Your pitch was liked",
        message: `${user.firstName} ${user.lastName} liked your pitch "${pitch.title}"`,
        metadata: {
          pitchId,
          likerId: userId,
          pitchTitle: pitch.title,
          likerName: `${user.firstName} ${user.lastName}`
        },
        relatedUserId: userId,
        relatedPitchId: pitchId,
        actionUrl: `/pitch/${pitchId}`,
        actionText: "View pitch",
        priority: "medium"
      });
    } catch (error) {
      console.error("Error triggering pitch like notification:", error);
    }
  }
  
  /**
   * Trigger when an NDA is requested
   */
  async onNDARequested(ndaRequestId: number) {
    try {
      const [ndaRequest] = await db
        .select({
          id: ndaRequests.id,
          pitchId: ndaRequests.pitchId,
          requesterId: ndaRequests.userId,
          pitch: {
            id: pitches.id,
            title: pitches.title,
            userId: pitches.userId
          },
          requester: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            companyName: users.companyName
          }
        })
        .from(ndaRequests)
        .innerJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .innerJoin(users, eq(ndaRequests.userId, users.id))
        .where(eq(ndaRequests.id, ndaRequestId))
        .limit(1);
      
      if (!ndaRequest) return;
      
      const requesterName = ndaRequest.requester.companyName || 
        `${ndaRequest.requester.firstName} ${ndaRequest.requester.lastName}`;
      
      await notificationService.createNotification({
        userId: ndaRequest.pitch.userId,
        type: "nda_requested",
        title: "New NDA Request",
        message: `${requesterName} requested an NDA for "${ndaRequest.pitch.title}"`,
        metadata: {
          ndaRequestId,
          pitchId: ndaRequest.pitchId,
          requesterId: ndaRequest.requesterId,
          pitchTitle: ndaRequest.pitch.title,
          requesterName
        },
        relatedUserId: ndaRequest.requesterId,
        relatedPitchId: ndaRequest.pitchId,
        relatedNdaId: ndaRequestId,
        actionUrl: `/creator/nda-requests`,
        actionText: "Review request",
        priority: "high"
      });
    } catch (error) {
      console.error("Error triggering NDA request notification:", error);
    }
  }
  
  /**
   * Trigger when an NDA is approved
   */
  async onNDAApproved(ndaRequestId: number) {
    try {
      const [ndaRequest] = await db
        .select({
          id: ndaRequests.id,
          userId: ndaRequests.userId,
          pitchId: ndaRequests.pitchId,
          pitch: {
            title: pitches.title
          }
        })
        .from(ndaRequests)
        .innerJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .where(eq(ndaRequests.id, ndaRequestId))
        .limit(1);
      
      if (!ndaRequest) return;
      
      await notificationService.createNotification({
        userId: ndaRequest.userId,
        type: "nda_approved",
        title: "NDA Approved",
        message: `Your NDA request for "${ndaRequest.pitch.title}" has been approved`,
        metadata: {
          ndaRequestId,
          pitchId: ndaRequest.pitchId,
          pitchTitle: ndaRequest.pitch.title
        },
        relatedPitchId: ndaRequest.pitchId,
        relatedNdaId: ndaRequestId,
        actionUrl: `/pitch/${ndaRequest.pitchId}`,
        actionText: "View pitch details",
        priority: "high"
      });
    } catch (error) {
      console.error("Error triggering NDA approval notification:", error);
    }
  }
  
  /**
   * Trigger when an NDA is rejected
   */
  async onNDARejected(ndaRequestId: number, reason?: string) {
    try {
      const [ndaRequest] = await db
        .select({
          id: ndaRequests.id,
          userId: ndaRequests.userId,
          pitchId: ndaRequests.pitchId,
          pitch: {
            title: pitches.title
          }
        })
        .from(ndaRequests)
        .innerJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .where(eq(ndaRequests.id, ndaRequestId))
        .limit(1);
      
      if (!ndaRequest) return;
      
      const message = reason 
        ? `Your NDA request for "${ndaRequest.pitch.title}" was rejected: ${reason}`
        : `Your NDA request for "${ndaRequest.pitch.title}" was rejected`;
      
      await notificationService.createNotification({
        userId: ndaRequest.userId,
        type: "nda_rejected",
        title: "NDA Rejected",
        message,
        metadata: {
          ndaRequestId,
          pitchId: ndaRequest.pitchId,
          pitchTitle: ndaRequest.pitch.title,
          reason
        },
        relatedPitchId: ndaRequest.pitchId,
        relatedNdaId: ndaRequestId,
        priority: "medium"
      });
    } catch (error) {
      console.error("Error triggering NDA rejection notification:", error);
    }
  }
  
  /**
   * Trigger when investment is received
   */
  async onInvestmentReceived(investmentId: number) {
    try {
      const [investment] = await db
        .select({
          id: investments.id,
          amount: investments.amount,
          pitchId: investments.pitchId,
          investorId: investments.userId,
          pitch: {
            id: pitches.id,
            title: pitches.title,
            userId: pitches.userId
          },
          investor: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            companyName: users.companyName
          }
        })
        .from(investments)
        .innerJoin(pitches, eq(investments.pitchId, pitches.id))
        .innerJoin(users, eq(investments.userId, users.id))
        .where(eq(investments.id, investmentId))
        .limit(1);
      
      if (!investment) return;
      
      const investorName = investment.investor.companyName || 
        `${investment.investor.firstName} ${investment.investor.lastName}`;
      
      await notificationService.createNotification({
        userId: investment.pitch.userId,
        type: "investment_received",
        title: "New Investment!",
        message: `${investorName} invested $${investment.amount.toLocaleString()} in "${investment.pitch.title}"`,
        metadata: {
          investmentId,
          pitchId: investment.pitchId,
          investorId: investment.investorId,
          amount: investment.amount,
          pitchTitle: investment.pitch.title,
          investorName
        },
        relatedUserId: investment.investorId,
        relatedPitchId: investment.pitchId,
        relatedInvestmentId: investmentId,
        actionUrl: `/creator/investments`,
        actionText: "View investment details",
        priority: "urgent"
      });
    } catch (error) {
      console.error("Error triggering investment notification:", error);
    }
  }
  
  /**
   * Trigger when someone follows a user
   */
  async onNewFollower(followId: number) {
    try {
      const [follow] = await db
        .select({
          id: follows.id,
          followerId: follows.followerId,
          followingId: follows.followingId,
          follower: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
            profileImageUrl: users.profileImageUrl
          }
        })
        .from(follows)
        .innerJoin(users, eq(follows.followerId, users.id))
        .where(eq(follows.id, followId))
        .limit(1);
      
      if (!follow) return;
      
      const followerName = `${follow.follower.firstName} ${follow.follower.lastName}`.trim() || 
        follow.follower.username;
      
      await notificationService.createNotification({
        userId: follow.followingId,
        type: "new_follower",
        title: "New Follower",
        message: `${followerName} started following you`,
        metadata: {
          followerId: follow.followerId,
          followerName,
          followerUsername: follow.follower.username,
          followerProfileImage: follow.follower.profileImageUrl
        },
        relatedUserId: follow.followerId,
        actionUrl: `/profile/${follow.follower.username}`,
        actionText: "View profile",
        priority: "low"
      });
    } catch (error) {
      console.error("Error triggering new follower notification:", error);
    }
  }
  
  /**
   * Trigger when a message is received
   */
  async onMessageReceived(messageId: number, senderId: number, recipientId: number, content: string) {
    try {
      const [sender] = await db.select().from(users).where(eq(users.id, senderId)).limit(1);
      
      if (!sender) return;
      
      const senderName = `${sender.firstName} ${sender.lastName}`.trim() || sender.username;
      
      await notificationService.createNotification({
        userId: recipientId,
        type: "message_received",
        title: "New Message",
        message: `${senderName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        metadata: {
          messageId,
          senderId,
          senderName,
          messagePreview: content.substring(0, 200)
        },
        relatedUserId: senderId,
        actionUrl: `/messages/${senderId}`,
        actionText: "View conversation",
        priority: "medium"
      });
    } catch (error) {
      console.error("Error triggering message notification:", error);
    }
  }
  
  /**
   * Trigger system announcement
   */
  async onSystemAnnouncement(title: string, message: string, userIds?: number[]) {
    try {
      // If no specific users, get all active users
      if (!userIds) {
        const activeUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.emailVerified, true));
        userIds = activeUsers.map(u => u.id);
      }
      
      // Create notifications for all users
      const notifications = await Promise.all(
        userIds.map(userId => 
          notificationService.createNotification({
            userId,
            type: "system_announcement",
            title,
            message,
            metadata: {
              announcementType: "general"
            },
            priority: "medium"
          })
        )
      );
      
      console.log(`System announcement sent to ${notifications.length} users`);
    } catch (error) {
      console.error("Error triggering system announcement:", error);
    }
  }
  
  /**
   * Check if a notification was recently sent (for throttling)
   */
  private async wasRecentlyNotified(key: string, ttl: number): Promise<boolean> {
    // Simple in-memory throttling (you could use Redis for production)
    const cache = (global as any).notificationThrottle || {};
    const now = Date.now();
    
    if (cache[key] && (now - cache[key]) < ttl) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Mark that a notification was recently sent
   */
  private async markRecentlyNotified(key: string): Promise<void> {
    if (!(global as any).notificationThrottle) {
      (global as any).notificationThrottle = {};
    }
    (global as any).notificationThrottle[key] = Date.now();
    
    // Clean up old entries periodically
    this.cleanupThrottleCache();
  }
  
  /**
   * Clean up old throttle cache entries
   */
  private cleanupThrottleCache(): void {
    const cache = (global as any).notificationThrottle;
    if (!cache) return;
    
    const now = Date.now();
    const maxAge = 3600000 * 24; // 24 hours
    
    Object.keys(cache).forEach(key => {
      if (now - cache[key] > maxAge) {
        delete cache[key];
      }
    });
  }
}

// Export singleton instance
export const notificationTriggers = NotificationTriggersService.getInstance();