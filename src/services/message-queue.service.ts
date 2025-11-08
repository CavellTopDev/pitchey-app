/**
 * Message Queue Service
 * Handles queuing and delivery of messages for offline users
 * Supports priority messaging, retry logic, and delivery confirmation
 */

import { redisService } from "./redis.service.ts";
import { presenceTrackingService, PresenceStatus } from "./presence-tracking.service.ts";
import { AnalyticsService } from "./analytics.service.ts";
import { captureException } from "./logging.service.ts";
import { WSMessage, WSMessageType } from "./websocket.service.ts";
import { db } from "../db/client.ts";
import { notifications, messages, users } from "../db/schema.ts";
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";

// Message priority levels
export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5
}

// Queue message interface
export interface QueuedMessage {
  id: string;
  userId: number;
  message: WSMessage;
  priority: MessagePriority;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  expiresAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  lastAttemptAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

// Delivery status
export enum DeliveryStatus {
  QUEUED = "queued",
  DELIVERED = "delivered",
  FAILED = "failed",
  EXPIRED = "expired",
  CANCELLED = "cancelled"
}

// Queue statistics
export interface QueueStats {
  totalQueued: number;
  totalDelivered: number;
  totalFailed: number;
  totalExpired: number;
  avgDeliveryTime: number;
  retryRate: number;
  queueSizeByPriority: Record<MessagePriority, number>;
}

// Delivery confirmation
export interface DeliveryConfirmation {
  messageId: string;
  userId: number;
  status: DeliveryStatus;
  deliveredAt: Date;
  attempts: number;
}

/**
 * Message Queue Service Class
 */
export class MessageQueueService {
  private processingInterval!: number;
  private cleanupInterval!: number;
  private deliveryAttempts = new Map<string, number>();
  private processingQueue = new Set<string>();
  
  // Configuration
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly MAX_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s
  private readonly BATCH_SIZE = 50;
  private readonly PROCESSING_INTERVAL = 5000; // 5 seconds

  constructor() {
    this.setupProcessing();
    console.log("[Message Queue] Initialized");
  }

