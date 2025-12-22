/**
 * Unified Notification Service - Orchestrates email, in-app, and push notifications
 * Handles notification preferences, queuing, batching, and delivery tracking
 */

import type { DatabaseService } from '../types/worker-types.ts';
import { createEmailService, type EmailService } from './email.service.ts';
import type { MessagingService } from './messaging.service.ts';
import { eq, and, or, desc, asc, like, isNull, isNotNull, sql, inArray, gte, lte } from 'drizzle-orm';

// Redis integration for queuing and caching
interface RedisService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  rpush: (key: string, value: string) => Promise<void>;
  lpop: (key: string) => Promise<string | null>;
  llen: (key: string) => Promise<number>;
  hget: (hash: string, field: string) => Promise<string | null>;
  hset: (hash: string, field: string, value: string) => Promise<void>;
  sadd: (set: string, member: string) => Promise<void>;
  smembers: (set: string) => Promise<string[]>;
}

// Notification types and interfaces
export interface NotificationInput {
  userId: number;
  type: 'nda_request' | 'nda_approval' | 'nda_rejection' | 'nda_expiration' | 'nda_reminder' | 'message' | 'investment' | 'pitch_update' | 'system' | 'marketing';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Optional metadata
  relatedPitchId?: number;
  relatedUserId?: number;
  relatedNdaRequestId?: number;
  relatedInvestmentId?: number;
  relatedMessageId?: number;
  actionUrl?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  
  // Channel preferences - if not specified, uses user preferences
  channels?: {
    email?: boolean;
    inApp?: boolean;
    push?: boolean;
    sms?: boolean;
  };
  
  // Email specific options
  emailOptions?: {
    templateType?: string;
    variables?: Record<string, any>;
    attachments?: Array<{
      filename: string;
      content: string | Buffer;
      type?: string;
    }>;
  };
}

export interface NotificationPreferences {
  userId: number;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  digestFrequency: 'instant' | 'hourly' | 'daily' | 'weekly' | 'never';
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;   // HH:mm format
  timezone?: string;
  
