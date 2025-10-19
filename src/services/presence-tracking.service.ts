/**
 * Presence Tracking Service
 * Manages user online/offline/away status with Redis storage and real-time updates
 */

import { redisService } from "./redis.service.ts";
import { webSocketRedisService } from "./websocket-redis.service.ts";
import { AnalyticsService } from "./analytics.service.ts";
import { captureException } from "./logging.service.ts";
import { db } from "../db/client.ts";
import { users, userSessions, follows } from "../db/schema.ts";
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";

// Presence status enum
export enum PresenceStatus {
  ONLINE = "online",
  AWAY = "away",
  OFFLINE = "offline",
  DO_NOT_DISTURB = "do_not_disturb"
}

// Presence information interface
export interface PresenceInfo {
  userId: number;
  status: PresenceStatus;
  lastSeen: Date;
  lastActivity: Date;
  sessionCount: number;
  isActive: boolean;
  customStatus?: string;
  location?: string;
  device?: string;
  metadata?: Record<string, any>;
}

// Presence activity types
export enum ActivityType {
  VIEWING_PITCH = "viewing_pitch",
  CREATING_PITCH = "creating_pitch",
  MESSAGING = "messaging",
  BROWSING_MARKETPLACE = "browsing_marketplace",
  IN_DASHBOARD = "in_dashboard",
  UPLOADING_FILE = "uploading_file",
  IDLE = "idle"
}

// Activity information
export interface ActivityInfo {
  type: ActivityType;
  details?: Record<string, any>;
  timestamp: Date;
}

// Presence event for real-time updates
export interface PresenceEvent {
  userId: number;
  oldStatus: PresenceStatus;
  newStatus: PresenceStatus;
  timestamp: Date;
  sessionId?: string;
}

/**
 * Presence Tracking Service Class
 */
