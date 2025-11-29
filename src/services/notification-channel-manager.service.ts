/**
 * Unified Notification Channel Manager
 * Orchestrates delivery across email, SMS, push, and in-app channels
 */

import { db } from "../db/client";
import { users, notificationPreferences } from "../db/schema-notifications";
import { eq } from "drizzle-orm";
import { twilioSMSService } from "./notification-sms-twilio.service";
import { NotificationEmailService } from "./notification-email.service";
import { notificationRateLimitService } from "./notification-ratelimit.service";
import { redis } from "../lib/redis";

export interface NotificationPayload {
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: string[];          // Specific channels to use
  priority?: 'low' | 'normal' | 'high' | 'critical';
  template?: string;
  variables?: Record<string, any>;  // Template variables
  actionUrl?: string;
  actionText?: string;
  mediaUrl?: string[];
  metadata?: Record<string, any>;
}

export interface ChannelResult {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
  price?: number;
}

export interface DeliveryResult {
  success: boolean;
  channels: ChannelResult[];
  totalSent: number;
  totalFailed: number;
  rateLimited?: boolean;
  errors?: string[];
}

// Channel priority based on notification type and urgency
const CHANNEL_PRIORITY = {
  critical: ['sms', 'push', 'email', 'inApp'],
  high: ['push', 'email', 'sms', 'inApp'],
  normal: ['email', 'push', 'inApp'],
  low: ['email', 'inApp']
};

// Template to channel mapping
const TEMPLATE_CHANNELS = {
  password_reset: ['email', 'sms'],
  verification_code: ['sms', 'email'],
  nda_request: ['email', 'push', 'inApp'],
  nda_approved: ['email', 'push', 'inApp'],
  new_message: ['push', 'inApp', 'email'],
  pitch_view: ['inApp', 'email'],
  investment_update: ['email', 'push', 'sms'],
  payment_confirmation: ['email', 'sms'],
  security_alert: ['sms', 'email', 'push'],
  marketing: ['email'],
  digest: ['email']
};

export class NotificationChannelManager {
  private static instance: NotificationChannelManager;
  private emailService: NotificationEmailService;
  private smsService: typeof twilioSMSService;
  private initialized: boolean = false;

  private constructor() {
    this.emailService = new NotificationEmailService();
    this.smsService = twilioSMSService;
  }

  public static getInstance(): NotificationChannelManager {
    if (!NotificationChannelManager.instance) {
      NotificationChannelManager.instance = new NotificationChannelManager();
    }
    return NotificationChannelManager.instance;
  }

  /**
   * Initialize all channel services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize SMS service
      await this.smsService.initialize();
      
      // Initialize other services as needed
      console.log('✅ Notification Channel Manager initialized');
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize channel manager:', error);
    }
  }

  /**
   * Send notification through appropriate channels
   */
  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    const results: ChannelResult[] = [];
    const errors: string[] = [];
    
