/**
 * Redis Pub/Sub Service for WebSocket Real-time Features
 * Handles scalable message broadcasting across multiple server instances
 */

import { nativeRedisService as redisService } from "./redis-native.service.ts";
import { WSMessage, WSMessageType, REDIS_CHANNELS } from "./websocket.service.ts";
import { captureException } from "./logging.service.ts";

interface PubSubSubscription {
  channel: string;
  callback: (message: WSMessage) => Promise<void>;
  pattern?: boolean;
}

interface PresenceInfo {
  userId: number;
  status: "online" | "away" | "offline";
  timestamp: number;
  lastSeen: string;
  sessionCount: number;
}

interface MessageQueueItem {
  userId: number;
  message: WSMessage;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
}

/**
 * WebSocket Redis Pub/Sub Manager
 */
export class WebSocketRedisService {
  private subscriptions = new Map<string, PubSubSubscription>();
  private isSubscribed = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.setupRedisSubscriptions();
  }

  /**
   * Setup Redis Pub/Sub subscriptions
   */
  private async setupRedisSubscriptions(): Promise<void> {
    if (!redisService.isEnabled()) {
      console.warn("[WebSocket Redis] Redis not enabled, pub/sub features will be limited");
      return;
    }

    try {
      // Subscribe to global announcement channel
      await this.subscribe(REDIS_CHANNELS.GLOBAL_ANNOUNCEMENTS, async (message) => {
        await this.handleGlobalAnnouncement(message);
      });

      // Subscribe to presence updates
      await this.subscribe(REDIS_CHANNELS.PRESENCE_UPDATES, async (message) => {
        await this.handlePresenceUpdate(message);
      });

      this.isSubscribed = true;
      this.reconnectAttempts = 0;
      console.log("[WebSocket Redis] Pub/Sub subscriptions established");

    } catch (error) {
      console.error("[WebSocket Redis] Failed to setup subscriptions:", error);
      await this.handleReconnection();
    }
  }

  /**
   * Subscribe to a Redis channel
   */
  async subscribe(channel: string, callback: (message: WSMessage) => Promise<void>, pattern = false): Promise<void> {
    try {
      this.subscriptions.set(channel, { channel, callback, pattern });
      
      // In a real Redis implementation, you would use:
      // await redis.subscribe(channel, callback);
      // For now, we'll simulate the subscription
      
      console.log(`[WebSocket Redis] Subscribed to channel: ${channel}`);
    } catch (error) {
      console.error(`[WebSocket Redis] Failed to subscribe to ${channel}:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Unsubscribe from a Redis channel
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      this.subscriptions.delete(channel);
      
      // In a real Redis implementation:
      // await redis.unsubscribe(channel);
      
      console.log(`[WebSocket Redis] Unsubscribed from channel: ${channel}`);
    } catch (error) {
      console.error(`[WebSocket Redis] Failed to unsubscribe from ${channel}:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Publish message to Redis channel
   */
  async publish(channel: string, message: WSMessage): Promise<void> {
    if (!redisService.isEnabled()) {
      console.warn("[WebSocket Redis] Redis not enabled, message not published");
      return;
    }

    try {
      // In a real Redis implementation:
      // await redis.publish(channel, JSON.stringify(message));
      
      // For demonstration, we'll use Redis set operation
      const publishKey = `pitchey:pubsub:${channel}:${Date.now()}`;
      await redisService.set(publishKey, message, 60); // 1 minute TTL
      
      console.log(`[WebSocket Redis] Published message to ${channel}:`, message.type);
    } catch (error) {
      console.error(`[WebSocket Redis] Failed to publish to ${channel}:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WebSocket Redis] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`[WebSocket Redis] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      await this.setupRedisSubscriptions();
    }, delay);
  }

  /**
   * Handle global announcements
   */
  private async handleGlobalAnnouncement(message: WSMessage): Promise<void> {
    console.log("[WebSocket Redis] Received global announcement:", message.payload);
    
    // Forward to WebSocket server for broadcasting to all connected clients
    // This would be handled by the WebSocket server instance
  }

  /**
   * Handle presence updates
   */
  private async handlePresenceUpdate(message: WSMessage): Promise<void> {
    const { userId, status, timestamp } = message.payload || {};
    
    if (!userId || !status) {
      console.warn("[WebSocket Redis] Invalid presence update payload");
      return;
    }

    console.log(`[WebSocket Redis] User ${userId} presence: ${status}`);
    
    // Update local presence cache and broadcast to relevant clients
    await this.updatePresenceCache(userId, status, timestamp);
  }

  /**
   * Update presence information in Redis
   */
  async updatePresenceCache(userId: number, status: string, timestamp: number): Promise<void> {
    try {
      const presenceKey = `pitchey:presence:${userId}`;
      const presenceInfo: PresenceInfo = {
        userId,
        status: status as "online" | "away" | "offline",
        timestamp,
        lastSeen: new Date().toISOString(),
        sessionCount: status === "offline" ? 0 : 1
      };

      await redisService.set(presenceKey, presenceInfo, 3600); // 1 hour TTL
      
      // Also maintain a global presence set for quick lookups
      const globalPresenceKey = `pitchey:presence:global`;
      const allPresence = await redisService.get(globalPresenceKey) || {};
      allPresence[userId] = presenceInfo;
      await redisService.set(globalPresenceKey, allPresence, 3600);

    } catch (error) {
      console.error(`[WebSocket Redis] Failed to update presence for user ${userId}:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Get user presence information
   */
  async getUserPresence(userId: number): Promise<PresenceInfo | null> {
    try {
      const presenceKey = `pitchey:presence:${userId}`;
      return await redisService.get(presenceKey);
    } catch (error) {
      console.error(`[WebSocket Redis] Failed to get presence for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get all online users
   */
  async getOnlineUsers(): Promise<PresenceInfo[]> {
    try {
      const globalPresenceKey = `pitchey:presence:global`;
      const allPresence = await redisService.get(globalPresenceKey) || {};
      
      return Object.values(allPresence).filter((presence: any) => 
        presence.status === "online" || presence.status === "away"
      );
    } catch (error) {
      console.error("[WebSocket Redis] Failed to get online users:", error);
      return [];
    }
  }

  /**
   * Queue message for offline user
   */
  async queueMessageForUser(userId: number, message: WSMessage): Promise<void> {
    try {
      const queueKey = `pitchey:message_queue:${userId}`;
      const queueItem: MessageQueueItem = {
        userId,
        message,
        timestamp: Date.now(),
        attempts: 0,
        maxAttempts: 3
      };

      // Get existing queue
      const existingQueue = await redisService.get(queueKey) || [];
      existingQueue.push(queueItem);

      // Keep only last 100 messages per user
      if (existingQueue.length > 100) {
        existingQueue.splice(0, existingQueue.length - 100);
      }

      await redisService.set(queueKey, existingQueue, 24 * 3600); // 24 hours TTL
      
      console.log(`[WebSocket Redis] Queued message for offline user ${userId}`);
    } catch (error) {
      console.error(`[WebSocket Redis] Failed to queue message for user ${userId}:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Get queued messages for user
   */
  async getQueuedMessages(userId: number): Promise<WSMessage[]> {
    try {
      const queueKey = `pitchey:message_queue:${userId}`;
      const queue: MessageQueueItem[] = await redisService.get(queueKey) || [];
      
      // Return messages and clear the queue
      if (queue.length > 0) {
        await redisService.del(queueKey);
        console.log(`[WebSocket Redis] Retrieved ${queue.length} queued messages for user ${userId}`);
      }
      
      return queue.map(item => item.message);
    } catch (error) {
      console.error(`[WebSocket Redis] Failed to get queued messages for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Store draft auto-sync data
   */
  async storeDraftSync(userId: number, pitchId: number, draftData: any, sessionId: string): Promise<void> {
    try {
      const draftKey = `pitchey:draft:${userId}:${pitchId}`;
      const draftInfo = {
        data: draftData,
        timestamp: Date.now(),
        sessionId,
        userId,
        pitchId
      };

      await redisService.set(draftKey, draftInfo, 3600); // 1 hour TTL
      
      // Publish draft sync notification
      await this.publish(REDIS_CHANNELS.DASHBOARD_UPDATES(userId), {
        type: WSMessageType.DRAFT_UPDATE,
        payload: {
          pitchId,
          draftData,
          updatedBy: sessionId,
          timestamp: Date.now()
        },
        messageId: crypto.randomUUID()
      });

    } catch (error) {
      console.error(`[WebSocket Redis] Failed to store draft sync:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Get latest draft data
   */
  async getDraftSync(userId: number, pitchId: number): Promise<any> {
    try {
      const draftKey = `pitchey:draft:${userId}:${pitchId}`;
      return await redisService.get(draftKey);
    } catch (error) {
      console.error(`[WebSocket Redis] Failed to get draft sync:`, error);
      return null;
    }
  }

  /**
   * Store upload progress
   */
  async storeUploadProgress(userId: number, uploadId: string, progress: number, status: string): Promise<void> {
    try {
      const progressKey = `pitchey:upload:${userId}:${uploadId}`;
      const progressInfo = {
        uploadId,
        progress,
        status,
        timestamp: Date.now(),
        userId
      };

      await redisService.set(progressKey, progressInfo, 3600); // 1 hour TTL
      
      // Publish progress update
      await this.publish(REDIS_CHANNELS.UPLOAD_PROGRESS(userId), {
        type: WSMessageType.UPLOAD_PROGRESS,
        payload: progressInfo,
        messageId: crypto.randomUUID()
      });

    } catch (error) {
      console.error(`[WebSocket Redis] Failed to store upload progress:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Store pitch statistics for real-time updates
   */
  async updatePitchStats(pitchId: number, stats: any): Promise<void> {
    try {
      const statsKey = `pitchey:pitch_stats:${pitchId}`;
      const statsInfo = {
        pitchId,
        stats,
        timestamp: Date.now(),
        lastUpdated: new Date().toISOString()
      };

      await redisService.set(statsKey, statsInfo, 1800); // 30 minutes TTL
      
      // Publish stats update
      await this.publish(REDIS_CHANNELS.PITCH_UPDATES(pitchId), {
        type: WSMessageType.PITCH_STATS_UPDATE,
        payload: statsInfo,
        messageId: crypto.randomUUID()
      });

    } catch (error) {
      console.error(`[WebSocket Redis] Failed to update pitch stats:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Store typing indicator state
   */
  async setTypingIndicator(conversationId: number, userId: number, isTyping: boolean): Promise<void> {
    try {
      const typingKey = `pitchey:typing:${conversationId}`;
      const typingData = await redisService.get(typingKey) || {};
      
      if (isTyping) {
        typingData[userId] = {
          timestamp: Date.now(),
          userId
        };
      } else {
        delete typingData[userId];
      }

      await redisService.set(typingKey, typingData, 300); // 5 minutes TTL
      
      // Publish typing indicator update
      await this.publish(REDIS_CHANNELS.TYPING_INDICATORS(conversationId), {
        type: WSMessageType.USER_TYPING,
        payload: {
          conversationId,
          userId,
          isTyping,
          timestamp: Date.now()
        },
        messageId: crypto.randomUUID()
      });

    } catch (error) {
      console.error(`[WebSocket Redis] Failed to set typing indicator:`, error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Get typing users for conversation
   */
  async getTypingUsers(conversationId: number): Promise<number[]> {
    try {
      const typingKey = `pitchey:typing:${conversationId}`;
      const typingData = await redisService.get(typingKey) || {};
      
      const now = Date.now();
      const typingUsers: number[] = [];
      
      // Filter out stale typing indicators (older than 5 seconds)
      for (const [userIdStr, data] of Object.entries(typingData)) {
        const { timestamp } = data as any;
        if (now - timestamp < 5000) { // 5 seconds
          typingUsers.push(parseInt(userIdStr));
        }
      }
      
      return typingUsers;
    } catch (error) {
      console.error(`[WebSocket Redis] Failed to get typing users:`, error);
      return [];
    }
  }

  /**
   * Clean up expired data periodically
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      console.log("[WebSocket Redis] Running cleanup of expired data");
      
      // Clean up old typing indicators
      const typingPattern = "pitchey:typing:*";
      await redisService.delPattern(typingPattern);
      
      // Clean up old upload progress
      const uploadPattern = "pitchey:upload:*:*";
      await redisService.delPattern(uploadPattern);
      
      console.log("[WebSocket Redis] Cleanup completed");
    } catch (error) {
      console.error("[WebSocket Redis] Failed to cleanup expired data:", error);
      captureException(error, { service: 'WebSocketRedis' });
    }
  }

  /**
   * Get Redis statistics
   */
  async getRedisStats(): Promise<any> {
    try {
      const stats = await redisService.getStats();
      const presenceCount = await this.getOnlineUsers();
      
      return {
        redis_stats: stats,
        online_users_count: presenceCount.length,
        subscriptions_count: this.subscriptions.size,
        is_connected: this.isSubscribed
      };
    } catch (error) {
      console.error("[WebSocket Redis] Failed to get Redis stats:", error);
      return null;
    }
  }

  /**
   * Shutdown Redis connections
   */
  async shutdown(): Promise<void> {
    console.log("[WebSocket Redis] Shutting down Redis connections");
    
    // Unsubscribe from all channels
    const unsubscribePromises = Array.from(this.subscriptions.keys()).map(channel =>
      this.unsubscribe(channel)
    );
    
    await Promise.allSettled(unsubscribePromises);
    
    this.subscriptions.clear();
    this.isSubscribed = false;
    
    console.log("[WebSocket Redis] Shutdown complete");
  }
}

// Export singleton instance
export const webSocketRedisService = new WebSocketRedisService();

// Setup periodic cleanup (every 10 minutes)
setInterval(async () => {
  await webSocketRedisService.cleanupExpiredData();
}, 10 * 60 * 1000);

export default webSocketRedisService;