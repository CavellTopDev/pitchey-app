import { getEmailQueueService } from "./email-queue.service.ts";
import { getNotificationEmailService } from "./notification-email.service.ts";
import { db } from "../db/client.ts";
import { users, emailPreferences, digestHistory, pitches, pitchViews, follows } from "../db/schema.ts";
import { eq, gte, lt, and, sql, desc } from "npm:drizzle-orm";

export class EmailCronService {
  private emailQueue = getEmailQueueService();
  private notificationService = getNotificationEmailService();
  private isProcessing = false;

  // Main cron job - runs every minute
  async runCronJobs(): Promise<void> {
    if (this.isProcessing) {
      console.log("Email cron job already running, skipping...");
      return;
    }

    this.isProcessing = true;
    
    try {
      console.log("Starting email cron jobs...");
      
      // Process pending emails (high priority)
      await this.processPendingEmails();
      
      // Run other periodic tasks based on time
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Run weekly digest on Sunday at 9 AM
      if (dayOfWeek === 0 && hour === 9) {
        await this.sendWeeklyDigests();
      }
      
      // Clean up old emails daily at 2 AM
      if (hour === 2) {
        await this.cleanupOldEmails();
      }
      
      // Retry failed emails every 6 hours
      if (hour % 6 === 0) {
        await this.retryFailedEmails();
      }
      
      console.log("Email cron jobs completed successfully");
    } catch (error) {
      console.error("Error in email cron jobs:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process pending emails in queue
  private async processPendingEmails(): Promise<void> {
    try {
      console.log("Processing pending emails...");
      await this.emailQueue.processPendingEmails(25); // Process up to 25 emails per run
    } catch (error) {
      console.error("Error processing pending emails:", error);
    }
  }

  // Send weekly digest emails
  private async sendWeeklyDigests(): Promise<void> {
    try {
      console.log("Sending weekly digest emails...");
      
      // Get all users who want weekly digests
      const usersWithDigest = await db
        .select({
          userId: emailPreferences.userId,
          email: users.email,
          firstName: users.firstName,
          username: users.username,
          digestDay: emailPreferences.digestDay,
          digestTime: emailPreferences.digestTime,
          timezone: emailPreferences.timezone,
        })
        .from(emailPreferences)
        .innerJoin(users, eq(emailPreferences.userId, users.id))
        .where(
          and(
            eq(emailPreferences.emailEnabled, true),
            eq(emailPreferences.weeklyDigest, true)
          )
        );

      console.log(`Found ${usersWithDigest.length} users for weekly digest`);

      for (const user of usersWithDigest) {
        try {
          // Check if we already sent digest for this week
          const weekStart = this.getWeekStart(new Date());
          const existingDigest = await db
            .select()
            .from(digestHistory)
            .where(
              and(
                eq(digestHistory.userId, user.userId),
                eq(digestHistory.weekStart, weekStart)
              )
            )
            .limit(1);

          if (existingDigest.length > 0) {
            console.log(`Digest already sent for user ${user.userId} this week`);
            continue;
          }

          // Generate weekly stats
          const stats = await this.generateWeeklyStats(user.userId);
          
          // Get recommendations
          const recommendations = await this.generateRecommendations(user.userId);

          // Send digest email
          await this.notificationService.sendWeeklyDigestEmail(
            user.userId,
            stats,
            recommendations
          );

          // Record that we sent the digest
          await db.insert(digestHistory).values({
            userId: user.userId,
            weekStart,
            weekEnd: this.getWeekEnd(weekStart),
            stats,
          });

          console.log(`Weekly digest sent to user ${user.userId}`);
        } catch (error) {
          console.error(`Error sending weekly digest to user ${user.userId}:`, error);
        }
      }
    } catch (error) {
      console.error("Error sending weekly digests:", error);
    }
  }

  // Generate weekly stats for a user
  private async generateWeeklyStats(userId: number): Promise<any> {
    const weekStart = this.getWeekStart(new Date());
    const weekEnd = this.getWeekEnd(weekStart);

    try {
      // Get user's pitches
      const userPitches = await db
        .select({ id: pitches.id })
        .from(pitches)
        .where(eq(pitches.userId, userId));

      const pitchIds = userPitches.map(p => p.id);

      // Count new followers (simplified - would need a follows table with timestamps)
      const newFollowers = 0; // TODO: Implement when follows table has timestamps

      // Count messages (simplified - would need message timestamps)
      const messages = 0; // TODO: Implement when messages are integrated

      // Count pitch views this week
      const viewsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pitchViews)
        .where(
          and(
            sql`pitch_id IN (${pitchIds.join(',') || '0'})`,
            gte(pitchViews.viewedAt, weekStart),
            lt(pitchViews.viewedAt, weekEnd)
          )
        );

      const views = viewsResult[0]?.count || 0;

      // Count new pitches this week
      const newPitchesResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pitches)
        .where(
          and(
            eq(pitches.userId, userId),
            gte(pitches.createdAt, weekStart),
            lt(pitches.createdAt, weekEnd)
          )
        );

      const newPitches = newPitchesResult[0]?.count || 0;

      // Get top performing pitches
      const topPitches = await db
        .select({
          title: pitches.title,
          id: pitches.id,
        })
        .from(pitches)
        .where(eq(pitches.userId, userId))
        .orderBy(desc(pitches.viewCount))
        .limit(3);

      return {
        newPitches,
        newFollowers,
        messages,
        views,
        topPitches: topPitches.map(pitch => ({
          title: pitch.title,
          views: 0, // TODO: Calculate views for this week
          url: `${Deno.env.get("BASE_URL") || "https://pitchey.com"}/pitches/${pitch.id}`,
        })),
      };
    } catch (error) {
      console.error(`Error generating weekly stats for user ${userId}:`, error);
      return {
        newPitches: 0,
        newFollowers: 0,
        messages: 0,
        views: 0,
        topPitches: [],
      };
    }
  }

  // Generate recommendations for a user
  private async generateRecommendations(userId: number): Promise<any[]> {
    try {
      // Get user preferences (simplified recommendation)
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) return [];

      // Get recent popular pitches (simplified)
      const recommendations = await db
        .select({
          id: pitches.id,
          title: pitches.title,
          userId: pitches.userId,
          firstName: users.firstName,
          username: users.username,
        })
        .from(pitches)
        .innerJoin(users, eq(pitches.userId, users.id))
        .where(eq(pitches.status, "published"))
        .orderBy(desc(pitches.viewCount))
        .limit(3);

      return recommendations.map(rec => ({
        title: rec.title,
        creator: rec.firstName || rec.username,
        url: `${Deno.env.get("BASE_URL") || "https://pitchey.com"}/pitches/${rec.id}`,
      }));
    } catch (error) {
      console.error(`Error generating recommendations for user ${userId}:`, error);
      return [];
    }
  }

