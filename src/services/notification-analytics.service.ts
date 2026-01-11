/**
 * Notification Analytics and Delivery Tracking Service
 * Provides comprehensive analytics and performance metrics for the notification system
 */

import type { DatabaseService } from '../types/worker-types.ts';

export interface NotificationAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalFailed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
}

export interface ChannelAnalytics {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  deliveryRate: number;
  engagementRate: number;
}

export interface CategoryAnalytics {
  category: string;
  sent: number;
  opened: number;
  clicked: number;
  conversionRate: number;
  averageResponseTime: number;
}

export interface UserEngagementMetrics {
  userId: string;
  totalReceived: number;
  totalOpened: number;
  totalClicked: number;
  engagementScore: number;
  preferredChannel: string;
  preferredTime: string;
  averageResponseTime: number;
  lastEngagement: Date;
}

export interface DeliveryPerformance {
  timestamp: Date;
  channel: string;
  averageDeliveryTime: number;
  successRate: number;
  failureReasons: Record<string, number>;
}

export interface ABTestResults {
  testId: string;
  testName: string;
  variantA: {
    sent: number;
    opened: number;
    clicked: number;
    conversionRate: number;
  };
  variantB: {
    sent: number;
    opened: number;
    clicked: number;
    conversionRate: number;
  };
  winner: 'A' | 'B' | 'inconclusive';
  confidence: number;
  isSignificant: boolean;
}

export class NotificationAnalyticsService {
  constructor(private db: DatabaseService, private redis?: any) {}

