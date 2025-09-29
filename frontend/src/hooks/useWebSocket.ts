import { useEffect, useRef, useState, useCallback } from 'react';
import { notificationService } from '../services/notification.service';
import { getUserId } from '../lib/apiServices';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    reconnectInterval = 5000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    // Check if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      return;
    }

    // Skip WebSocket connection in demo mode or if explicitly disabled
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    if (isDemoMode) {
      return;
    }

    try {
      // Connect to the main server WebSocket endpoint
      const wsUrl = import.meta.env.VITE_WS_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://') : 'ws://localhost:8001');
      const ws = new WebSocket(`${wsUrl}/api/messages/ws?token=${token}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        onConnect?.();
        
        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Start ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
        
        // Send initial ping
        ws.send(JSON.stringify({ type: 'ping' }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
          
          // Handle specific message types
          switch (message.type) {
            case 'connected':
              console.log('WebSocket connected as:', message.username, `(ID: ${message.userId})`);
              break;
            case 'pong':
              // Ping received, connection is healthy
              break;
            case 'user_online':
              console.log(`${message.username} came online`);
              break;
            case 'user_offline':
              console.log(`${message.username} went offline`);
              break;
            case 'new_message':
              console.log('New message received:', message);
              break;
            case 'message_sent':
              console.log('Message sent confirmation:', message);
              break;
            case 'message_read':
              console.log('Message read receipt:', message);
              break;
            case 'user_typing':
              console.log('Typing indicator:', message);
              break;
            case 'conversation_joined':
              console.log('Joined conversation:', message.conversationId);
              break;
            case 'online_users':
              console.log('Online users:', message.users);
              break;
            case 'queued_message':
              console.log('Received queued message:', message);
              break;
            case 'error':
              console.error('WebSocket error:', message.message, message.error);
              break;
            default:
              // Other messages are handled by the consumer
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        onDisconnect?.();
        wsRef.current = null;
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        // Only attempt reconnect if it was an unexpected disconnect (not a client-initiated close)
        // and we have a valid token
        if (event.code !== 1000 && event.code !== 1001 && localStorage.getItem('authToken')) {
          // Schedule reconnect with exponential backoff
          const delay = Math.min(reconnectInterval * (reconnectTimeoutRef.current ? 2 : 1), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        // Only log WebSocket errors in development
        if (process.env.NODE_ENV === 'development') {
          console.error('WebSocket error:', error);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      // Only log connection errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to connect WebSocket:', error);
      }
    }
  }, [onMessage, onConnect, onDisconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // Empty dependency array - only connect on mount

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
}

// Specific hooks for different features
export function usePitchUpdates(pitchId: number) {
  const [views, setViews] = useState(0);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const { sendMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.pitchId !== pitchId) return;
      
      switch (message.type) {
        case 'pitch_viewed':
          setViews(v => v + 1);
          break;
        case 'pitch_liked':
          setLikes(l => l + 1);
          break;
        case 'new_comment':
          setComments(c => [...c, {
            username: message.username,
            comment: message.comment,
            timestamp: message.timestamp,
          }]);
          break;
        case 'user_typing':
          if (message.isTyping) {
            setTypingUsers(users => [...users, message.username]);
          } else {
            setTypingUsers(users => users.filter(u => u !== message.username));
          }
          break;
      }
    },
  });

  const trackView = () => {
    sendMessage({ type: 'pitch_view', pitchId });
  };

  const trackLike = () => {
    sendMessage({ type: 'pitch_like', pitchId });
  };

  const sendComment = (comment: string) => {
    sendMessage({ type: 'pitch_comment', pitchId, comment });
  };

  const setTyping = (isTyping: boolean) => {
    sendMessage({ type: 'typing', pitchId, isTyping });
  };

  return {
    views,
    likes,
    comments,
    typingUsers,
    trackView,
    trackLike,
    sendComment,
    setTyping,
  };
}

// Hook for messaging with real-time features
export function useMessaging() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentMessages, setCurrentMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ [conversationId: number]: string[] }>({});
  const [onlineUsers, setOnlineUsers] = useState<{ [userId: number]: boolean }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [conversationId: number]: number }>({});

  const { sendMessage, isConnected } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'new_message':
          // Add new message to current conversation if it matches
          if (message.conversationId) {
            setCurrentMessages(prev => {
              const existing = prev.find(m => m.id === message.messageId);
              if (!existing) {
                return [...prev, {
                  id: message.messageId,
                  conversationId: message.conversationId,
                  senderId: message.senderId,
                  senderName: message.senderName,
                  content: message.content,
                  timestamp: message.timestamp,
                  delivered: true,
                }];
              }
              return prev;
            });
          }

          // Update conversation list
          setConversations(prev => prev.map(conv => 
            conv.id === message.conversationId
              ? { 
                  ...conv, 
                  lastMessage: {
                    content: message.content,
                    timestamp: message.timestamp,
                    senderName: message.senderName,
                  },
                  lastMessageAt: message.timestamp,
                }
              : conv
          ));

          // Update unread count and show notification if message is not from current user
          const currentUserId = getUserId();
          if (message.senderId !== parseInt(currentUserId || '0')) {
            setUnreadCounts(prev => ({
              ...prev,
              [message.conversationId]: (prev[message.conversationId] || 0) + 1,
            }));

            // Show notification for new message
            notificationService.notifyNewMessage(
              message.senderName || 'Unknown User',
              message.content,
              message.conversationId
            );
          }
          break;

        case 'message_read':
          // Update message as read
          setCurrentMessages(prev => prev.map(msg =>
            msg.id === message.messageId
              ? { ...msg, isRead: true, readAt: message.readAt }
              : msg
          ));

          // Show read receipt notification (silent)
          if (message.readByName) {
            notificationService.notifyMessageRead(message.messageId, message.readByName);
          }
          break;

        case 'user_typing':
          if (message.conversationId) {
            setTypingUsers(prev => {
              const conversationTyping = prev[message.conversationId] || [];
              if (message.isTyping) {
                return {
                  ...prev,
                  [message.conversationId]: [...conversationTyping.filter(u => u !== message.username), message.username],
                };
              } else {
                return {
                  ...prev,
                  [message.conversationId]: conversationTyping.filter(u => u !== message.username),
                };
              }
            });
          }
          break;

        case 'user_online':
          setOnlineUsers(prev => ({ ...prev, [message.userId]: true }));
          
          // Show user online notification (silent)
          if (message.username) {
            notificationService.notifyUserOnline(message.username);
          }
          break;

        case 'user_offline':
          setOnlineUsers(prev => ({ ...prev, [message.userId]: false }));
          break;
      }
    },
  });

  // getCurrentUserId function removed - now using centralized getUserId from apiServices

  const sendChatMessage = (conversationId: number, content: string, recipientId?: number) => {
    const requestId = `msg_${Date.now()}_${Math.random()}`;
    sendMessage({
      type: 'send_message',
      conversationId,
      content,
      recipientId,
      requestId,
    });
  };

  const markMessageAsRead = (messageId: number) => {
    sendMessage({
      type: 'mark_read',
      messageId,
    });
  };

  const startTyping = (conversationId: number) => {
    sendMessage({
      type: 'typing_start',
      conversationId,
    });
  };

  const stopTyping = (conversationId: number) => {
    sendMessage({
      type: 'typing_stop',
      conversationId,
    });
  };

  const joinConversation = (conversationId: number) => {
    sendMessage({
      type: 'join_conversation',
      conversationId,
    });
  };

  const markConversationAsRead = (conversationId: number) => {
    setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
  };

  return {
    conversations,
    setConversations,
    currentMessages,
    setCurrentMessages,
    typingUsers,
    onlineUsers,
    unreadCounts,
    isConnected,
    sendChatMessage,
    markMessageAsRead,
    startTyping,
    stopTyping,
    joinConversation,
    markConversationAsRead,
  };
}

// Hook for notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useWebSocket({
    onMessage: (message) => {
      if (message.type === 'nda_signed') {
        setNotifications(n => [...n, {
          type: 'nda',
          message: `${message.signedBy} signed an NDA for your pitch`,
          timestamp: message.timestamp,
          pitchId: message.pitchId,
        }]);
      }
    },
  });

  const clearNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    clearNotifications,
  };
}