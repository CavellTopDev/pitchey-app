/**
 * WebSocket Messaging Handler
 * Handles real-time messaging features including message delivery,
 * typing indicators, read receipts, presence tracking, and more
 */

import type { 
  WebSocketMessage, 
  MessagingService,
  ConversationWithDetails,
  MessageWithDetails 
} from '../messaging.service';

// WebSocket connection interface
interface WebSocketConnection {
  id: string;
  userId: number;
  socket: WebSocket;
  conversations: Set<number>;
  lastSeen: Date;
  userAgent?: string;
  ipAddress?: string;
}

// Presence status types
type PresenceStatus = 'online' | 'away' | 'offline';

interface UserPresence {
  userId: number;
  status: PresenceStatus;
  lastSeen: Date;
  connections: Set<string>;
}

// Message queue for offline users
interface QueuedMessage {
  id: string;
  recipientId: number;
  message: WebSocketMessage;
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
}

// Redis interface for caching and pub/sub
interface RedisService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  publish: (channel: string, message: string) => Promise<void>;
  subscribe: (channel: string, callback: (message: string) => void) => Promise<void>;
  hget: (hash: string, field: string) => Promise<string | null>;
  hset: (hash: string, field: string, value: string) => Promise<void>;
  hdel: (hash: string, field: string) => Promise<void>;
  sadd: (set: string, member: string) => Promise<void>;
  srem: (set: string, member: string) => Promise<void>;
  smembers: (set: string) => Promise<string[]>;
  expire: (key: string, seconds: number) => Promise<void>;
  zadd: (key: string, score: number, member: string) => Promise<void>;
  zrem: (key: string, member: string) => Promise<void>;
  zrange: (key: string, start: number, stop: number) => Promise<string[]>;
}

export class MessagingWebSocketHandler {
  private connections: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<number, Set<string>> = new Map();
  private presence: Map<number, UserPresence> = new Map();
  private messageQueue: Map<number, QueuedMessage[]> = new Map();
  private redis: RedisService;
  private messagingService: MessagingService;

  // Configuration
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly PRESENCE_TIMEOUT = 60000; // 1 minute
  private readonly MESSAGE_QUEUE_MAX_SIZE = 100;
  private readonly MESSAGE_QUEUE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(redis: RedisService, messagingService: MessagingService) {
    this.redis = redis;
    this.messagingService = messagingService;
    
    // Initialize periodic cleanup tasks
    this.initializeCleanupTasks();
    
    // Subscribe to Redis channels for cross-instance messaging
    this.initializeRedisSubscriptions();
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(socket: WebSocket, userId: number, connectionId: string, metadata?: {
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const connection: WebSocketConnection = {
        id: connectionId,
        userId,
        socket,
        conversations: new Set(),
        lastSeen: new Date(),
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress
      };

      // Store connection
      this.connections.set(connectionId, connection);

      // Track user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(connectionId);

      // Update presence
      await this.updateUserPresence(userId, 'online');

      // Set up event handlers
      this.setupSocketEventHandlers(connection);

      // Send connection acknowledgment
      await this.sendToConnection(connectionId, {
        type: 'connection_ack',
        data: {
          connectionId,
          timestamp: new Date().toISOString(),
          features: ['messaging', 'presence', 'typing', 'read_receipts', 'file_uploads']
        },
        userId,
        timestamp: new Date().toISOString()
      });

      // Send queued messages for this user
      await this.deliverQueuedMessages(userId);

      // Broadcast presence update
      await this.broadcastPresenceUpdate(userId, 'online');

      console.log(`WebSocket connection established for user ${userId}, connection ${connectionId}`);
    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      socket.close(1011, 'Server error during connection setup');
    }
  }

  /**
   * Handle connection disconnect
   */
  async handleDisconnection(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      const { userId } = connection;

      // Remove connection
      this.connections.delete(connectionId);

      // Update user connections
      const userConns = this.userConnections.get(userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(userId);
          // User is now offline
          await this.updateUserPresence(userId, 'offline');
          await this.broadcastPresenceUpdate(userId, 'offline');
        }
      }

      // Stop typing indicators for all conversations
      for (const conversationId of connection.conversations) {
        await this.messagingService.stopTyping(conversationId, userId);
      }

      console.log(`WebSocket connection closed for user ${userId}, connection ${connectionId}`);
    } catch (error) {
      console.error('Error handling WebSocket disconnection:', error);
    }
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(connectionId: string, message: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        console.warn(`Message from unknown connection: ${connectionId}`);
        return;
      }

