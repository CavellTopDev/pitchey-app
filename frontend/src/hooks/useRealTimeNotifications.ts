import { useEffect, useCallback } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useNotificationToast } from '../components/Toast/NotificationToastContainer';
import { notificationService } from '../services/notification.service';

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
  const { subscribeToMessages, sendMessage } = useWebSocket();
  const toast = useNotificationToast();

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

  // Subscribe to WebSocket messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages(handleNotificationMessage);
    return unsubscribe;
  }, [subscribeToMessages, handleNotificationMessage]);

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