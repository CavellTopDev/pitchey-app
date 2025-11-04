import apiClient from '../lib/api-client';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId?: number;
  relatedType?: string;
  data?: any;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
}

export interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    message: string;
  };
}

export class NotificationsService {
  /**
   * Get all notifications for the current user
   */
  static async getNotifications(limit: number = 20): Promise<Notification[]> {
    try {
      const response = await apiClient.get<NotificationsResponse>(`/api/notifications?limit=${limit}`);
      
      if (response.success && response.data?.notifications) {
        return response.data.notifications;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  }

  /**
   * Get only unread notifications
   */
  static async getUnreadNotifications(): Promise<Notification[]> {
    try {
      const response = await apiClient.get<{ success: boolean; data: Notification[] }>('/api/notifications/unread');
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch unread notifications:', error);
      return [];
    }
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: number): Promise<boolean> {
    try {
      const response = await apiClient.post(`/api/notifications/${notificationId}/read`);
      return response.success;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  static async markMultipleAsRead(notificationIds: number[]): Promise<boolean> {
    try {
      const response = await apiClient.post('/api/notifications/read', {
        notificationIds
      });
      return response.success;
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<boolean> {
    try {
      // Get all notification IDs first
      const notifications = await this.getNotifications(1000); // Get a large number to cover all
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      
      if (unreadIds.length === 0) {
        return true; // Nothing to mark as read
      }
      
      return await this.markMultipleAsRead(unreadIds);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }

  /**
   * Get notification preferences
   */
  static async getPreferences(): Promise<NotificationPreferences | null> {
    try {
      const response = await apiClient.get<{ preferences: NotificationPreferences }>('/api/notifications/preferences');
      return response.preferences || null;
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
      return null;
    }
  }

  /**
   * Update notification preferences
   */
  static async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const response = await apiClient.put('/api/notifications/preferences', preferences);
      return response.success;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  /**
   * Convert backend notification to frontend format
   */
  static convertToFrontendFormat(notification: Notification) {
    return {
      id: notification.id.toString(),
      type: this.mapNotificationType(notification.type),
      title: notification.title,
      message: notification.message,
      timestamp: new Date(notification.createdAt),
      read: notification.isRead,
      metadata: {
        backendId: notification.id,
        relatedId: notification.relatedId,
        relatedType: notification.relatedType,
        data: notification.data
      }
    };
  }

  /**
   * Map backend notification types to frontend types
   */
  private static mapNotificationType(backendType: string): 'info' | 'success' | 'warning' | 'error' {
    switch (backendType) {
      case 'nda_approved':
      case 'investment':
      case 'follow':
        return 'success';
      case 'nda_rejected':
      case 'error':
        return 'error';
      case 'nda_request':
      case 'pitch_update':
      case 'info_request':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Get notification actions based on type
   */
  static getNotificationActions(notification: Notification) {
    const actions: Array<{ label: string; action: () => void; type?: 'primary' | 'secondary' }> = [];

    switch (notification.type) {
      case 'nda_request':
        actions.push(
          {
            label: 'View Pitch',
            action: () => {
              if (notification.data?.pitchId) {
                window.location.href = `/pitch/${notification.data.pitchId}`;
              }
            },
            type: 'primary'
          },
          {
            label: 'Manage NDAs',
            action: () => {
              window.location.href = '/creator/nda-management';
            },
            type: 'secondary'
          }
        );
        break;
      
      case 'message':
        actions.push({
          label: 'View Messages',
          action: () => {
            window.location.href = '/messages';
          },
          type: 'primary'
        });
        break;
      
      case 'investment':
        actions.push({
          label: 'View Investment',
          action: () => {
            window.location.href = '/creator/analytics';
          },
          type: 'primary'
        });
        break;
      
      case 'follow':
        actions.push({
          label: 'View Profile',
          action: () => {
            if (notification.data?.userId) {
              window.location.href = `/user/${notification.data.userId}`;
            }
          },
          type: 'primary'
        });
        break;
    }

    return actions;
  }
}