/**
 * Notification Analytics Service
 * Tracks and analyzes notification metrics
 */

import { db } from "../db/db";
import { 
  notifications, 
  notificationQueue,
  notificationPreferences 
} from "../db/schema-notifications";
import { users } from "../db/schema";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { redis } from "../lib/redis";

interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  avgTimeToRead: number;
  avgTimeToClick: number;
  byType: Record<string, {
    sent: number;
    delivered: number;
    read: number;
    clicked: number;
  }>;
  byChannel: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  byPriority: Record<string, number>;
  hourlyDistribution: Record<number, number>;
  topUsers: Array<{
    userId: number;
    username: string;
    notificationCount: number;
    readRate: number;
  }>;
}

interface UserEngagementMetrics {
  userId: number;
  totalReceived: number;
  totalRead: number;
  totalClicked: number;
  readRate: number;
  clickRate: number;
  avgResponseTime: number;
  preferredChannels: string[];
  mostActiveHours: number[];
  engagementScore: number;
}

export class NotificationAnalyticsService {
  private static instance: NotificationAnalyticsService;
  
  private constructor() {}
  
  static getInstance(): NotificationAnalyticsService {
    if (!NotificationAnalyticsService.instance) {
      NotificationAnalyticsService.instance = new NotificationAnalyticsService();
    }
    return NotificationAnalyticsService.instance;
  }
  
  /**
   * Get overall notification metrics
   */
  async getMetrics(
    startDate: Date,
    endDate: Date,
    filters?: {
      userType?: string;
      notificationType?: string;
    }
  ): Promise<NotificationMetrics> {
    try {
      // Check cache first
      const cacheKey = `notification:metrics:${startDate.getTime()}:${endDate.getTime()}`;
      const cached = await redis?.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Build base query conditions
      const conditions = [
        gte(notifications.createdAt, startDate),
        lte(notifications.createdAt, endDate)
      ];
      
      if (filters?.notificationType) {
        conditions.push(eq(notifications.type, filters.notificationType as any));
      }
      
      // Get total notifications
      const totalQuery = await db
        .select({
          total: sql<number>`count(*)`,
          delivered: sql<number>`count(case when delivered = true then 1 end)`,
          read: sql<number>`count(case when is_read = true then 1 end)`,
          clicked: sql<number>`count(case when action_url is not null and is_read = true then 1 end)`
        })
        .from(notifications)
        .where(and(...conditions));
      
      const totals = totalQuery[0] || { total: 0, delivered: 0, read: 0, clicked: 0 };
      
      // Get metrics by type
      const byTypeQuery = await db
        .select({
          type: notifications.type,
          sent: sql<number>`count(*)`,
          delivered: sql<number>`count(case when delivered = true then 1 end)`,
          read: sql<number>`count(case when is_read = true then 1 end)`,
          clicked: sql<number>`count(case when action_url is not null and is_read = true then 1 end)`
        })
        .from(notifications)
        .where(and(...conditions))
        .groupBy(notifications.type);
      
      const byType: Record<string, any> = {};
      byTypeQuery.forEach(row => {
        byType[row.type] = {
          sent: row.sent,
          delivered: row.delivered,
          read: row.read,
          clicked: row.clicked
        };
      });
      
      // Get metrics by channel from queue
      const byChannelQuery = await db
        .select({
          channel: notificationQueue.channel,
          sent: sql<number>`count(*)`,
          delivered: sql<number>`count(case when status = 'delivered' then 1 end)`,
          failed: sql<number>`count(case when status = 'failed' then 1 end)`
        })
        .from(notificationQueue)
        .innerJoin(notifications, eq(notificationQueue.notificationId, notifications.id))
        .where(and(...conditions))
        .groupBy(notificationQueue.channel);
      
      const byChannel: Record<string, any> = {};
      byChannelQuery.forEach(row => {
        byChannel[row.channel] = {
          sent: row.sent,
          delivered: row.delivered,
          failed: row.failed
        };
      });
      
      // Get metrics by priority
      const byPriorityQuery = await db
        .select({
          priority: notifications.priority,
          count: sql<number>`count(*)`
        })
        .from(notifications)
        .where(and(...conditions))
        .groupBy(notifications.priority);
      
      const byPriority: Record<string, number> = {};
      byPriorityQuery.forEach(row => {
        byPriority[row.priority] = row.count;
      });
      
      // Get hourly distribution
      const hourlyQuery = await db
        .select({
          hour: sql<number>`extract(hour from created_at)`,
          count: sql<number>`count(*)`
        })
        .from(notifications)
        .where(and(...conditions))
        .groupBy(sql`extract(hour from created_at)`);
      
      const hourlyDistribution: Record<number, number> = {};
      for (let i = 0; i < 24; i++) {
        hourlyDistribution[i] = 0;
      }
      hourlyQuery.forEach(row => {
        hourlyDistribution[row.hour] = row.count;
      });
      
      // Get average time to read
      const timeMetrics = await db
        .select({
          avgTimeToRead: sql<number>`avg(extract(epoch from (read_at - created_at)))`
        })
        .from(notifications)
        .where(
          and(
            ...conditions,
            sql`read_at is not null`
          )
        );
      
      const avgTimeToRead = timeMetrics[0]?.avgTimeToRead || 0;
      
      // Get top users
      const topUsersQuery = await db
        .select({
          userId: notifications.userId,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          notificationCount: sql<number>`count(*)`,
          readCount: sql<number>`count(case when is_read = true then 1 end)`
        })
        .from(notifications)
        .innerJoin(users, eq(notifications.userId, users.id))
        .where(and(...conditions))
        .groupBy(notifications.userId, users.username, users.firstName, users.lastName)
        .orderBy(desc(sql`count(*)`))
        .limit(10);
      
      const topUsers = topUsersQuery.map(user => ({
        userId: user.userId,
        username: user.username,
        notificationCount: user.notificationCount,
        readRate: user.readCount / user.notificationCount
      }));
      
      // Calculate rates
      const deliveryRate = totals.total > 0 ? totals.delivered / totals.total : 0;
      const readRate = totals.delivered > 0 ? totals.read / totals.delivered : 0;
      const clickRate = totals.read > 0 ? totals.clicked / totals.read : 0;
      
      const metrics: NotificationMetrics = {
        totalSent: totals.total,
        totalDelivered: totals.delivered,
        totalRead: totals.read,
        totalClicked: totals.clicked,
        deliveryRate,
        readRate,
        clickRate,
        avgTimeToRead,
        avgTimeToClick: 0, // TODO: Track click time
        byType,
        byChannel,
        byPriority,
        hourlyDistribution,
        topUsers
      };
      
      // Cache the results
      if (redis) {
        await redis.setex(cacheKey, 300, JSON.stringify(metrics)); // 5 minutes cache
      }
      
      return metrics;
    } catch (error) {
      console.error("Error getting notification metrics:", error);
      throw error;
    }
  }
  