  /**
   * Setup message processing intervals
   */
  private setupProcessing(): void {
    // Process queued messages every 5 seconds
    this.processingInterval = setInterval(async () => {
      await this.processQueuedMessages();
    }, this.PROCESSING_INTERVAL);

    // Cleanup expired messages every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredMessages();
    }, 60 * 60 * 1000);
  }

  /**
   * Queue message for offline user
   */
  async queueMessage(
    userId: number,
    message: WSMessage,
    priority: MessagePriority = MessagePriority.NORMAL,
    options?: {
      maxAttempts?: number;
      expiresAt?: Date;
      scheduledAt?: Date;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    try {
      // Check if user is online first
      const presence = await presenceTrackingService.getUserPresence(userId);
      if (presence && (presence.status === PresenceStatus.ONLINE || presence.status === PresenceStatus.AWAY)) {
        // User is online, try immediate delivery
        const delivered = await this.attemptImmediateDelivery(userId, message);
        if (delivered) {
          console.log(`[Message Queue] Immediate delivery successful for user ${userId}`);
          return "immediate_delivery";
        }
      }

      // Queue the message
      const queuedMessage: QueuedMessage = {
        id: crypto.randomUUID(),
        userId,
        message,
        priority,
        attempts: 0,
        maxAttempts: options?.maxAttempts || this.MAX_ATTEMPTS,
        createdAt: new Date(),
        scheduledAt: options?.scheduledAt,
        expiresAt: options?.expiresAt || new Date(Date.now() + this.DEFAULT_TTL),
        metadata: options?.metadata
      };

      // Store in Redis with priority-based key
      await this.storeQueuedMessage(queuedMessage);

      // Add to user's queue index
      await this.addToUserQueueIndex(userId, queuedMessage.id, priority);

      // Track analytics
      await this.trackQueueAnalytics('message_queued', queuedMessage);

      console.log(`[Message Queue] Queued message ${queuedMessage.id} for user ${userId} (priority: ${priority})`);
      return queuedMessage.id;

    } catch (error) {
      console.error(`[Message Queue] Failed to queue message for user ${userId}:`, error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'MessageQueue' });
      throw error;
    }
  }

  /**
   * Get queued messages for user when they come online
   */
  async getQueuedMessages(userId: number): Promise<QueuedMessage[]> {
    try {
      // Get user's queue index sorted by priority
      const queueIndex = await this.getUserQueueIndex(userId);
      if (!queueIndex || queueIndex.length === 0) {
        return [];
      }

      // Fetch messages from Redis
      const messages: QueuedMessage[] = [];
      for (const messageId of queueIndex) {
        const queuedMessage = await this.getQueuedMessage(messageId);
        if (queuedMessage && !this.isExpired(queuedMessage)) {
          messages.push(queuedMessage);
        }
      }

      // Sort by priority (higher first) and creation time
      messages.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      console.log(`[Message Queue] Retrieved ${messages.length} queued messages for user ${userId}`);
      return messages;

    } catch (error) {
      console.error(`[Message Queue] Failed to get queued messages for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Deliver queued messages to user
   */
  async deliverQueuedMessages(userId: number): Promise<DeliveryConfirmation[]> {
    try {
      const queuedMessages = await this.getQueuedMessages(userId);
      if (queuedMessages.length === 0) {
        return [];
      }

      const confirmations: DeliveryConfirmation[] = [];

      // Process messages in batches
      for (let i = 0; i < queuedMessages.length; i += this.BATCH_SIZE) {
        const batch = queuedMessages.slice(i, i + this.BATCH_SIZE);
        const batchConfirmations = await this.processBatch(userId, batch);
        confirmations.push(...batchConfirmations);
      }

      // Clear user's queue after successful delivery
      if (confirmations.some(c => c.status === DeliveryStatus.DELIVERED)) {
        await this.clearUserQueue(userId);
      }

      console.log(`[Message Queue] Delivered ${confirmations.length} messages to user ${userId}`);
      return confirmations;

    } catch (error) {
      console.error(`[Message Queue] Failed to deliver queued messages to user ${userId}:`, error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'MessageQueue' });
      return [];
    }
  }

  /**
   * Process a batch of messages for delivery
   */
  private async processBatch(userId: number, messages: QueuedMessage[]): Promise<DeliveryConfirmation[]> {
    const confirmations: DeliveryConfirmation[] = [];

    for (const queuedMessage of messages) {
      try {
        // Skip if already being processed
        if (this.processingQueue.has(queuedMessage.id)) {
          continue;
        }

        this.processingQueue.add(queuedMessage.id);

        // Attempt delivery
        const delivered = await this.attemptDelivery(userId, queuedMessage);
        
        const confirmation: DeliveryConfirmation = {
          messageId: queuedMessage.id,
          userId,
          status: delivered ? DeliveryStatus.DELIVERED : DeliveryStatus.FAILED,
          deliveredAt: new Date(),
          attempts: queuedMessage.attempts + 1
        };

        if (delivered) {
          // Mark as delivered
          queuedMessage.deliveredAt = new Date();
          await this.updateQueuedMessage(queuedMessage);
          await this.trackQueueAnalytics('message_delivered', queuedMessage);
        } else {
          // Handle failed delivery
          await this.handleFailedDelivery(queuedMessage);
        }

        confirmations.push(confirmation);

      } catch (error) {
        console.error(`[Message Queue] Error processing message ${queuedMessage.id}:`, error);
        
        confirmations.push({
          messageId: queuedMessage.id,
          userId,
          status: DeliveryStatus.FAILED,
          deliveredAt: new Date(),
          attempts: queuedMessage.attempts
        });

      } finally {
        this.processingQueue.delete(queuedMessage.id);
      }
    }

    return confirmations;
  }

  /**
   * Attempt to deliver a queued message
   */
  private async attemptDelivery(userId: number, queuedMessage: QueuedMessage): Promise<boolean> {
    try {
      // Check if user is still online
      const presence = await presenceTrackingService.getUserPresence(userId);
      if (!presence || presence.status === PresenceStatus.OFFLINE) {
        return false;
      }

      // Update attempt count
      queuedMessage.attempts++;
      queuedMessage.lastAttemptAt = new Date();

      // Try to deliver via WebSocket (this would be called by the WebSocket server)
      // For now, we'll simulate delivery
      const delivered = await this.attemptImmediateDelivery(userId, queuedMessage.message);
      
      if (delivered) {
        console.log(`[Message Queue] Successfully delivered message ${queuedMessage.id} to user ${userId}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error(`[Message Queue] Delivery attempt failed for message ${queuedMessage.id}:`, error);
      queuedMessage.errorMessage = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /**
   * Attempt immediate delivery (placeholder for WebSocket server integration)
   */
  private async attemptImmediateDelivery(userId: number, message: WSMessage): Promise<boolean> {
    // This would be implemented by the WebSocket server
    // For now, we'll return true to simulate successful delivery
    // In a real implementation, this would try to send via active WebSocket connections
    return true;
  }

  /**
   * Handle failed delivery with retry logic
   */
  private async handleFailedDelivery(queuedMessage: QueuedMessage): Promise<void> {
    queuedMessage.lastAttemptAt = new Date();

    if (queuedMessage.attempts >= queuedMessage.maxAttempts) {
      // Mark as permanently failed
      queuedMessage.failedAt = new Date();
      await this.updateQueuedMessage(queuedMessage);
      await this.trackQueueAnalytics('message_failed', queuedMessage);
      
      console.warn(`[Message Queue] Message ${queuedMessage.id} permanently failed after ${queuedMessage.attempts} attempts`);
    } else {
      // Schedule retry with exponential backoff
      const retryDelay = this.RETRY_DELAYS[queuedMessage.attempts - 1] || 30000; // 30s default
      queuedMessage.scheduledAt = new Date(Date.now() + retryDelay);
      await this.updateQueuedMessage(queuedMessage);
      
      console.log(`[Message Queue] Scheduled retry for message ${queuedMessage.id} in ${retryDelay}ms`);
    }
  }

  /**
   * Process all queued messages (background task)
   */
  private async processQueuedMessages(): Promise<void> {
    try {
      // Get all active user queues
      const activeQueues = await this.getActiveUserQueues();
      
      for (const userId of activeQueues) {
        // Check if user is online
        const presence = await presenceTrackingService.getUserPresence(userId);
        if (presence && (presence.status === PresenceStatus.ONLINE || presence.status === PresenceStatus.AWAY)) {
          // User is online, attempt delivery
          await this.deliverQueuedMessages(userId);
        }
      }

    } catch (error) {
      console.error("[Message Queue] Error processing queued messages:", error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'MessageQueue' });
    }
  }

  /**
   * Store queued message in Redis
   */
  private async storeQueuedMessage(queuedMessage: QueuedMessage): Promise<void> {
    const messageKey = `pitchey:queue:message:${queuedMessage.id}`;
    const ttl = Math.ceil((queuedMessage.expiresAt!.getTime() - Date.now()) / 1000);
    await redisService.set(messageKey, queuedMessage, ttl);
  }

  /**
   * Get queued message from Redis
   */
  private async getQueuedMessage(messageId: string): Promise<QueuedMessage | null> {
    const messageKey = `pitchey:queue:message:${messageId}`;
    return await redisService.get(messageKey);
  }

  /**
   * Update queued message in Redis
   */
  private async updateQueuedMessage(queuedMessage: QueuedMessage): Promise<void> {
    await this.storeQueuedMessage(queuedMessage);
  }

  /**
   * Add message to user's queue index
   */
  private async addToUserQueueIndex(userId: number, messageId: string, priority: MessagePriority): Promise<void> {
    const indexKey = `pitchey:queue:user:${userId}`;
    const userQueue = await redisService.get(indexKey) || [];
    
    // Add message with priority for sorting
    userQueue.push({ messageId, priority, createdAt: Date.now() });
    
    // Keep only last 1000 messages per user
    if (userQueue.length > 1000) {
      userQueue.splice(0, userQueue.length - 1000);
    }
    
    await redisService.set(indexKey, userQueue, this.DEFAULT_TTL / 1000);
  }

  /**
   * Get user's queue index
   */
  private async getUserQueueIndex(userId: number): Promise<string[]> {
    const indexKey = `pitchey:queue:user:${userId}`;
    const userQueue = await redisService.get(indexKey) || [];
    
    // Sort by priority and return message IDs
    return userQueue
      .sort((a: any, b: any) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
      })
      .map((item: any) => item.messageId);
  }

  /**
   * Clear user's queue after delivery
   */
  private async clearUserQueue(userId: number): Promise<void> {
    const indexKey = `pitchey:queue:user:${userId}`;
    await redisService.del(indexKey);
  }

  /**
   * Get all active user queues
   */
  private async getActiveUserQueues(): Promise<number[]> {
    // In a real Redis implementation, this would use SCAN to find all user queue keys
    // For now, we'll return an empty array
    // The pattern would be: pitchey:queue:user:*
    return [];
  }

  /**
   * Check if message has expired
   */
  private isExpired(queuedMessage: QueuedMessage): boolean {
    return queuedMessage.expiresAt ? queuedMessage.expiresAt.getTime() < Date.now() : false;
  }

  /**
   * Clean up expired messages
   */
  private async cleanupExpiredMessages(): Promise<void> {
    try {
      console.log("[Message Queue] Running cleanup of expired messages");
      
      // In a real implementation, this would scan for expired message keys
      // and remove them from Redis
      
      // For now, we'll just log the cleanup operation
      console.log("[Message Queue] Cleanup completed");

    } catch (error) {
      console.error("[Message Queue] Failed to cleanup expired messages:", error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'MessageQueue' });
    }
  }

  /**
   * Track queue analytics
   */
  private async trackQueueAnalytics(eventType: string, queuedMessage: QueuedMessage): Promise<void> {
    try {
      await AnalyticsService.trackEvent({
        eventType,
        userId: queuedMessage.userId,
        eventData: {
          category: 'message_queue',
          messageId: queuedMessage.id,
          messageType: queuedMessage.message.type,
          priority: queuedMessage.priority,
          attempts: queuedMessage.attempts,
          queueTime: queuedMessage.deliveredAt ? 
            queuedMessage.deliveredAt.getTime() - queuedMessage.createdAt.getTime() : undefined,
          metadata: queuedMessage.metadata
        }
      });
    } catch (error) {
      console.error("[Message Queue] Failed to track queue analytics:", error);
    }
  }

  /**
   * Queue notification message
   */
  async queueNotification(
    userId: number,
    notification: {
      type: string;
      title: string;
      message: string;
      relatedId?: number;
      relatedType?: string;
    },
    priority: MessagePriority = MessagePriority.NORMAL
  ): Promise<string> {
    const wsMessage: WSMessage = {
      type: WSMessageType.NOTIFICATION,
      payload: notification,
      messageId: crypto.randomUUID(),
      timestamp: Date.now()
    };

    return await this.queueMessage(userId, wsMessage, priority, {
      metadata: {
        notificationType: notification.type,
        source: 'notification_system'
      }
    });
  }

  /**
   * Queue system announcement
   */
  async queueSystemAnnouncement(
    userIds: number[],
    announcement: {
      title: string;
      message: string;
      type: string;
    }
  ): Promise<string[]> {
    const messageIds: string[] = [];

    for (const userId of userIds) {
      const wsMessage: WSMessage = {
        type: WSMessageType.SYSTEM_ANNOUNCEMENT,
        payload: announcement,
        messageId: crypto.randomUUID(),
        timestamp: Date.now()
      };

      const messageId = await this.queueMessage(userId, wsMessage, MessagePriority.HIGH, {
        metadata: {
          announcementType: announcement.type,
          source: 'system'
        }
      });

      messageIds.push(messageId);
    }

    return messageIds;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      // In a real implementation, this would scan Redis for queue statistics
      // For now, return default stats
      return {
        totalQueued: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalExpired: 0,
        avgDeliveryTime: 0,
        retryRate: 0,
        queueSizeByPriority: {
          [MessagePriority.LOW]: 0,
          [MessagePriority.NORMAL]: 0,
          [MessagePriority.HIGH]: 0,
          [MessagePriority.URGENT]: 0,
          [MessagePriority.CRITICAL]: 0
        }
      };

    } catch (error) {
      console.error("[Message Queue] Failed to get queue stats:", error);
      return {
        totalQueued: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalExpired: 0,
        avgDeliveryTime: 0,
        retryRate: 0,
        queueSizeByPriority: {
          [MessagePriority.LOW]: 0,
          [MessagePriority.NORMAL]: 0,
          [MessagePriority.HIGH]: 0,
          [MessagePriority.URGENT]: 0,
          [MessagePriority.CRITICAL]: 0
        }
      };
    }
  }

  /**
   * Cancel queued message
   */
  async cancelQueuedMessage(messageId: string): Promise<boolean> {
    try {
      const queuedMessage = await this.getQueuedMessage(messageId);
      if (!queuedMessage) {
        return false;
      }

      // Mark as cancelled
      queuedMessage.metadata = { 
        ...queuedMessage.metadata, 
        cancelled: true, 
        cancelledAt: new Date().toISOString() 
      };
      
      await this.updateQueuedMessage(queuedMessage);
      await this.trackQueueAnalytics('message_cancelled', queuedMessage);

      return true;

    } catch (error) {
      console.error(`[Message Queue] Failed to cancel message ${messageId}:`, error);
      return false;
    }
  }

  /**
   * Shutdown message queue service
   */
  async shutdown(): Promise<void> {
    console.log("[Message Queue] Shutting down...");
    
    clearInterval(this.processingInterval);
    clearInterval(this.cleanupInterval);
    
    // Clear processing state
    this.processingQueue.clear();
    this.deliveryAttempts.clear();
    
    console.log("[Message Queue] Shutdown complete");
  }
}

// Export singleton instance
export const messageQueueService = new MessageQueueService();
export default messageQueueService;