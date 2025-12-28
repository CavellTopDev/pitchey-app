import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useWebSocketAdvanced } from '../hooks/useWebSocketAdvanced';
import type { WebSocketMessage, ConnectionStatus, MessageQueueStatus } from '../types/websocket';
import { useAuthStore } from '../store/authStore';
import { config } from '../config';
import { presenceFallbackService } from '../services/presence-fallback.service';

interface NotificationData {
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

interface DashboardMetrics {
  pitchViews: number;
  totalRevenue: number;
  activeInvestors: number;
  newMessages: number;
  lastUpdated: Date;
}

interface PresenceData {
  userId: number;
  username: string;
  status: 'online' | 'away' | 'offline' | 'dnd';
  lastSeen: Date;
  activity?: string;
}

interface TypingData {
  conversationId: number;
  userId: number;
  username: string;
  isTyping: boolean;
}

interface UploadProgress {
  uploadId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface PitchViewData {
  pitchId: number;
  viewCount: number;
  uniqueViewers: number;
  recentViewers: Array<{
    userId: number;
    username: string;
    timestamp: Date;
  }>;
}

interface WebSocketContextType {
  // Connection state
  connectionStatus: ConnectionStatus;
  queueStatus: MessageQueueStatus;
  isConnected: boolean;
  
  // Real-time data
  notifications: NotificationData[];
  dashboardMetrics: DashboardMetrics | null;
  onlineUsers: PresenceData[];
  typingIndicators: TypingData[];
  uploadProgress: UploadProgress[];
  pitchViews: Map<number, PitchViewData>;
  
  // Actions
  sendMessage: (message: WebSocketMessage) => boolean;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  updatePresence: (status: PresenceData['status'], activity?: string) => void;
  startTyping: (conversationId: number) => void;
  stopTyping: (conversationId: number) => void;
  trackPitchView: (pitchId: number) => void;
  
  // Connection control
  connect: () => void;
  disconnect: () => void;
  clearQueue: () => void;
  
  // Emergency controls
  disableWebSocket: () => void;
  enableWebSocket: () => void;
  isWebSocketDisabled: boolean;
  
  // Subscriptions
  subscribeToNotifications: (callback: (notification: NotificationData) => void) => () => void;
  subscribeToDashboard: (callback: (metrics: DashboardMetrics) => void) => () => void;
  subscribeToPresence: (callback: (users: PresenceData[]) => void) => () => void;
  subscribeToTyping: (conversationId: number, callback: (typing: TypingData[]) => void) => () => void;
  subscribeToUploads: (callback: (uploads: UploadProgress[]) => void) => () => void;
  subscribeToPitchViews: (pitchId: number, callback: (data: PitchViewData) => void) => () => void;
  
  // General message subscription for custom hooks
  subscribeToMessages: (callback: (message: WebSocketMessage) => void) => () => void;
  
  // Notification permission (must be called from user interaction)
  requestNotificationPermission: () => Promise<NotificationPermission>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user, isAuthenticated } = useAuthStore();
  
  // Emergency disable state - DISABLED BY DEFAULT on free tier
  const [isWebSocketDisabled, setIsWebSocketDisabled] = useState(true);
  
  // Fallback state - always use polling on free tier
  const [usingFallback, setUsingFallback] = useState(true);
  