export class PresenceTrackingService {
  private presenceCache = new Map<number, PresenceInfo>();
  private activityCache = new Map<number, ActivityInfo>();
  private statusUpdateQueue = new Map<number, PresenceEvent>();
  private batchUpdateInterval!: number;
  private cleanupInterval!: number;
  private awayThreshold = 5 * 60 * 1000; // 5 minutes
  private offlineThreshold = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.setupIntervals();
    console.log("[Presence Service] Initialized");
  }

  /**
   * Setup periodic tasks
   */
  private setupIntervals(): void {
    // Batch update presence every 30 seconds
    this.batchUpdateInterval = setInterval(async () => {
      await this.processBatchUpdates();
    }, 30 * 1000);

    // Cleanup stale presence data every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupStalePresence();
    }, 5 * 60 * 1000);

    // Update away/offline status every minute
    setInterval(async () => {
      await this.updateInactiveUsers();
    }, 60 * 1000);
  }

  /**
   * Set user presence status
   */
  async setUserPresence(
    userId: number, 
    status: PresenceStatus, 
    sessionId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const now = new Date();
      const currentPresence = await this.getUserPresence(userId);
      const oldStatus = currentPresence?.status || PresenceStatus.OFFLINE;

      // Create or update presence info
      const presenceInfo: PresenceInfo = {
        userId,
        status,
        lastSeen: now,
        lastActivity: now,
        sessionCount: await this.getSessionCount(userId),
        isActive: status === PresenceStatus.ONLINE,
        metadata: {
          ...currentPresence?.metadata,
          ...metadata,
          sessionId,
          updatedAt: now.toISOString()
        }
      };

      // Update local cache
      this.presenceCache.set(userId, presenceInfo);

      // Store in Redis for fast access
      const presenceKey = `pitchey:presence:${userId}`;
      await redisService.set(presenceKey, presenceInfo, 3600); // 1 hour TTL

      // Queue status update event
      if (oldStatus !== status) {
        this.statusUpdateQueue.set(userId, {
          userId,
          oldStatus,
          newStatus: status,
          timestamp: now,
          sessionId
        });
      }

      // Update global presence index
      await this.updateGlobalPresenceIndex(userId, presenceInfo);

      // Track analytics
      await this.trackPresenceAnalytics(userId, status, oldStatus, sessionId);

      console.log(`[Presence Service] User ${userId} status: ${oldStatus} -> ${status}`);

    } catch (error) {
      console.error(`[Presence Service] Failed to set presence for user ${userId}:`, error);
      captureException(error, { service: 'PresenceTracking' });
    }
  }

  /**
   * Get user presence information
   */
  async getUserPresence(userId: number): Promise<PresenceInfo | null> {
    try {
      // Check local cache first
      const cached = this.presenceCache.get(userId);
      if (cached) {
        return cached;
      }

      // Check Redis
      const presenceKey = `pitchey:presence:${userId}`;
      const redisPresence = await redisService.get(presenceKey);
      if (redisPresence) {
        this.presenceCache.set(userId, redisPresence);
        return redisPresence;
      }

      // Default to offline if no presence data found
      return null;

    } catch (error) {
      console.error(`[Presence Service] Failed to get presence for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple users' presence information
   */
  async getUsersPresence(userIds: number[]): Promise<Map<number, PresenceInfo>> {
    const presenceMap = new Map<number, PresenceInfo>();

    try {
      // Get from cache and Redis in parallel
      const cacheResults = userIds.map(userId => this.presenceCache.get(userId));
      const redisKeys = userIds.map(userId => `pitchey:presence:${userId}`);
      
      // Batch get from Redis for users not in cache
      const uncachedUserIds = userIds.filter((userId, index) => !cacheResults[index]);
      if (uncachedUserIds.length > 0) {
        // In a real Redis implementation, use MGET for batch retrieval
        const redisPromises = uncachedUserIds.map(async userId => {
          const presence = await redisService.get(`pitchey:presence:${userId}`);
          if (presence) {
            this.presenceCache.set(userId, presence);
            return { userId, presence };
          }
          return null;
        });

        const redisResults = await Promise.allSettled(redisPromises);
        redisResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            presenceMap.set(result.value.userId, result.value.presence);
          }
        });
      }

      // Add cached results
      userIds.forEach((userId, index) => {
        if (cacheResults[index]) {
          presenceMap.set(userId, cacheResults[index]!);
        }
      });

    } catch (error) {
      console.error("[Presence Service] Failed to get multiple users presence:", error);
      captureException(error, { service: 'PresenceTracking' });
    }

    return presenceMap;
  }

  /**
   * Get online users that a user follows
   */
  async getFollowingOnlineUsers(userId: number): Promise<PresenceInfo[]> {
    try {
      // Get users that this user follows
      const following = await db.select({ creatorId: follows.creatorId })
        .from(follows)
        .where(eq(follows.followerId, userId));

      const followingIds = following.map(f => f.creatorId);
      if (followingIds.length === 0) {
        return [];
      }

      // Get presence for followed users
      const presenceMap = await this.getUsersPresence(followingIds);
      
      // Filter for online users
      return Array.from(presenceMap.values()).filter(presence => 
        presence.status === PresenceStatus.ONLINE || presence.status === PresenceStatus.AWAY
      );

    } catch (error) {
      console.error(`[Presence Service] Failed to get following online users for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get all online users (for admin/monitoring)
   */
  async getAllOnlineUsers(): Promise<PresenceInfo[]> {
    try {
      const globalPresenceKey = "pitchey:presence:global";
      const globalPresence = await redisService.get(globalPresenceKey) || {};
      
      return Object.values(globalPresence).filter((presence: any) =>
        presence.status === PresenceStatus.ONLINE || presence.status === PresenceStatus.AWAY
      );

    } catch (error) {
      console.error("[Presence Service] Failed to get all online users:", error);
      return [];
    }
  }

  /**
   * Set user activity
   */
  async setUserActivity(
    userId: number, 
    activity: ActivityType, 
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const activityInfo: ActivityInfo = {
        type: activity,
        details,
        timestamp: new Date()
      };

      // Update activity cache
      this.activityCache.set(userId, activityInfo);

      // Store in Redis with shorter TTL
      const activityKey = `pitchey:activity:${userId}`;
      await redisService.set(activityKey, activityInfo, 300); // 5 minutes TTL

      // Update last activity in presence
      const presence = await this.getUserPresence(userId);
      if (presence) {
        presence.lastActivity = new Date();
        presence.isActive = activity !== ActivityType.IDLE;
        
        await this.setUserPresence(userId, presence.status, undefined, {
          currentActivity: activity,
          activityDetails: details
        });
      }

    } catch (error) {
      console.error(`[Presence Service] Failed to set activity for user ${userId}:`, error);
      captureException(error, { service: 'PresenceTracking' });
    }
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId: number): Promise<ActivityInfo | null> {
    try {
      // Check cache first
      const cached = this.activityCache.get(userId);
      if (cached) {
        return cached;
      }

      // Check Redis
      const activityKey = `pitchey:activity:${userId}`;
      const activity = await redisService.get(activityKey);
      if (activity) {
        this.activityCache.set(userId, activity);
        return activity;
      }

      return null;

    } catch (error) {
      console.error(`[Presence Service] Failed to get activity for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Handle user connection
   */
  async handleUserConnect(userId: number, sessionId: string, metadata?: Record<string, any>): Promise<void> {
    await this.setUserPresence(userId, PresenceStatus.ONLINE, sessionId, metadata);
    await this.incrementSessionCount(userId);
  }

  /**
   * Handle user disconnection
   */
  async handleUserDisconnect(userId: number, sessionId: string): Promise<void> {
    await this.decrementSessionCount(userId);
    
    const sessionCount = await this.getSessionCount(userId);
    if (sessionCount <= 0) {
      // User is completely offline
      await this.setUserPresence(userId, PresenceStatus.OFFLINE, sessionId);
    }
  }

  /**
   * Update global presence index
   */
  private async updateGlobalPresenceIndex(userId: number, presence: PresenceInfo): Promise<void> {
    try {
      const globalPresenceKey = "pitchey:presence:global";
      const globalPresence = await redisService.get(globalPresenceKey) || {};
      
      if (presence.status === PresenceStatus.OFFLINE) {
        delete globalPresence[userId];
      } else {
        globalPresence[userId] = presence;
      }
      
      await redisService.set(globalPresenceKey, globalPresence, 3600); // 1 hour TTL

    } catch (error) {
      console.error("[Presence Service] Failed to update global presence index:", error);
    }
  }

  /**
   * Get session count for user
   */
  private async getSessionCount(userId: number): Promise<number> {
    try {
      const sessionCountKey = `pitchey:sessions:${userId}`;
      const count = await redisService.get(sessionCountKey);
      return count || 0;
    } catch (error) {
      console.error(`[Presence Service] Failed to get session count for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Increment session count
   */
  private async incrementSessionCount(userId: number): Promise<void> {
    try {
      const sessionCountKey = `pitchey:sessions:${userId}`;
      const currentCount = await this.getSessionCount(userId);
      await redisService.set(sessionCountKey, currentCount + 1, 3600); // 1 hour TTL
    } catch (error) {
      console.error(`[Presence Service] Failed to increment session count for user ${userId}:`, error);
    }
  }

  /**
   * Decrement session count
   */
  private async decrementSessionCount(userId: number): Promise<void> {
    try {
      const sessionCountKey = `pitchey:sessions:${userId}`;
      const currentCount = await this.getSessionCount(userId);
      const newCount = Math.max(0, currentCount - 1);
      
      if (newCount === 0) {
        await redisService.del(sessionCountKey);
      } else {
        await redisService.set(sessionCountKey, newCount, 3600);
      }
    } catch (error) {
      console.error(`[Presence Service] Failed to decrement session count for user ${userId}:`, error);
    }
  }

  /**
   * Process batch updates to reduce Redis load
   */
  private async processBatchUpdates(): Promise<void> {
    if (this.statusUpdateQueue.size === 0) {
      return;
    }

    try {
      const updates = Array.from(this.statusUpdateQueue.values());
      this.statusUpdateQueue.clear();

      // Broadcast presence updates via Redis pub/sub
      for (const update of updates) {
        await webSocketRedisService.publish("pitchey:presence:updates", {
          type: "presence_update" as any,
          payload: update,
          messageId: crypto.randomUUID()
        });
      }

      console.log(`[Presence Service] Processed ${updates.length} presence updates`);

    } catch (error) {
      console.error("[Presence Service] Failed to process batch updates:", error);
      captureException(error, { service: 'PresenceTracking' });
    }
  }

  /**
   * Update users who have been inactive
   */
  private async updateInactiveUsers(): Promise<void> {
    try {
      const now = Date.now();
      const updates: Promise<void>[] = [];

      for (const [userId, presence] of this.presenceCache.entries()) {
        const timeSinceActivity = now - presence.lastActivity.getTime();
        
        if (presence.status === PresenceStatus.ONLINE && timeSinceActivity > this.awayThreshold) {
          // User should be marked as away
          updates.push(this.setUserPresence(userId, PresenceStatus.AWAY));
        } else if (
          (presence.status === PresenceStatus.ONLINE || presence.status === PresenceStatus.AWAY) &&
          timeSinceActivity > this.offlineThreshold
        ) {
          // User should be marked as offline
          updates.push(this.setUserPresence(userId, PresenceStatus.OFFLINE));
        }
      }

      if (updates.length > 0) {
        await Promise.allSettled(updates);
        console.log(`[Presence Service] Updated ${updates.length} inactive users`);
      }

    } catch (error) {
      console.error("[Presence Service] Failed to update inactive users:", error);
      captureException(error, { service: 'PresenceTracking' });
    }
  }

  /**
   * Cleanup stale presence data
   */
  private async cleanupStalePresence(): Promise<void> {
    try {
      const now = Date.now();
      const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
      const toDelete: number[] = [];

      // Clean up local cache
      for (const [userId, presence] of this.presenceCache.entries()) {
        const timeSinceLastSeen = now - presence.lastSeen.getTime();
        
        if (timeSinceLastSeen > staleThreshold) {
          toDelete.push(userId);
        }
      }

      // Remove stale entries
      for (const userId of toDelete) {
        this.presenceCache.delete(userId);
        this.activityCache.delete(userId);
      }

      // Clean up Redis keys (pattern deletion)
      if (toDelete.length > 0) {
        console.log(`[Presence Service] Cleaned up ${toDelete.length} stale presence entries`);
      }

    } catch (error) {
      console.error("[Presence Service] Failed to cleanup stale presence:", error);
      captureException(error, { service: 'PresenceTracking' });
    }
  }

  /**
   * Track presence analytics
   */
  private async trackPresenceAnalytics(
    userId: number, 
    newStatus: PresenceStatus, 
    oldStatus: PresenceStatus,
    sessionId?: string
  ): Promise<void> {
    try {
      await AnalyticsService.trackEvent({
        eventType: 'user_presence_changed',
        userId,
        eventData: {
          category: 'presence',
          oldStatus,
          newStatus,
          sessionId,
          timestamp: new Date(),
          source: 'presence_tracking_service'
        }
      });
    } catch (error) {
      console.error("[Presence Service] Failed to track presence analytics:", error);
    }
  }

  /**
   * Get presence statistics
   */
  async getPresenceStats(): Promise<{
    totalTrackedUsers: number;
    onlineUsers: number;
    awayUsers: number;
    offlineUsers: number;
    doNotDisturbUsers: number;
    activeSessions: number;
  }> {
    try {
      const allUsers = await this.getAllOnlineUsers();
      const stats = {
        totalTrackedUsers: this.presenceCache.size,
        onlineUsers: 0,
        awayUsers: 0,
        offlineUsers: 0,
        doNotDisturbUsers: 0,
        activeSessions: 0
      };

      for (const presence of allUsers) {
        switch (presence.status) {
          case PresenceStatus.ONLINE:
            stats.onlineUsers++;
            break;
          case PresenceStatus.AWAY:
            stats.awayUsers++;
            break;
          case PresenceStatus.OFFLINE:
            stats.offlineUsers++;
            break;
          case PresenceStatus.DO_NOT_DISTURB:
            stats.doNotDisturbUsers++;
            break;
        }
        stats.activeSessions += presence.sessionCount;
      }

      return stats;

    } catch (error) {
      console.error("[Presence Service] Failed to get presence stats:", error);
      return {
        totalTrackedUsers: 0,
        onlineUsers: 0,
        awayUsers: 0,
        offlineUsers: 0,
        doNotDisturbUsers: 0,
        activeSessions: 0
      };
    }
  }

  /**
   * Set custom status message
   */
  async setCustomStatus(userId: number, customStatus: string): Promise<void> {
    const presence = await this.getUserPresence(userId);
    if (presence) {
      await this.setUserPresence(userId, presence.status, undefined, {
        customStatus
      });
    }
  }

  /**
   * Clear custom status
   */
  async clearCustomStatus(userId: number): Promise<void> {
    const presence = await this.getUserPresence(userId);
    if (presence && presence.metadata) {
      delete presence.metadata.customStatus;
      await this.setUserPresence(userId, presence.status, undefined, presence.metadata);
    }
  }

  /**
   * Shutdown presence service
   */
  async shutdown(): Promise<void> {
    console.log("[Presence Service] Shutting down...");
    
    clearInterval(this.batchUpdateInterval);
    clearInterval(this.cleanupInterval);
    
    // Process any remaining updates
    await this.processBatchUpdates();
    
    // Clear caches
    this.presenceCache.clear();
    this.activityCache.clear();
    this.statusUpdateQueue.clear();
    
    console.log("[Presence Service] Shutdown complete");
  }
}

// Export singleton instance
export const presenceTrackingService = new PresenceTrackingService();
export default presenceTrackingService;