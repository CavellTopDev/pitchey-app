import { useEffect, useCallback, useRef } from 'react';
import { useNotificationToast } from '../components/Toast/NotificationToastContainer';
import { notificationService } from '../services/notification.service';
import { useBetterAuthStore } from '../store/betterAuthStore';

interface NotificationData {
  type: 'nda_request' | 'nda_approved' | 'nda_declined' | 'investment' | 'message' | 
        'pitch_viewed' | 'follow' | 'comment' | 'like' | 'system';
  title: string;
  message: string;
  data?: any;
  userId?: number;
  pitchId?: number;
  conversationId?: number;
  requireInteraction?: boolean;
}

export function useRealTimeNotifications() {
  const toast = useNotificationToast();
  const { isAuthenticated } = useBetterAuthStore();
  const lastNotificationId = useRef<number>(0);
  const pollingInterval = useRef<NodeJS.Timer | null>(null);

  // Mock WebSocket functions for compatibility
  const subscribeToMessages = () => {};
  const sendMessage = () => {};

  // Handle incoming real-time notifications
  const handleNotificationMessage = useCallback((message: any) => {
    if (message.type !== 'notification') return;

    const notificationData: NotificationData = message.data;

    // Show toast notification
    switch (notificationData.type) {
      case 'nda_request':
        toast.notifyNDARequest(
          notificationData.data?.pitchTitle || 'Unknown Pitch',
          notificationData.data?.requesterName || 'Someone',
          notificationData.pitchId || 0
        );
        break;

      case 'nda_approved':
        toast.notifyNDAApproved(notificationData.data?.pitchTitle || 'Your pitch');
        break;

      case 'nda_declined':
        toast.notifyNDADeclined(notificationData.data?.pitchTitle || 'Your pitch');
        break;

      case 'investment':
        toast.notifyNewInvestment(
          notificationData.data?.amount || 0,
          notificationData.data?.pitchTitle || 'Your pitch'
        );
        break;

      case 'message':
        toast.notifyNewMessage(
          notificationData.data?.senderName || 'Someone',
          notificationData.message,
          notificationData.conversationId || 0
        );
        break;

      case 'pitch_viewed':
        toast.notifyPitchViewed(
          notificationData.data?.pitchTitle || 'Your pitch',
          notificationData.data?.viewerName || 'Someone'
        );
        break;

      case 'follow':
        toast.notifyFollowReceived(
          notificationData.data?.followerName || 'Someone',
          notificationData.userId || 0
        );
        break;

      case 'comment':
        toast.info(
          'New Comment',
          `${notificationData.data?.commenterName || 'Someone'} commented on your pitch`,
          {
            duration: 5000,
            actions: [{
              label: 'View',
              action: () => window.location.href = `/pitch/${notificationData.pitchId}#comments`,
              variant: 'primary'
            }]
          }
        );
        break;

      case 'like':
        toast.info(
          'Pitch Liked',
          `${notificationData.data?.likerName || 'Someone'} liked your pitch`,
          { duration: 4000 }
        );
        break;

      case 'system':
        toast.info(notificationData.title, notificationData.message, {
          duration: notificationData.requireInteraction ? 0 : 6000,
          autoClose: !notificationData.requireInteraction
        });
        break;

      default:
        // Generic notification
        toast.info(notificationData.title, notificationData.message);
    }

    // Also show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      notificationService.showNotification({
        title: notificationData.title,
        body: notificationData.message,
        icon: '/pitcheylogo.png',
        tag: `realtime_${Date.now()}`,
        data: notificationData.data,
        requireInteraction: notificationData.requireInteraction
      });
    }
  }, [toast]);

  // Poll for new notifications instead of WebSocket
  useEffect(() => {
    if (!isAuthenticated) return;

    const pollNotifications = async () => {
      try {
        // Fetch recent notifications from API
        const apiUrl = import.meta.env.VITE_API_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
        const response = await fetch(`${apiUrl}/api/user/notifications`, {
          method: 'GET',
          credentials: 'include' // Send cookies for Better Auth session
        });
        
        // Handle 404 gracefully - endpoint might not exist yet
        if (response.status === 404) {
          // Silently ignore - endpoint not implemented yet
          return;
        }
        
        if (!response.ok) {
          // Handle 401 with mock data for demo purposes
          if (response.status === 401) {
            // Use mock notifications for demo when auth fails
            const mockNotifications = [
              {
                id: Date.now(),
                type: 'info',
                title: 'Welcome to Pitchey',
                message: 'Your dashboard is ready. Start exploring!',
                timestamp: new Date().toISOString()
              }
            ];
            
            // Only show welcome notification once per session
            if (!sessionStorage.getItem('welcome_notification_shown')) {
              mockNotifications.forEach((notification: any) => {
                handleNotificationMessage({
                  type: 'notification',
                  data: {
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    data: {}
                  }
                });
              });
              sessionStorage.setItem('welcome_notification_shown', 'true');
            }
          }
          
          // Only log error for non-404/401 errors
          if (response.status !== 404 && response.status !== 401) {
            console.warn(`Notification polling returned status: ${response.status}`);
          }
          return;
        }
        
        const data = await response.json();
        
        if (data && Array.isArray(data)) {
          const newNotifications = data.filter(
            (n: any) => n.id > lastNotificationId.current
          );
          
          // Process new notifications
          newNotifications.forEach((notification: any) => {
            handleNotificationMessage({
              type: 'notification',
              data: {
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data,
                pitchId: notification.pitchId,
                conversationId: notification.conversationId
              }
            });
            
            // Update last notification ID
            if (notification.id > lastNotificationId.current) {
              lastNotificationId.current = notification.id;
            }
          });
        }
      } catch (error) {
        // Silently handle errors to avoid console spam
        // Only log if it's not a network error (which is common)
        if (error instanceof Error && !error.message.includes('fetch')) {
          console.warn('Notification polling error:', error.message);
        }
      }
    };

    // DISABLED: Polling was causing rate limiting and 429 errors
    // Notifications should be fetched on-demand or via WebSocket when available
    // pollNotifications(); // Initial poll
    // pollingInterval.current = setInterval(pollNotifications, 30000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [isAuthenticated, handleNotificationMessage]);

  // Methods to send real-time notifications (for admin/system use)
  const sendNotification = useCallback((notification: NotificationData) => {
    sendMessage({
      type: 'broadcast_notification',
      data: notification
    });
  }, [sendMessage]);

  const sendTargetedNotification = useCallback((userId: number, notification: NotificationData) => {
    sendMessage({
      type: 'send_notification',
      data: {
        ...notification,
        targetUserId: userId
      }
    });
  }, [sendMessage]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          toast.success('Notifications enabled', 'You\'ll now receive browser notifications');
        }
        return permission;
      } catch (error) {
        console.error('Failed to request notification permission:', error);
        return 'denied';
      }
    }
    return Notification.permission;
  }, [toast]);

  return {
    sendNotification,
    sendTargetedNotification,
    requestNotificationPermission
  };
}