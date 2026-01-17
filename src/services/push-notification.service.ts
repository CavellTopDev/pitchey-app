/**
 * Push Notification Service with Browser and Mobile Support
 * Handles Web Push API, service worker registration, and delivery tracking
 */

import type { DatabaseService } from '../types/worker-types.ts';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  data?: Record<string, any>;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

export interface PushDeliveryResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
  shouldRetry: boolean;
  removeSubscription?: boolean;
}

export interface PushAnalytics {
  subscriptionId: string;
  notificationId?: string;
  event: 'sent' | 'delivered' | 'clicked' | 'dismissed' | 'failed';
  timestamp: Date;
  userAgent?: string;
  error?: string;
}

export class PushNotificationService {
  private vapidKeys: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };

  constructor(
    private db: DatabaseService,
    private redis?: any,
    vapidKeys?: { publicKey: string; privateKey: string; subject: string }
  ) {
    // VAPID keys must be provided - no process.env fallback in Cloudflare Workers
    this.vapidKeys = vapidKeys || {
      publicKey: '',
      privateKey: '',
      subject: 'mailto:support@pitchey.com',
    };
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribe(
    userId: string,
    subscription: PushSubscriptionData,
    userAgent?: string
  ): Promise<string> {
    try {
      // Detect device type from user agent
      const deviceType = this.detectDeviceType(userAgent);

      const result = await this.db.query(
        `INSERT INTO push_subscriptions (
          user_id, endpoint, p256dh_key, auth_key, user_agent, device_type, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (user_id, endpoint) 
        DO UPDATE SET 
          p256dh_key = EXCLUDED.p256dh_key,
          auth_key = EXCLUDED.auth_key,
          user_agent = EXCLUDED.user_agent,
          device_type = EXCLUDED.device_type,
          is_active = true,
          last_used_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          userId,
          subscription.endpoint,
          subscription.keys.p256dh,
          subscription.keys.auth,
          userAgent,
          deviceType,
        ]
      );

      // Raw SQL returns array directly, not { rows: [...] }
      const rows = Array.isArray(result) ? result : [];
      const subscriptionId = (rows[0] as any)?.id;

      // Cache subscription for quick lookup
      if (this.redis) {
        await this.redis.set(
          `push_subscription:${userId}:${subscriptionId}`,
          JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            deviceType,
          }),
          3600 // 1 hour TTL
        );
      }

      // Track subscription analytics
      await this.trackAnalytics({
        subscriptionId,
        event: 'sent', // Subscription created
        timestamp: new Date(),
        userAgent,
      });

      return subscriptionId;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw new Error('Failed to subscribe to push notifications');
    }
  }

  /**
   * Send push notification to user
   */
  async sendNotification(
    userId: string,
    payload: PushNotificationPayload,
    notificationId?: string
  ): Promise<PushDeliveryResult[]> {
    try {
      // Get all active subscriptions for user
      const subscriptions = await this.getUserSubscriptions(userId);

      if (subscriptions.length === 0) {
        return [{ success: false, error: 'No active subscriptions', shouldRetry: false }];
      }

      // Send to all subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(subscription =>
          this.sendToSubscription(subscription, payload, notificationId)
        )
      );

      // Process results and handle failures
      const deliveryResults: PushDeliveryResult[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const subscription = subscriptions[i];

        if (result.status === 'fulfilled') {
          deliveryResults.push({
            ...result.value,
            subscriptionId: subscription.id,
          });

          // Remove subscription if it's invalid
          if (result.value.removeSubscription) {
            await this.removeSubscription(subscription.id);
          }
        } else {
          deliveryResults.push({
            success: false,
            subscriptionId: subscription.id,
            error: result.reason?.message || 'Unknown error',
            shouldRetry: true,
          });
        }
      }

      return deliveryResults;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return [{ success: false, error: String(error), shouldRetry: true }];
    }
  }

  /**
   * Send notification to specific subscription
   */
  private async sendToSubscription(
    subscription: any,
    payload: PushNotificationPayload,
    notificationId?: string
  ): Promise<PushDeliveryResult> {
    try {
      // Prepare push payload
      const pushPayload = this.preparePushPayload(payload);
      
      // For demo purposes, we'll simulate sending
      // In production, use web-push library or similar
      const success = await this.deliverPushNotification(
        subscription.endpoint,
        subscription.p256dh_key,
        subscription.auth_key,
        pushPayload
      );

      if (success) {
        // Track delivery analytics
        await this.trackAnalytics({
          subscriptionId: subscription.id,
          notificationId,
          event: 'delivered',
          timestamp: new Date(),
        });

        // Update last used timestamp
        await this.updateSubscriptionLastUsed(subscription.id);

        return { success: true, shouldRetry: false };
      } else {
        return { success: false, error: 'Delivery failed', shouldRetry: true };
      }
    } catch (error) {
      const errorMessage = String(error);
      
      // Handle specific error types
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        return {
          success: false,
          error: errorMessage,
          shouldRetry: false,
          removeSubscription: true,
        };
      }

      if (errorMessage.includes('rate limit')) {
        return {
          success: false,
          error: errorMessage,
          shouldRetry: true,
        };
      }

      return {
        success: false,
        error: errorMessage,
        shouldRetry: true,
      };
    }
  }

  /**
   * Get user's push subscriptions
   */
  async getUserSubscriptions(userId: string): Promise<any[]> {
    try {
      // Check cache first
      if (this.redis) {
        const cached = await this.redis.get(`user_push_subscriptions:${userId}`);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      const result = await this.db.query(
        `SELECT id, endpoint, p256dh_key, auth_key, device_type, user_agent
         FROM push_subscriptions 
         WHERE user_id = $1 AND is_active = true
         ORDER BY last_used_at DESC`,
        [userId]
      );

      // Raw SQL returns array directly, not { rows: [...] }
      const rows = Array.isArray(result) ? result : [];

      // Cache for quick lookup
      if (this.redis && rows.length > 0) {
        await this.redis.set(
          `user_push_subscriptions:${userId}`,
          JSON.stringify(rows),
          300 // 5 minutes TTL
        );
      }

      return rows;
    } catch (error) {
      console.error('Error getting user subscriptions:', error);
      return [];
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(userId: string, endpoint?: string): Promise<void> {
    try {
      let query = 'UPDATE push_subscriptions SET is_active = false WHERE user_id = $1';
      const params = [userId];

      if (endpoint) {
        query += ' AND endpoint = $2';
        params.push(endpoint);
      }

      await this.db.query(query, params);

      // Clear cache
      if (this.redis) {
        await this.redis.del(`user_push_subscriptions:${userId}`);
      }

      console.log(`Unsubscribed user ${userId} from push notifications`);
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    }
  }

  /**
   * Get VAPID public key for client
   */
  getVAPIDPublicKey(): string {
    return this.vapidKeys.publicKey;
  }

  /**
   * Track push notification click
   */
  async trackClick(subscriptionId: string, notificationId?: string): Promise<void> {
    try {
      await this.trackAnalytics({
        subscriptionId,
        notificationId,
        event: 'clicked',
        timestamp: new Date(),
      });

      // Update notification as clicked in main notifications table
      if (notificationId) {
        await this.db.query(
          'UPDATE notifications SET clicked_at = CURRENT_TIMESTAMP WHERE id = $1',
          [notificationId]
        );
      }
    } catch (error) {
      console.error('Error tracking push notification click:', error);
    }
  }

  /**
   * Get push notification analytics
   */
  async getAnalytics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalClicked: number;
    clickRate: number;
    deliveryRate: number;
    byDevice: Record<string, { sent: number; clicked: number }>;
  }> {
    try {
      let whereClause = '1=1';
      const params: any[] = [];

      if (userId) {
        whereClause += ' AND ps.user_id = $' + (params.length + 1);
        params.push(userId);
      }

      if (startDate) {
        whereClause += ' AND pa.timestamp >= $' + (params.length + 1);
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND pa.timestamp <= $' + (params.length + 1);
        params.push(endDate);
      }

      const result = await this.db.query(`
        SELECT
          ps.device_type,
          COUNT(CASE WHEN pa.event = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN pa.event = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN pa.event = 'clicked' THEN 1 END) as clicked
        FROM push_analytics pa
        JOIN push_subscriptions ps ON pa.subscription_id = ps.id
        WHERE ${whereClause}
        GROUP BY ps.device_type
      `, params);

      // Raw SQL returns array directly, not { rows: [...] }
      const rows = Array.isArray(result) ? result : [];

      interface AnalyticsRow {
        device_type: string;
        sent: string;
        delivered: string;
        clicked: string;
      }

      const totalSent = rows.reduce((sum: number, row: AnalyticsRow) => sum + parseInt(row.sent), 0);
      const totalDelivered = rows.reduce((sum: number, row: AnalyticsRow) => sum + parseInt(row.delivered), 0);
      const totalClicked = rows.reduce((sum: number, row: AnalyticsRow) => sum + parseInt(row.clicked), 0);

      const byDevice = rows.reduce((acc: Record<string, { sent: number; clicked: number }>, row: AnalyticsRow) => {
        acc[row.device_type] = {
          sent: parseInt(row.sent),
          clicked: parseInt(row.clicked),
        };
        return acc;
      }, {});

      return {
        totalSent,
        totalDelivered,
        totalClicked,
        clickRate: totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0,
        deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
        byDevice,
      };
    } catch (error) {
      console.error('Error getting push analytics:', error);
      throw error;
    }
  }

  // Private helper methods

  private preparePushPayload(payload: PushNotificationPayload): string {
    const pushData = {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/badge-72x72.png',
      image: payload.image,
      data: {
        url: payload.url,
        timestamp: payload.timestamp || Date.now(),
        ...payload.data,
      },
      actions: payload.actions,
      tag: payload.tag || 'pitchey-notification',
      requireInteraction: payload.requireInteraction || false,
      silent: payload.silent || false,
    };

    return JSON.stringify(pushData);
  }

  private async deliverPushNotification(
    endpoint: string,
    p256dh: string,
    auth: string,
    payload: string
  ): Promise<boolean> {
    try {
      // In production, use web-push library
      // const webpush = require('web-push');
      // 
      // webpush.setVapidDetails(
      //   this.vapidKeys.subject,
      //   this.vapidKeys.publicKey,
      //   this.vapidKeys.privateKey
      // );
      //
      // const result = await webpush.sendNotification(
      //   { endpoint, keys: { p256dh, auth } },
      //   payload
      // );
      //
      // return result.statusCode >= 200 && result.statusCode < 300;

      // For demo purposes, simulate success
      console.log('Push notification sent:', { endpoint, payload: JSON.parse(payload) });
      return true;
    } catch (error) {
      console.error('Error delivering push notification:', error);
      throw error;
    }
  }

  private detectDeviceType(userAgent?: string): 'desktop' | 'mobile' | 'tablet' {
    if (!userAgent) return 'desktop';

    const ua = userAgent.toLowerCase();
    
    if (ua.includes('mobile')) return 'mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    
    return 'desktop';
  }

  private async removeSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE push_subscriptions SET is_active = false WHERE id = $1',
        [subscriptionId]
      );
    } catch (error) {
      console.error('Error removing push subscription:', error);
    }
  }

  private async updateSubscriptionLastUsed(subscriptionId: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE push_subscriptions SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [subscriptionId]
      );
    } catch (error) {
      console.error('Error updating subscription last used:', error);
    }
  }

  private async trackAnalytics(analytics: PushAnalytics): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO push_analytics (subscription_id, notification_id, event, timestamp, user_agent, error)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          analytics.subscriptionId,
          analytics.notificationId,
          analytics.event,
          analytics.timestamp,
          analytics.userAgent,
          analytics.error,
        ]
      );
    } catch (error) {
      console.error('Error tracking push analytics:', error);
    }
  }
}

// Service worker script for handling push notifications
export const PUSH_SERVICE_WORKER = `
// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/badge-72x72.png',
      image: data.image,
      tag: data.tag || 'pitchey-notification',
      data: data.data,
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const clickAction = event.action;
  const notification = event.notification;
  const data = notification.data;
  
  // Track click event
  if (data.subscriptionId) {
    fetch('/api/notifications/push/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: data.subscriptionId,
        notificationId: data.notificationId,
        action: clickAction,
      }),
    }).catch(console.error);
  }
  
  // Handle different actions
  if (clickAction === 'view' || !clickAction) {
    const url = data.url || '/dashboard';
    event.waitUntil(
      clients.matchAll().then(function(clientList) {
        // Check if a window/tab is already open
        for (let client of clientList) {
          if (client.url.includes(new URL(url).pathname) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window/tab if none exists
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  } else if (clickAction === 'dismiss') {
    // Just close the notification
    return;
  }
});

self.addEventListener('notificationclose', function(event) {
  const notification = event.notification;
  const data = notification.data;
  
  // Track dismiss event
  if (data.subscriptionId) {
    fetch('/api/notifications/push/track-dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: data.subscriptionId,
        notificationId: data.notificationId,
      }),
    }).catch(console.error);
  }
});
`;

export function createPushNotificationService(
  db: DatabaseService,
  redis?: any,
  vapidKeys?: { publicKey: string; privateKey: string; subject: string }
): PushNotificationService {
  return new PushNotificationService(db, redis, vapidKeys);
}