  // State
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceData[]>([]);
  const [typingIndicators, setTypingIndicators] = useState<TypingData[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [pitchViews, setPitchViews] = useState<Map<number, PitchViewData>>(new Map());
  
  // Subscription callbacks
  const [subscriptions] = useState({
    notifications: new Set<(notification: NotificationData) => void>(),
    dashboard: new Set<(metrics: DashboardMetrics) => void>(),
    presence: new Set<(users: PresenceData[]) => void>(),
    typing: new Map<number, Set<(typing: TypingData[]) => void>>(),
    uploads: new Set<(uploads: UploadProgress[]) => void>(),
    pitchViews: new Map<number, Set<(data: PitchViewData) => void>>(),
    messages: new Set<(message: WebSocketMessage) => void>(), // General message subscriptions
  });
  
  // Track previous user type for portal switching detection
  const previousUserType = useRef<string | null>(localStorage.getItem('userType'));
  
  // WebSocket connection
  const {
    connectionStatus,
    queueStatus,
    isConnected,
    sendMessage: wsSendMessage,
    connect,
    disconnect,
    clearQueue,
  } = useWebSocketAdvanced({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    autoConnect: isAuthenticated && !isWebSocketDisabled && config.WEBSOCKET_ENABLED,
    maxReconnectAttempts: 5,  // Reduced to prevent infinite loops
    reconnectInterval: 5000,  // Increased initial delay
    maxReconnectInterval: 30000,  // Reduced max interval
    maxQueueSize: 100,
    enablePersistence: true,
    rateLimit: {
      maxMessages: 120,
      windowMs: 60000,
    },
  });
  
  // Handle incoming messages
  function handleMessage(message: WebSocketMessage) {
    // Notify all general message subscribers first
    subscriptions.messages.forEach(callback => callback(message));
    
    switch (message.type) {
      case 'notification':
        handleNotificationMessage(message);
        break;
      case 'dashboard_update':
        handleDashboardUpdate(message);
        break;
      case 'presence_update':
        handlePresenceUpdate(message);
        break;
      case 'typing':
        handleTypingIndicator(message);
        break;
      case 'upload_progress':
        handleUploadProgress(message);
        break;
      case 'pitch_view':
        handlePitchView(message);
        break;
      case 'draft_sync':
        // Handled by useDraftSync hook
        break;
      case 'ping':
      case 'pong':
      case 'connected':
      case 'error':
        // These are handled by the lower-level WebSocket hooks
        break;
      case 'initial_data':
        // Handle initial data from server
        console.log('📦 Initial data received:', message.data);
        // Store notifications if present
        if (message.data?.notifications && Array.isArray(message.data.notifications)) {
          setNotifications(message.data.notifications.map((n: any) => ({
            id: n.id?.toString() || Math.random().toString(),
            type: n.type || 'info',
            title: n.title || 'Notification',
            message: n.message || '',
            timestamp: new Date(n.createdAt || Date.now()),
            read: n.isRead || false
          })));
        }
        break;
      default:
        // Only log unhandled messages in development mode
        if (process.env.NODE_ENV === 'development') {
          console.log('Unhandled WebSocket message type:', message.type);
        }
    }
  }
  
  function handleNotificationMessage(message: WebSocketMessage) {
    const notification: NotificationData = {
      id: message.id || `notif_${Date.now()}`,
      type: message.data?.type || 'info',
      title: message.data?.title || 'Notification',
      message: message.data?.message || '',
      timestamp: new Date(message.timestamp || Date.now()),
      read: false,
      actions: message.data?.actions,
    };
    
    setNotifications(prev => [notification, ...prev]);
    
    // Notify subscribers
    subscriptions.notifications.forEach(callback => callback(notification));
    
    // Show browser notification if supported and permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/pitcheylogo.png',
        tag: notification.id,
      });
    }
  }
  
  function handleDashboardUpdate(message: WebSocketMessage) {
    const metrics: DashboardMetrics = {
      pitchViews: message.data?.pitchViews || 0,
      totalRevenue: message.data?.totalRevenue || 0,
      activeInvestors: message.data?.activeInvestors || 0,
      newMessages: message.data?.newMessages || 0,
      lastUpdated: new Date(message.timestamp || Date.now()),
    };
    
    setDashboardMetrics(metrics);
    
    // Notify subscribers
    subscriptions.dashboard.forEach(callback => callback(metrics));
  }
  
  function handlePresenceUpdate(message: WebSocketMessage) {
    const presenceData: PresenceData = {
      userId: message.data?.userId,
      username: message.data?.username,
      status: message.data?.status || 'offline',
      lastSeen: new Date(message.data?.lastSeen || Date.now()),
      activity: message.data?.activity,
    };
    
    setOnlineUsers(prev => {
      const filtered = prev.filter(user => user.userId !== presenceData.userId);
      if (presenceData.status !== 'offline') {
        return [...filtered, presenceData];
      }
      return filtered;
    });
    
    // Notify subscribers
    subscriptions.presence.forEach(callback => callback(onlineUsers));
  }
  
  function handleTypingIndicator(message: WebSocketMessage) {
    const typingData: TypingData = {
      conversationId: message.data?.conversationId,
      userId: message.data?.userId,
      username: message.data?.username,
      isTyping: message.data?.isTyping,
    };
    
    setTypingIndicators(prev => {
      const filtered = prev.filter(
        t => !(t.conversationId === typingData.conversationId && t.userId === typingData.userId)
      );
      
      if (typingData.isTyping) {
        return [...filtered, typingData];
      }
      return filtered;
    });
    
    // Notify conversation-specific subscribers
    const conversationSubs = subscriptions.typing.get(typingData.conversationId);
    if (conversationSubs) {
      const conversationTyping = typingIndicators.filter(
        t => t.conversationId === typingData.conversationId
      );
      conversationSubs.forEach(callback => callback(conversationTyping));
    }
  }
  
  function handleUploadProgress(message: WebSocketMessage) {
    const progressData: UploadProgress = {
      uploadId: message.data?.uploadId,
      filename: message.data?.filename,
      progress: message.data?.progress || 0,
      status: message.data?.status || 'uploading',
      error: message.data?.error,
    };
    
    setUploadProgress(prev => {
      const filtered = prev.filter(u => u.uploadId !== progressData.uploadId);
      return [...filtered, progressData];
    });
    
    // Notify subscribers
    subscriptions.uploads.forEach(callback => callback(uploadProgress));
    
    // Auto-remove completed/errored uploads after 5 seconds
    if (progressData.status === 'completed' || progressData.status === 'error') {
      setTimeout(() => {
        setUploadProgress(prev => prev.filter(u => u.uploadId !== progressData.uploadId));
      }, 5000);
    }
  }
  
  function handlePitchView(message: WebSocketMessage) {
    const viewData: PitchViewData = {
      pitchId: message.data?.pitchId,
      viewCount: message.data?.viewCount || 0,
      uniqueViewers: message.data?.uniqueViewers || 0,
      recentViewers: message.data?.recentViewers || [],
    };
    
    setPitchViews(prev => new Map(prev.set(viewData.pitchId, viewData)));
    
    // Notify pitch-specific subscribers
    const pitchSubs = subscriptions.pitchViews.get(viewData.pitchId);
    if (pitchSubs) {
      pitchSubs.forEach(callback => callback(viewData));
    }
  }
  
  function handleConnect() {
    console.log('WebSocket connected - updating presence to online');
    
    // Update presence to online when connected
    if (user) {
      updatePresence('online');
    }
    
    // Request initial data
    wsSendMessage({
      type: 'request_initial_data',
      data: {
        includeDashboard: true,
        includePresence: true,
        includeNotifications: true,
      },
    });
  }
  
  function handleDisconnect() {
    console.log('WebSocket disconnected');
    
    // Update local state to reflect disconnection
    setOnlineUsers(prev => prev.filter(user => user.userId !== user?.id));
    
    // Enhanced circuit breaker for bundling-induced loops
    const recentAttempts = connectionStatus.reconnectAttempts;
    if (recentAttempts >= 3) { // Reduced threshold for faster detection
      console.warn(`WebSocket reconnection loop detected (${recentAttempts} attempts). Auto-disabling to prevent infinite loops.`);
      setTimeout(() => {
        setIsWebSocketDisabled(true);
        localStorage.setItem('pitchey_websocket_disabled', 'true');
        localStorage.setItem('pitchey_websocket_loop_detected', Date.now().toString());
        
        // Start fallback service when WebSocket fails
        if (isAuthenticated && !usingFallback) {
          console.log('Starting fallback presence service due to WebSocket failure');
          setUsingFallback(true);
          presenceFallbackService.start();
        }
      }, 500); // Faster disable
    }
  }
  
  // Public methods
  const sendMessage = useCallback((message: WebSocketMessage) => {
    return wsSendMessage(message);
  }, [wsSendMessage]);
  
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    
    sendMessage({
      type: 'notification_read',
      data: { notificationId: id },
    });
  }, [sendMessage]);
  
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    sendMessage({
      type: 'notifications_clear_all',
    });
  }, [sendMessage]);
  
  const updatePresence = useCallback(async (status: PresenceData['status'], activity?: string) => {
    // Try WebSocket first
    if (isConnected && !usingFallback) {
      sendMessage({
        type: 'presence_update',
        data: { status, activity },
      });
    } else {
      // Use fallback service
      console.log('Using fallback presence update');
      await presenceFallbackService.updatePresence({ status, activity });
    }
  }, [sendMessage, isConnected, usingFallback]);
  
  const startTyping = useCallback((conversationId: number) => {
    sendMessage({
      type: 'typing',
      data: { conversationId, isTyping: true },
    });
  }, [sendMessage]);
  
  const stopTyping = useCallback((conversationId: number) => {
    sendMessage({
      type: 'typing',
      data: { conversationId, isTyping: false },
    });
  }, [sendMessage]);
  
  const trackPitchView = useCallback((pitchId: number) => {
    sendMessage({
      type: 'pitch_view_update',
      data: { pitchId },
    });
  }, [sendMessage]);
  
  // Subscription methods
  const subscribeToNotifications = useCallback((callback: (notification: NotificationData) => void) => {
    subscriptions.notifications.add(callback);
    return () => subscriptions.notifications.delete(callback);
  }, []);

  const subscribeToMessages = useCallback((callback: (message: WebSocketMessage) => void) => {
    subscriptions.messages.add(callback);
    return () => subscriptions.messages.delete(callback);
  }, []);
  
  const subscribeToDashboard = useCallback((callback: (metrics: DashboardMetrics) => void) => {
    subscriptions.dashboard.add(callback);
    return () => subscriptions.dashboard.delete(callback);
  }, []);
  
  const subscribeToPresence = useCallback((callback: (users: PresenceData[]) => void) => {
    subscriptions.presence.add(callback);
    return () => subscriptions.presence.delete(callback);
  }, []);
  
  const subscribeToTyping = useCallback((
    conversationId: number, 
    callback: (typing: TypingData[]) => void
  ) => {
    if (!subscriptions.typing.has(conversationId)) {
      subscriptions.typing.set(conversationId, new Set());
    }
    subscriptions.typing.get(conversationId)!.add(callback);
    
    return () => {
      const subs = subscriptions.typing.get(conversationId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          subscriptions.typing.delete(conversationId);
        }
      }
    };
  }, []);
  
  const subscribeToUploads = useCallback((callback: (uploads: UploadProgress[]) => void) => {
    subscriptions.uploads.add(callback);
    return () => subscriptions.uploads.delete(callback);
  }, []);
  
  const subscribeToPitchViews = useCallback((
    pitchId: number, 
    callback: (data: PitchViewData) => void
  ) => {
    if (!subscriptions.pitchViews.has(pitchId)) {
      subscriptions.pitchViews.set(pitchId, new Set());
    }
    subscriptions.pitchViews.get(pitchId)!.add(callback);
    
    return () => {
      const subs = subscriptions.pitchViews.get(pitchId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          subscriptions.pitchViews.delete(pitchId);
        }
      }
    };
  }, []);
  
  // Handle authentication state changes and portal switches
  useEffect(() => {
    // Check for portal type change (cross-portal authentication issue fix)
    const currentUserType = localStorage.getItem('userType');
    
    // If user type changed, we're switching portals - disconnect WebSocket to prevent conflicts
    if (previousUserType.current && currentUserType && previousUserType.current !== currentUserType) {
      console.log(`Portal switch detected: ${previousUserType.current} → ${currentUserType}`);
      console.log('Disconnecting WebSocket to prevent cross-portal authentication conflicts...');
      disconnect();
      
      // Clear all real-time data for portal switch
      setNotifications([]);
      setDashboardMetrics(null);
      setOnlineUsers([]);
      setTypingIndicators([]);
      setUploadProgress([]);
      setPitchViews(new Map());
      
      // Stop fallback service
      if (usingFallback) {
        presenceFallbackService.stop();
        setUsingFallback(false);
      }
      
      // Allow time for cleanup before reconnecting
      setTimeout(() => {
        if (isAuthenticated && !isWebSocketDisabled && config.WEBSOCKET_ENABLED) {
          console.log(`Reconnecting WebSocket for new portal: ${currentUserType}`);
          connect();
        }
      }, 1000);
    }
    
    previousUserType.current = currentUserType;
    
    if (isAuthenticated && !isConnected && !isWebSocketDisabled && config.WEBSOCKET_ENABLED) {
      console.log('User authenticated, connecting WebSocket...');
      connect();
    } else if (!isAuthenticated && isConnected) {
      console.log('User logged out, disconnecting WebSocket...');
      disconnect();
      // Clear all real-time data when user logs out
      setNotifications([]);
      setDashboardMetrics(null);
      setOnlineUsers([]);
      setTypingIndicators([]);
      setUploadProgress([]);
      setPitchViews(new Map());
      
      // Stop fallback service
      if (usingFallback) {
        presenceFallbackService.stop();
        setUsingFallback(false);
      }
    } else if (isAuthenticated && (isWebSocketDisabled || !config.WEBSOCKET_ENABLED)) {
      // Start fallback service if WebSocket is disabled but user is authenticated
      if (!usingFallback) {
        console.log('Starting fallback presence service - WebSocket disabled');
        setUsingFallback(true);
        presenceFallbackService.start();
        
        // Subscribe to fallback presence updates
        presenceFallbackService.subscribe((users) => {
          setOnlineUsers(users.map(user => ({
            ...user,
            lastSeen: new Date(user.lastSeen)
          })));
        });
      }
    }
  }, [isAuthenticated, isConnected, isWebSocketDisabled, usingFallback]); // Added isWebSocketDisabled and usingFallback to deps
  
  // Emergency control functions
  const disableWebSocket = useCallback(() => {
    console.log('WebSocket manually disabled - stopping all connections');
    setIsWebSocketDisabled(true);
    disconnect();
    localStorage.setItem('pitchey_websocket_disabled', 'true');
  }, [disconnect]);

  const enableWebSocket = useCallback(() => {
    console.log('WebSocket manually enabled - allowing connections');
    setIsWebSocketDisabled(false);
    localStorage.removeItem('pitchey_websocket_disabled');
    if (isAuthenticated && config.WEBSOCKET_ENABLED) {
      setTimeout(connect, 1000); // Small delay before reconnecting
    }
  }, [connect, isAuthenticated]);

  // Check if WebSocket was manually disabled or loop detected
  useEffect(() => {
    const wasDisabled = localStorage.getItem('pitchey_websocket_disabled') === 'true';
    const loopDetected = localStorage.getItem('pitchey_websocket_loop_detected');
    
    if (wasDisabled) {
      setIsWebSocketDisabled(true);
    }
    
    // Auto-recover from loop detection after 5 minutes
    if (loopDetected) {
      const detectedTime = parseInt(loopDetected);
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      if (detectedTime < fiveMinutesAgo) {
        localStorage.removeItem('pitchey_websocket_loop_detected');
        console.log('WebSocket loop detection expired - allowing reconnection');
      } else {
        setIsWebSocketDisabled(true);
        console.log('WebSocket loop recently detected - keeping disabled');
      }
    }
  }, []);

  // Function to request notification permission (must be called from user interaction)
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
        return permission;
      } catch (error) {
        console.warn('Failed to request notification permission:', error);
        return 'denied';
      }
    }
    return Notification.permission;
  }, []);
  
  const contextValue: WebSocketContextType = {
    // Connection state
    connectionStatus,
    queueStatus,
    isConnected,
    
    // Real-time data
    notifications,
    dashboardMetrics,
    onlineUsers,
    typingIndicators,
    uploadProgress,
    pitchViews,
    
    // Actions
    sendMessage,
    markNotificationAsRead,
    clearAllNotifications,
    updatePresence,
    startTyping,
    stopTyping,
    trackPitchView,
    
    // Connection control
    connect,
    disconnect,
    clearQueue,
    
    // Emergency controls
    disableWebSocket,
    enableWebSocket,
    isWebSocketDisabled,
    
    // Subscriptions
    subscribeToNotifications,
    subscribeToDashboard,
    subscribeToPresence,
    subscribeToTyping,
    subscribeToUploads,
    subscribeToPitchViews,
    subscribeToMessages,
    
    // Notification permission
    requestNotificationPermission,
  };
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// Convenience hooks for specific features
export function useNotifications() {
  const { notifications, markNotificationAsRead, clearAllNotifications, subscribeToNotifications } = useWebSocket();
  return { notifications, markNotificationAsRead, clearAllNotifications, subscribeToNotifications };
}

