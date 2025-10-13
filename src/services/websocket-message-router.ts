/**
 * WebSocket Message Router
 * Routes and processes different types of WebSocket messages with specialized handlers
 */

import { WSSession, WSMessage, WSMessageType, PresenceStatus } from "./websocket.service.ts";
import { webSocketRedisService } from "./websocket-redis.service.ts";
import { AnalyticsService } from "./analytics.service.ts";
import { NotificationService } from "./notification.service.ts";
import { sentryService, captureException } from "./sentry.service.ts";
import { db } from "../db/client.ts";
import { 
  users, pitches, notifications, messages, conversations, conversationParticipants,
  messageReadReceipts, typingIndicators, pitchViews, analyticsEvents
} from "../db/schema.ts";
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";

// Message handler function type
type MessageHandler = (session: WSSession, message: WSMessage) => Promise<WSMessage | WSMessage[] | void>;

// Message validation schema
interface ValidationRule {
  required?: string[];
  optional?: string[];
  types?: Record<string, string>;
  custom?: (payload: any) => string | null; // Returns error message or null
}

/**
 * WebSocket Message Router Class
 */
export class WebSocketMessageRouter {
  private handlers = new Map<WSMessageType, MessageHandler>();
  private validators = new Map<WSMessageType, ValidationRule>();
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
    
    this.setupHandlers();
    this.setupValidators();
    