  /**
   * Get overall notification analytics
   */
  async getOverallAnalytics(
    startDate?: Date,
    endDate?: Date,
    userId?: string
  ): Promise<NotificationAnalytics> {
    try {
      let whereClause = '1=1';
      const params: any[] = [];

      if (startDate) {
        whereClause += ` AND n.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND n.created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (userId) {
        whereClause += ` AND n.user_id = $${params.length + 1}`;
        params.push(userId);
      }

      const result = await this.db.query(`
        SELECT 
          COUNT(DISTINCT n.id) as total_sent,
          COUNT(DISTINCT CASE WHEN n.status IN ('sent', 'delivered') THEN n.id END) as total_delivered,
          COUNT(DISTINCT CASE WHEN n.read_at IS NOT NULL THEN n.id END) as total_opened,
          COUNT(DISTINCT CASE WHEN n.clicked_at IS NOT NULL THEN n.id END) as total_clicked,
          COUNT(DISTINCT CASE WHEN n.status = 'failed' THEN n.id END) as total_failed,
          COUNT(DISTINCT eu.id) as total_unsubscribes
        FROM notifications n
        LEFT JOIN email_unsubscribe_tokens eu ON eu.user_id = n.user_id 
          AND eu.used_at BETWEEN n.created_at AND COALESCE(n.created_at + INTERVAL '30 days', NOW())
        WHERE ${whereClause}
      `, params);

      const stats = result.rows[0];
      const totalSent = parseInt(stats.total_sent) || 1; // Avoid division by zero

      return {
        totalSent: parseInt(stats.total_sent),
        totalDelivered: parseInt(stats.total_delivered),
        totalOpened: parseInt(stats.total_opened),
        totalClicked: parseInt(stats.total_clicked),
        totalFailed: parseInt(stats.total_failed),
        deliveryRate: (parseInt(stats.total_delivered) / totalSent) * 100,
        openRate: parseInt(stats.total_delivered) > 0 
          ? (parseInt(stats.total_opened) / parseInt(stats.total_delivered)) * 100 
          : 0,
        clickRate: parseInt(stats.total_opened) > 0 
          ? (parseInt(stats.total_clicked) / parseInt(stats.total_opened)) * 100 
          : 0,
        bounceRate: (parseInt(stats.total_failed) / totalSent) * 100,
        unsubscribeRate: (parseInt(stats.total_unsubscribes) / totalSent) * 100,
      };
    } catch (error) {
      console.error('Error getting overall analytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics by channel
   */
  async getChannelAnalytics(
    startDate?: Date,
    endDate?: Date,
    userId?: string
  ): Promise<ChannelAnalytics[]> {
    try {
      let whereClause = '1=1';
      const params: any[] = [];

      if (startDate) {
        whereClause += ` AND n.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND n.created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (userId) {
        whereClause += ` AND n.user_id = $${params.length + 1}`;
        params.push(userId);
      }

      const result = await this.db.query(`
        SELECT 
          n.type as channel,
          COUNT(DISTINCT n.id) as sent,
          COUNT(DISTINCT CASE WHEN n.status IN ('sent', 'delivered') THEN n.id END) as delivered,
          COUNT(DISTINCT CASE WHEN n.read_at IS NOT NULL THEN n.id END) as opened,
          COUNT(DISTINCT CASE WHEN n.clicked_at IS NOT NULL THEN n.id END) as clicked,
          COUNT(DISTINCT CASE WHEN n.status = 'failed' THEN n.id END) as failed
        FROM notifications n
        WHERE ${whereClause}
        GROUP BY n.type
        ORDER BY sent DESC
      `, params);

      return result.rows.map(row => {
        const sent = parseInt(row.sent) || 1;
        const delivered = parseInt(row.delivered);
        const opened = parseInt(row.opened);
        const clicked = parseInt(row.clicked);

        return {
          channel: row.channel,
          sent,
          delivered,
          opened,
          clicked,
          failed: parseInt(row.failed),
          deliveryRate: (delivered / sent) * 100,
          engagementRate: delivered > 0 ? ((opened + clicked) / delivered) * 100 : 0,
        };
      });
    } catch (error) {
      console.error('Error getting channel analytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics by category
   */
  async getCategoryAnalytics(
    startDate?: Date,
    endDate?: Date,
    userId?: string
  ): Promise<CategoryAnalytics[]> {
    try {
      let whereClause = '1=1';
      const params: any[] = [];

      if (startDate) {
        whereClause += ` AND n.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND n.created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (userId) {
        whereClause += ` AND n.user_id = $${params.length + 1}`;
        params.push(userId);
      }

      const result = await this.db.query(`
        SELECT 
          n.category,
          COUNT(DISTINCT n.id) as sent,
          COUNT(DISTINCT CASE WHEN n.read_at IS NOT NULL THEN n.id END) as opened,
          COUNT(DISTINCT CASE WHEN n.clicked_at IS NOT NULL THEN n.id END) as clicked,
          AVG(EXTRACT(EPOCH FROM (n.read_at - n.created_at))/60) as avg_response_minutes
        FROM notifications n
        WHERE ${whereClause} AND n.status IN ('sent', 'delivered')
        GROUP BY n.category
        ORDER BY sent DESC
      `, params);

      return result.rows.map(row => {
        const sent = parseInt(row.sent) || 1;
        const opened = parseInt(row.opened);
        const clicked = parseInt(row.clicked);

        return {
          category: row.category,
          sent,
          opened,
          clicked,
          conversionRate: (clicked / sent) * 100,
          averageResponseTime: parseFloat(row.avg_response_minutes) || 0,
        };
      });
    } catch (error) {
      console.error('Error getting category analytics:', error);
      throw error;
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<UserEngagementMetrics[]> {
    try {
      let whereClause = '1=1';
      const params: any[] = [];

      if (startDate) {
        whereClause += ` AND n.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND n.created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      const result = await this.db.query(`
        SELECT 
          n.user_id,
          COUNT(DISTINCT n.id) as total_received,
          COUNT(DISTINCT CASE WHEN n.read_at IS NOT NULL THEN n.id END) as total_opened,
          COUNT(DISTINCT CASE WHEN n.clicked_at IS NOT NULL THEN n.id END) as total_clicked,
          MODE() WITHIN GROUP (ORDER BY n.type) as preferred_channel,
          DATE_PART('hour', AVG(n.read_at)) as preferred_hour,
          AVG(EXTRACT(EPOCH FROM (n.read_at - n.created_at))/60) as avg_response_minutes,
          MAX(COALESCE(n.clicked_at, n.read_at, n.created_at)) as last_engagement
        FROM notifications n
        WHERE ${whereClause}
        GROUP BY n.user_id
        HAVING COUNT(DISTINCT n.id) >= 3
        ORDER BY total_received DESC
        LIMIT $${params.length + 1}
      `, [...params, limit]);

      return result.rows.map(row => {
        const received = parseInt(row.total_received) || 1;
        const opened = parseInt(row.total_opened);
        const clicked = parseInt(row.total_clicked);

        // Calculate engagement score (0-100)
        const openRate = (opened / received) * 100;
        const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;
        const engagementScore = Math.min(100, (openRate * 0.6 + clickRate * 0.4));

        return {
          userId: row.user_id,
          totalReceived: received,
          totalOpened: opened,
          totalClicked: clicked,
          engagementScore: Math.round(engagementScore),
          preferredChannel: row.preferred_channel || 'email',
          preferredTime: `${Math.round(row.preferred_hour || 12)}:00`,
          averageResponseTime: parseFloat(row.avg_response_minutes) || 0,
          lastEngagement: new Date(row.last_engagement),
        };
      });
    } catch (error) {
      console.error('Error getting user engagement metrics:', error);
      throw error;
    }
  }

  /**
   * Get delivery performance metrics
   */
  async getDeliveryPerformance(
    timeWindow: 'hourly' | 'daily' = 'hourly',
    hours: number = 24
  ): Promise<DeliveryPerformance[]> {
    try {
      const groupBy = timeWindow === 'hourly' 
        ? `DATE_TRUNC('hour', n.created_at)`
        : `DATE_TRUNC('day', n.created_at)`;

      const result = await this.db.query(`
        SELECT 
          ${groupBy} as time_bucket,
          n.type as channel,
          AVG(EXTRACT(EPOCH FROM (n.sent_at - n.created_at))) as avg_delivery_seconds,
          COUNT(CASE WHEN n.status IN ('sent', 'delivered') THEN 1 END)::FLOAT / COUNT(*) * 100 as success_rate,
          ARRAY_AGG(DISTINCT n.error_message) FILTER (WHERE n.error_message IS NOT NULL) as error_messages
        FROM notifications n
        WHERE n.created_at >= NOW() - INTERVAL '${hours} hours'
        GROUP BY time_bucket, n.type
        ORDER BY time_bucket DESC, channel
      `);

      return result.rows.map(row => {
        // Count failure reasons
        const failureReasons: Record<string, number> = {};
        if (row.error_messages) {
          row.error_messages.forEach((error: string) => {
            const reason = this.categorizeError(error);
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
          });
        }

        return {
          timestamp: new Date(row.time_bucket),
          channel: row.channel,
          averageDeliveryTime: parseFloat(row.avg_delivery_seconds) || 0,
          successRate: parseFloat(row.success_rate) || 0,
          failureReasons,
        };
      });
    } catch (error) {
      console.error('Error getting delivery performance:', error);
      throw error;
    }
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId?: string): Promise<ABTestResults[]> {
    try {
      let whereClause = 'abt.status = \'active\'';
      const params: any[] = [];

      if (testId) {
        whereClause += ` AND abt.id = $${params.length + 1}`;
        params.push(testId);
      }

      const result = await this.db.query(`
        WITH test_metrics AS (
          SELECT 
            abt.id as test_id,
            abt.name,
            aba.variant,
            COUNT(n.id) as sent,
            COUNT(CASE WHEN n.read_at IS NOT NULL THEN 1 END) as opened,
            COUNT(CASE WHEN n.clicked_at IS NOT NULL THEN 1 END) as clicked
          FROM notification_ab_tests abt
          LEFT JOIN notification_ab_assignments aba ON abt.id = aba.test_id
          LEFT JOIN notifications n ON n.user_id = aba.user_id 
            AND n.template_id IN (abt.template_a_id, abt.template_b_id)
            AND n.created_at >= abt.start_date
            AND (abt.end_date IS NULL OR n.created_at <= abt.end_date)
          WHERE ${whereClause}
          GROUP BY abt.id, abt.name, aba.variant
        )
        SELECT 
          test_id,
          name,
          MAX(CASE WHEN variant = 'A' THEN sent END) as variant_a_sent,
          MAX(CASE WHEN variant = 'A' THEN opened END) as variant_a_opened,
          MAX(CASE WHEN variant = 'A' THEN clicked END) as variant_a_clicked,
          MAX(CASE WHEN variant = 'B' THEN sent END) as variant_b_sent,
          MAX(CASE WHEN variant = 'B' THEN opened END) as variant_b_opened,
          MAX(CASE WHEN variant = 'B' THEN clicked END) as variant_b_clicked
        FROM test_metrics
        GROUP BY test_id, name
      `, params);

      return result.rows.map(row => {
        const variantASent = parseInt(row.variant_a_sent) || 0;
        const variantAClicked = parseInt(row.variant_a_clicked) || 0;
        const variantBSent = parseInt(row.variant_b_sent) || 0;
        const variantBClicked = parseInt(row.variant_b_clicked) || 0;

        const conversionA = variantASent > 0 ? (variantAClicked / variantASent) * 100 : 0;
        const conversionB = variantBSent > 0 ? (variantBClicked / variantBSent) * 100 : 0;

        // Simple significance test (would use proper statistical test in production)
        const minSampleSize = 100;
        const isSignificant = variantASent >= minSampleSize && variantBSent >= minSampleSize;
        const difference = Math.abs(conversionA - conversionB);
        const confidence = isSignificant ? Math.min(99, difference * 10) : 0;

        let winner: 'A' | 'B' | 'inconclusive' = 'inconclusive';
        if (isSignificant && difference > 2) {
          winner = conversionA > conversionB ? 'A' : 'B';
        }

        return {
          testId: row.test_id,
          testName: row.name,
          variantA: {
            sent: variantASent,
            opened: parseInt(row.variant_a_opened) || 0,
            clicked: variantAClicked,
            conversionRate: conversionA,
          },
          variantB: {
            sent: variantBSent,
            opened: parseInt(row.variant_b_opened) || 0,
            clicked: variantBClicked,
            conversionRate: conversionB,
          },
          winner,
          confidence,
          isSignificant,
        };
      });
    } catch (error) {
      console.error('Error getting A/B test results:', error);
      throw error;
    }
  }

  /**
   * Track notification event
   */
  async trackEvent(data: {
    notificationId?: string;
    userId: string;
    eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed';
    channel?: string;
    userAgent?: string;
    ipAddress?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO notification_analytics (
          notification_id, user_id, event_type, user_agent, ip_address, event_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [
        data.notificationId,
        data.userId,
        data.eventType,
        data.userAgent,
        data.ipAddress,
        JSON.stringify(data.metadata || {}),
      ]);

      // Update notification record if applicable
      if (data.notificationId && ['opened', 'clicked'].includes(data.eventType)) {
        const updateField = data.eventType === 'opened' ? 'read_at' : 'clicked_at';
        await this.db.query(`
          UPDATE notifications 
          SET ${updateField} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND ${updateField} IS NULL
        `, [data.notificationId]);
      }

      // Cache frequently accessed metrics
      if (this.redis) {
        await this.invalidateAnalyticsCache(data.userId);
      }
    } catch (error) {
      console.error('Error tracking notification event:', error);
      throw error;
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    overall: NotificationAnalytics;
    byChannel: ChannelAnalytics[];
    byCategory: CategoryAnalytics[];
    topUsers: UserEngagementMetrics[];
    deliveryPerformance: DeliveryPerformance[];
    recommendations: string[];
  }> {
    try {
      const [overall, byChannel, byCategory, topUsers, deliveryPerformance] = await Promise.all([
        this.getOverallAnalytics(startDate, endDate, userId),
        this.getChannelAnalytics(startDate, endDate, userId),
        this.getCategoryAnalytics(startDate, endDate, userId),
        this.getUserEngagementMetrics(startDate, endDate, 10),
        this.getDeliveryPerformance('daily', Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))),
      ]);

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        overall,
        byChannel,
        byCategory,
        topUsers,
      });

      return {
        overall,
        byChannel,
        byCategory,
        topUsers,
        deliveryPerformance,
        recommendations,
      };
    } catch (error) {
      console.error('Error generating performance report:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics for dashboard
   */
  async getRealTimeMetrics(): Promise<{
    lastHourSent: number;
    lastHourDelivered: number;
    lastHourOpened: number;
    currentQueueSize: number;
    averageDeliveryTime: number;
    failureRate: number;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [metrics, queueSize] = await Promise.all([
        this.db.query(`
          SELECT 
            COUNT(*) as sent,
            COUNT(CASE WHEN status IN ('sent', 'delivered') THEN 1 END) as delivered,
            COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as opened,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
            AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_delivery_seconds
          FROM notifications
          WHERE created_at >= $1
        `, [oneHourAgo]),
        this.getQueueSize(),
      ]);

      const stats = metrics.rows[0];
      const sent = parseInt(stats.sent) || 1;

      return {
        lastHourSent: sent,
        lastHourDelivered: parseInt(stats.delivered) || 0,
        lastHourOpened: parseInt(stats.opened) || 0,
        currentQueueSize: queueSize,
        averageDeliveryTime: parseFloat(stats.avg_delivery_seconds) || 0,
        failureRate: (parseInt(stats.failed) / sent) * 100,
      };
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      throw error;
    }
  }

  // Private helper methods

  private categorizeError(error: string): string {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('network') || errorLower.includes('timeout')) {
      return 'Network Error';
    } else if (errorLower.includes('auth') || errorLower.includes('permission')) {
      return 'Authentication Error';
    } else if (errorLower.includes('rate limit') || errorLower.includes('quota')) {
      return 'Rate Limit';
    } else if (errorLower.includes('invalid') || errorLower.includes('malformed')) {
      return 'Invalid Data';
    } else if (errorLower.includes('bounce') || errorLower.includes('undeliverable')) {
      return 'Delivery Failed';
    } else {
      return 'Other Error';
    }
  }

  private generateRecommendations(data: {
    overall: NotificationAnalytics;
    byChannel: ChannelAnalytics[];
    byCategory: CategoryAnalytics[];
    topUsers: UserEngagementMetrics[];
  }): string[] {
    const recommendations: string[] = [];

    // Overall performance recommendations
    if (data.overall.openRate < 20) {
      recommendations.push('Consider improving subject lines and send times to increase open rates');
    }

    if (data.overall.clickRate < 5) {
      recommendations.push('Optimize call-to-action buttons and notification content for better engagement');
    }

    if (data.overall.deliveryRate < 95) {
      recommendations.push('Review delivery infrastructure to improve delivery rates');
    }

    // Channel-specific recommendations
    const emailChannel = data.byChannel.find(c => c.channel === 'email');
    if (emailChannel && emailChannel.engagementRate < 15) {
      recommendations.push('Email engagement is low - consider A/B testing different templates and send times');
    }

    const pushChannel = data.byChannel.find(c => c.channel === 'push');
    if (pushChannel && pushChannel.deliveryRate < 90) {
      recommendations.push('Push notification delivery rate needs improvement - check device subscription management');
    }

    // Category-specific recommendations
    const lowPerformingCategories = data.byCategory.filter(c => c.conversionRate < 3);
    if (lowPerformingCategories.length > 0) {
      recommendations.push(`Low conversion rates detected for: ${lowPerformingCategories.map(c => c.category).join(', ')}`);
    }

    // User engagement recommendations
    const lowEngagementUsers = data.topUsers.filter(u => u.engagementScore < 30).length;
    if (lowEngagementUsers > data.topUsers.length * 0.3) {
      recommendations.push('High number of low-engagement users - consider implementing re-engagement campaigns');
    }

    return recommendations;
  }

  private async getQueueSize(): Promise<number> {
    // This would check the actual queue size
    // For now, return a mock value
    return 0;
  }

  private async invalidateAnalyticsCache(userId: string): Promise<void> {
    if (!this.redis) return;

    try {
      const cacheKeys = [
        `analytics:user:${userId}`,
        `analytics:overall`,
        `analytics:channels`,
        `analytics:categories`,
      ];

      await Promise.all(cacheKeys.map(key => this.redis.del(key)));
    } catch (error) {
      console.error('Error invalidating analytics cache:', error);
    }
  }
}

export function createNotificationAnalyticsService(
  db: DatabaseService,
  redis?: any
): NotificationAnalyticsService {
  return new NotificationAnalyticsService(db, redis);
}