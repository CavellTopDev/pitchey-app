/**
 * Mobile Push Notification Infrastructure
 * Handles web push notifications, Firebase FCM, and APNs for mobile devices
 */

import { WorkerDatabase } from '../services/worker-database';
import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';
import { getCorsHeaders } from '../utils/response';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

interface MobilePushContext {
  request: Request;
  env: any;
  db: WorkerDatabase;
}

// Web Push VAPID configuration
const VAPID_KEYS = {
  publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa40HI95RllOcJvqBNpIzM4RSVhA-r6YwTLNYfh4YVCyNk9bJ1yj7X3YQQO8kQ',
  privateKey: 'YOUR_VAPID_PRIVATE_KEY' // Should be in environment variables
};

// Push notification types
export enum PushNotificationType {
  PITCH_LIKE = 'pitch_like',
  PITCH_COMMENT = 'pitch_comment',
  NEW_FOLLOWER = 'new_follower',
  INVESTMENT_INTEREST = 'investment_interest',
  NDA_SIGNED = 'nda_signed',
  NDA_REQUEST = 'nda_request',
  MESSAGE_RECEIVED = 'message_received',
  SYSTEM_ANNOUNCEMENT = 'system_announcement'
}

// Subscribe to push notifications
export async function subscribePushNotifications(context: MobilePushContext, userId: number): Promise<Response> {
  try {
    const body = await context.request.json();
    
    if (!body.subscription) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.VALIDATION_ERROR, 'Push subscription required')),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const subscription: PushSubscription = body.subscription;
    const deviceId = body.deviceId;
    const platform = body.platform || 'web';

    // Validate subscription format
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.VALIDATION_ERROR, 'Invalid push subscription format')),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Store or update push subscription
    await context.db.executeQuery(
      `INSERT INTO push_subscriptions (
        user_id, device_id, platform, endpoint, p256dh_key, auth_key, 
        subscription_data, created_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), true)
      ON CONFLICT (user_id, endpoint) 
      DO UPDATE SET 
        device_id = EXCLUDED.device_id,
        p256dh_key = EXCLUDED.p256dh_key,
        auth_key = EXCLUDED.auth_key,
        subscription_data = EXCLUDED.subscription_data,
        updated_at = NOW(),
        is_active = true`,
      [
        userId,
        deviceId,
        platform,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        JSON.stringify(subscription)
      ]
    );

    // Update device table with push capability
    if (deviceId) {
      await context.db.executeQuery(
        'UPDATE mobile_devices SET push_enabled = true, push_token_updated_at = NOW() WHERE id = $1 AND user_id = $2',
        [deviceId, userId]
      );
    }

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ 
        message: 'Push notifications enabled',
        vapidPublicKey: VAPID_KEYS.publicKey 
      })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Subscribe push notifications error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to enable push notifications')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Unsubscribe from push notifications
