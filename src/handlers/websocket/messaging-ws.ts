import { Redis } from "https://deno.land/x/upstash_redis@v1.19.3/mod.ts";

/**
 * WebSocket Handler for Real-time Messaging
 * Handles real-time message delivery, typing indicators, and presence
 */

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

interface UserConnection {
  userId: string;
  ws: WebSocket;
  conversations: Set<string>;
  lastActivity: Date;
}

export class MessagingWebSocketHandler {
  private connections: Map<string, UserConnection> = new Map();
  private redis?: Redis;
  private heartbeatInterval?: number;

  constructor() {
    // Initialize Redis for pub/sub
    const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    
    if (redisUrl && redisToken) {
      this.redis = new Redis({
        url: redisUrl,
        token: redisToken,
      });
    }

    // Start heartbeat interval to check connection health
    this.startHeartbeat();
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws: WebSocket, userId: string) {
    console.log(`WebSocket connection established for user: ${userId}`);

    // Store connection
    const connection: UserConnection = {
      userId,
      ws,
      conversations: new Set(),
      lastActivity: new Date(),
    };
    this.connections.set(userId, connection);

    // Set up event handlers
    ws.onmessage = (event) => this.handleMessage(userId, event.data);
    ws.onclose = () => this.handleDisconnection(userId);
    ws.onerror = (error) => this.handleError(userId, error);

    // Send connection confirmation
    this.sendToUser(userId, {
      type: 'connected',
      payload: { userId },
      timestamp: new Date().toISOString(),
    });

    // Update user presence
    await this.updatePresence(userId, 'online');

    // Subscribe to user's conversations
    await this.subscribeToUserConversations(userId);
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(userId: string, data: string) {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      const connection = this.connections.get(userId);
      
      if (!connection) {
        console.error(`No connection found for user: ${userId}`);
        return;
      }

      // Update last activity
      connection.lastActivity = new Date();

      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(userId, message.payload);
          break;
        
        case 'unsubscribe':
          await this.handleUnsubscribe(userId, message.payload);
          break;
        
        case 'typing':
          await this.handleTypingIndicator(userId, message.payload);
          break;
        
        case 'presence':
          await this.handlePresenceUpdate(userId, message.payload);
          break;
        
        case 'ping':
          this.sendToUser(userId, {
            type: 'pong',
            payload: {},
            timestamp: new Date().toISOString(),
          });
          break;
        
        case 'message':
          await this.handleNewMessage(userId, message.payload);
          break;
        
        case 'read':
          await this.handleReadReceipt(userId, message.payload);
          break;
        
        case 'reaction':
          await this.handleReaction(userId, message.payload);
          break;
        
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${userId}:`, error);
      this.sendToUser(userId, {
        type: 'error',
        payload: { error: 'Invalid message format' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle subscribing to a conversation
   */
  private async handleSubscribe(userId: string, payload: any) {
    const { conversationId } = payload;
    const connection = this.connections.get(userId);
    
    if (!connection) return;

    // Add conversation to user's subscriptions
    connection.conversations.add(conversationId);

    // Subscribe to Redis channel for real-time updates
    if (this.redis) {
      // Note: Upstash Redis doesn't support pub/sub directly via REST API
      // In production, you would use a different approach or service
      console.log(`User ${userId} subscribed to conversation ${conversationId}`);
    }

    // Send confirmation
    this.sendToUser(userId, {
      type: 'subscribed',
      payload: { conversationId },
      timestamp: new Date().toISOString(),
    });

    // Send recent messages from cache if available
    await this.sendCachedMessages(userId, conversationId);
  }

  /**
   * Handle unsubscribing from a conversation
   */
  private handleUnsubscribe(userId: string, payload: any) {
    const { conversationId } = payload;
    const connection = this.connections.get(userId);
    
    if (!connection) return;

    // Remove conversation from user's subscriptions
    connection.conversations.delete(conversationId);

    // Send confirmation
    this.sendToUser(userId, {
      type: 'unsubscribed',
      payload: { conversationId },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle typing indicator
   */
  private async handleTypingIndicator(userId: string, payload: any) {
    const { conversationId, isTyping } = payload;

    // Broadcast to other participants in the conversation
    await this.broadcastToConversation(conversationId, {
      type: 'typing_indicator',
      payload: {
        conversationId,
        userId,
        isTyping,
      },
      timestamp: new Date().toISOString(),
    }, userId); // Exclude sender

    // Set/clear typing indicator in Redis with TTL
    if (this.redis && isTyping) {
      const key = `typing:${conversationId}:${userId}`;
      await this.redis.setex(key, 10, "1"); // 10 second TTL
    }
  }

  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(userId: string, payload: any) {
    const { status } = payload; // online, away, offline
    
    await this.updatePresence(userId, status);

    // Get user's conversations
    const connection = this.connections.get(userId);
    if (!connection) return;

    // Broadcast presence to all conversations
    for (const conversationId of connection.conversations) {
      await this.broadcastToConversation(conversationId, {
        type: 'presence_update',
        payload: {
          userId,
          status,
        },
        timestamp: new Date().toISOString(),
      }, userId);
    }
  }

  /**
   * Handle new message notification
   */
  private async handleNewMessage(userId: string, payload: any) {
    const { conversationId, messageId, content } = payload;

    // Broadcast to all participants in the conversation
    await this.broadcastToConversation(conversationId, {
      type: 'new_message',
      payload: {
        conversationId,
        messageId,
        senderId: userId,
        content,
      },
      timestamp: new Date().toISOString(),
    });

    // Cache message for offline users
    if (this.redis) {
      const key = `messages:${conversationId}:recent`;
      await this.redis.lpush(key, JSON.stringify({
        messageId,
        senderId: userId,
        content,
        timestamp: new Date().toISOString(),
      }));
      await this.redis.ltrim(key, 0, 99); // Keep last 100 messages
      await this.redis.expire(key, 3600); // 1 hour TTL
    }
  }

  /**
   * Handle read receipt
   */
  private async handleReadReceipt(userId: string, payload: any) {
    const { conversationId, messageIds } = payload;

    // Broadcast to conversation participants
    await this.broadcastToConversation(conversationId, {
      type: 'read_receipt',
      payload: {
        conversationId,
        userId,
        messageIds,
      },
      timestamp: new Date().toISOString(),
    }, userId);
  }

  /**
   * Handle reaction
   */
  private async handleReaction(userId: string, payload: any) {
    const { conversationId, messageId, emoji, action } = payload;

    // Broadcast to conversation participants
    await this.broadcastToConversation(conversationId, {
      type: 'reaction',
      payload: {
        conversationId,
        messageId,
        userId,
        emoji,
        action, // 'add' or 'remove'
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle disconnection
   */
  private async handleDisconnection(userId: string) {
    console.log(`WebSocket disconnected for user: ${userId}`);

    const connection = this.connections.get(userId);
    if (!connection) return;

    // Update presence
    await this.updatePresence(userId, 'offline');

    // Notify conversations of user going offline
    for (const conversationId of connection.conversations) {
      await this.broadcastToConversation(conversationId, {
        type: 'presence_update',
        payload: {
          userId,
          status: 'offline',
        },
        timestamp: new Date().toISOString(),
      }, userId);
    }

    // Remove connection
    this.connections.delete(userId);
  }

  /**
   * Handle WebSocket error
   */
  private handleError(userId: string, error: Event) {
    console.error(`WebSocket error for user ${userId}:`, error);
    
    // Clean up connection on error
    this.handleDisconnection(userId);
  }

  /**
   * Send message to specific user
   */
  private sendToUser(userId: string, message: WebSocketMessage) {
    const connection = this.connections.get(userId);
    
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all participants in a conversation
   */
  private async broadcastToConversation(
    conversationId: string,
    message: WebSocketMessage,
    excludeUserId?: string
  ) {
    // In a real implementation, you would:
    // 1. Get all participants of the conversation from the database
    // 2. Send to each connected participant
    
    for (const [userId, connection] of this.connections) {
      if (userId !== excludeUserId && connection.conversations.has(conversationId)) {
        this.sendToUser(userId, message);
      }
    }

    // Also publish to Redis for other server instances
    if (this.redis) {
      // Note: This would require a different Redis setup for pub/sub
      console.log(`Broadcasting to conversation ${conversationId}`);
    }
  }

  /**
   * Update user presence in Redis
   */
  private async updatePresence(userId: string, status: string) {
    if (this.redis) {
      const key = `presence:${userId}`;
      await this.redis.setex(key, 300, status); // 5 minute TTL
      
      // Update last seen timestamp
      await this.redis.set(`last_seen:${userId}`, new Date().toISOString());
    }
  }

  /**
   * Subscribe user to their conversations on connection
   */
  private async subscribeToUserConversations(userId: string) {
    // In a real implementation, fetch user's active conversations from database
    // For now, this is a placeholder
    console.log(`Subscribing user ${userId} to their conversations`);
  }

  /**
   * Send cached messages to user
   */
  private async sendCachedMessages(userId: string, conversationId: string) {
    if (!this.redis) return;

    const key = `messages:${conversationId}:recent`;
    const messages = await this.redis.lrange(key, 0, 19); // Get last 20 messages

    if (messages && messages.length > 0) {
      this.sendToUser(userId, {
        type: 'cached_messages',
        payload: {
          conversationId,
          messages: messages.map(m => JSON.parse(m as string)).reverse(),
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Start heartbeat interval to check connection health
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 60000; // 1 minute timeout

      for (const [userId, connection] of this.connections) {
        const timeSinceActivity = now.getTime() - connection.lastActivity.getTime();
        
        if (timeSinceActivity > timeout) {
          // Connection is stale, close it
          console.log(`Closing stale connection for user: ${userId}`);
          connection.ws.close();
          this.handleDisconnection(userId);
        } else {
          // Send ping to keep connection alive
          this.sendToUser(userId, {
            type: 'ping',
            payload: {},
            timestamp: now.toISOString(),
          });
        }
      }
    }, 30000); // Run every 30 seconds
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const [userId, connection] of this.connections) {
      connection.ws.close();
    }
    this.connections.clear();
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const stats = {
      totalConnections: this.connections.size,
      users: [] as any[],
    };

    for (const [userId, connection] of this.connections) {
      stats.users.push({
        userId,
        conversations: Array.from(connection.conversations),
        lastActivity: connection.lastActivity,
        connectionState: connection.ws.readyState,
      });
    }

    return stats;
  }
}