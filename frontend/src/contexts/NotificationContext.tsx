import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { notificationService } from '../services/notification.service';
import { pollingService } from '../services/polling.service';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    type?: 'primary' | 'secondary';
  }>;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  fetchNotifications: () => Promise<void>;
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await notificationService.getNotifications();
      
      // Transform API notifications to context format
      const formattedNotifications: Notification[] = data.map(n => ({
        id: n.id.toString(),
        type: n.type as Notification['type'],
        title: n.title,
        message: n.message,
        timestamp: new Date(n.createdAt),
        read: n.isRead,
      }));
      
      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    
    // Mark as read on server
    notificationService.markAsRead(parseInt(id)).catch(console.error);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    
    // Mark all as read on server
    notificationService.markAllAsRead().catch(console.error);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Set up polling for notifications
  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Set up polling interval
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    fetchNotifications,
    isLoading,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};