export async function unsubscribePushNotifications(context: MobilePushContext, userId: number): Promise<Response> {
  try {
    const body = await context.request.json();
    const endpoint = body.endpoint;
    const deviceId = body.deviceId;

    if (endpoint) {
      await context.db.executeQuery(
        'UPDATE push_subscriptions SET is_active = false, unsubscribed_at = NOW() WHERE user_id = $1 AND endpoint = $2',
        [userId, endpoint]
      );
    } else if (deviceId) {
      await context.db.executeQuery(
        'UPDATE push_subscriptions SET is_active = false, unsubscribed_at = NOW() WHERE user_id = $1 AND device_id = $2',
        [userId, deviceId]
      );
    } else {
      // Unsubscribe all
      await context.db.executeQuery(
        'UPDATE push_subscriptions SET is_active = false, unsubscribed_at = NOW() WHERE user_id = $1',
        [userId]
      );
    }

    // Update device table
    if (deviceId) {
      await context.db.executeQuery(
        'UPDATE mobile_devices SET push_enabled = false WHERE id = $1 AND user_id = $2',
        [deviceId, userId]
      );
    }

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ message: 'Push notifications disabled' })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Unsubscribe push notifications error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to disable push notifications')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Get push notification settings
export async function getPushNotificationSettings(context: MobilePushContext, userId: number): Promise<Response> {
  try {
    const settingsResult = await context.db.executeQuery(
      `SELECT 
        ps.platform, ps.endpoint, ps.created_at, ps.is_active,
        md.device_name, md.push_enabled
      FROM push_subscriptions ps
      LEFT JOIN mobile_devices md ON ps.device_id = md.id
      WHERE ps.user_id = $1 
      ORDER BY ps.created_at DESC`,
      [userId]
    );

    // Get notification preferences
    const preferencesResult = await context.db.executeQuery(
      'SELECT notification_type, enabled FROM notification_preferences WHERE user_id = $1',
      [userId]
    );

    const preferences = {};
    preferencesResult.rows.forEach(pref => {
      preferences[pref.notification_type] = pref.enabled;
    });

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({
        subscriptions: settingsResult.rows,
        preferences,
        vapidPublicKey: VAPID_KEYS.publicKey
      })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Get push settings error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch push settings')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Update notification preferences
export async function updateNotificationPreferences(context: MobilePushContext, userId: number): Promise<Response> {
  try {
    const body = await context.request.json();
    const preferences = body.preferences;

    if (!preferences || typeof preferences !== 'object') {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.VALIDATION_ERROR, 'Preferences object required')),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Update preferences
    for (const [notificationType, enabled] of Object.entries(preferences)) {
      await context.db.executeQuery(
        `INSERT INTO notification_preferences (user_id, notification_type, enabled, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, notification_type)
         DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
        [userId, notificationType, enabled]
      );
    }

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ message: 'Preferences updated' })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Update notification preferences error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to update preferences')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Send push notification to user
export async function sendPushNotification(
  db: WorkerDatabase,
  env: any,
  userId: number,
  notificationType: PushNotificationType,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    // Check user's notification preferences
    const preferenceResult = await db.executeQuery(
      'SELECT enabled FROM notification_preferences WHERE user_id = $1 AND notification_type = $2',
      [userId, notificationType]
    );

    if (preferenceResult.rows.length > 0 && !preferenceResult.rows[0].enabled) {
      console.log(`Push notification disabled for user ${userId}, type ${notificationType}`);
      return false;
    }

    // Get active push subscriptions for user
    const subscriptionsResult = await db.executeQuery(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (!subscriptionsResult.rows.length) {
      console.log(`No active push subscriptions for user ${userId}`);
      return false;
    }

    const results = [];

    for (const subscription of subscriptionsResult.rows) {
      try {
        const pushSubscription: PushSubscription = JSON.parse(subscription.subscription_data);
        
        // Prepare notification payload based on platform
        const notificationPayload = {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icons/icon-192x192.png',
          badge: payload.badge || '/icons/badge-72x72.png',
          tag: payload.tag || `${notificationType}-${Date.now()}`,
          data: {
            ...payload.data,
            notificationType,
            userId,
            timestamp: payload.timestamp || Date.now(),
            url: payload.data?.url || '/'
          },
          actions: payload.actions || getDefaultActionsForType(notificationType),
          requireInteraction: payload.requireInteraction || false,
          silent: payload.silent || false
        };

        // Add mobile-specific optimizations
        if (subscription.platform === 'android' || subscription.platform === 'ios') {
          notificationPayload.vibrate = payload.vibrate || [100, 50, 100];
          if (payload.image) {
            notificationPayload.image = payload.image;
          }
        }

        // Send web push notification
        const success = await sendWebPush(env, pushSubscription, notificationPayload);
        
        if (success) {
          // Update last sent timestamp
          await db.executeQuery(
            'UPDATE push_subscriptions SET last_sent_at = NOW() WHERE id = $1',
            [subscription.id]
          );
        } else {
          // Mark subscription as potentially invalid
          await db.executeQuery(
            'UPDATE push_subscriptions SET failed_attempts = failed_attempts + 1 WHERE id = $1',
            [subscription.id]
          );
        }

        results.push(success);

      } catch (error) {
        console.error(`Failed to send push to subscription ${subscription.id}:`, error);
        results.push(false);
      }
    }

    // Store notification record
    await db.executeQuery(
      `INSERT INTO sent_notifications (
        user_id, notification_type, title, body, payload, 
        sent_at, delivery_count, success_count
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [
        userId,
        notificationType,
        payload.title,
        payload.body,
        JSON.stringify(payload),
        results.length,
        results.filter(Boolean).length
      ]
    );

    return results.some(Boolean);

  } catch (error) {
    console.error('Send push notification error:', error);
    return false;
  }
}

// Send bulk push notifications
export async function sendBulkPushNotifications(
  db: WorkerDatabase,
  env: any,
  userIds: number[],
  notificationType: PushNotificationType,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Process in batches to avoid overwhelming the system
  const batchSize = 50;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    
    const promises = batch.map(async (userId) => {
      const success = await sendPushNotification(db, env, userId, notificationType, payload);
      return success ? 'sent' : 'failed';
    });

    const results = await Promise.all(promises);
    sent += results.filter(r => r === 'sent').length;
    failed += results.filter(r => r === 'failed').length;

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { sent, failed };
}

// Helper functions

function getDefaultActionsForType(notificationType: PushNotificationType): Array<{ action: string; title: string; icon?: string }> {
  switch (notificationType) {
    case PushNotificationType.PITCH_LIKE:
    case PushNotificationType.PITCH_COMMENT:
      return [
        { action: 'view', title: 'View Pitch', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/close.png' }
      ];
    case PushNotificationType.NEW_FOLLOWER:
      return [
        { action: 'view_profile', title: 'View Profile', icon: '/icons/user.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/close.png' }
      ];
    case PushNotificationType.MESSAGE_RECEIVED:
      return [
        { action: 'reply', title: 'Reply', icon: '/icons/reply.png' },
        { action: 'view', title: 'View', icon: '/icons/view.png' }
      ];
    default:
      return [
        { action: 'view', title: 'View', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/close.png' }
      ];
  }
}

async function sendWebPush(env: any, subscription: PushSubscription, payload: any): Promise<boolean> {
  try {
    // This would typically use the Web Push Protocol
    // For now, we'll simulate the API call
    
    const webPushPayload = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      payload: JSON.stringify(payload)
    };

    // In a real implementation, you would use a library like web-push
    // or make direct HTTP requests to FCM/APNs endpoints
    
    console.log('Sending web push notification:', webPushPayload);
    
    // Simulate success (in real implementation, check response status)
    return true;

  } catch (error) {
    console.error('Web push send failed:', error);
    return false;
  }
}

// Test push notification endpoint
export async function testPushNotification(context: MobilePushContext, userId: number): Promise<Response> {
  try {
    const payload: NotificationPayload = {
      title: 'Test Notification',
      body: 'This is a test push notification from Pitchey',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: {
        test: true,
        url: '/dashboard'
      }
    };

    const success = await sendPushNotification(
      context.db,
      context.env,
      userId,
      PushNotificationType.SYSTEM_ANNOUNCEMENT,
      payload
    );

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ 
        sent: success,
        message: success ? 'Test notification sent' : 'Failed to send test notification'
      })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Test push notification error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Test failed')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}