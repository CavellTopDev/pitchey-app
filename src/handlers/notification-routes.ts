/**
 * Notification API Routes Handler
 * Comprehensive REST API endpoints for the notification system
 */

import type { Context } from 'hono';
import { z } from 'zod';
import type { DatabaseService } from '../types/worker-types.ts';
import { ApiResponseBuilder, ErrorCode, errorHandler } from '../utils/api-response.ts';
import { NotificationIntegrationService } from '../services/notification-integration.service.ts';

// Validation schemas
const SendNotificationSchema = z.object({
  userId: z.string().optional(), // Optional, will use current user if not provided
  templateName: z.string().optional(),
  type: z.enum(['email', 'push', 'in_app', 'sms']).default('in_app'),
  category: z.enum(['investment', 'project', 'system', 'analytics', 'market']),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  htmlContent: z.string().optional(),
  contextType: z.string().optional(),
  contextId: z.string().optional(),
  actionUrl: z.string().optional(),
  actionText: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  variables: z.record(z.any()).default({}),
  channels: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    in_app: z.boolean().optional(),
    sms: z.boolean().optional(),
  }).optional(),
});

const UpdatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  investmentAlerts: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  projectUpdates: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  systemAlerts: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  analyticsAlerts: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  marketIntelligence: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  digestFrequency: z.enum(['instant', 'daily', 'weekly', 'monthly']).optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
});

export class NotificationRoutesHandler {
  constructor(
    private db: DatabaseService,
    private notificationIntegration: NotificationIntegrationService
  ) {}