      // Update last seen
      connection.lastSeen = new Date();

      // Parse message
      let wsMessage: WebSocketMessage;
      try {
        wsMessage = JSON.parse(message);
      } catch (error) {
        await this.sendError(connectionId, 'Invalid JSON message format');
        return;
      }

      // Validate message structure
      if (!wsMessage.type || !wsMessage.userId) {
        await this.sendError(connectionId, 'Invalid message structure');
        return;
      }

      // Verify user ID matches connection
      if (wsMessage.userId !== connection.userId) {
        await this.sendError(connectionId, 'User ID mismatch');
        return;
      }

      // Route message based on type
      await this.routeMessage(connection, wsMessage);
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      await this.sendError(connectionId, 'Server error processing message');
    }
  }

  /**
   * Route message to appropriate handler
   */
  private async routeMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'message':
        await this.handleChatMessage(connection, message);
        break;
      
      case 'typing':
        await this.handleTypingIndicator(connection, message);
        break;
      
      case 'read_receipt':
        await this.handleReadReceipt(connection, message);
        break;
      
      case 'join_conversation':
        await this.handleJoinConversation(connection, message);
        break;
      
      case 'leave_conversation':
        await this.handleLeaveConversation(connection, message);
        break;
      
      case 'presence':
        await this.handlePresenceUpdate(connection, message);
        break;
      
      case 'reaction':
        await this.handleMessageReaction(connection, message);
        break;
      
      case 'ping':
        await this.handlePing(connection, message);
        break;
      
      default:
        await this.sendError(connection.id, `Unknown message type: ${message.type}`);
    }
  }

  // ============================================================================
  // SPECIFIC MESSAGE HANDLERS
  // ============================================================================

  /**
   * Handle chat message
   */
  private async handleChatMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    try {
      const { data } = message;
      
      if (!data.conversationId || !data.content) {
        await this.sendError(connection.id, 'Message requires conversationId and content');
        return;
      }

      // Send via messaging service
      const sentMessage = await this.messagingService.sendMessage({
        conversationId: data.conversationId,
        content: data.content,
        subject: data.subject,
        messageType: data.messageType || 'text',
        contentType: data.contentType || 'text',
        priority: data.priority || 'normal',
        parentMessageId: data.parentMessageId,
        isEncrypted: data.isEncrypted || false,
        metadata: data.metadata
      }, connection.userId);

      // Broadcast to conversation participants
      await this.broadcastToConversation(data.conversationId, {
        type: 'message',
        data: sentMessage,
        conversationId: data.conversationId,
        userId: connection.userId,
        timestamp: new Date().toISOString(),
        messageId: sentMessage.id.toString()
      }, connection.userId);

      // Send confirmation to sender
      await this.sendToConnection(connection.id, {
        type: 'message_sent',
        data: { messageId: sentMessage.id, timestamp: sentMessage.sentAt },
        userId: connection.userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error handling chat message:', error);
      await this.sendError(connection.id, 'Failed to send message: ' + error.message);
    }
  }

  /**
   * Handle typing indicator
   */
  private async handleTypingIndicator(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    try {
      const { data } = message;
      
      if (!data.conversationId || typeof data.isTyping !== 'boolean') {
        await this.sendError(connection.id, 'Typing indicator requires conversationId and isTyping');
        return;
      }

      if (data.isTyping) {
        await this.messagingService.startTyping(data.conversationId, connection.userId);
      } else {
        await this.messagingService.stopTyping(data.conversationId, connection.userId);
      }

      // Broadcast typing indicator to other participants
      await this.broadcastToConversation(data.conversationId, {
        type: 'typing',
        data: {
          userId: connection.userId,
          isTyping: data.isTyping,
          timestamp: new Date().toISOString()
        },
        conversationId: data.conversationId,
        userId: connection.userId,
        timestamp: new Date().toISOString()
      }, connection.userId);
    } catch (error) {
      console.error('Error handling typing indicator:', error);
      await this.sendError(connection.id, 'Failed to update typing status');
    }
  }

  /**
   * Handle read receipt
   */
  private async handleReadReceipt(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    try {
      const { data } = message;
      
      if (!data.messageIds || !Array.isArray(data.messageIds) || !data.conversationId) {
        await this.sendError(connection.id, 'Read receipt requires messageIds array and conversationId');
        return;
      }

      await this.messagingService.markMessagesAsRead(
        data.messageIds,
        connection.userId,
        data.conversationId
      );

      // Broadcast read receipt to conversation participants
      await this.broadcastToConversation(data.conversationId, {
        type: 'read_receipt',
        data: {
          messageIds: data.messageIds,
          userId: connection.userId,
          timestamp: new Date().toISOString()
        },
        conversationId: data.conversationId,
        userId: connection.userId,
        timestamp: new Date().toISOString()
      }, connection.userId);
    } catch (error) {
      console.error('Error handling read receipt:', error);
      await this.sendError(connection.id, 'Failed to mark messages as read');
    }
  }

  /**
   * Handle join conversation
   */
  private async handleJoinConversation(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    try {
      const { data } = message;
      
      if (!data.conversationId) {
        await this.sendError(connection.id, 'Join conversation requires conversationId');
        return;
      }

      // Verify user has access to conversation
      try {
        await this.messagingService.getConversationById(data.conversationId, connection.userId);
      } catch (error) {
        await this.sendError(connection.id, 'Access denied to conversation');
        return;
      }

      // Add to connection's conversation set
      connection.conversations.add(data.conversationId);

      // Subscribe to conversation channel in Redis
      await this.redis.sadd(`conversation:${data.conversationId}:participants`, connection.id);

      // Send confirmation
      await this.sendToConnection(connection.id, {
        type: 'conversation_joined',
        data: { conversationId: data.conversationId },
        userId: connection.userId,
        timestamp: new Date().toISOString()
      });

      // Send current typing users
      const typingUsers = await this.messagingService.getTypingUsers(data.conversationId, connection.userId);
      if (typingUsers.length > 0) {
        await this.sendToConnection(connection.id, {
          type: 'typing_users',
          data: { conversationId: data.conversationId, typingUsers },
          userId: connection.userId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error handling join conversation:', error);
      await this.sendError(connection.id, 'Failed to join conversation');
    }
  }

  /**
   * Handle leave conversation
   */
  private async handleLeaveConversation(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    try {
      const { data } = message;
      
      if (!data.conversationId) {
        await this.sendError(connection.id, 'Leave conversation requires conversationId');
        return;
      }

      // Remove from connection's conversation set
      connection.conversations.delete(data.conversationId);

      // Unsubscribe from conversation channel
      await this.redis.srem(`conversation:${data.conversationId}:participants`, connection.id);

      // Stop typing if user was typing
      await this.messagingService.stopTyping(data.conversationId, connection.userId);

      // Send confirmation
      await this.sendToConnection(connection.id, {
        type: 'conversation_left',
        data: { conversationId: data.conversationId },
        userId: connection.userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error handling leave conversation:', error);
      await this.sendError(connection.id, 'Failed to leave conversation');
    }
  }

  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    try {
      const { data } = message;
      
      if (!data.status || !['online', 'away', 'offline'].includes(data.status)) {
        await this.sendError(connection.id, 'Invalid presence status');
        return;
      }

      await this.updateUserPresence(connection.userId, data.status);
      await this.broadcastPresenceUpdate(connection.userId, data.status);
    } catch (error) {
      console.error('Error handling presence update:', error);
      await this.sendError(connection.id, 'Failed to update presence');
    }
  }

  /**
   * Handle message reaction
   */
  private async handleMessageReaction(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    try {
      const { data } = message;
      
      if (!data.messageId || !data.reactionType || !data.conversationId) {
        await this.sendError(connection.id, 'Reaction requires messageId, reactionType, and conversationId');
        return;
      }

      // Add reaction through messaging service (would need to be implemented)
      // await this.messagingService.addMessageReaction(data.messageId, connection.userId, data.reactionType);

      // Broadcast reaction to conversation participants
      await this.broadcastToConversation(data.conversationId, {
        type: 'reaction',
        data: {
          messageId: data.messageId,
          userId: connection.userId,
          reactionType: data.reactionType,
          timestamp: new Date().toISOString()
        },
        conversationId: data.conversationId,
        userId: connection.userId,
        timestamp: new Date().toISOString()
      }, connection.userId);
    } catch (error) {
      console.error('Error handling message reaction:', error);
      await this.sendError(connection.id, 'Failed to add reaction');
    }
  }

  /**
   * Handle ping for heartbeat
   */
  private async handlePing(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    await this.sendToConnection(connection.id, {
      type: 'pong',
      data: { timestamp: new Date().toISOString() },
      userId: connection.userId,
      timestamp: new Date().toISOString()
    });
  }

  // ============================================================================
  // BROADCASTING AND DELIVERY
  // ============================================================================

  /**
   * Broadcast message to all participants in a conversation
   */
  async broadcastToConversation(
    conversationId: number, 
    message: WebSocketMessage,
    excludeUserId?: number
  ): Promise<void> {
    try {
      // Get conversation participants
      const conversation = await this.messagingService.getConversationById(conversationId, message.userId);
      
      // Send to each online participant
      for (const participant of conversation.participants) {
        if (excludeUserId && participant.userId === excludeUserId) continue;
        
        const userConnections = this.userConnections.get(participant.userId);
        if (userConnections) {
          for (const connectionId of userConnections) {
            await this.sendToConnection(connectionId, message);
          }
        } else {
          // User is offline, queue the message
          await this.queueMessageForOfflineUser(participant.userId, message);
        }
      }

      // Also publish to Redis for cross-instance delivery
      await this.redis.publish(`conversation:${conversationId}`, JSON.stringify(message));
    } catch (error) {
      console.error('Error broadcasting to conversation:', error);
    }
  }

  /**
   * Send message to specific connection
   */
  async sendToConnection(connectionId: string, message: WebSocketMessage): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const messageString = JSON.stringify(message);
      connection.socket.send(messageString);
    } catch (error) {
      console.error(`Error sending message to connection ${connectionId}:`, error);
      // Remove dead connection
      await this.handleDisconnection(connectionId);
    }
  }

  /**
   * Send error message to connection
   */
  async sendError(connectionId: string, errorMessage: string): Promise<void> {
    await this.sendToConnection(connectionId, {
      type: 'error',
      data: { message: errorMessage },
      userId: 0,
      timestamp: new Date().toISOString()
    });
  }

  // ============================================================================
  // PRESENCE MANAGEMENT
  // ============================================================================

  /**
   * Update user presence status
   */
  async updateUserPresence(userId: number, status: PresenceStatus): Promise<void> {
    try {
      const now = new Date();
      
      // Update local presence
      const existingPresence = this.presence.get(userId);
      if (existingPresence) {
        existingPresence.status = status;
        existingPresence.lastSeen = now;
      } else {
        this.presence.set(userId, {
          userId,
          status,
          lastSeen: now,
          connections: new Set()
        });
      }

      // Update Redis presence with TTL
      await this.redis.hset(`presence:${userId}`, 'status', status);
      await this.redis.hset(`presence:${userId}`, 'lastSeen', now.toISOString());
      await this.redis.expire(`presence:${userId}`, 300); // 5 minutes TTL

      // Add to presence sorted set for cleanup
      await this.redis.zadd('presence:active', now.getTime(), userId.toString());
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  /**
   * Get user presence status
   */
  async getUserPresence(userId: number): Promise<{ status: PresenceStatus; lastSeen: Date } | null> {
    try {
      // Check local presence first
      const localPresence = this.presence.get(userId);
      if (localPresence) {
        return {
          status: localPresence.status,
          lastSeen: localPresence.lastSeen
        };
      }

      // Check Redis
      const status = await this.redis.hget(`presence:${userId}`, 'status') as PresenceStatus;
      const lastSeenStr = await this.redis.hget(`presence:${userId}`, 'lastSeen');
      
      if (status && lastSeenStr) {
        return {
          status,
          lastSeen: new Date(lastSeenStr)
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting user presence:', error);
      return null;
    }
  }

  /**
   * Broadcast presence update to user's contacts
   */
  async broadcastPresenceUpdate(userId: number, status: PresenceStatus): Promise<void> {
    try {
      // Get user's conversations to determine who should receive presence updates
      const conversations = await this.messagingService.getConversations({
        userId,
        limit: 100
      });

      // Collect all unique participant IDs
      const contactIds = new Set<number>();
      for (const conversation of conversations.conversations) {
        for (const participant of conversation.participants) {
          if (participant.userId !== userId) {
            contactIds.add(participant.userId);
          }
        }
      }

      // Send presence update to each contact
      const presenceMessage: WebSocketMessage = {
        type: 'presence',
        data: {
          userId,
          status,
          timestamp: new Date().toISOString()
        },
        userId,
        timestamp: new Date().toISOString()
      };

      for (const contactId of contactIds) {
        const userConnections = this.userConnections.get(contactId);
        if (userConnections) {
          for (const connectionId of userConnections) {
            await this.sendToConnection(connectionId, presenceMessage);
          }
        }
      }

      // Also publish to Redis for cross-instance delivery
      await this.redis.publish(`user:${userId}:presence`, JSON.stringify(presenceMessage));
    } catch (error) {
      console.error('Error broadcasting presence update:', error);
    }
  }

  // ============================================================================
  // OFFLINE MESSAGE QUEUE
  // ============================================================================

  /**
   * Queue message for offline user
   */
  async queueMessageForOfflineUser(userId: number, message: WebSocketMessage): Promise<void> {
    try {
      const queuedMessage: QueuedMessage = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recipientId: userId,
        message,
        attempts: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.MESSAGE_QUEUE_TTL)
      };

      // Add to local queue
      if (!this.messageQueue.has(userId)) {
        this.messageQueue.set(userId, []);
      }
      
      const userQueue = this.messageQueue.get(userId)!;
      userQueue.push(queuedMessage);

      // Limit queue size
      if (userQueue.length > this.MESSAGE_QUEUE_MAX_SIZE) {
        userQueue.shift(); // Remove oldest message
      }

      // Store in Redis for persistence across instances
      await this.redis.zadd(
        `queue:${userId}`, 
        queuedMessage.createdAt.getTime(), 
        JSON.stringify(queuedMessage)
      );
    } catch (error) {
      console.error('Error queuing message for offline user:', error);
    }
  }

  /**
   * Deliver queued messages when user comes online
   */
  async deliverQueuedMessages(userId: number): Promise<void> {
    try {
      // Get messages from Redis
      const queuedMessages = await this.redis.zrange(`queue:${userId}`, 0, -1);
      
      for (const messageStr of queuedMessages) {
        try {
          const queuedMessage: QueuedMessage = JSON.parse(messageStr);
          
          // Check if message has expired
          if (queuedMessage.expiresAt < new Date()) {
            continue;
          }

          // Send message to user's connections
          const userConnections = this.userConnections.get(userId);
          if (userConnections) {
            for (const connectionId of userConnections) {
              await this.sendToConnection(connectionId, queuedMessage.message);
            }
          }
        } catch (parseError) {
          console.error('Error parsing queued message:', parseError);
        }
      }

      // Clear the queue after delivery
      await this.redis.del(`queue:${userId}`);
      this.messageQueue.delete(userId);
    } catch (error) {
      console.error('Error delivering queued messages:', error);
    }
  }

  // ============================================================================
  // SETUP AND CLEANUP
  // ============================================================================

  /**
   * Set up socket event handlers
   */
  private setupSocketEventHandlers(connection: WebSocketConnection): void {
    connection.socket.addEventListener('message', async (event) => {
      await this.handleMessage(connection.id, event.data);
    });

    connection.socket.addEventListener('close', async () => {
      await this.handleDisconnection(connection.id);
    });

    connection.socket.addEventListener('error', async (error) => {
      console.error(`WebSocket error for connection ${connection.id}:`, error);
      await this.handleDisconnection(connection.id);
    });

    // Set up heartbeat
    const heartbeatInterval = setInterval(async () => {
      if (connection.socket.readyState === WebSocket.OPEN) {
        await this.sendToConnection(connection.id, {
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() },
          userId: connection.userId,
          timestamp: new Date().toISOString()
        });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Initialize Redis subscriptions for cross-instance communication
   */
  private async initializeRedisSubscriptions(): Promise<void> {
    try {
      // Subscribe to conversation broadcasts
      await this.redis.subscribe('conversation:*', async (message) => {
        try {
          const wsMessage: WebSocketMessage = JSON.parse(message);
          if (wsMessage.conversationId) {
            await this.broadcastToConversation(wsMessage.conversationId, wsMessage);
          }
        } catch (error) {
          console.error('Error handling Redis conversation message:', error);
        }
      });

      // Subscribe to presence updates
      await this.redis.subscribe('user:*:presence', async (message) => {
        try {
          const wsMessage: WebSocketMessage = JSON.parse(message);
          // Handle cross-instance presence updates
          await this.broadcastPresenceUpdate(wsMessage.userId, wsMessage.data.status);
        } catch (error) {
          console.error('Error handling Redis presence message:', error);
        }
      });
    } catch (error) {
      console.error('Error setting up Redis subscriptions:', error);
    }
  }

  /**
   * Initialize cleanup tasks
   */
  private initializeCleanupTasks(): void {
    // Clean up inactive presence records every 5 minutes
    setInterval(async () => {
      await this.cleanupInactivePresence();
    }, 5 * 60 * 1000);

    // Clean up expired queued messages every hour
    setInterval(async () => {
      await this.cleanupExpiredQueuedMessages();
    }, 60 * 60 * 1000);

    // Clean up stale connections every 2 minutes
    setInterval(async () => {
      await this.cleanupStaleConnections();
    }, 2 * 60 * 1000);
  }

  /**
   * Clean up inactive presence records
   */
  private async cleanupInactivePresence(): Promise<void> {
    try {
      const cutoffTime = Date.now() - this.PRESENCE_TIMEOUT;
      const inactiveUsers = await this.redis.zrange('presence:active', 0, cutoffTime);
      
      for (const userId of inactiveUsers) {
        await this.updateUserPresence(parseInt(userId), 'offline');
        await this.redis.zrem('presence:active', userId);
      }
    } catch (error) {
      console.error('Error cleaning up inactive presence:', error);
    }
  }

  /**
   * Clean up expired queued messages
   */
  private async cleanupExpiredQueuedMessages(): Promise<void> {
    try {
      const now = new Date();
      
      for (const [userId, queue] of this.messageQueue.entries()) {
        this.messageQueue.set(
          userId, 
          queue.filter(msg => msg.expiresAt > now)
        );
      }
    } catch (error) {
      console.error('Error cleaning up expired queued messages:', error);
    }
  }

  /**
   * Clean up stale connections
   */
  private async cleanupStaleConnections(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - this.PRESENCE_TIMEOUT);
      
      for (const [connectionId, connection] of this.connections.entries()) {
        if (connection.lastSeen < cutoffTime || connection.socket.readyState !== WebSocket.OPEN) {
          await this.handleDisconnection(connectionId);
        }
      }
    } catch (error) {
      console.error('Error cleaning up stale connections:', error);
    }
  }

  // ============================================================================
  // PUBLIC UTILITY METHODS
  // ============================================================================

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    uniqueUsers: number;
    averageConnectionsPerUser: number;
    queuedMessagesCount: number;
  } {
    const totalConnections = this.connections.size;
    const uniqueUsers = this.userConnections.size;
    const averageConnectionsPerUser = uniqueUsers > 0 ? totalConnections / uniqueUsers : 0;
    
    let queuedMessagesCount = 0;
    for (const queue of this.messageQueue.values()) {
      queuedMessagesCount += queue.length;
    }

    return {
      totalConnections,
      uniqueUsers,
      averageConnectionsPerUser: Math.round(averageConnectionsPerUser * 100) / 100,
      queuedMessagesCount
    };
  }

  /**
   * Force disconnect user connections
   */
  async forceDisconnectUser(userId: number, reason: string = 'Server disconnect'): Promise<void> {
    const userConnections = this.userConnections.get(userId);
    if (userConnections) {
      for (const connectionId of userConnections) {
        const connection = this.connections.get(connectionId);
        if (connection) {
          connection.socket.close(1000, reason);
        }
      }
    }
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: number): boolean {
    return this.userConnections.has(userId) && this.userConnections.get(userId)!.size > 0;
  }

  /**
   * Get online users in a conversation
   */
  async getOnlineUsersInConversation(conversationId: number): Promise<number[]> {
    try {
      const conversation = await this.messagingService.getConversationById(conversationId, 0); // Using 0 as admin check
      const onlineUsers: number[] = [];
      
      for (const participant of conversation.participants) {
        if (this.isUserOnline(participant.userId)) {
          onlineUsers.push(participant.userId);
        }
      }
      
      return onlineUsers;
    } catch (error) {
      console.error('Error getting online users in conversation:', error);
      return [];
    }
  }
}

export { MessagingWebSocketHandler };
export type { WebSocketConnection, UserPresence, QueuedMessage };