  // Clean up old emails
  private async cleanupOldEmails(): Promise<void> {
    try {
      console.log("Cleaning up old emails...");
      
      // Delete emails older than 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      
      const deletedCount = await this.emailQueue.cleanOldEmails(cutoffDate);
      console.log(`Cleaned up ${deletedCount} old emails`);
    } catch (error) {
      console.error("Error cleaning up old emails:", error);
    }
  }

  // Retry failed emails
  private async retryFailedEmails(): Promise<void> {
    try {
      console.log("Retrying failed emails...");
      
      // Retry emails that failed more than 1 hour ago
      const retryAfter = new Date();
      retryAfter.setHours(retryAfter.getHours() - 1);
      
      const retriedCount = await this.emailQueue.retryFailedEmails(retryAfter);
      console.log(`Retried ${retriedCount} failed emails`);
    } catch (error) {
      console.error("Error retrying failed emails:", error);
    }
  }

  // Helper: Get start of week (Monday)
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  // Helper: Get end of week (Sunday)
  private getWeekEnd(weekStart: Date): Date {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
  }

  // Get queue statistics
  async getStats(): Promise<any> {
    try {
      const queueStats = await this.emailQueue.getQueueStats();
      
      return {
        queue: queueStats,
        isProcessing: this.isProcessing,
        lastRun: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error getting email cron stats:", error);
      return {
        queue: { pending: 0, sent: 0, failed: 0, total: 0 },
        isProcessing: this.isProcessing,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Singleton instance
let emailCronServiceInstance: EmailCronService | null = null;

export function getEmailCronService(): EmailCronService {
  if (!emailCronServiceInstance) {
    emailCronServiceInstance = new EmailCronService();
  }
  return emailCronServiceInstance;
}

// Start the cron service if in production
if (Deno.env.get("DENO_ENV") === "production") {
  const cronService = getEmailCronService();
  
  // Run every minute
  setInterval(async () => {
    await cronService.runCronJobs();
  }, 60 * 1000);
  
  console.log("Email cron service started");
}

export default EmailCronService;