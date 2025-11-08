/**
 * Production WebSocket Server for Pitchey Platform
 * Provides real-time features: notifications, live dashboard metrics, auto-sync, presence tracking, etc.
 */

import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { nativeRedisService as redisService } from "./redis-native.service.ts";
import { AnalyticsService } from "./analytics.service.ts";
import { captureException } from "./logging.service.ts";
import { db } from "../db/client.ts";
import { 
  users, notifications, analyticsEvents, pitchViews, sessions,
  conversations, conversationParticipants, messages, messageReadReceipts, typingIndicators
} from "../db/schema.ts";
import { eq, and, desc, sql, inArray, gte, or } from "drizzle-orm";

// Constants
const MAX_QUEUE_SIZE = 100;

// Simple JWT verification to match main server
async function verifySimpleToken(token: string): Promise<any | null> {
  try {
    const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-this-in-production";
    
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    const payload = await verify(token, key);
    return payload;
  } catch (error) {
    console.error("[WebSocket] Token verification failed:", error.message);
    return null;
  }
}

// WebSocket message types
export enum WSMessageType {
  // Connection management
  PING = "ping",
  PONG = "pong",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error",
  
  // Real-time notifications
  NOTIFICATION = "notification",
  NOTIFICATION_READ = "notification_read",
  
  // Live dashboard metrics
  DASHBOARD_UPDATE = "dashboard_update",
  METRICS_UPDATE = "metrics_update",
  
  // Draft auto-sync
  DRAFT_SYNC = "draft_sync",
  DRAFT_UPDATE = "draft_update",
  
  // Presence tracking
  USER_ONLINE = "user_online",
  USER_OFFLINE = "user_offline",
  USER_AWAY = "user_away",
  PRESENCE_UPDATE = "presence_update",
  
  // Upload progress tracking
  UPLOAD_PROGRESS = "upload_progress",
  UPLOAD_COMPLETE = "upload_complete",
  UPLOAD_ERROR = "upload_error",
  
  // Live pitch view counters
  PITCH_VIEW_UPDATE = "pitch_view_update",
  PITCH_STATS_UPDATE = "pitch_stats_update",
  
  // Typing indicators
  TYPING_START = "typing_start",
  TYPING_STOP = "typing_stop",
  USER_TYPING = "user_typing",
  
  // Activity feed updates
  ACTIVITY_UPDATE = "activity_update",
  
  // Messaging
  SEND_MESSAGE = "send_message",
  NEW_MESSAGE = "new_message",
  MESSAGE_READ = "message_read",
  
  // System events
  SYSTEM_ANNOUNCEMENT = "system_announcement",
  MAINTENANCE_MODE = "maintenance_mode",
  
  // Initial data
  INITIAL_DATA = "initial_data"
}

// WebSocket connection status
export enum WSConnectionStatus {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  ERROR = "error"
}

// User presence status
export enum PresenceStatus {
  ONLINE = "online",
  AWAY = "away",
  OFFLINE = "offline"
}

// WebSocket message interface
export interface WSMessage {
  type: WSMessageType;
  payload?: any;
  timestamp?: number;
  messageId?: string;
  userId?: number;
  conversationId?: number;
  targetUserId?: number;
  requestId?: string;
}

// Connection session interface
export interface WSSession {
  id: string;
  userId: number | null;
  userType: string;
  socket: WebSocket;
  lastActivity: number;
  presence: PresenceStatus;
  subscriptions: Set<string>;
  rateLimitTokens: number;
  rateLimitLastRefill: number;
  messageQueue: WSMessage[];
  authenticated: boolean;
  clientInfo: {
    userAgent?: string;
    ip?: string;
  };
}

// Rate limiting configuration
interface RateLimitConfig {
  maxMessages: number;
  windowMs: number;
  refillRate: number;
}

// Redis channel names for Pub/Sub
export const REDIS_CHANNELS = {
  USER_NOTIFICATIONS: (userId: number) => `pitchey:notifications:${userId}`,
  DASHBOARD_UPDATES: (userId: number) => `pitchey:dashboard:${userId}`,
  PITCH_UPDATES: (pitchId: number) => `pitchey:pitch:${pitchId}`,
  PRESENCE_UPDATES: "pitchey:presence",
  GLOBAL_ANNOUNCEMENTS: "pitchey:announcements",
  TYPING_INDICATORS: (conversationId: number) => `pitchey:typing:${conversationId}`,
  MESSAGE_UPDATES: (conversationId: number) => `pitchey:messages:${conversationId}`,
  UPLOAD_PROGRESS: (userId: number) => `pitchey:upload:${userId}`,
} as const;

