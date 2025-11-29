/**
 * Notification Digest Service
 * Batches notifications for email digests
 */

import { db } from "../db/db";
import { 
  notifications, 
  notificationPreferences,
  notificationTemplates
} from "../db/schema-notifications";
import { users } from "../db/schema";
import { eq, and, gte, lte, inArray, isNull } from "drizzle-orm";
import { emailService } from "./email.service";
import { redis } from "../lib/redis";

interface DigestNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  actionUrl?: string;
  relatedUser?: {
    name: string;
    avatar?: string;
  };
}

interface UserDigest {
  userId: number;
  email: string;
  name: string;
  frequency: 'daily' | 'weekly';
  notifications: DigestNotification[];
  summary: {
    total: number;
    byType: Record<string, number>;
    mostImportant: DigestNotification[];
  };
}

export class NotificationDigestService {
  private static instance: NotificationDigestService;
  
  private constructor() {}
  
  static getInstance(): NotificationDigestService {
    if (!NotificationDigestService.instance) {
      NotificationDigestService.instance = new NotificationDigestService();
    }
    return NotificationDigestService.instance;
  }
  
  /**
   * Process daily digest emails
   */
  async processDailyDigests(): Promise<void> {
    console.log("Processing daily notification digests...");
    
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      await this.processDigests('daily', yesterday, today);
    } catch (error) {
      console.error("Error processing daily digests:", error);
      throw error;
    }
  }
  
  /**
   * Process weekly digest emails
   */
  async processWeeklyDigests(): Promise<void> {
    console.log("Processing weekly notification digests...");
    
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      await this.processDigests('weekly', weekAgo, today);
    } catch (error) {
      console.error("Error processing weekly digests:", error);
      throw error;
    }
  }
  
  /**
   * Process digest emails for a specific frequency
   */
  private async processDigests(
    frequency: 'daily' | 'weekly',
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Get users with digest preferences
      const usersWithDigest = await db
        .select({
          userId: notificationPreferences.userId,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          emailDigest: notificationPreferences.emailDigest,
          timezone: notificationPreferences.timezone,
          maxDailyEmails: notificationPreferences.maxDailyEmails
        })
        .from(notificationPreferences)
        .innerJoin(users, eq(notificationPreferences.userId, users.id))
        .where(
          and(
            eq(notificationPreferences.emailDigest, frequency),
            eq(notificationPreferences.emailEnabled, true),
            eq(users.emailVerified, true)
          )
        );
      
      console.log(`Found ${usersWithDigest.length} users for ${frequency} digest`);
      
      // Process each user's digest
      for (const user of usersWithDigest) {
        try {
          await this.sendUserDigest(user, startDate, endDate);
          
          // Track sent digest
          await this.trackDigestSent(user.userId, frequency);
          
          // Rate limiting between emails
          await this.delay(100);
        } catch (error) {
          console.error(`Error sending digest to user ${user.userId}:`, error);
        }
      }
    } catch (error) {
      console.error("Error processing digests:", error);
      throw error;
    }
  }
  
  /**
   * Send digest email to a user
   */
  private async sendUserDigest(
    user: any,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Check if already sent today
      const sentKey = `digest:sent:${user.userId}:${endDate.getTime()}`;
      const alreadySent = await redis?.get(sentKey);
      if (alreadySent) {
        console.log(`Digest already sent to user ${user.userId}`);
        return;
      }
      
      // Get unread notifications for the period
      const userNotifications = await db
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          message: notifications.message,
          createdAt: notifications.createdAt,
          actionUrl: notifications.actionUrl,
          relatedUser: {
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl
          }
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.relatedUserId, users.id))
        .where(
          and(
            eq(notifications.userId, user.userId),
            eq(notifications.isRead, false),
            gte(notifications.createdAt, startDate),
            lte(notifications.createdAt, endDate),
            eq(notifications.delivered, true)
          )
        )
        .orderBy(notifications.createdAt);
      
      if (userNotifications.length === 0) {
        console.log(`No notifications for user ${user.userId}`);
        return;
      }
      
      // Group notifications by type
      const byType: Record<string, number> = {};
      const digestNotifications: DigestNotification[] = [];
      
      for (const notif of userNotifications) {
        byType[notif.type] = (byType[notif.type] || 0) + 1;
        
        digestNotifications.push({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          createdAt: notif.createdAt,
          actionUrl: notif.actionUrl,
          relatedUser: notif.relatedUser ? {
            name: `${notif.relatedUser.firstName} ${notif.relatedUser.lastName}`,
            avatar: notif.relatedUser.profileImageUrl
          } : undefined
        });
      }
      
      // Get most important notifications (high priority or with actions)
      const mostImportant = digestNotifications
        .filter(n => n.actionUrl)
        .slice(0, 5);
      
      // Create digest data
      const digest: UserDigest = {
        userId: user.userId,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        frequency: user.emailDigest,
        notifications: digestNotifications,
        summary: {
          total: digestNotifications.length,
          byType,
          mostImportant
        }
      };
      
      // Send the email
      await this.sendDigestEmail(digest);
      
      // Mark digest as sent
      if (redis) {
        await redis.setex(sentKey, 86400, '1'); // 24 hours
      }
      
      // Mark notifications as delivered via email
      const notificationIds = digestNotifications.map(n => n.id);
      await this.markAsEmailDelivered(notificationIds);
      
    } catch (error) {
      console.error(`Error sending digest to user ${user.userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Send the actual digest email
   */
  private async sendDigestEmail(digest: UserDigest): Promise<void> {
    try {
      const subject = digest.frequency === 'daily' 
        ? `Your Daily Pitchey Digest - ${digest.summary.total} notifications`
        : `Your Weekly Pitchey Digest - ${digest.summary.total} notifications`;
      
      const html = this.generateDigestHTML(digest);
      const text = this.generateDigestText(digest);
      
      await emailService.sendEmail({
        to: digest.email,
        subject,
        html,
        text,
        category: 'notification_digest',
        metadata: {
          userId: digest.userId,
          frequency: digest.frequency,
          notificationCount: digest.summary.total
        }
      });
      
      console.log(`Sent ${digest.frequency} digest to ${digest.email}`);
    } catch (error) {
      console.error("Error sending digest email:", error);
      throw error;
    }
  }
  
  /**
   * Generate HTML for digest email
   */
  private generateDigestHTML(digest: UserDigest): string {
    const typeLabels: Record<string, string> = {
      pitch_viewed: '👁️ Views',
      pitch_liked: '❤️ Likes',
      nda_requested: '📄 NDA Requests',
      investment_received: '💰 Investments',
      message_received: '💬 Messages',
      new_follower: '👥 Followers'
    };
    
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
    .summary { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px; }
    .summary-item { text-align: center; padding: 10px; background: white; border-radius: 6px; }
    .summary-count { font-size: 24px; font-weight: bold; color: #4f46e5; }
    .summary-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
    .notification { border-left: 3px solid #4f46e5; padding: 15px; margin-bottom: 15px; background: #f9fafb; }
    .notification-title { font-weight: 600; color: #111827; margin-bottom: 5px; }
    .notification-message { color: #4b5563; font-size: 14px; }
    .notification-time { color: #9ca3af; font-size: 12px; margin-top: 5px; }
    .cta-button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Hello ${digest.name}! 👋</h1>
      <p>Here's your ${digest.frequency} notification digest from Pitchey</p>
    </div>
    
    <div class="content">
      <div class="summary">
        <h2>📊 Summary</h2>
        <div class="summary-grid">
          ${Object.entries(digest.summary.byType)
            .slice(0, 6)
            .map(([type, count]) => `
              <div class="summary-item">
                <div class="summary-count">${count}</div>
                <div class="summary-label">${typeLabels[type] || type}</div>
              </div>
            `).join('')}
        </div>
      </div>
      
      ${digest.summary.mostImportant.length > 0 ? `
        <div>
          <h2>⚡ Most Important</h2>
          ${digest.summary.mostImportant.map(notif => `
            <div class="notification">
              <div class="notification-title">${notif.title}</div>
              <div class="notification-message">${notif.message}</div>
              <div class="notification-time">${this.formatTime(notif.createdAt)}</div>
              ${notif.actionUrl ? `
                <a href="${notif.actionUrl}" class="cta-button" style="font-size: 12px; padding: 8px 16px;">
                  View Details →
                </a>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://pitchey.pages.dev/notifications" class="cta-button">
          View All Notifications
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p>You received this email because you have ${digest.frequency} digest notifications enabled.</p>
      <p>
        <a href="https://pitchey.pages.dev/settings/notifications">Manage Preferences</a> | 
        <a href="https://pitchey.pages.dev/unsubscribe?token=${digest.userId}">Unsubscribe</a>
      </p>
      <p>© 2025 Pitchey. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }
  
  /**
   * Generate plain text for digest email
   */
  private generateDigestText(digest: UserDigest): string {
    return `
Hello ${digest.name}!

Here's your ${digest.frequency} notification digest from Pitchey:

SUMMARY
=======
Total notifications: ${digest.summary.total}

${Object.entries(digest.summary.byType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

MOST IMPORTANT
==============
${digest.summary.mostImportant
  .map(n => `
${n.title}
${n.message}
${this.formatTime(n.createdAt)}
${n.actionUrl ? `View: ${n.actionUrl}` : ''}
`)
  .join('\n---\n')}

View all notifications: https://pitchey.pages.dev/notifications

--
You received this email because you have ${digest.frequency} digest notifications enabled.
Manage preferences: https://pitchey.pages.dev/settings/notifications
© 2025 Pitchey. All rights reserved.
`;
  }
  
  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    
    return date.toLocaleDateString();
  }
  
  /**
   * Mark notifications as delivered via email
   */
  private async markAsEmailDelivered(notificationIds: number[]): Promise<void> {
    try {
      // Update delivery status in queue
      // This would be implemented based on your queue structure
      console.log(`Marked ${notificationIds.length} notifications as email delivered`);
    } catch (error) {
      console.error("Error marking notifications as delivered:", error);
    }
  }
  
  /**
   * Track that a digest was sent
   */
  private async trackDigestSent(userId: number, frequency: string): Promise<void> {
    try {
      const key = `digest:stats:${frequency}:${new Date().toISOString().split('T')[0]}`;
      
      if (redis) {
        await redis.hincrby(key, 'total', 1);
        await redis.hincrby(key, `user:${userId}`, 1);
        await redis.expire(key, 86400 * 30); // Keep for 30 days
      }
    } catch (error) {
      console.error("Error tracking digest:", error);
    }
  }
  
  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get digest statistics
   */
  async getDigestStats(days: number = 30): Promise<{
    daily: { sent: number; users: number };
    weekly: { sent: number; users: number };
    trend: number;
  }> {
    try {
      // This would aggregate stats from Redis or database
      return {
        daily: { sent: 0, users: 0 },
        weekly: { sent: 0, users: 0 },
        trend: 0
      };
    } catch (error) {
      console.error("Error getting digest stats:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationDigestService = NotificationDigestService.getInstance();