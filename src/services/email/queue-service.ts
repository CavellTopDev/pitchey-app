// Email Queue Service - Handles batch sending, retries, and delivery tracking
// Provides enterprise-grade email delivery with Redis-backed queuing

import { getEmailService } from './factory.ts';
import type { EmailData, EmailResult } from './interface.ts';
import { getRedisConnection } from '../cache.service.ts';

export interface QueuedEmail {
  id: string;
  emailData: EmailData;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt: number; // Unix timestamp
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: number;
  deliveredAt?: number;
}

export interface EmailQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  scheduled: number;
  totalSentToday: number;
  averageDeliveryTime: number;
}

export interface BatchEmailOptions {
  batchSize?: number;
  delayMs?: number;
  maxRetries?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export class EmailQueueService {
  private readonly QUEUE_PREFIX = 'email_queue';
  private readonly STATS_KEY = 'email_stats';
  private readonly DELIVERY_TRACKING_KEY = 'email_delivery';
  private isProcessing = false;
  private processingInterval?: number;

  /**
   * Add a single email to the queue
   */
  async queueEmail(
    emailData: EmailData, 
    options: {
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      scheduleAt?: Date;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedEmail: QueuedEmail = {
      id,
      emailData,
      priority: options.priority || 'normal',
      scheduledAt: options.scheduleAt ? options.scheduleAt.getTime() : Date.now(),
      attempts: 0,
      maxAttempts: options.maxRetries || 3,
      createdAt: Date.now(),
    };

    try {
      const redis = await getRedisConnection();
      if (redis) {
        const queueKey = this.getQueueKey(queuedEmail.priority);
        await redis.zadd(queueKey, queuedEmail.scheduledAt, JSON.stringify(queuedEmail));
        await this.updateStats('pending', 1);
      } else {
        // Fallback: send immediately if Redis unavailable
        console.warn('Redis unavailable, sending email immediately');
        await this.sendEmailDirect(queuedEmail);
      }
      
      console.log(`✅ Email queued: ${id} (priority: ${queuedEmail.priority})`);
      return id;
    } catch (error) {
      console.error('Failed to queue email:', error);
      throw error;
    }
  }

  /**
   * Add multiple emails to the queue with batch processing options
   */
  async queueBatchEmails(
    emails: EmailData[], 
    options: BatchEmailOptions = {}
  ): Promise<string[]> {
    const {
      batchSize = 50,
      delayMs = 1000,
      maxRetries = 3,
      priority = 'normal'
    } = options;

    const emailIds: string[] = [];
    
    try {
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        for (const emailData of batch) {
          const id = await this.queueEmail(emailData, { priority, maxRetries });
          emailIds.push(id);
        }
        
        // Add delay between batches to avoid rate limiting
        if (i + batchSize < emails.length && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      console.log(`✅ Queued ${emails.length} emails in batches of ${batchSize}`);
      return emailIds;
    } catch (error) {
      console.error('Failed to queue batch emails:', error);
      throw error;
    }
  }

  /**
   * Start the queue processor (should be called on application startup)
   */
  async startProcessor(intervalMs: number = 5000): Promise<void> {
    if (this.isProcessing) {
      console.warn('Email queue processor already running');
      return;
    }

    this.isProcessing = true;
    console.log(`🚀 Starting email queue processor (interval: ${intervalMs}ms)`);

    this.processingInterval = setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        console.error('Error in email queue processor:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop the queue processor
   */
  stopProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isProcessing = false;
    console.log('📧 Email queue processor stopped');
  }

  /**
   * Process queued emails (internal method)
   */
  private async processQueue(): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return;

      const now = Date.now();
      
      // Process queues in priority order: urgent > high > normal > low
      const priorities = ['urgent', 'high', 'normal', 'low'] as const;
      
      for (const priority of priorities) {
        const queueKey = this.getQueueKey(priority);
        
        // Get emails scheduled for now or earlier
        const results = await redis.zrangebyscore(queueKey, 0, now, 'LIMIT', 0, 10);
        
        for (const result of results) {
          try {
            const queuedEmail: QueuedEmail = JSON.parse(result);
            
            // Remove from queue first to prevent duplicate processing
            await redis.zrem(queueKey, result);
            await this.updateStats('pending', -1);
            await this.updateStats('processing', 1);
            
            // Attempt to send the email
            const emailResult = await this.sendEmailDirect(queuedEmail);
            
            if (emailResult.success) {
              queuedEmail.deliveredAt = Date.now();
              await this.trackDelivery(queuedEmail, emailResult);
              await this.updateStats('processing', -1);
              await this.updateStats('completed', 1);
              console.log(`✅ Email sent: ${queuedEmail.id}`);
            } else {
              await this.handleFailure(queuedEmail, emailResult.error || 'Unknown error');
            }
          } catch (error) {
            console.error('Error processing queued email:', error);
            await this.updateStats('processing', -1);
          }
        }
      }
    } catch (error) {
      console.error('Error in queue processing:', error);
    }
  }

  /**
   * Send email directly using the email service
   */
  private async sendEmailDirect(queuedEmail: QueuedEmail): Promise<EmailResult> {
    try {
      const emailService = getEmailService();
      
      // Add queue metadata to tracking
      queuedEmail.emailData.trackingId = queuedEmail.emailData.trackingId || queuedEmail.id;
      queuedEmail.emailData.headers = {
        'X-Queue-ID': queuedEmail.id,
        'X-Queue-Priority': queuedEmail.priority,
        'X-Queue-Attempt': (queuedEmail.attempts + 1).toString(),
        ...queuedEmail.emailData.headers,
      };
      
      const result = await emailService.sendEmail(queuedEmail.emailData);
      queuedEmail.attempts++;
      
      return result;
    } catch (error) {
      queuedEmail.attempts++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle email sending failure with retry logic
   */
  private async handleFailure(queuedEmail: QueuedEmail, error: string): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return;

      queuedEmail.lastError = error;
      await this.updateStats('processing', -1);

      if (queuedEmail.attempts < queuedEmail.maxAttempts) {
        // Schedule retry with exponential backoff
        const retryDelayMs = Math.pow(2, queuedEmail.attempts) * 60000; // 1min, 2min, 4min, etc.
        queuedEmail.scheduledAt = Date.now() + retryDelayMs;
        
        const queueKey = this.getQueueKey(queuedEmail.priority);
        await redis.zadd(queueKey, queuedEmail.scheduledAt, JSON.stringify(queuedEmail));
        await this.updateStats('pending', 1);
        
        console.warn(`⏰ Email retry scheduled: ${queuedEmail.id} (attempt ${queuedEmail.attempts}/${queuedEmail.maxAttempts})`);
      } else {
        // Max retries reached, mark as failed
        await this.updateStats('failed', 1);
        console.error(`❌ Email failed permanently: ${queuedEmail.id} - ${error}`);
        
        // Store failed email for analysis
        await redis.hset('email_failures', queuedEmail.id, JSON.stringify({
          ...queuedEmail,
          finalError: error,
          failedAt: Date.now(),
        }));
      }
    } catch (redisError) {
      console.error('Error handling email failure:', redisError);
    }
  }

  /**
   * Track successful email delivery
   */
  private async trackDelivery(queuedEmail: QueuedEmail, result: EmailResult): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return;

      const deliveryData = {
        id: queuedEmail.id,
        to: queuedEmail.emailData.to,
        subject: queuedEmail.emailData.subject,
        provider: result.providerId,
        messageId: result.messageId,
        queuedAt: queuedEmail.createdAt,
        scheduledAt: queuedEmail.scheduledAt,
        deliveredAt: queuedEmail.deliveredAt,
        attempts: queuedEmail.attempts,
        deliveryTimeMs: queuedEmail.deliveredAt! - queuedEmail.createdAt,
      };

      await redis.hset(this.DELIVERY_TRACKING_KEY, queuedEmail.id, JSON.stringify(deliveryData));
      
      // Keep delivery tracking for 30 days
      await redis.expire(this.DELIVERY_TRACKING_KEY, 30 * 24 * 60 * 60);
      
      // Update daily stats
      const today = new Date().toISOString().split('T')[0];
      await redis.hincrby(`email_daily_stats:${today}`, 'sent', 1);
    } catch (error) {
      console.error('Error tracking delivery:', error);
    }
  }

