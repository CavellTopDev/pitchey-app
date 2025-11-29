/**
 * Notification Scheduling Service
 * Schedule notifications for future delivery
 */

import { db } from "../db/db";
import { 
  notifications, 
  notificationQueue,
  notificationTemplates
} from "../db/schema-notifications";
import { users } from "../db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { redis } from "../lib/redis";
import { NotificationService } from "./notification.service";
import { notificationDigestService } from "./notification-digest.service";
import cron from "node-cron";

interface ScheduledNotification {
  id: string;
  userId: number | number[] | 'all' | 'segment';
  segmentCriteria?: {
    userType?: string[];
    location?: string[];
    minEngagement?: number;
    tags?: string[];
  };
  type: string;
  templateId?: number;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledFor: Date;
  recurrence?: {
    type: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    endDate?: Date;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    timezone?: string;
  };
  status: 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';
  metadata?: {
    campaign?: string;
    tags?: string[];
    tracking?: boolean;
  };
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CampaignSchedule {
  id: string;
  name: string;
  description: string;
  notifications: ScheduledNotification[];
  startDate: Date;
  endDate: Date;
  targetAudience: {
    segmentCriteria?: any;
    userIds?: number[];
    estimatedReach: number;
  };
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
}

export class NotificationSchedulerService {
  private static instance: NotificationSchedulerService;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private notificationService: NotificationService;
  
  private constructor() {
    this.notificationService = NotificationService.getInstance();
    this.initializeScheduler();
  }
  
  static getInstance(): NotificationSchedulerService {
    if (!NotificationSchedulerService.instance) {
      NotificationSchedulerService.instance = new NotificationSchedulerService();
    }
    return NotificationSchedulerService.instance;
  }
  
  /**
   * Initialize the scheduler
   */
  private async initializeScheduler() {
    console.log("Initializing notification scheduler...");
    
    // Check for scheduled notifications every minute
    cron.schedule('* * * * *', async () => {
      await this.processScheduledNotifications();
    });
    
    // Process recurring notifications every hour
    cron.schedule('0 * * * *', async () => {
      await this.processRecurringNotifications();
    });
    
    // Process daily digests at 9 AM
    cron.schedule('0 9 * * *', async () => {
      await notificationDigestService.processDailyDigests();
    });
    
    // Process weekly digests on Mondays at 9 AM
    cron.schedule('0 9 * * 1', async () => {
      await notificationDigestService.processWeeklyDigests();
    });
    
    // Clean up old completed schedules daily
    cron.schedule('0 0 * * *', async () => {
      await this.cleanupCompletedSchedules();
    });
    
    // Load active schedules from database
    await this.loadActiveSchedules();
  }
  