    try {
      // Get user preferences and contact info
      const user = await this.getUserInfo(payload.userId);
      if (!user) {
        return {
          success: false,
          channels: [],
          totalSent: 0,
          totalFailed: 1,
          errors: ['User not found']
        };
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(payload.userId);
      
      // Determine channels to use
      const channels = this.determineChannels(
        payload,
        preferences,
        user
      );

      // Check rate limits for each channel
      const rateLimitChecks = await Promise.all(
        channels.map(channel => 
          notificationRateLimitService.checkRateLimit(
            payload.userId.toString(),
            channel,
            payload.template,
            user.subscriptionTier || 'basic'
          )
        )
      );

      const allowedChannels = channels.filter((_, index) => 
        rateLimitChecks[index].allowed
      );

      if (allowedChannels.length === 0) {
        return {
          success: false,
          channels: results,
          totalSent: 0,
          totalFailed: channels.length,
          rateLimited: true,
          errors: ['All channels rate limited']
        };
      }

      // Send through each allowed channel
      for (const channel of allowedChannels) {
        try {
          const result = await this.sendToChannel(
            channel,
            payload,
            user,
            preferences
          );
          results.push(result);
        } catch (error: any) {
          console.error(`Failed to send via ${channel}:`, error);
          results.push({
            channel,
            success: false,
            error: error.message
          });
          errors.push(`${channel}: ${error.message}`);
        }
      }

      // Track delivery metrics
      await this.trackDelivery(payload, results);

      const totalSent = results.filter(r => r.success).length;
      const totalFailed = results.filter(r => !r.success).length;

      return {
        success: totalSent > 0,
        channels: results,
        totalSent,
        totalFailed,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      console.error('Notification delivery failed:', error);
      return {
        success: false,
        channels: results,
        totalSent: 0,
        totalFailed: 1,
        errors: [error.message]
      };
    }
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(
    channel: string,
    payload: NotificationPayload,
    user: any,
    preferences: any
  ): Promise<ChannelResult> {
    switch (channel) {
      case 'email':
        return await this.sendEmail(payload, user, preferences);
      
      case 'sms':
        return await this.sendSMS(payload, user, preferences);
      
      case 'push':
        return await this.sendPush(payload, user, preferences);
      
      case 'inApp':
        return await this.sendInApp(payload, user);
      
      case 'webhook':
        return await this.sendWebhook(payload, user, preferences);
      
      default:
        return {
          channel,
          success: false,
          error: `Unknown channel: ${channel}`
        };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    payload: NotificationPayload,
    user: any,
    preferences: any
  ): Promise<ChannelResult> {
    try {
      // Format email content
      const emailContent = this.formatEmailContent(payload);
      
      // Send via email service
      const result = await this.emailService.sendNotificationEmail({
        to: user.email,
        subject: payload.title,
        html: emailContent.html,
        text: emailContent.text,
        category: payload.type,
        metadata: payload.metadata
      });

      return {
        channel: 'email',
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        deliveredAt: result.success ? new Date() : undefined
      };
    } catch (error: any) {
      return {
        channel: 'email',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    payload: NotificationPayload,
    user: any,
    preferences: any
  ): Promise<ChannelResult> {
    // Check if user has phone number
    if (!user.phoneNumber) {
      return {
        channel: 'sms',
        success: false,
        error: 'No phone number on file'
      };
    }

    // Check if SMS is enabled for this notification type
    if (!this.isSMSEnabledForType(payload.type, preferences)) {
      return {
        channel: 'sms',
        success: false,
        error: 'SMS disabled for this notification type'
      };
    }

    try {
      // Format SMS message (limited to 160 chars for single segment)
      const smsMessage = this.formatSMSMessage(payload);
      
      // Send via Twilio
      const result = await this.smsService.sendSMS({
        to: user.phoneNumber,
        body: smsMessage,
        template: payload.template,
        metadata: payload.metadata
      });

      return {
        channel: 'sms',
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        price: result.price ? parseFloat(result.price) : undefined,
        deliveredAt: result.success ? new Date() : undefined
      };
    } catch (error: any) {
      return {
        channel: 'sms',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send push notification
   */
  private async sendPush(
    payload: NotificationPayload,
    user: any,
    preferences: any
  ): Promise<ChannelResult> {
    // Check if user has push tokens
    if (!user.pushTokens || user.pushTokens.length === 0) {
      return {
        channel: 'push',
        success: false,
        error: 'No push tokens registered'
      };
    }

    try {
      // Format push notification
      const pushData = {
        title: payload.title,
        body: payload.message,
        data: payload.data,
        badge: 1,
        sound: 'default',
        icon: '/icon-192x192.png',
        actionUrl: payload.actionUrl
      };

      // Send to all registered devices
      // In production, integrate with FCM, APNS, or OneSignal
      const results = await Promise.all(
        user.pushTokens.map(async (token: string) => {
          // Placeholder for actual push service
          return { success: true, token };
        })
      );

      const success = results.some(r => r.success);

      return {
        channel: 'push',
        success,
        deliveredAt: success ? new Date() : undefined
      };
    } catch (error: any) {
      return {
        channel: 'push',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInApp(
    payload: NotificationPayload,
    user: any
  ): Promise<ChannelResult> {
    try {
      // Store in database (already handled by notification service)
      
      // Send via WebSocket if user is online
      if (global.wsService) {
        await global.wsService.sendNotificationToUser(payload.userId, {
          type: 'notification',
          data: {
            title: payload.title,
            message: payload.message,
            type: payload.type,
            actionUrl: payload.actionUrl,
            metadata: payload.metadata,
            timestamp: new Date().toISOString()
          }
        });
      }

      return {
        channel: 'inApp',
        success: true,
        deliveredAt: new Date()
      };
    } catch (error: any) {
      return {
        channel: 'inApp',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    payload: NotificationPayload,
    user: any,
    preferences: any
  ): Promise<ChannelResult> {
    if (!preferences?.webhookUrl) {
      return {
        channel: 'webhook',
        success: false,
        error: 'No webhook URL configured'
      };
    }

    try {
      const webhookPayload = {
        event: `notification.${payload.type}`,
        userId: payload.userId,
        notification: {
          title: payload.title,
          message: payload.message,
          type: payload.type,
          data: payload.data,
          metadata: payload.metadata
        },
        timestamp: new Date().toISOString()
      };

      // Sign webhook payload for security
      const signature = await this.signWebhookPayload(
        webhookPayload,
        preferences.webhookSecret
      );

      const response = await fetch(preferences.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': webhookPayload.event
        },
        body: JSON.stringify(webhookPayload)
      });

      return {
        channel: 'webhook',
        success: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`,
        deliveredAt: response.ok ? new Date() : undefined
      };
    } catch (error: any) {
      return {
        channel: 'webhook',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Determine which channels to use
   */
  private determineChannels(
    payload: NotificationPayload,
    preferences: any,
    user: any
  ): string[] {
    // If specific channels requested, use those
    if (payload.channels && payload.channels.length > 0) {
      return payload.channels;
    }

    // Use template-based channel selection
    if (payload.template && TEMPLATE_CHANNELS[payload.template]) {
      return TEMPLATE_CHANNELS[payload.template];
    }

    // Use priority-based channel selection
    const priority = payload.priority || 'normal';
    const priorityChannels = CHANNEL_PRIORITY[priority];

    // Filter based on user preferences and availability
    return priorityChannels.filter(channel => {
      // Check if channel is enabled in preferences
      if (preferences && preferences[channel]?.enabled === false) {
        return false;
      }

      // Check if user has required info for channel
      switch (channel) {
        case 'email':
          return !!user.email;
        case 'sms':
          return !!user.phoneNumber;
        case 'push':
          return user.pushTokens?.length > 0;
        case 'webhook':
          return !!preferences?.webhookUrl;
        default:
          return true;
      }
    });
  }

  /**
   * Format email content
   */
  private formatEmailContent(payload: NotificationPayload): {
    html: string;
    text: string;
  } {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${payload.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e5e5; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${payload.title}</h1>
            </div>
            <div class="content">
              <p>${payload.message}</p>
              ${payload.actionUrl ? `
                <a href="${payload.actionUrl}" class="button">
                  ${payload.actionText || 'Take Action'}
                </a>
              ` : ''}
            </div>
            <div class="footer">
              <p>© 2024 Pitchey. All rights reserved.</p>
              <p>
                <a href="https://pitchey.com/unsubscribe">Unsubscribe</a> | 
                <a href="https://pitchey.com/preferences">Update Preferences</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
${payload.title}

${payload.message}

${payload.actionUrl ? `Take action: ${payload.actionUrl}` : ''}

---
© 2024 Pitchey. All rights reserved.
Unsubscribe: https://pitchey.com/unsubscribe
    `.trim();

    return { html, text };
  }

  /**
   * Format SMS message (limited length)
   */
  private formatSMSMessage(payload: NotificationPayload): string {
    let message = `${payload.title}: ${payload.message}`;
    
    // Add action URL if present and fits
    if (payload.actionUrl) {
      const urlAddition = ` ${payload.actionUrl}`;
      if (message.length + urlAddition.length <= 160) {
        message += urlAddition;
      }
    }

    // Truncate if too long
    if (message.length > 160) {
      message = message.substring(0, 157) + '...';
    }

    return message;
  }

  /**
   * Check if SMS is enabled for notification type
   */
  private isSMSEnabledForType(type: string, preferences: any): boolean {
    // Critical notifications always go through
    const criticalTypes = ['password_reset', 'verification_code', 'security_alert'];
    if (criticalTypes.includes(type)) {
      return true;
    }

    // Check user preferences
    if (preferences?.sms?.types) {
      return preferences.sms.types.includes(type);
    }

    // Default SMS-enabled types
    const defaultSMSTypes = ['payment_confirmation', 'investment_update'];
    return defaultSMSTypes.includes(type);
  }

  /**
   * Get user info including contact details
   */
  private async getUserInfo(userId: number): Promise<any> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          email: true,
          phoneNumber: true,
          subscriptionTier: true,
          pushTokens: true,
          timezone: true,
          locale: true
        }
      });

      return user;
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: number): Promise<any> {
    try {
      // Try cache first
      const cached = await redis?.get(`prefs:${userId}`);
      if (cached) {
        return JSON.parse(cached as string);
      }

      // Get from database
      const prefs = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, userId)
      });

      if (prefs) {
        // Cache for 1 hour
        await redis?.setex(
          `prefs:${userId}`,
          3600,
          JSON.stringify(prefs)
        );
      }

      return prefs;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  /**
   * Track delivery metrics
   */
  private async trackDelivery(
    payload: NotificationPayload,
    results: ChannelResult[]
  ): Promise<void> {
    try {
      // Track per-channel metrics
      for (const result of results) {
        const key = `metrics:${result.channel}:${result.success ? 'sent' : 'failed'}`;
        await redis?.incr(key);

        if (payload.template) {
          await redis?.incr(`metrics:template:${payload.template}:${result.channel}`);
        }
      }

      // Track overall metrics
      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      await redis?.incrby('metrics:total:sent', sent);
      await redis?.incrby('metrics:total:failed', failed);

      // Track cost if applicable
      const totalCost = results
        .filter(r => r.price)
        .reduce((sum, r) => sum + (r.price || 0), 0);
      
      if (totalCost > 0) {
        await redis?.incrbyfloat('metrics:total:cost', totalCost);
      }
    } catch (error) {
      console.error('Failed to track delivery metrics:', error);
    }
  }

  /**
   * Sign webhook payload for security
   */
  private async signWebhookPayload(
    payload: any,
    secret?: string
  ): Promise<string> {
    if (!secret) {
      return '';
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const key = encoder.encode(secret);
    
    // Use Web Crypto API for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    
    // Convert to hex string
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Get delivery status for a notification
   */
  async getDeliveryStatus(
    notificationId: string,
    channel?: string
  ): Promise<any> {
    const statuses: any = {};

    if (!channel || channel === 'sms') {
      const smsStatus = await this.smsService.getDeliveryStatus(notificationId);
      if (smsStatus) {
        statuses.sms = smsStatus;
      }
    }

    // Add other channel status checks here

    return statuses;
  }
}

// Export singleton instance
export const notificationChannelManager = NotificationChannelManager.getInstance();