  /**
   * Get email queue statistics
   */
  async getStats(): Promise<EmailQueueStats> {
    try {
      const redis = await getRedisConnection();
      if (!redis) {
        return {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          scheduled: 0,
          totalSentToday: 0,
          averageDeliveryTime: 0,
        };
      }

      const stats = await redis.hgetall(this.STATS_KEY);
      const today = new Date().toISOString().split('T')[0];
      const dailyStats = await redis.hgetall(`email_daily_stats:${today}`);
      
      return {
        pending: parseInt(stats.pending || '0'),
        processing: parseInt(stats.processing || '0'),
        completed: parseInt(stats.completed || '0'),
        failed: parseInt(stats.failed || '0'),
        scheduled: await this.getScheduledCount(),
        totalSentToday: parseInt(dailyStats.sent || '0'),
        averageDeliveryTime: await this.getAverageDeliveryTime(),
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      throw error;
    }
  }

  /**
   * Clear all queue data (use with caution!)
   */
  async clearQueue(): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return;

      const priorities = ['urgent', 'high', 'normal', 'low'];
      for (const priority of priorities) {
        await redis.del(this.getQueueKey(priority));
      }
      
      await redis.del(this.STATS_KEY);
      console.log('📧 Email queue cleared');
    } catch (error) {
      console.error('Error clearing queue:', error);
      throw error;
    }
  }

  // Helper methods

  private getQueueKey(priority: string): string {
    return `${this.QUEUE_PREFIX}:${priority}`;
  }

  private async updateStats(metric: string, delta: number): Promise<void> {
    try {
      const redis = await getRedisConnection();
      if (redis) {
        await redis.hincrby(this.STATS_KEY, metric, delta);
      }
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  private async getScheduledCount(): Promise<number> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return 0;

      let total = 0;
      const priorities = ['urgent', 'high', 'normal', 'low'];
      
      for (const priority of priorities) {
        const queueKey = this.getQueueKey(priority);
        const count = await redis.zcard(queueKey);
        total += count;
      }
      
      return total;
    } catch (error) {
      console.error('Error getting scheduled count:', error);
      return 0;
    }
  }

  private async getAverageDeliveryTime(): Promise<number> {
    try {
      const redis = await getRedisConnection();
      if (!redis) return 0;

      const deliveries = await redis.hgetall(this.DELIVERY_TRACKING_KEY);
      const times = Object.values(deliveries)
        .map(data => JSON.parse(data).deliveryTimeMs)
        .filter(time => typeof time === 'number');

      return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    } catch (error) {
      console.error('Error getting average delivery time:', error);
      return 0;
    }
  }
}