  /**
   * Schedule a notification
   */
  async scheduleNotification(data: Omit<ScheduledNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScheduledNotification> {
    try {
      const id = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const scheduled: ScheduledNotification = {
        id,
        ...data,
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Store in Redis with expiry
      const key = `notification:scheduled:${id}`;
      const ttl = Math.ceil((scheduled.scheduledFor.getTime() - Date.now()) / 1000) + 86400; // Add 24h buffer
      
      if (redis) {
        await redis.setex(key, ttl, JSON.stringify(scheduled));
        
        // Add to scheduled set
        await redis.zadd(
          'notification:scheduled:timeline',
          scheduled.scheduledFor.getTime(),
          id
        );
      }
      
      // If it's a recurring notification, set up cron job
      if (scheduled.recurrence && scheduled.recurrence.type !== 'once') {
        await this.setupRecurringJob(scheduled);
      }
      
      console.log(`Scheduled notification ${id} for ${scheduled.scheduledFor}`);
      
      return scheduled;
    } catch (error) {
      console.error("Error scheduling notification:", error);
      throw error;
    }
  }
  
  /**
   * Setup recurring job
   */
  private async setupRecurringJob(scheduled: ScheduledNotification) {
    try {
      let cronPattern = '';
      
      switch (scheduled.recurrence?.type) {
        case 'daily':
          cronPattern = `0 ${scheduled.scheduledFor.getHours()} * * *`;
          break;
          
        case 'weekly':
          const daysOfWeek = scheduled.recurrence.daysOfWeek || [scheduled.scheduledFor.getDay()];
          cronPattern = `0 ${scheduled.scheduledFor.getHours()} * * ${daysOfWeek.join(',')}`;
          break;
          
        case 'monthly':
          const dayOfMonth = scheduled.recurrence.dayOfMonth || scheduled.scheduledFor.getDate();
          cronPattern = `0 ${scheduled.scheduledFor.getHours()} ${dayOfMonth} * *`;
          break;
          
        case 'custom':
          // Custom cron pattern would be provided in metadata
          cronPattern = scheduled.metadata?.cronPattern as string || '0 0 * * *';
          break;
      }
      
      if (cronPattern) {
        const job = cron.schedule(cronPattern, async () => {
          await this.sendScheduledNotification(scheduled);
        }, {
          scheduled: false,
          timezone: scheduled.recurrence?.timezone || 'America/Los_Angeles'
        });
        
        job.start();
        this.scheduledJobs.set(scheduled.id, job);
      }
    } catch (error) {
      console.error("Error setting up recurring job:", error);
    }
  }
  
  /**
   * Process scheduled notifications
   */
  private async processScheduledNotifications() {
    try {
      const now = Date.now();
      
      if (!redis) return;
      
      // Get notifications scheduled for the next minute
      const scheduled = await redis.zrangebyscore(
        'notification:scheduled:timeline',
        '-inf',
        now + 60000,
        'LIMIT',
        0,
        100
      );
      
      for (const id of scheduled) {
        const key = `notification:scheduled:${id}`;
        const data = await redis.get(key);
        
        if (data) {
          const notification: ScheduledNotification = JSON.parse(data);
          
          if (notification.scheduledFor.getTime() <= now && notification.status === 'scheduled') {
            await this.sendScheduledNotification(notification);
            
            // Remove from timeline if not recurring
            if (!notification.recurrence || notification.recurrence.type === 'once') {
              await redis.zrem('notification:scheduled:timeline', id);
              await redis.del(key);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing scheduled notifications:", error);
    }
  }
  
  /**
   * Send scheduled notification
   */
  private async sendScheduledNotification(scheduled: ScheduledNotification) {
    try {
      console.log(`Sending scheduled notification ${scheduled.id}`);
      
      // Update status
      scheduled.status = 'processing';
      scheduled.updatedAt = new Date();
      
      if (redis) {
        await redis.setex(
          `notification:scheduled:${scheduled.id}`,
          86400,
          JSON.stringify(scheduled)
        );
      }
      
      // Get target users
      const targetUsers = await this.getTargetUsers(scheduled);
      
      // Send notifications
      for (const userId of targetUsers) {
        try {
          await this.notificationService.createNotification({
            userId,
            type: scheduled.type,
            priority: scheduled.priority,
            data: scheduled.data,
            templateId: scheduled.templateId
          });
        } catch (error) {
          console.error(`Error sending to user ${userId}:`, error);
        }
      }
      
      // Update status
      scheduled.status = 'completed';
      scheduled.updatedAt = new Date();
      
      if (redis) {
        await redis.setex(
          `notification:scheduled:${scheduled.id}`,
          86400,
          JSON.stringify(scheduled)
        );
      }
      
      // Track completion
      await this.trackScheduledCompletion(scheduled, targetUsers.length);
      
    } catch (error) {
      console.error("Error sending scheduled notification:", error);
      
      scheduled.status = 'failed';
      scheduled.updatedAt = new Date();
      
      if (redis) {
        await redis.setex(
          `notification:scheduled:${scheduled.id}`,
          86400,
          JSON.stringify(scheduled)
        );
      }
    }
  }
  
  /**
   * Get target users for notification
   */
  private async getTargetUsers(scheduled: ScheduledNotification): Promise<number[]> {
    try {
      if (Array.isArray(scheduled.userId)) {
        return scheduled.userId;
      }
      
      if (typeof scheduled.userId === 'number') {
        return [scheduled.userId];
      }
      
      if (scheduled.userId === 'all') {
        const allUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.emailVerified, true));
        
        return allUsers.map(u => u.id);
      }
      
      if (scheduled.userId === 'segment' && scheduled.segmentCriteria) {
        return await this.getUsersBySegment(scheduled.segmentCriteria);
      }
      
      return [];
    } catch (error) {
      console.error("Error getting target users:", error);
      return [];
    }
  }
  
  /**
   * Get users by segment criteria
   */
  private async getUsersBySegment(criteria: any): Promise<number[]> {
    try {
      const conditions = [];
      
      if (criteria.userType?.length > 0) {
        conditions.push(inArray(users.userType, criteria.userType));
      }
      
      if (criteria.location?.length > 0) {
        conditions.push(inArray(users.location, criteria.location));
      }
      
      const query = db
        .select({ id: users.id })
        .from(users)
        .where(and(...conditions));
      
      const result = await query;
      return result.map(u => u.id);
    } catch (error) {
      console.error("Error getting users by segment:", error);
      return [];
    }
  }
  
  /**
   * Create a campaign schedule
   */
  async createCampaign(data: Omit<CampaignSchedule, 'id'>): Promise<CampaignSchedule> {
    try {
      const campaign: CampaignSchedule = {
        id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...data
      };
      
      // Store campaign
      if (redis) {
        await redis.setex(
          `notification:campaign:${campaign.id}`,
          86400 * 30, // 30 days
          JSON.stringify(campaign)
        );
      }
      
      // Schedule all notifications in the campaign
      for (const notification of campaign.notifications) {
        await this.scheduleNotification(notification);
      }
      
      console.log(`Created campaign ${campaign.id} with ${campaign.notifications.length} notifications`);
      
      return campaign;
    } catch (error) {
      console.error("Error creating campaign:", error);
      throw error;
    }
  }
  
  /**
   * Cancel a scheduled notification
   */
  async cancelScheduled(id: string): Promise<boolean> {
    try {
      // Cancel cron job if exists
      const job = this.scheduledJobs.get(id);
      if (job) {
        job.stop();
        this.scheduledJobs.delete(id);
      }
      
      // Update status in Redis
      if (redis) {
        const data = await redis.get(`notification:scheduled:${id}`);
        if (data) {
          const scheduled: ScheduledNotification = JSON.parse(data);
          scheduled.status = 'cancelled';
          scheduled.updatedAt = new Date();
          
          await redis.setex(
            `notification:scheduled:${id}`,
            86400,
            JSON.stringify(scheduled)
          );
          
          // Remove from timeline
          await redis.zrem('notification:scheduled:timeline', id);
        }
      }
      
      console.log(`Cancelled scheduled notification ${id}`);
      return true;
    } catch (error) {
      console.error("Error cancelling scheduled notification:", error);
      return false;
    }
  }
  
  /**
   * Get scheduled notifications
   */
  async getScheduledNotifications(filters?: {
    status?: string;
    userId?: number;
    dateRange?: { start: Date; end: Date };
  }): Promise<ScheduledNotification[]> {
    try {
      if (!redis) return [];
      
      const keys = await redis.keys('notification:scheduled:*');
      const notifications: ScheduledNotification[] = [];
      
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const notification: ScheduledNotification = JSON.parse(data);
          
          // Apply filters
          if (filters) {
            if (filters.status && notification.status !== filters.status) continue;
            if (filters.userId && notification.createdBy !== filters.userId) continue;
            if (filters.dateRange) {
              if (notification.scheduledFor < filters.dateRange.start ||
                  notification.scheduledFor > filters.dateRange.end) continue;
            }
          }
          
          notifications.push(notification);
        }
      }
      
      return notifications.sort((a, b) => 
        a.scheduledFor.getTime() - b.scheduledFor.getTime()
      );
    } catch (error) {
      console.error("Error getting scheduled notifications:", error);
      return [];
    }
  }
  
  /**
   * Process recurring notifications
   */
  private async processRecurringNotifications() {
    try {
      const scheduled = await this.getScheduledNotifications({
        status: 'scheduled'
      });
      
      for (const notification of scheduled) {
        if (notification.recurrence && notification.recurrence.endDate) {
          if (new Date() > notification.recurrence.endDate) {
            // End date reached, cancel the notification
            await this.cancelScheduled(notification.id);
          }
        }
      }
    } catch (error) {
      console.error("Error processing recurring notifications:", error);
    }
  }
  
  /**
   * Track scheduled notification completion
   */
  private async trackScheduledCompletion(scheduled: ScheduledNotification, recipientCount: number) {
    try {
      if (!redis) return;
      
      const key = `notification:scheduled:stats:${new Date().toISOString().split('T')[0]}`;
      
      await redis.hincrby(key, 'total', 1);
      await redis.hincrby(key, 'recipients', recipientCount);
      await redis.hincrby(key, scheduled.type, 1);
      await redis.expire(key, 86400 * 30); // Keep for 30 days
    } catch (error) {
      console.error("Error tracking scheduled completion:", error);
    }
  }
  
  /**
   * Clean up old completed schedules
   */
  private async cleanupCompletedSchedules() {
    try {
      if (!redis) return;
      
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const keys = await redis.keys('notification:scheduled:*');
      
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const scheduled: ScheduledNotification = JSON.parse(data);
          
          if (scheduled.status === 'completed' && 
              scheduled.updatedAt.getTime() < thirtyDaysAgo) {
            await redis.del(key);
          }
        }
      }
      
      console.log("Cleaned up old completed schedules");
    } catch (error) {
      console.error("Error cleaning up schedules:", error);
    }
  }
  