  /**
   * POST /api/notifications/send - Send immediate notification
   */
  async sendNotification(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const validatedData = SendNotificationSchema.parse(body);

      // Use current user if userId not provided
      const userId = validatedData.userId || user.id;

      // Check if user has permission to send notifications to other users
      if (userId !== user.id && user.role !== 'admin') {
        return c.json({ error: 'Cannot send notifications to other users' }, 403);
      }

      const services = this.notificationIntegration.getServices();
      const notificationData = {
        ...validatedData,
        userId,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
      };

      const result = await services.notification.sendNotification(notificationData);

      return c.json({
        success: true,
        notificationId: result,
        message: 'Notification sent successfully',
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      return c.json({
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * GET /api/notifications - Get user notifications with pagination
   */
  async getNotifications(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const category = c.req.query('category');
      const unreadOnly = c.req.query('unreadOnly') === 'true';
      const contextType = c.req.query('contextType');

      const services = this.notificationIntegration.getServices();
      const result = await services.notification.getUserNotifications(user.id, {
        page,
        limit,
        category,
        unreadOnly,
        contextType,
      });

      return c.json({
        success: true,
        data: result.notifications,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
        unreadCount: result.unreadCount,
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      return c.json({
        error: 'Failed to get notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * PUT /api/notifications/:id/read - Mark notification as read
   */
  async markAsRead(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const notificationId = c.req.param('id');
      const services = this.notificationIntegration.getServices();

      await services.notification.markAsRead([notificationId], user.id);

      return c.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return c.json({
        error: 'Failed to mark notification as read',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * PUT /api/notifications/read-multiple - Mark multiple notifications as read
   */
  async markMultipleAsRead(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { notificationIds } = await c.req.json();
      
      if (!Array.isArray(notificationIds)) {
        return c.json({ error: 'notificationIds must be an array' }, 400);
      }

      const services = this.notificationIntegration.getServices();
      await services.notification.markAsRead(notificationIds, user.id);

      return c.json({
        success: true,
        message: `${notificationIds.length} notifications marked as read`,
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      return c.json({
        error: 'Failed to mark notifications as read',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * GET /api/notifications/preferences - Get user notification preferences
   */
  async getPreferences(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const preferences = await services.notification.getUserPreferences(user.id);

      return c.json({
        success: true,
        preferences,
      });
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return c.json({
        error: 'Failed to get notification preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/preferences - Update notification preferences
   */
  async updatePreferences(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const updates = UpdatePreferencesSchema.parse(body);

      const services = this.notificationIntegration.getServices();
      const updatedPreferences = await services.notification.updateUserPreferences(user.id, updates);

      return c.json({
        success: true,
        preferences: updatedPreferences,
        message: 'Notification preferences updated successfully',
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return c.json({
        error: 'Failed to update notification preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/push/subscribe - Subscribe to push notifications
   */
  async subscribeToPush(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const { endpoint, keys } = body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return c.json({ error: 'Invalid push subscription data' }, 400);
      }

      const userAgent = c.req.header('User-Agent') || '';
      const services = this.notificationIntegration.getServices();
      
      const subscriptionId = await services.push.subscribe(
        user.id,
        { endpoint, keys },
        userAgent
      );

      return c.json({
        success: true,
        subscriptionId,
        message: 'Successfully subscribed to push notifications',
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return c.json({
        error: 'Failed to subscribe to push notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * DELETE /api/notifications/push/unsubscribe - Unsubscribe from push notifications
   */
  async unsubscribeFromPush(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { endpoint } = await c.req.json();
      const services = this.notificationIntegration.getServices();

      await services.push.unsubscribe(user.id, endpoint);

      return c.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications',
      });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return c.json({
        error: 'Failed to unsubscribe from push notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * GET /api/notifications/push/vapid-key - Get VAPID public key
   */
  async getVAPIDKey(c: Context) {
    try {
      const services = this.notificationIntegration.getServices();
      const publicKey = services.push.getVAPIDPublicKey();

      return c.json({
        success: true,
        publicKey,
      });
    } catch (error) {
      console.error('Error getting VAPID key:', error);
      return c.json({
        error: 'Failed to get VAPID key',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/push/track-click - Track push notification click
   */
  async trackPushClick(c: Context) {
    try {
      const { subscriptionId, notificationId } = await c.req.json();
      const services = this.notificationIntegration.getServices();

      await services.push.trackClick(subscriptionId, notificationId);

      return c.json({
        success: true,
        message: 'Push notification click tracked',
      });
    } catch (error) {
      console.error('Error tracking push notification click:', error);
      return c.json({
        error: 'Failed to track push notification click',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * GET /api/notifications/templates - Get all email templates (admin only)
   */
  async getTemplates(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const category = c.req.query('category');
      const services = this.notificationIntegration.getServices();
      const templates = await services.emailTemplate.getTemplates(category);

      return c.json({
        success: true,
        templates,
      });
    } catch (error) {
      console.error('Error getting templates:', error);
      return c.json({
        error: 'Failed to get templates',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/templates/preview - Preview email template (admin only)
   */
  async previewTemplate(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { templateName, sampleData } = await c.req.json();
      const services = this.notificationIntegration.getServices();

      const preview = await services.emailTemplate.previewTemplate(templateName, sampleData);

      return c.json({
        success: true,
        preview,
      });
    } catch (error) {
      console.error('Error previewing template:', error);
      return c.json({
        error: 'Failed to preview template',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/digest - Generate and send digest notifications (admin only)
   */
  async sendDigest(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { digestType } = await c.req.json();

      if (!['daily', 'weekly', 'monthly'].includes(digestType)) {
        return c.json({ error: 'Invalid digest type' }, 400);
      }

      const services = this.notificationIntegration.getServices();
      await services.notification.sendDigestNotifications(digestType);

      return c.json({
        success: true,
        message: `${digestType} digest notifications sent successfully`,
      });
    } catch (error) {
      console.error('Error sending digest notifications:', error);
      return c.json({
        error: 'Failed to send digest notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * GET /api/notifications/analytics - Get notification analytics
   */
  async getAnalytics(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');
      const includeUserData = user.role === 'admin';

      const services = this.notificationIntegration.getServices();
      
      const [notificationMetrics, pushMetrics] = await Promise.all([
        services.notification.getNotificationMetrics(
          includeUserData ? undefined : user.id,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        ),
        services.push.getAnalytics(
          includeUserData ? undefined : user.id,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        ),
      ]);

      return c.json({
        success: true,
        analytics: {
          notifications: notificationMetrics,
          push: pushMetrics,
        },
      });
    } catch (error) {
      console.error('Error getting notification analytics:', error);
      return c.json({
        error: 'Failed to get notification analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * DELETE /api/notifications/unsubscribe - Process email unsubscribe
   */
  async processUnsubscribe(c: Context) {
    try {
      const token = c.req.query('token');
      const category = c.req.query('category');

      if (!token) {
        return c.json({ error: 'Unsubscribe token required' }, 400);
      }

      const services = this.notificationIntegration.getServices();
      const result = await services.notification.processUnsubscribe(token);

      if (!result.success) {
        return c.json({ error: 'Invalid or expired unsubscribe token' }, 400);
      }

      return c.json({
        success: true,
        message: category
          ? `Successfully unsubscribed from ${category} notifications`
          : 'Successfully unsubscribed from all email notifications',
        category: result.category,
      });
    } catch (error) {
      console.error('Error processing unsubscribe:', error);
      return c.json({
        error: 'Failed to process unsubscribe request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/test - Send test notification (admin only)
   */
  async sendTestNotification(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { type = 'in_app', title = 'Test Notification', message = 'This is a test notification.' } = await c.req.json();

      // Send test notification using integration service
      await this.notificationIntegration.notifyWelcome({
        userId: user.id,
        userName: user.first_name || 'Test User',
        userType: user.user_type as any || 'creator',
      });

      return c.json({
        success: true,
        message: 'Test notification sent successfully',
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      return c.json({
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
}

export function createNotificationRoutesHandler(
  db: DatabaseService,
  notificationIntegration: NotificationIntegrationService
): NotificationRoutesHandler {
  return new NotificationRoutesHandler(db, notificationIntegration);
}