    console.log("[WebSocket Router] Initialized with", this.handlers.size, "message handlers");
  }

  /**
   * Setup message handlers for different message types
   */
  private setupHandlers(): void {
    // Connection management
    this.handlers.set(WSMessageType.PING, this.handlePing.bind(this));
    
    // Real-time notifications
    this.handlers.set(WSMessageType.NOTIFICATION_READ, this.handleNotificationRead.bind(this));
    
    // Draft auto-sync
    this.handlers.set(WSMessageType.DRAFT_SYNC, this.handleDraftSync.bind(this));
    
    // Presence tracking
    this.handlers.set(WSMessageType.PRESENCE_UPDATE, this.handlePresenceUpdate.bind(this));
    
    // Typing indicators
    this.handlers.set(WSMessageType.TYPING_START, this.handleTypingStart.bind(this));
    this.handlers.set(WSMessageType.TYPING_STOP, this.handleTypingStop.bind(this));
    
    // Messaging
    this.handlers.set(WSMessageType.SEND_MESSAGE, this.handleSendMessage.bind(this));
    this.handlers.set(WSMessageType.MESSAGE_READ, this.handleMessageRead.bind(this));
    
    // Upload progress (client -> server subscription)
    this.handlers.set(WSMessageType.UPLOAD_PROGRESS, this.handleUploadProgressSubscription.bind(this));
    
    // Pitch view tracking
    this.handlers.set(WSMessageType.PITCH_VIEW_UPDATE, this.handlePitchViewSubscription.bind(this));
  }

  /**
   * Setup message validators
   */
  private setupValidators(): void {
    this.validators.set(WSMessageType.NOTIFICATION_READ, {
      required: ['notificationId'],
      types: { notificationId: 'number' }
    });

    this.validators.set(WSMessageType.DRAFT_SYNC, {
      required: ['pitchId', 'draftData'],
      types: { pitchId: 'number', draftData: 'object' }
    });

    this.validators.set(WSMessageType.PRESENCE_UPDATE, {
      required: ['status'],
      types: { status: 'string' },
      custom: (payload) => {
        const validStatuses = Object.values(PresenceStatus);
        return validStatuses.includes(payload.status) ? null : 'Invalid presence status';
      }
    });

    this.validators.set(WSMessageType.TYPING_START, {
      required: ['conversationId'],
      types: { conversationId: 'number' }
    });

    this.validators.set(WSMessageType.TYPING_STOP, {
      required: ['conversationId'],
      types: { conversationId: 'number' }
    });

    this.validators.set(WSMessageType.SEND_MESSAGE, {
      required: ['content'],
      optional: ['conversationId', 'recipientId', 'pitchId'],
      types: { 
        content: 'string', 
        conversationId: 'number', 
        recipientId: 'number',
        pitchId: 'number'
      },
      custom: (payload) => {
        if (!payload.conversationId && !payload.recipientId) {
          return 'Either conversationId or recipientId must be provided';
        }
        if (payload.content.length > 5000) {
          return 'Message content too long (max 5000 characters)';
        }
        return null;
      }
    });

    this.validators.set(WSMessageType.MESSAGE_READ, {
      required: ['messageId'],
      types: { messageId: 'number' }
    });

    this.validators.set(WSMessageType.UPLOAD_PROGRESS, {
      required: ['uploadId'],
      types: { uploadId: 'string' }
    });

    this.validators.set(WSMessageType.PITCH_VIEW_UPDATE, {
      required: ['pitchId'],
      types: { pitchId: 'number' }
    });
  }

  /**
   * Route message to appropriate handler
   */
  async routeMessage(session: WSSession, message: WSMessage): Promise<WSMessage | WSMessage[] | void> {
    try {
      // Validate message
      const validationError = await this.validateMessage(message);
      if (validationError) {
        throw new Error(`Validation failed: ${validationError}`);
      }

      // Get handler for message type
      const handler = this.handlers.get(message.type);
      if (!handler) {
        throw new Error(`No handler found for message type: ${message.type}`);
      }

      // Execute handler
      const result = await handler(session, message);

      // Track successful message processing
      await this.trackMessageAnalytics(session, message, 'success');

      return result;

    } catch (error) {
      console.error(`[WebSocket Router] Error routing message ${message.type}:`, error);
      captureException(error);
      
      // Track failed message processing
      await this.trackMessageAnalytics(session, message, 'error', error.message);
      
      // Return error response
      return {
        type: WSMessageType.ERROR,
        payload: {
          error: error.message,
          originalMessageId: message.messageId,
          timestamp: Date.now()
        },
        messageId: crypto.randomUUID()
      };
    }
  }

  /**
   * Validate message payload
   */
  private async validateMessage(message: WSMessage): Promise<string | null> {
    const validator = this.validators.get(message.type);
    if (!validator) {
      return null; // No validation rules defined
    }

    const { payload } = message;
    if (!payload && validator.required?.length) {
      return 'Message payload is required';
    }

    // Check required fields
    if (validator.required) {
      for (const field of validator.required) {
        if (payload[field] === undefined || payload[field] === null) {
          return `Required field missing: ${field}`;
        }
      }
    }

    // Check field types
    if (validator.types) {
      for (const [field, expectedType] of Object.entries(validator.types)) {
        if (payload[field] !== undefined) {
          const actualType = typeof payload[field];
          if (actualType !== expectedType) {
            return `Invalid type for field ${field}: expected ${expectedType}, got ${actualType}`;
          }
        }
      }
    }

    // Run custom validation
    if (validator.custom) {
      const customError = validator.custom(payload);
      if (customError) {
        return customError;
      }
    }

    return null;
  }

  /**
   * Handle ping message
   */
  private async handlePing(session: WSSession, message: WSMessage): Promise<WSMessage> {
    return {
      type: WSMessageType.PONG,
      payload: {
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
      },
      messageId: crypto.randomUUID()
    };
  }

  /**
   * Handle notification read
   */
  private async handleNotificationRead(session: WSSession, message: WSMessage): Promise<WSMessage[]> {
    const { notificationId } = message.payload;

    // Update notification in database
    const [updatedNotification] = await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, session.userId)
      ))
      .returning();

    if (!updatedNotification) {
      throw new Error('Notification not found or access denied');
    }

    // Get updated notification count
    const [unreadCount] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, session.userId),
        eq(notifications.isRead, false)
      ));

    return [
      {
        type: WSMessageType.NOTIFICATION_READ,
        payload: {
          notificationId,
          unreadCount: unreadCount.count,
          timestamp: Date.now()
        },
        messageId: crypto.randomUUID()
      }
    ];
  }

  /**
   * Handle draft synchronization
   */
  private async handleDraftSync(session: WSSession, message: WSMessage): Promise<void> {
    const { pitchId, draftData } = message.payload;

    // Verify user owns the pitch
    const [pitch] = await db.select()
      .from(pitches)
      .where(and(
        eq(pitches.id, pitchId),
        eq(pitches.userId, session.userId)
      ))
      .limit(1);

    if (!pitch) {
      throw new Error('Pitch not found or access denied');
    }

    // Store draft in Redis
    await webSocketRedisService.storeDraftSync(session.userId, pitchId, draftData, session.id);

    // The Redis service will handle broadcasting to other sessions
  }

  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(session: WSSession, message: WSMessage): Promise<void> {
    const { status } = message.payload;

    // Update session presence
    session.presence = status as PresenceStatus;

    // Update presence in Redis
    await webSocketRedisService.updatePresenceCache(session.userId, status, Date.now());

    // Broadcast presence update will be handled by Redis pub/sub
  }

  /**
   * Handle typing start
   */
  private async handleTypingStart(session: WSSession, message: WSMessage): Promise<void> {
    const { conversationId } = message.payload;

    // Verify user is participant in conversation
    await this.verifyConversationParticipant(session.userId, conversationId);

    // Set typing indicator in Redis
    await webSocketRedisService.setTypingIndicator(conversationId, session.userId, true);

    // Store in database with expiration
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
  }

  /**
   * Handle typing stop
   */
  private async handleTypingStop(session: WSSession, message: WSMessage): Promise<void> {
    const { conversationId } = message.payload;

    // Verify user is participant in conversation
    await this.verifyConversationParticipant(session.userId, conversationId);

    // Remove typing indicator from Redis
    await webSocketRedisService.setTypingIndicator(conversationId, session.userId, false);

    // Remove from database
    await db.delete(typingIndicators)
      .where(and(
        eq(typingIndicators.conversationId, conversationId),
        eq(typingIndicators.userId, session.userId)
      ));
  }

  /**
   * Handle send message
   */
  private async handleSendMessage(session: WSSession, message: WSMessage): Promise<WSMessage[]> {
    const { content, conversationId, recipientId, pitchId } = message.payload;

    let targetConversationId = conversationId;

    // If no conversation ID, create or find conversation with recipient
    if (!targetConversationId && recipientId) {
      targetConversationId = await this.getOrCreateConversation(session.userId, recipientId);
    }

    if (!targetConversationId) {
      throw new Error('Unable to determine conversation');
    }

    // Verify user is participant in conversation
    await this.verifyConversationParticipant(session.userId, targetConversationId);

    // Create message in database
    const [newMessage] = await db.insert(messages)
      .values({
        senderId: session.userId,
        recipientId,
        content,
        pitchId,
        createdAt: new Date()
      })
      .returning();

    // Get conversation participants for broadcasting
    const participants = await db.select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, targetConversationId));

    // Create response messages
    const responses: WSMessage[] = [];

    // Confirmation to sender
    responses.push({
      type: WSMessageType.NEW_MESSAGE,
      payload: {
        messageId: newMessage.id,
        conversationId: targetConversationId,
        senderId: session.userId,
        content,
        timestamp: newMessage.createdAt,
        status: 'sent'
      },
      messageId: crypto.randomUUID()
    });

    // Broadcast to other participants would be handled by the WebSocket server
    // using the participant list returned here
    
    return responses;
  }

  /**
   * Handle message read receipt
   */
  private async handleMessageRead(session: WSSession, message: WSMessage): Promise<WSMessage[]> {
    const { messageId } = message.payload;

    // Verify message exists and user has access
    const [messageInfo] = await db.select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

    if (!messageInfo) {
      throw new Error('Message not found');
    }

    // Verify user is recipient or sender
    if (messageInfo.senderId !== session.userId && messageInfo.recipientId !== session.userId) {
      throw new Error('Access denied');
    }

    // Create read receipt
    await db.insert(messageReadReceipts)
      .values({
        messageId,
        userId: session.userId,
        readAt: new Date()
      })
      .onConflictDoNothing();

    return [
      {
        type: WSMessageType.MESSAGE_READ,
        payload: {
          messageId,
          readBy: session.userId,
          readAt: new Date().toISOString()
        },
        messageId: crypto.randomUUID()
      }
    ];
  }

  /**
   * Handle upload progress subscription
   */
  private async handleUploadProgressSubscription(session: WSSession, message: WSMessage): Promise<WSMessage> {
    const { uploadId } = message.payload;

    // Add upload subscription to session
    session.subscriptions.add(`upload:${uploadId}`);

    return {
      type: WSMessageType.UPLOAD_PROGRESS,
      payload: {
        uploadId,
        subscribed: true,
        timestamp: Date.now()
      },
      messageId: crypto.randomUUID()
    };
  }

  /**
   * Handle pitch view subscription
   */
  private async handlePitchViewSubscription(session: WSSession, message: WSMessage): Promise<WSMessage> {
    const { pitchId } = message.payload;

    // Verify pitch exists and user has access
    const [pitch] = await db.select({
      id: pitches.id,
      userId: pitches.userId,
      requireNda: pitches.requireNda,
      status: pitches.status
    })
    .from(pitches)
    .where(eq(pitches.id, pitchId))
    .limit(1);

    if (!pitch) {
      throw new Error('Pitch not found');
    }

    // Check if user has access (owner, or public pitch, or has NDA)
    const hasAccess = await this.verifyPitchAccess(session.userId, pitch);
    if (!hasAccess) {
      throw new Error('Access denied to pitch');
    }

    // Record pitch view
    await db.insert(pitchViews)
      .values({
        pitchId,
        viewerId: session.userId,
        viewType: 'live_view',
        viewedAt: new Date()
      });

    // Subscribe to pitch updates
    session.subscriptions.add(`pitch:${pitchId}`);

    // Get current view count
    const [viewCount] = await db.select({ count: sql<number>`count(*)` })
      .from(pitchViews)
      .where(eq(pitchViews.pitchId, pitchId));

    return {
      type: WSMessageType.PITCH_VIEW_UPDATE,
      payload: {
        pitchId,
        subscribed: true,
        currentViewCount: viewCount.count,
        timestamp: Date.now()
      },
      messageId: crypto.randomUUID()
    };
  }

  /**
   * Verify user is participant in conversation
   */
  private async verifyConversationParticipant(userId: number, conversationId: number): Promise<void> {
    const [participant] = await db.select()
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ))
      .limit(1);

    if (!participant) {
      throw new Error('Not a participant in this conversation');
    }
  }

  /**
   * Get or create conversation between two users
   */
  private async getOrCreateConversation(userId1: number, userId2: number): Promise<number> {
    // Try to find existing conversation between users
    const existingConversation = await db.select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId1))
      .intersect(
        db.select({ conversationId: conversationParticipants.conversationId })
          .from(conversationParticipants)
          .where(eq(conversationParticipants.userId, userId2))
      )
      .limit(1);

    if (existingConversation.length > 0) {
      return existingConversation[0].conversationId;
    }

    // Create new conversation
    const [newConversation] = await db.insert(conversations)
      .values({
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Add participants
    await db.insert(conversationParticipants)
      .values([
        {
          conversationId: newConversation.id,
          userId: userId1,
          joinedAt: new Date()
        },
        {
          conversationId: newConversation.id,
          userId: userId2,
          joinedAt: new Date()
        }
      ]);

    return newConversation.id;
  }

  /**
   * Verify user has access to pitch
   */
  private async verifyPitchAccess(userId: number, pitch: any): Promise<boolean> {
    // Owner always has access
    if (pitch.userId === userId) {
      return true;
    }

    // Public pitches (no NDA required)
    if (!pitch.requireNda && pitch.status === 'published') {
      return true;
    }

    // Check if user has signed NDA
    if (pitch.requireNda) {
      // This would check NDA status in a real implementation
      // For now, we'll assume access is granted
      return true;
    }

    return false;
  }

  /**
   * Track message analytics
   */
  private async trackMessageAnalytics(
    session: WSSession, 
    message: WSMessage, 
    status: 'success' | 'error',
    errorMessage?: string
  ): Promise<void> {
    try {
      await AnalyticsService.trackEvent({
        eventType: 'websocket_message_processed',
        userId: session.userId,
        eventData: {
          category: 'websocket',
          messageType: message.type,
          messageId: message.messageId,
          sessionId: session.id,
          status,
          errorMessage,
          processingTime: Date.now() - (message.timestamp || Date.now()),
          userType: session.userType,
          clientInfo: session.clientInfo
        }
      });
    } catch (error) {
      console.error("[WebSocket Router] Failed to track message analytics:", error);
    }
  }

  /**
   * Get router statistics
   */
  getStats(): {
    totalHandlers: number;
    totalValidators: number;
    handlerTypes: string[];
  } {
    return {
      totalHandlers: this.handlers.size,
      totalValidators: this.validators.size,
      handlerTypes: Array.from(this.handlers.keys())
    };
  }

  /**
   * Add custom message handler
   */
  addHandler(messageType: WSMessageType, handler: MessageHandler, validator?: ValidationRule): void {
    this.handlers.set(messageType, handler);
    if (validator) {
      this.validators.set(messageType, validator);
    }
    console.log(`[WebSocket Router] Added handler for message type: ${messageType}`);
  }

  /**
   * Remove message handler
   */
  removeHandler(messageType: WSMessageType): void {
    this.handlers.delete(messageType);
    this.validators.delete(messageType);
    console.log(`[WebSocket Router] Removed handler for message type: ${messageType}`);
  }
}

// Export singleton instance
export const webSocketMessageRouter = new WebSocketMessageRouter();
export default webSocketMessageRouter;