  // Category-specific preferences
  ndaNotifications: boolean;
  investmentNotifications: boolean;
  messageNotifications: boolean;
  pitchUpdateNotifications: boolean;
  systemNotifications: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDelivery {
  id: number;
  notificationId: number;
  channel: 'email' | 'push' | 'sms' | 'in_app';
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
  providerId?: string; // External provider message ID
  attempts: number;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationQueueItem {
  id: string;
  notificationId: number;
  channel: 'email' | 'push' | 'sms';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt: Date;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  data: NotificationInput;
  createdAt: Date;
}

export interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  totalFailed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  byChannel: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  byType: Record<string, {
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

export class NotificationService {
  private redis: RedisService;
  private email: EmailService;
  private messaging: MessagingService;
  private processingInterval: number = 5000; // 5 seconds
  private batchSize: number = 10;
  private isProcessing: boolean = false;

  constructor(
    private db: DatabaseService,
    redis: RedisService,
    email: EmailService,
    messaging: MessagingService
  ) {
    this.redis = redis;
    this.email = email;
    this.messaging = messaging;
    this.startQueueProcessor();
  }

  // ============================================================================
  // NOTIFICATION SENDING
  // ============================================================================

  /**
   * Send notification through appropriate channels based on user preferences
   */
  async sendNotification(input: NotificationInput): Promise<{
    notificationId: number;
    channels: Array<{ channel: string; status: string; messageId?: string }>;
  }> {
    try {
      // Create notification record
      const [notification] = await this.db
        .insert('notifications')
        .values({
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          priority: input.priority,
          relatedPitchId: input.relatedPitchId,
          relatedUserId: input.relatedUserId,
          relatedNdaRequestId: input.relatedNdaRequestId,
          relatedInvestmentId: input.relatedInvestmentId,
          relatedMessageId: input.relatedMessageId,
          actionUrl: input.actionUrl,
          expiresAt: input.expiresAt,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .execute();

      // Get user preferences
      const preferences = await this.getUserPreferences(input.userId);
      
      // Determine which channels to use
      const channelsToUse = await this.determineChannels(input, preferences);
      
      const results: Array<{ channel: string; status: string; messageId?: string }> = [];

      // Send in-app notification immediately
      if (channelsToUse.includes('in_app')) {
        await this.sendInAppNotification(notification, input);
        results.push({ channel: 'in_app', status: 'sent' });
      }

      // Queue other channels for background processing
      for (const channel of channelsToUse) {
        if (channel !== 'in_app') {
          await this.queueNotification(notification.id, channel as 'email' | 'push' | 'sms', input);
          results.push({ channel, status: 'queued' });
        }
      }

      // Cache notification for real-time delivery
      await this.cacheNotification(notification, input.userId);

      return {
        notificationId: notification.id,
        channels: results
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send batch notifications efficiently
   */
  async sendBatchNotifications(notifications: NotificationInput[]): Promise<{
    successful: number;
    failed: number;
    results: Array<{ input: NotificationInput; success: boolean; error?: string }>;
  }> {
    const results: Array<{ input: NotificationInput; success: boolean; error?: string }> = [];
    let successful = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming the system
    const batchSize = 20;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (notificationInput) => {
          try {
            await this.sendNotification(notificationInput);
            results.push({ input: notificationInput, success: true });
            successful++;
          } catch (error) {
            results.push({ 
              input: notificationInput, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
            failed++;
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { successful, failed, results };
  }

  /**
   * Send notification reminders
   */
  async sendReminder(originalNotificationId: number, reminderText: string): Promise<void> {
    try {
      // Get original notification
      const [original] = await this.db
        .select()
        .from('notifications')
        .where(eq('id', originalNotificationId))
        .execute();

      if (!original) {
        throw new Error('Original notification not found');
      }

      // Send reminder notification
      await this.sendNotification({
        userId: original.userId,
        type: original.type as any,
        title: `Reminder: ${original.title}`,
        message: reminderText,
        priority: 'normal',
        relatedPitchId: original.relatedPitchId,
        relatedUserId: original.relatedUserId,
        relatedNdaRequestId: original.relatedNdaRequestId,
        actionUrl: original.actionUrl,
        metadata: { 
          ...original.metadata, 
          isReminder: true, 
          originalNotificationId: originalNotificationId 
        }
      });
    } catch (error) {
      console.error('Error sending reminder:', error);
      throw error;
    }
  }

  // ============================================================================
  // NOTIFICATION PREFERENCES
  // ============================================================================

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: number): Promise<NotificationPreferences> {
    try {
      const [preferences] = await this.db
        .select()
        .from('notification_preferences')
        .where(eq('user_id', userId))
        .execute();

      if (!preferences) {
        // Create default preferences
        const defaultPrefs: Partial<NotificationPreferences> = {
          userId,
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
          marketingEmails: false,
          digestFrequency: 'instant',
          quietHoursEnabled: false,
          ndaNotifications: true,
          investmentNotifications: true,
          messageNotifications: true,
          pitchUpdateNotifications: true,
          systemNotifications: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const [created] = await this.db
          .insert('notification_preferences')
          .values(defaultPrefs)
          .returning()
          .execute();

        return created as NotificationPreferences;
      }

      return preferences as NotificationPreferences;
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: number, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const [updated] = await this.db
        .update('notification_preferences')
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq('user_id', userId))
        .returning()
        .execute();

      if (!updated) {
        throw new Error('Failed to update preferences');
      }

      // Clear cached preferences
      await this.redis.del(`user_preferences:${userId}`);

      return updated as NotificationPreferences;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  // ============================================================================
  // NOTIFICATION QUEUING AND PROCESSING
  // ============================================================================

  /**
   * Queue notification for background processing
   */
  private async queueNotification(
    notificationId: number,
    channel: 'email' | 'push' | 'sms',
    data: NotificationInput,
    scheduledAt?: Date
  ): Promise<void> {
    try {
      const queueItem: NotificationQueueItem = {
        id: `${notificationId}_${channel}_${Date.now()}`,
        notificationId,
        channel,
        priority: data.priority,
        scheduledAt: scheduledAt || new Date(),
        attempts: 0,
        maxAttempts: 3,
        data,
        createdAt: new Date()
      };

      // Add to Redis queue based on priority
      const queueKey = `notification_queue:${data.priority}:${channel}`;
      await this.redis.rpush(queueKey, JSON.stringify(queueItem));

      // Track queue size metrics
      await this.redis.hset('notification_metrics', `queue_size_${channel}`, 
        (await this.redis.llen(queueKey)).toString()
      );
    } catch (error) {
      console.error('Error queuing notification:', error);
      throw error;
    }
  }

  /**
   * Start the background queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing) {
        this.processQueues();
      }
    }, this.processingInterval);
  }

  /**
   * Process notification queues
   */
  private async processQueues(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    try {
      const channels = ['email', 'push', 'sms'];
      const priorities = ['urgent', 'high', 'normal', 'low'];

      for (const channel of channels) {
        for (const priority of priorities) {
          await this.processQueue(channel as 'email' | 'push' | 'sms', priority);
        }
      }
    } catch (error) {
      console.error('Error processing notification queues:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process specific queue
   */
  private async processQueue(channel: 'email' | 'push' | 'sms', priority: string): Promise<void> {
    const queueKey = `notification_queue:${priority}:${channel}`;
    
    for (let i = 0; i < this.batchSize; i++) {
      const itemJson = await this.redis.lpop(queueKey);
      if (!itemJson) break;

      try {
        const item: NotificationQueueItem = JSON.parse(itemJson);
        
        // Check if scheduled time has passed
        if (item.scheduledAt > new Date()) {
          // Put back in queue for later processing
          await this.redis.rpush(queueKey, itemJson);
          continue;
        }

        await this.processQueueItem(item);
      } catch (error) {
        console.error(`Error processing queue item for ${channel}:`, error);
      }
    }
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: NotificationQueueItem): Promise<void> {
    try {
      let success = false;
      let errorMessage = '';
      let providerId = '';

      // Create delivery record
      const [delivery] = await this.db
        .insert('notification_deliveries')
        .values({
          notificationId: item.notificationId,
          channel: item.channel,
          status: 'sending',
          attempts: item.attempts + 1,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .execute();

      try {
        switch (item.channel) {
          case 'email':
            const result = await this.sendEmailNotification(item.data, delivery.id);
            success = result.success;
            providerId = result.messageId || '';
            errorMessage = result.error || '';
            break;
          case 'push':
            // Implement push notification sending
            success = await this.sendPushNotification(item.data, delivery.id);
            break;
          case 'sms':
            // Implement SMS notification sending
            success = await this.sendSMSNotification(item.data, delivery.id);
            break;
        }

        // Update delivery record
        await this.db
          .update('notification_deliveries')
          .set({
            status: success ? 'sent' : 'failed',
            providerId: providerId || null,
            errorMessage: success ? null : errorMessage,
            sentAt: success ? new Date() : null,
            updatedAt: new Date()
          })
          .where(eq('id', delivery.id))
          .execute();

      } catch (sendError) {
        success = false;
        errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
        
        // Update delivery record with error
        await this.db
          .update('notification_deliveries')
          .set({
            status: 'failed',
            errorMessage,
            updatedAt: new Date()
          })
          .where(eq('id', delivery.id))
          .execute();
      }

      // Handle retry logic
      if (!success && item.attempts < item.maxAttempts) {
        const retryDelay = Math.min(1000 * Math.pow(2, item.attempts), 30000); // Exponential backoff
        const retryItem = {
          ...item,
          attempts: item.attempts + 1,
          lastAttemptAt: new Date(),
          scheduledAt: new Date(Date.now() + retryDelay)
        };

        const queueKey = `notification_queue:${item.priority}:${item.channel}`;
        await this.redis.rpush(queueKey, JSON.stringify(retryItem));
      }

    } catch (error) {
      console.error('Error processing queue item:', error);
    }
  }

  // ============================================================================
  // CHANNEL-SPECIFIC SENDING
  // ============================================================================

  /**
   * Send email notification
   */
  private async sendEmailNotification(data: NotificationInput, deliveryId: number): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // Get user email
      const [user] = await this.db
        .select({ email: 'email', firstName: 'first_name', lastName: 'last_name' })
        .from('users')
        .where(eq('id', data.userId))
        .execute();

      if (!user?.email) {
        return { success: false, error: 'User email not found' };
      }

      // Prepare email data
      const emailData = {
        to: user.email,
        subject: data.title,
        html: data.message,
        templateType: data.emailOptions?.templateType || data.type,
        variables: {
          recipientName: user.firstName || 'User',
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl,
          ...data.emailOptions?.variables
        },
        attachments: data.emailOptions?.attachments
      };

      const result = await this.email.sendEmail(emailData);
      
      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send push notification (placeholder)
   */
  private async sendPushNotification(data: NotificationInput, deliveryId: number): Promise<boolean> {
    try {
      // Implement push notification logic here
      // This would integrate with Firebase, APNs, or other push services
      console.log('Push notification would be sent:', data.title);
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Send SMS notification (placeholder)
   */
  private async sendSMSNotification(data: NotificationInput, deliveryId: number): Promise<boolean> {
    try {
      // Implement SMS logic here
      // This would integrate with Twilio, AWS SNS, or other SMS services
      console.log('SMS notification would be sent:', data.title);
      return true;
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      return false;
    }
  }

  /**
   * Send in-app notification via WebSocket
   */
  private async sendInAppNotification(notification: any, data: NotificationInput): Promise<void> {
    try {
      // Send via messaging service WebSocket
      await this.messaging.broadcastUserBlocked({
        type: 'notification',
        data: {
          id: notification.id,
          type: data.type,
          title: data.title,
          message: data.message,
          priority: data.priority,
          actionUrl: data.actionUrl,
          timestamp: notification.createdAt
        },
        conversationId: 0,
        userId: data.userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending in-app notification:', error);
      // Don't throw - in-app notification failure shouldn't break the flow
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Determine which channels to use for notification
   */
  private async determineChannels(input: NotificationInput, preferences: NotificationPreferences): Promise<string[]> {
    const channels: string[] = [];

    // Always include in-app
    channels.push('in_app');

    // Check explicit channel preferences in input
    if (input.channels) {
      if (input.channels.email) channels.push('email');
      if (input.channels.push) channels.push('push');
      if (input.channels.sms) channels.push('sms');
      return channels;
    }

    // Check if user is in quiet hours
    const inQuietHours = await this.isInQuietHours(preferences);
    
    // Apply user preferences and quiet hours
    if (preferences.emailNotifications && !inQuietHours) {
      // Check category-specific preferences
      const categoryAllowed = this.isCategoryAllowed(input.type, preferences);
      if (categoryAllowed) {
        channels.push('email');
      }
    }

    if (preferences.pushNotifications) {
      // Push notifications can bypass quiet hours for urgent notifications
      if (!inQuietHours || input.priority === 'urgent') {
        channels.push('push');
      }
    }

    if (preferences.smsNotifications && input.priority === 'urgent') {
      // SMS only for urgent notifications
      channels.push('sms');
    }

    return channels;
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private async isInQuietHours(preferences: NotificationPreferences): Promise<boolean> {
    if (!preferences.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    try {
      const now = new Date();
      const timezone = preferences.timezone || 'UTC';
      const currentTime = now.toLocaleTimeString('en-US', { 
        timeZone: timezone, 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      const start = preferences.quietHoursStart;
      const end = preferences.quietHoursEnd;

      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      if (start > end) {
        return currentTime >= start || currentTime <= end;
      } else {
        return currentTime >= start && currentTime <= end;
      }
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Check if notification category is allowed by user preferences
   */
  private isCategoryAllowed(type: string, preferences: NotificationPreferences): boolean {
    switch (type) {
      case 'nda_request':
      case 'nda_approval':
      case 'nda_rejection':
      case 'nda_expiration':
      case 'nda_reminder':
        return preferences.ndaNotifications;
      case 'investment':
        return preferences.investmentNotifications;
      case 'message':
        return preferences.messageNotifications;
      case 'pitch_update':
        return preferences.pitchUpdateNotifications;
      case 'system':
        return preferences.systemNotifications;
      case 'marketing':
        return preferences.marketingEmails;
      default:
        return true;
    }
  }

  /**
   * Cache notification for real-time delivery
   */
  private async cacheNotification(notification: any, userId: number): Promise<void> {
    try {
      const cacheKey = `user_notifications:${userId}`;
      const notificationData = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        timestamp: notification.createdAt,
        read: false
      };

      await this.redis.rpush(cacheKey, JSON.stringify(notificationData));
      
      // Keep only recent 100 notifications in cache
      const length = await this.redis.llen(cacheKey);
      if (length > 100) {
        await this.redis.lpop(cacheKey);
      }
    } catch (error) {
      console.error('Error caching notification:', error);
    }
  }

  // ============================================================================
  // NOTIFICATION ANALYTICS AND METRICS
  // ============================================================================

  /**
   * Get notification metrics
   */
  async getNotificationMetrics(
    userId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationMetrics> {
    try {
      const whereClause = and(
        userId ? eq('n.user_id', userId) : undefined,
        startDate ? gte('n.created_at', startDate) : undefined,
        endDate ? lte('n.created_at', endDate) : undefined
      );

      // Get overall metrics
      const [overallStats] = await this.db
        .select({
          totalSent: sql`COUNT(DISTINCT nd.id)`,
          totalDelivered: sql`COUNT(DISTINCT CASE WHEN nd.status IN ('sent', 'delivered') THEN nd.id END)`,
          totalRead: sql`COUNT(DISTINCT CASE WHEN nd.read_at IS NOT NULL THEN nd.id END)`,
          totalClicked: sql`COUNT(DISTINCT CASE WHEN nd.clicked_at IS NOT NULL THEN nd.id END)`,
          totalFailed: sql`COUNT(DISTINCT CASE WHEN nd.status = 'failed' THEN nd.id END)`
        })
        .from('notifications n')
        .leftJoin('notification_deliveries nd', eq('nd.notification_id', 'n.id'))
        .where(whereClause)
        .execute();

      // Calculate rates
      const totalSent = Number(overallStats.totalSent) || 1;
      const totalDelivered = Number(overallStats.totalDelivered);
      const totalRead = Number(overallStats.totalRead);
      const totalClicked = Number(overallStats.totalClicked);
      const totalFailed = Number(overallStats.totalFailed);

      return {
        totalSent,
        totalDelivered,
        totalRead,
        totalClicked,
        totalFailed,
        deliveryRate: (totalDelivered / totalSent) * 100,
        openRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
        clickRate: totalRead > 0 ? (totalClicked / totalRead) * 100 : 0,
        bounceRate: (totalFailed / totalSent) * 100,
        byChannel: {}, // Would implement detailed channel metrics
        byType: {}      // Would implement detailed type metrics
      };
    } catch (error) {
      console.error('Error getting notification metrics:', error);
      throw error;
    }
  }

  /**
   * Mark notification as delivered (called by webhooks)
   */
  async markAsDelivered(providerId: string, deliveredAt?: Date): Promise<void> {
    try {
      await this.db
        .update('notification_deliveries')
        .set({
          status: 'delivered',
          deliveredAt: deliveredAt || new Date(),
          updatedAt: new Date()
        })
        .where(eq('provider_id', providerId))
        .execute();
    } catch (error) {
      console.error('Error marking notification as delivered:', error);
    }
  }

  /**
   * Mark notification as read (called by user interaction)
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    try {
      // Update notification
      await this.db
        .update('notifications')
        .set({
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq('id', notificationId), eq('user_id', userId)))
        .execute();

      // Update delivery records
      await this.db
        .update('notification_deliveries')
        .set({
          readAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq('notification_id', notificationId))
        .execute();

      // Remove from cache
      await this.redis.del(`user_notifications:${userId}`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      includeRead?: boolean;
      type?: string;
    } = {}
  ): Promise<{ notifications: any[]; total: number }> {
    try {
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      let whereClause = eq('user_id', userId);
      
      if (!options.includeRead) {
        whereClause = and(whereClause, eq('is_read', false));
      }
      
      if (options.type) {
        whereClause = and(whereClause, eq('type', options.type));
      }

      const notifications = await this.db
        .select()
        .from('notifications')
        .where(whereClause)
        .orderBy(desc('created_at'))
        .limit(limit)
        .offset(offset)
        .execute();

      const [{ count }] = await this.db
        .select({ count: sql`count(*)` })
        .from('notifications')
        .where(whereClause)
        .execute();

      return {
        notifications,
        total: Number(count)
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }
}

// Export service factory
export function createNotificationService(
  db: DatabaseService,
  redis: RedisService,
  email: EmailService,
  messaging: MessagingService
): NotificationService {
  return new NotificationService(db, redis, email, messaging);
}

// Export types
export type {
  NotificationInput,
  NotificationPreferences,
  NotificationDelivery,
  NotificationQueueItem,
  NotificationMetrics
};