  /**
   * Load active schedules from database
   */
  private async loadActiveSchedules() {
    try {
      const scheduled = await this.getScheduledNotifications({
        status: 'scheduled'
      });
      
      for (const notification of scheduled) {
        if (notification.recurrence && notification.recurrence.type !== 'once') {
          await this.setupRecurringJob(notification);
        }
      }
      
      console.log(`Loaded ${scheduled.length} active schedules`);
    } catch (error) {
      console.error("Error loading active schedules:", error);
    }
  }
  
  /**
   * Get scheduler statistics
   */
  async getSchedulerStats(): Promise<{
    scheduled: number;
    processing: number;
    completed: number;
    failed: number;
    campaigns: number;
    nextExecution: Date | null;
  }> {
    try {
      const notifications = await this.getScheduledNotifications();
      
      const stats = {
        scheduled: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        campaigns: 0,
        nextExecution: null as Date | null
      };
      
      let nextDate = null;
      
      for (const notification of notifications) {
        stats[notification.status]++;
        
        if (notification.status === 'scheduled') {
          if (!nextDate || notification.scheduledFor < nextDate) {
            nextDate = notification.scheduledFor;
          }
        }
      }
      
      if (redis) {
        const campaignKeys = await redis.keys('notification:campaign:*');
        stats.campaigns = campaignKeys.length;
      }
      
      stats.nextExecution = nextDate;
      
      return stats;
    } catch (error) {
      console.error("Error getting scheduler stats:", error);
      return {
        scheduled: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        campaigns: 0,
        nextExecution: null
      };
    }
  }
}

// Export singleton instance
export const notificationScheduler = NotificationSchedulerService.getInstance();