  /**
   * Get user engagement metrics
   */
  async getUserEngagement(userId: number, days: number = 30): Promise<UserEngagementMetrics> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get notification stats for user
      const stats = await db
        .select({
          totalReceived: sql<number>`count(*)`,
          totalRead: sql<number>`count(case when is_read = true then 1 end)`,
          totalClicked: sql<number>`count(case when action_url is not null and is_read = true then 1 end)`,
          avgResponseTime: sql<number>`avg(extract(epoch from (read_at - created_at)))`
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            gte(notifications.createdAt, startDate)
          )
        );
      
      const userStats = stats[0] || {
        totalReceived: 0,
        totalRead: 0,
        totalClicked: 0,
        avgResponseTime: 0
      };
      
      // Get preferred channels
      const channelStats = await db
        .select({
          channel: notificationQueue.channel,
          count: sql<number>`count(*)`
        })
        .from(notificationQueue)
        .innerJoin(notifications, eq(notificationQueue.notificationId, notifications.id))
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notificationQueue.status, "delivered")
          )
        )
        .groupBy(notificationQueue.channel)
        .orderBy(desc(sql`count(*)`));
      
      const preferredChannels = channelStats.map(c => c.channel);
      
      // Get most active hours
      const hourlyActivity = await db
        .select({
          hour: sql<number>`extract(hour from read_at)`,
          count: sql<number>`count(*)`
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            sql`read_at is not null`
          )
        )
        .groupBy(sql`extract(hour from read_at)`)
        .orderBy(desc(sql`count(*)`))
        .limit(3);
      
      const mostActiveHours = hourlyActivity.map(h => h.hour);
      
      // Calculate engagement score (0-100)
      const readRate = userStats.totalReceived > 0 
        ? userStats.totalRead / userStats.totalReceived 
        : 0;
      const clickRate = userStats.totalRead > 0 
        ? userStats.totalClicked / userStats.totalRead 
        : 0;
      const responseScore = userStats.avgResponseTime > 0
        ? Math.max(0, 100 - (userStats.avgResponseTime / 3600)) // Penalize if > 1 hour
        : 0;
      
      const engagementScore = Math.round(
        (readRate * 40) + (clickRate * 30) + (responseScore * 30)
      );
      
      return {
        userId,
        totalReceived: userStats.totalReceived,
        totalRead: userStats.totalRead,
        totalClicked: userStats.totalClicked,
        readRate,
        clickRate,
        avgResponseTime: userStats.avgResponseTime,
        preferredChannels,
        mostActiveHours,
        engagementScore
      };
    } catch (error) {
      console.error("Error getting user engagement metrics:", error);
      throw error;
    }
  }
  
  /**
   * Get conversion funnel metrics
   */
  async getConversionFunnel(
    notificationType: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    conversionRate: number;
  }> {
    try {
      const metrics = await db
        .select({
          sent: sql<number>`count(*)`,
          delivered: sql<number>`count(case when delivered = true then 1 end)`,
          opened: sql<number>`count(case when is_read = true then 1 end)`,
          clicked: sql<number>`count(case when action_url is not null and is_read = true then 1 end)`,
          // Conversion tracking would need additional implementation
          converted: sql<number>`0`
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.type, notificationType as any),
            gte(notifications.createdAt, startDate),
            lte(notifications.createdAt, endDate)
          )
        );
      
      const funnel = metrics[0] || {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        converted: 0
      };
      
      funnel.conversionRate = funnel.sent > 0 
        ? funnel.converted / funnel.sent 
        : 0;
      
      return funnel;
    } catch (error) {
      console.error("Error getting conversion funnel:", error);
      throw error;
    }
  }
  
  /**
   * Get trending notification types
   */
  async getTrendingTypes(days: number = 7): Promise<Array<{
    type: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
  }>> {
    try {
      const currentPeriodStart = new Date();
      currentPeriodStart.setDate(currentPeriodStart.getDate() - days);
      
      const previousPeriodStart = new Date();
      previousPeriodStart.setDate(previousPeriodStart.getDate() - (days * 2));
      
      // Get current period counts
      const currentCounts = await db
        .select({
          type: notifications.type,
          count: sql<number>`count(*)`
        })
        .from(notifications)
        .where(gte(notifications.createdAt, currentPeriodStart))
        .groupBy(notifications.type);
      
      // Get previous period counts
      const previousCounts = await db
        .select({
          type: notifications.type,
          count: sql<number>`count(*)`
        })
        .from(notifications)
        .where(
          and(
            gte(notifications.createdAt, previousPeriodStart),
            lte(notifications.createdAt, currentPeriodStart)
          )
        )
        .groupBy(notifications.type);
      
      const previousMap = new Map(
        previousCounts.map(p => [p.type, p.count])
      );
      
      return currentCounts.map(current => {
        const previous = previousMap.get(current.type) || 0;
        const percentChange = previous > 0 
          ? ((current.count - previous) / previous) * 100 
          : 100;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (percentChange > 5) trend = 'up';
        else if (percentChange < -5) trend = 'down';
        
        return {
          type: current.type,
          count: current.count,
          trend,
          percentChange
        };
      }).sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error("Error getting trending types:", error);
      throw error;
    }
  }
  
  /**
   * Get delivery performance metrics
   */
  async getDeliveryPerformance(hours: number = 24): Promise<{
    successRate: number;
    avgDeliveryTime: number;
    failureReasons: Record<string, number>;
    retryStats: {
      totalRetries: number;
      successfulRetries: number;
      avgRetriesPerNotification: number;
    };
  }> {
    try {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hours);
      
      // Get delivery stats
      const deliveryStats = await db
        .select({
          total: sql<number>`count(*)`,
          delivered: sql<number>`count(case when status = 'delivered' then 1 end)`,
          failed: sql<number>`count(case when status = 'failed' then 1 end)`,
          avgDeliveryTime: sql<number>`avg(extract(epoch from (processed_at - created_at)))`,
          totalRetries: sql<number>`sum(attempts)`,
          retriedNotifications: sql<number>`count(case when attempts > 1 then 1 end)`
        })
        .from(notificationQueue)
        .where(gte(notificationQueue.createdAt, startTime));
      
      const stats = deliveryStats[0] || {
        total: 0,
        delivered: 0,
        failed: 0,
        avgDeliveryTime: 0,
        totalRetries: 0,
        retriedNotifications: 0
      };
      
      // Get failure reasons
      const failures = await db
        .select({
          error: notificationQueue.lastError,
          count: sql<number>`count(*)`
        })
        .from(notificationQueue)
        .where(
          and(
            eq(notificationQueue.status, "failed"),
            gte(notificationQueue.createdAt, startTime)
          )
        )
        .groupBy(notificationQueue.lastError);
      
      const failureReasons: Record<string, number> = {};
      failures.forEach(f => {
        const reason = f.error || 'Unknown';
        failureReasons[reason] = f.count;
      });
      
      return {
        successRate: stats.total > 0 ? stats.delivered / stats.total : 0,
        avgDeliveryTime: stats.avgDeliveryTime,
        failureReasons,
        retryStats: {
          totalRetries: stats.totalRetries,
          successfulRetries: stats.retriedNotifications,
          avgRetriesPerNotification: stats.total > 0 
            ? stats.totalRetries / stats.total 
            : 0
        }
      };
    } catch (error) {
      console.error("Error getting delivery performance:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationAnalytics = NotificationAnalyticsService.getInstance();