/**
 * Production WebSocket Server Class
 */
export class PitcheyWebSocketServer {
  private sessions = new Map<string, WSSession>();
  private userSessions = new Map<number, Set<string>>(); // userId -> Set of sessionIds
  private failedConnections = new Map<string, { count: number; lastAttempt: number }>(); // Track failed attempts by IP
  private rateLimitConfig: RateLimitConfig;
  private cleanupInterval!: number;
  private heartbeatInterval!: number;
  private isShuttingDown = false;

  constructor() {
    this.rateLimitConfig = {
      maxMessages: 120, // 120 messages per minute for testing
      windowMs: 60 * 1000, // 1 minute window
      refillRate: 2, // 2 tokens per second
    };
    
    // Setup cleanup intervals
    this.setupCleanupIntervals();
    
    // Setup Redis subscription handlers
    this.setupRedisSubscriptions();
    
    console.log("[WebSocket] Pitchey WebSocket Server initialized");
  }

  /**
   * Setup periodic cleanup tasks
   */
  private setupCleanupIntervals(): void {
    // Clean up inactive sessions every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 30 * 1000);

    // Send heartbeat pings every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, 30 * 1000);
  }

  /**
   * Setup Redis Pub/Sub subscriptions
   */
  private async setupRedisSubscriptions(): Promise<void> {
    // In a production environment, you would setup Redis subscribers here
    // For now, we'll implement the pub/sub logic within the WebSocket handlers
    console.log("[WebSocket] Redis Pub/Sub subscriptions ready");
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(socket: WebSocket, request: Request, user?: any, isAuthenticated = false): Promise<void> {
    const clientIP = this.getClientIP(request);
    
    try {
      // Check rate limiting for failed connections
      if (this.isRateLimited(clientIP)) {
        socket.close(1008, "Too many failed connection attempts");
        return;
      }
      
      let payload = user;
      
      // If no user provided, try to authenticate using the old method for compatibility
      if (!payload && !isAuthenticated) {
        // Extract JWT token from query parameters
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        
        if (token) {
          // Verify JWT token
          payload = await verifySimpleToken(token);
          if (payload) {
            isAuthenticated = true;
          }
        }
      }
      
      // Create session (authenticated or unauthenticated)
      const session = await this.createSession(socket, payload, request, isAuthenticated);
      
      // Clear failed attempts on successful connection
      this.failedConnections.delete(clientIP);
      
      // Setup socket event handlers
      this.setupSocketHandlers(session);
      
      // Send connection confirmation
      await this.sendMessage(session, {
        type: WSMessageType.CONNECTED,
        payload: {
          sessionId: session.id,
          userId: session.userId,
          presence: session.presence,
          timestamp: Date.now()
        }
      });

      // Update user presence
      if (session.userId != null) {
        await this.updateUserPresence(session.userId, PresenceStatus.ONLINE);
      }
      
      // Send queued messages
      await this.sendQueuedMessages(session);
      
      // Track connection analytics
      await this.trackAnalyticsEvent({
        eventType: "websocket_connected",
        userId: session.userId,
        eventData: {
          sessionId: session.id,
          userType: session.userType
        }
      });

      console.log(`[WebSocket] User ${session.userId} connected (session: ${session.id})`);
      
    } catch (error) {
      this.recordFailedConnection(clientIP);
      console.error("[WebSocket] Connection error:", error);
      console.error("[WebSocket] Detailed error information:", {
        message: error instanceof Error ? error.message : "Unknown error type",
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        clientIP,
        url: request.url
      });
      
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'WebSocket', method: 'handleConnection' });
      
      // Send detailed error message to client before closing
      if (socket.readyState === WebSocket.OPEN) {
        const errorResponse = {
          type: "error",
          message: error instanceof Error ? error.message : "Server connection error",
          code: 1011,
          category: "internal",
          timestamp: Date.now()
        };
        
        try {
          socket.send(JSON.stringify(errorResponse));
        } catch (sendError) {
          console.error("[WebSocket] Failed to send error message:", sendError);
        }
      }
      
      socket.close(1011, error instanceof Error ? error.message.substring(0, 123) : "Internal server error");
    }
  }

  /**
   * Create a new WebSocket session (authenticated or unauthenticated)
   */
  private async createSession(socket: WebSocket, payload: any, request: Request, isAuthenticated = false): Promise<WSSession> {
    const sessionId = crypto.randomUUID();
    let userId = null;
    let userType = 'anonymous';
    let user = null;
    
    if (isAuthenticated && payload) {
      userId = payload.userId || parseInt(payload.sub);
      
      // Debug logging for user lookup
      console.log(`[WebSocket] Creating authenticated session for user ID: ${userId}, type: ${typeof userId}`);
      
      // Validate userId before database query
      if (!userId || isNaN(userId)) {
        console.warn(`[WebSocket] Invalid user ID: ${userId} from token payload:`, payload);
        throw new Error("Invalid user ID in token");
      }
      
      // Get user info from database
      const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!dbUser) {
        console.warn(`[WebSocket] User not found in database: ID ${userId}`);
        throw new Error("User not found");
      }
      
      user = dbUser;
      userType = user.userType;
      console.log(`[WebSocket] User found: ${user.email} (${user.userType})`);
    } else {
      console.log(`[WebSocket] Creating unauthenticated session: ${sessionId}`);
    }

    const session: WSSession = {
      id: sessionId,
      userId,
      userType,
      socket,
      lastActivity: Date.now(),
      presence: isAuthenticated ? PresenceStatus.ONLINE : PresenceStatus.OFFLINE,
      subscriptions: new Set(),
      rateLimitTokens: this.rateLimitConfig.maxMessages,
      rateLimitLastRefill: Date.now(),
      messageQueue: [],
      authenticated: isAuthenticated,
      clientInfo: {
        userAgent: request.headers.get("user-agent") || undefined,
        ip: request.headers.get("x-forwarded-for") || 
            request.headers.get("x-real-ip") || 
            "unknown"
      }
    };

    // Store session
    this.sessions.set(sessionId, session);
    
    // Add to user sessions map only if authenticated
    if (isAuthenticated && userId) {
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)!.add(sessionId);
    }

    return session;
  }

  /**
   * Setup WebSocket event handlers for a session
   */
  private setupSocketHandlers(session: WSSession): void {
    const { socket } = session;

    socket.onmessage = async (event) => {
      try {
        await this.handleMessage(session, event.data);
      } catch (error) {
        console.error(`[WebSocket] Message handling error for session ${session.id}:`, error);
        const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'WebSocket', method: 'handleConnection' });
        await this.sendError(session, "Message processing failed");
      }
    };

    socket.onclose = async (event) => {
      await this.handleDisconnection(session, event.code, event.reason);
    };

    socket.onerror = async (event) => {
      console.error(`[WebSocket] Socket error for session ${session.id}:`, event);
      await this.handleDisconnection(session, 1011, "Socket error");
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(session: WSSession, rawMessage: string): Promise<void> {
    // Update last activity
    session.lastActivity = Date.now();

    // Check rate limiting
    if (!this.checkRateLimit(session)) {
      await this.sendError(session, "Rate limit exceeded");
      return;
    }

    let message: WSMessage;
    try {
      message = JSON.parse(rawMessage);
    } catch (error) {
      await this.sendError(session, "Invalid message format");
      return;
    }

    // Add default properties
    message.userId = session.userId;
    message.timestamp = Date.now();
    if (!message.messageId) {
      message.messageId = crypto.randomUUID();
    }

    // Route message based on type
    await this.routeMessage(session, message);
  }

  /**
   * Check rate limiting for a session
   */
  private checkRateLimit(session: WSSession): boolean {
    const now = Date.now();
    const timeSinceLastRefill = now - session.rateLimitLastRefill;
    
    // Refill tokens based on time elapsed
    if (timeSinceLastRefill >= 1000) { // Refill every second
      const tokensToAdd = Math.floor(timeSinceLastRefill / 1000) * this.rateLimitConfig.refillRate;
      session.rateLimitTokens = Math.min(
        this.rateLimitConfig.maxMessages,
        session.rateLimitTokens + tokensToAdd
      );
      session.rateLimitLastRefill = now;
    }

    // Check if tokens available
    if (session.rateLimitTokens <= 0) {
      return false;
    }

    // Consume token
    session.rateLimitTokens--;
    return true;
  }

  /**
   * Route messages to appropriate handlers
   */
  private async routeMessage(session: WSSession, message: WSMessage): Promise<void> {
    try {
      switch (message.type) {
        case WSMessageType.PING:
          await this.handlePing(session, message);
          break;
          
        case WSMessageType.NOTIFICATION_READ:
          await this.handleNotificationRead(session, message);
          break;
          
        case WSMessageType.DRAFT_SYNC:
          await this.handleDraftSync(session, message);
          break;
          
        case WSMessageType.PRESENCE_UPDATE:
          await this.handlePresenceUpdate(session, message);
          break;
          
        case WSMessageType.TYPING_START:
        case WSMessageType.TYPING_STOP:
          await this.handleTypingIndicator(session, message);
          break;
          
        case WSMessageType.SEND_MESSAGE:
          await this.handleSendMessage(session, message);
          break;
          
        case WSMessageType.MESSAGE_READ:
          await this.handleMessageRead(session, message);
          break;
        
        case 'pong':
          // Client responded to our ping - update connection health
          await this.handlePong(session, message);
          break;
        
        case 'request_initial_data':
          // Client requests initial data
          await this.handleInitialDataRequest(session, message);
          break;
          
        default:
          // Don't log pong messages as unhandled
          if (message.type !== 'pong') {
            console.warn(`[WebSocket] Unhandled message type: ${message.type}`);
          }
          // Don't send error for unrecognized message types - just ignore them
      }

      // Track analytics for all message types
      await this.trackAnalyticsEvent({
        eventType: "websocket_message",
        userId: session.userId,
        eventData: {
          messageType: message.type,
          sessionId: session.id,
          messageId: message.messageId
        }
      });

    } catch (error) {
      console.error(`[WebSocket] Error handling message type ${message.type}:`, error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'WebSocket', method: 'handleConnection' });
      await this.sendError(session, "Message handling failed");
    }
  }

  /**
   * Handle ping message
   */
  private async handlePing(session: WSSession, message: WSMessage): Promise<void> {
    await this.sendMessage(session, {
      type: WSMessageType.PONG,
      payload: { timestamp: Date.now() },
      messageId: crypto.randomUUID()
    });
  }

  /**
   * Handle pong message (response to our ping)
   */
  private async handlePong(session: WSSession, message: WSMessage): Promise<void> {
    // Update last activity timestamp to mark connection as healthy
    session.lastActivity = Date.now();
    
    // Optionally track connection health metrics
    if (message.payload?.timestamp) {
      const latency = Date.now() - message.payload.timestamp;
      session.connectionLatency = latency;
    }
  }

  /**
   * Handle request for initial data
   */
  private async handleInitialDataRequest(session: WSSession, message: WSMessage): Promise<void> {
    if (session.userId == null) return;
    
    try {
      // Fetch initial data for the user
      const [recentNotifications, unreadMessages, activeConversations] = await Promise.all([
        // Get recent notifications
        db.select()
          .from(notifications)
          .where(eq(notifications.userId, session.userId))
          .orderBy(desc(notifications.createdAt))
          .limit(10),
        
        // Get unread message count
        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(messages)
          .where(and(
            eq(messages.receiverId, session.userId),
            eq(messages.isRead, false)
          )),
        
        // Get active conversations (last 5)
        db.select()
          .from(messages)
          .where(or(
            eq(messages.senderId, session.userId),
            eq(messages.receiverId, session.userId)
          ))
          .orderBy(desc(messages.sentAt))
          .limit(5)
      ]);

      // Send initial data to client
      await this.sendMessage(session, {
        type: 'initial_data',
        payload: {
          userId: session.userId,
          notifications: recentNotifications,
          unreadMessagesCount: unreadMessages[0]?.count || 0,
          conversations: activeConversations,
          serverTime: Date.now(),
        },
        messageId: crypto.randomUUID()
      });
    } catch (error) {
      console.error('[WebSocket] Error sending initial data:', error);
      await this.sendError(session, 'Failed to fetch initial data');
    }
  }

  /**
   * Handle notification read
   */
  private async handleNotificationRead(session: WSSession, message: WSMessage): Promise<void> {
    if (session.userId == null) return;
    
    const { notificationId } = message.payload || {};
    
    if (!notificationId) {
      await this.sendError(session, "Notification ID required");
      return;
    }

    // Update notification as read in database
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, session.userId)
      ));

    // Broadcast update to all user sessions
    await this.broadcastToUser(session.userId, {
      type: WSMessageType.NOTIFICATION_READ,
      payload: { notificationId },
      messageId: crypto.randomUUID()
    });
  }

  /**
   * Handle draft synchronization
   */
  private async handleDraftSync(session: WSSession, message: WSMessage): Promise<void> {
    if (session.userId == null) return;
    
    const { draftData, pitchId } = message.payload || {};
    
    if (!draftData || !pitchId) {
      await this.sendError(session, "Draft data and pitch ID required");
      return;
    }

    // Store draft in Redis for auto-sync
    const draftKey = `pitchey:draft:${session.userId}:${pitchId}`;
    await redisService.set(draftKey, {
      data: draftData,
      timestamp: Date.now(),
      sessionId: session.id
    }, 3600); // 1 hour TTL

    // Broadcast draft update to other user sessions
    await this.broadcastToUser(session.userId, {
      type: WSMessageType.DRAFT_UPDATE,
      payload: { pitchId, draftData, updatedBy: session.id },
      messageId: crypto.randomUUID()
    }, session.id); // Exclude current session
  }

  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(session: WSSession, message: WSMessage): Promise<void> {
    if (session.userId == null) return;
    
    const { status } = message.payload || {};
    
    if (!Object.values(PresenceStatus).includes(status)) {
      await this.sendError(session, "Invalid presence status");
      return;
    }

    session.presence = status;
    await this.updateUserPresence(session.userId, status);
  }

  /**
   * Handle typing indicators
   */
  private async handleTypingIndicator(session: WSSession, message: WSMessage): Promise<void> {
    if (session.userId == null) return;
    
    const { conversationId } = message.payload || {};
    
    if (!conversationId) {
      await this.sendError(session, "Conversation ID required");
      return;
    }

    // Verify user is participant in conversation
    const [participant] = await db.select()
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, session.userId)
      ))
      .limit(1);

    if (!participant) {
      await this.sendError(session, "Not a participant in this conversation");
      return;
    }

    if (message.type === WSMessageType.TYPING_START) {
      // Store typing indicator
      await db.insert(typingIndicators)
        .values({
          conversationId,
          userId: session.userId,
          startedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [typingIndicators.conversationId, typingIndicators.userId],
          set: { startedAt: new Date() }
        });
    } else {
      // Remove typing indicator
      await db.delete(typingIndicators)
        .where(and(
          eq(typingIndicators.conversationId, conversationId),
          eq(typingIndicators.userId, session.userId)
        ));
    }

    // Broadcast to conversation participants
    await this.broadcastToConversation(conversationId, {
      type: WSMessageType.USER_TYPING,
      payload: {
        conversationId,
        userId: session.userId,
        isTyping: message.type === WSMessageType.TYPING_START
      },
      messageId: crypto.randomUUID()
    }, session.userId); // Exclude sender
  }

  /**
   * Handle send message
   */
  private async handleSendMessage(session: WSSession, message: WSMessage): Promise<void> {
    const { conversationId, content, recipientId } = message.payload || {};
    
    if (!content) {
      await this.sendError(session, "Message content required");
      return;
    }

    // Create message in database
    const [newMessage] = await db.insert(messages)
      .values({
        senderId: session.userId,
        recipientId,
        content,
        createdAt: new Date()
      })
      .returning();

    // Broadcast to conversation participants
    if (conversationId) {
      await this.broadcastToConversation(conversationId, {
        type: WSMessageType.NEW_MESSAGE,
        payload: {
          messageId: newMessage.id,
          conversationId,
          senderId: session.userId,
          content,
          timestamp: newMessage.createdAt
        },
        messageId: crypto.randomUUID()
      });
    } else if (recipientId) {
      // Direct message
      await this.broadcastToUser(recipientId, {
        type: WSMessageType.NEW_MESSAGE,
        payload: {
          messageId: newMessage.id,
          senderId: session.userId,
          content,
          timestamp: newMessage.createdAt
        },
        messageId: crypto.randomUUID()
      });
    }
  }

  /**
   * Handle message read receipt
   */
  private async handleMessageRead(session: WSSession, message: WSMessage): Promise<void> {
    const { messageId } = message.payload || {};
    
    if (!messageId) {
      await this.sendError(session, "Message ID required");
      return;
    }

    // Create read receipt
    await db.insert(messageReadReceipts)
      .values({
        messageId,
        userId: session.userId,
        readAt: new Date()
      })
      .onConflictDoNothing();

    // Get message sender to notify
    const [messageInfo] = await db.select({ senderId: messages.senderId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (messageInfo && messageInfo.senderId !== session.userId) {
      await this.broadcastToUser(messageInfo.senderId, {
        type: WSMessageType.MESSAGE_READ,
        payload: {
          messageId,
          readBy: session.userId,
          readAt: new Date()
        },
        messageId: crypto.randomUUID()
      });
    }
  }

  /**
   * Send message to a specific session
   */
  async sendMessage(session: WSSession, message: WSMessage): Promise<void> {
    if (session.socket.readyState !== WebSocket.OPEN) {
      // Queue message if socket is not open with size limit
      if (session.messageQueue.length < MAX_QUEUE_SIZE) {
        session.messageQueue.push(message);
      } else {
        console.warn(`[WebSocket] Queue full for session ${session.id}, dropping oldest message`);
        session.messageQueue.shift(); // Remove oldest
        session.messageQueue.push(message);
      }
      return;
    }

    try {
      session.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[WebSocket] Failed to send message to session ${session.id}:`, error);
      // Queue message with size limit on error
      if (session.messageQueue.length < MAX_QUEUE_SIZE) {
        session.messageQueue.push(message);
      } else {
        console.warn(`[WebSocket] Queue full for session ${session.id}, dropping oldest message`);
        session.messageQueue.shift(); // Remove oldest
        session.messageQueue.push(message);
      }
    }
  }

  /**
   * Send error message to session
   */
  private async sendError(session: WSSession, errorMessage: string): Promise<void> {
    await this.sendMessage(session, {
      type: WSMessageType.ERROR,
      payload: { error: errorMessage, timestamp: Date.now() },
      messageId: crypto.randomUUID()
    });
  }

  /**
   * Broadcast message to all sessions of a user
   */
  async broadcastToUser(userId: number, message: WSMessage, excludeSessionId?: string): Promise<void> {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) return;

    const promises = Array.from(userSessionIds)
      .filter(sessionId => sessionId !== excludeSessionId)
      .map(sessionId => {
        const session = this.sessions.get(sessionId);
        if (session) {
          return this.sendMessage(session, message);
        }
      })
      .filter(Boolean);

    await Promise.allSettled(promises);
  }

  /**
   * Broadcast message to all participants in a conversation
   */
  async broadcastToConversation(conversationId: number, message: WSMessage, excludeUserId?: number): Promise<void> {
    try {
      // Get conversation participants
      const participants = await db.select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conversationId));

      const promises = participants
        .filter((p: { userId: number }) => p.userId !== excludeUserId)
        .map((p: { userId: number }) => this.broadcastToUser(p.userId, message));

      await Promise.allSettled(promises);
    } catch (error) {
      console.error(`[WebSocket] Failed to broadcast to conversation ${conversationId}:`, error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'WebSocket', method: 'handleConnection' });
    }
  }

  /**
   * Update user presence status
   */
  async updateUserPresence(userId: number, status: PresenceStatus): Promise<void> {
    try {
      // Store in Redis for fast access
      const presenceKey = `pitchey:presence:${userId}`;
      await redisService.set(presenceKey, {
        status,
        timestamp: Date.now(),
        lastSeen: new Date().toISOString()
      }, 3600); // 1 hour TTL

      // Broadcast presence update via Redis Pub/Sub
      await this.publishToRedis(REDIS_CHANNELS.PRESENCE_UPDATES, {
        type: WSMessageType.PRESENCE_UPDATE,
        payload: { userId, status, timestamp: Date.now() },
        messageId: crypto.randomUUID()
      });

      // Presence is tracked in Redis, no need to update sessions table
      // Sessions table is for JWT tokens, not presence tracking

    } catch (error) {
      console.error(`[WebSocket] Failed to update presence for user ${userId}:`, error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'WebSocket', method: 'handleConnection' });
    }
  }

  /**
   * Send queued messages to a session
   */
  private async sendQueuedMessages(session: WSSession): Promise<void> {
    if (session.messageQueue.length === 0) return;

    console.log(`[WebSocket] Sending ${session.messageQueue.length} queued messages to session ${session.id}`);
    
    for (const message of session.messageQueue) {
      await this.sendMessage(session, message);
    }
    
    session.messageQueue = [];
  }

  /**
   * Handle WebSocket disconnection
   */
  private async handleDisconnection(session: WSSession, code: number, reason: string): Promise<void> {
    try {
      console.log(`[WebSocket] User ${session.userId} disconnected (session: ${session.id}, code: ${code})`);

      // Remove from sessions
      this.sessions.delete(session.id);
      
      // Remove from user sessions if userId exists
      if (session.userId !== null) {
        const userSessionIds = this.userSessions.get(session.userId);
        if (userSessionIds) {
          userSessionIds.delete(session.id);
          if (userSessionIds.size === 0) {
            this.userSessions.delete(session.userId);
            // User is completely offline
            await this.updateUserPresence(session.userId, PresenceStatus.OFFLINE);
          }
        }

        // Track disconnection analytics
        await this.trackAnalyticsEvent({
          eventType: "websocket_disconnected",
          userId: session.userId,
          eventData: {
            sessionId: session.id,
            code,
            reason: reason || "Unknown",
            duration: Date.now() - session.lastActivity
          }
        });
      }

    } catch (error) {
      console.error(`[WebSocket] Error handling disconnection for session ${session.id}:`, error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'WebSocket', method: 'handleConnection' });
    }
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > inactiveThreshold) {
        console.log(`[WebSocket] Cleaning up inactive session ${sessionId}`);
        session.socket.close(1000, "Session timeout");
        this.handleDisconnection(session, 1000, "Session timeout");
      }
    }
  }

  /**
   * Send heartbeat pings
   */
  private sendHeartbeats(): void {
    for (const session of this.sessions.values()) {
      this.sendMessage(session, {
        type: WSMessageType.PING,
        payload: { timestamp: Date.now() },
        messageId: crypto.randomUUID()
      });
    }
  }

  /**
   * Publish message to Redis channel
   */
  private async publishToRedis(channel: string, message: WSMessage): Promise<void> {
    try {
      if (redisService.isEnabled()) {
        // Use Redis PUBLISH command for real pub/sub
        const result = await redisService.publish(channel, message);
        console.log(`[WebSocket] Published to Redis channel ${channel}: ${message.type} (${result} subscribers)`);
      } else {
        // Fallback to direct broadcasting (single instance)
        console.log(`[WebSocket] Redis not available, skipping publish to ${channel}:`, message.type);
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to publish to Redis channel ${channel}:`, error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      captureException(errorObj, { service: 'WebSocket', method: 'handleConnection' });
    }
  }

  /**
   * Track analytics event
   */
  private async trackAnalyticsEvent(event: {
    eventType: string;
    userId: number;
    eventData: any;
  }): Promise<void> {
    try {
      await AnalyticsService.trackEvent({
        ...event,
        eventData: {
          ...event.eventData,
          category: "websocket",
          timestamp: new Date(),
          source: "websocket_server"
        }
      });
    } catch (error) {
      console.error("[WebSocket] Failed to track analytics event:", error);
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalSessions: number;
    totalUsers: number;
    messageQueues: number;
    avgMessagesPerQueue: number;
  } {
    const totalSessions = this.sessions.size;
    const totalUsers = this.userSessions.size;
    const messageQueues = Array.from(this.sessions.values())
      .filter(s => s.messageQueue.length > 0).length;
    const totalQueuedMessages = Array.from(this.sessions.values())
      .reduce((sum, s) => sum + s.messageQueue.length, 0);
    
    return {
      totalSessions,
      totalUsers,
      messageQueues,
      avgMessagesPerQueue: messageQueues > 0 ? totalQueuedMessages / messageQueues : 0
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    console.log("[WebSocket] Initiating graceful shutdown...");
    
    // Clear intervals
    clearInterval(this.cleanupInterval);
    clearInterval(this.heartbeatInterval);
    
    // Close all connections
    const closePromises = Array.from(this.sessions.values()).map(session => {
      return new Promise<void>((resolve) => {
        session.socket.close(1001, "Server shutting down");
        session.socket.onclose = () => resolve();
        
        // Force close after 5 seconds
        setTimeout(() => resolve(), 5000);
      });
    });
    
    await Promise.allSettled(closePromises);
    
    console.log("[WebSocket] All connections closed. Shutdown complete.");
  }

  /**
   * Send notification to user via WebSocket
   */
  async sendNotificationToUser(userId: number, notification: {
    type: string;
    title: string;
    message: string;
    relatedId?: number;
    relatedType?: string;
  }): Promise<void> {
    await this.broadcastToUser(userId, {
      type: WSMessageType.NOTIFICATION,
      payload: notification,
      messageId: crypto.randomUUID()
    });
  }

  /**
   * Send dashboard update to user
   */
  async sendDashboardUpdate(userId: number, metrics: any): Promise<void> {
    await this.broadcastToUser(userId, {
      type: WSMessageType.DASHBOARD_UPDATE,
      payload: { metrics, timestamp: Date.now() },
      messageId: crypto.randomUUID()
    });
  }

  /**
   * Send upload progress update
   */
  async sendUploadProgress(userId: number, uploadId: string, progress: number, status: string): Promise<void> {
    await this.broadcastToUser(userId, {
      type: WSMessageType.UPLOAD_PROGRESS,
      payload: { uploadId, progress, status, timestamp: Date.now() },
      messageId: crypto.randomUUID()
    });
  }

  /**
   * Send pitch view counter update
   */
  async sendPitchStatsUpdate(pitchId: number, stats: any): Promise<void> {
    // Broadcast to all users viewing this pitch
    const message: WSMessage = {
      type: WSMessageType.PITCH_STATS_UPDATE,
      payload: { pitchId, stats, timestamp: Date.now() },
      messageId: crypto.randomUUID()
    };

    // In production, this would use Redis Pub/Sub to notify all server instances
    // For now, broadcast to all connected sessions that might be interested
    for (const session of this.sessions.values()) {
      if (session.subscriptions.has(`pitch:${pitchId}`)) {
        await this.sendMessage(session, message);
      }
    }
  }

  /**
   * Subscribe session to pitch updates
   */
  async subscribeToPitch(sessionId: string, pitchId: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscriptions.add(`pitch:${pitchId}`);
    }
  }

  /**
   * Unsubscribe session from pitch updates
   */
  async unsubscribeFromPitch(sessionId: string, pitchId: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscriptions.delete(`pitch:${pitchId}`);
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIP = request.headers.get("x-real-ip");
    const remoteAddr = request.headers.get("remote-addr");
    
    return forwarded?.split(",")[0]?.trim() || realIP || remoteAddr || "unknown";
  }

  /**
   * Check if IP is rate limited
   */
  private isRateLimited(ip: string): boolean {
    const failed = this.failedConnections.get(ip);
    if (!failed) return false;
    
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Reset after 5 minutes
    if (now - failed.lastAttempt > fiveMinutes) {
      this.failedConnections.delete(ip);
      return false;
    }
    
    // Block after 10 failed attempts within 5 minutes
    return failed.count >= 10;
  }

  /**
   * Record failed connection attempt
   */
  private recordFailedConnection(ip: string): void {
    const now = Date.now();
    const existing = this.failedConnections.get(ip);
    
    if (existing) {
      existing.count++;
      existing.lastAttempt = now;
    } else {
      this.failedConnections.set(ip, { count: 1, lastAttempt: now });
    }
    
    // Log if this is becoming a problem
    const failCount = this.failedConnections.get(ip)!.count;
    if (failCount === 5) {
      console.warn(`[WebSocket] IP ${ip} has ${failCount} failed connection attempts`);
    } else if (failCount >= 10) {
      console.warn(`[WebSocket] IP ${ip} is now rate limited (${failCount} failed attempts)`);
    }
  }
}

// Export singleton instance
export const pitcheyWebSocketServer = new PitcheyWebSocketServer();
export default pitcheyWebSocketServer;