export function useDashboardMetrics() {
  const { dashboardMetrics, subscribeToDashboard } = useWebSocket();
  return { dashboardMetrics, subscribeToDashboard };
}

export function usePresence() {
  const { onlineUsers, updatePresence, subscribeToPresence } = useWebSocket();
  return { onlineUsers, updatePresence, subscribeToPresence };
}

export function useTyping(conversationId: number) {
  const { startTyping, stopTyping, subscribeToTyping } = useWebSocket();
  
  const startTypingForConversation = useCallback(() => {
    startTyping(conversationId);
  }, [conversationId, startTyping]);
  
  const stopTypingForConversation = useCallback(() => {
    stopTyping(conversationId);
  }, [conversationId, stopTyping]);
  
  return { 
    startTyping: startTypingForConversation, 
    stopTyping: stopTypingForConversation, 
    subscribeToTyping: (callback: (typing: any[]) => void) => subscribeToTyping(conversationId, callback)
  };
}

export function useUploadProgress() {
  const { uploadProgress, subscribeToUploads } = useWebSocket();
  return { uploadProgress, subscribeToUploads };
}

export function usePitchViews(pitchId: number) {
  const { pitchViews, trackPitchView, subscribeToPitchViews } = useWebSocket();
  
  const trackView = useCallback(() => {
    trackPitchView(pitchId);
  }, [pitchId, trackPitchView]);
  
  const pitchData = pitchViews.get(pitchId);
  
  return { 
    pitchData, 
    trackView, 
    subscribeToViews: (callback: (data: any) => void) => subscribeToPitchViews(pitchId, callback)
  };
}