// Singleton instance for global use
let emailQueueInstance: EmailQueueService | null = null;

export function getEmailQueueService(): EmailQueueService {
  if (!emailQueueInstance) {
    emailQueueInstance = new EmailQueueService();
  }
  return emailQueueInstance;
}

// High-level functions for easy integration
export async function queueWelcomeEmail(email: string, data: any): Promise<string> {
  const queue = getEmailQueueService();
  const { sendWelcomeEmail } = await import('./index.ts');
  
  // Create email data
  const emailData = {
    to: email,
    subject: 'Welcome to Pitchey!',
    html: '', // Will be populated by template engine
    text: '',
    trackingId: `welcome-${Date.now()}-${email}`,
  };
  
  return queue.queueEmail(emailData, { priority: 'high' });
}

export async function queuePasswordResetEmail(email: string, resetUrl: string): Promise<string> {
  const queue = getEmailQueueService();
  
  const emailData = {
    to: email,
    subject: 'Reset Your Password - Pitchey',
    html: '', // Will be populated by template engine
    text: '',
    trackingId: `password-reset-${Date.now()}-${email}`,
  };
  
  return queue.queueEmail(emailData, { priority: 'urgent' });
}

export async function queueNotificationEmail(email: string, type: string, data: any): Promise<string> {
  const queue = getEmailQueueService();
  
  const emailData = {
    to: email,
    subject: `New ${type} - Pitchey`,
    html: '', // Will be populated by template engine
    text: '',
    trackingId: `${type}-${Date.now()}-${email}`,
  };
  
  return queue.queueEmail(emailData, { priority: 'normal' });
}