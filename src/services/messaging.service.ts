/**
 * Comprehensive Real-Time Messaging Service
 * Features: Real-time WebSocket messaging, E2E encryption, file attachments,
 * read receipts, typing indicators, message search, and offline support
 */

import type { DatabaseService } from '../types/worker-types';
import { eq, and, or, desc, asc, like, isNull, isNotNull, sql, inArray } from 'drizzle-orm';
import type { 
  ConversationType, 
  NewConversationType, 
  MessageType, 
  NewMessageType,
  MessageAttachmentType,
  NewMessageAttachmentType,
  MessageReadReceiptType,
  NewMessageReadReceiptType,
  TypingIndicatorType,
  NewTypingIndicatorType,
  MessageReactionType,
  NewMessageReactionType,
  ConversationParticipantType,
  NewConversationParticipantType,
  BlockedUserType,
  NewBlockedUserType,
  ConversationSettingsType,
  NewConversationSettingsType
} from '../db/schema/messaging.schema';

// Redis integration for caching and real-time features
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
}

// Email service for offline notifications
interface EmailService {
  sendEmail: (params: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, any>;
  }) => Promise<void>;
}

// R2 storage service for file attachments
interface StorageService {
  uploadFile: (file: File | Buffer, key: string, metadata?: Record<string, any>) => Promise<string>;
  deleteFile: (key: string) => Promise<void>;
  getSignedUrl: (key: string, expiresIn?: number) => Promise<string>;
  generateUploadUrl: (key: string, contentType: string) => Promise<{ url: string; fields: Record<string, string> }>;
}

// WebSocket message types for real-time communication
export interface WebSocketMessage {
  type: 'message' | 'typing' | 'read_receipt' | 'presence' | 'reaction' | 'conversation_update' | 'user_blocked';
  data: any;
  conversationId?: number;
  userId: number;
  timestamp: string;
  messageId?: string;
}

// Encryption service for end-to-end encryption
interface EncryptionService {
  generateKeyPair: () => Promise<{ publicKey: string; privateKey: string }>;
  generateSymmetricKey: () => Promise<string>;
  encryptMessage: (content: string, key: string) => Promise<{ encrypted: string; iv: string }>;
  decryptMessage: (encrypted: string, key: string, iv: string) => Promise<string>;
  encryptKey: (key: string, publicKey: string) => Promise<string>;
  decryptKey: (encryptedKey: string, privateKey: string) => Promise<string>;
}

// Message filters and search options
export interface MessageFilters {
  conversationId?: number;
  senderId?: number;
  messageType?: string;
  contentType?: string;
  beforeDate?: Date;
  afterDate?: Date;
  hasAttachments?: boolean;
  isUnread?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ConversationFilters {
  userId: number;
  pitchId?: number;
  isGroup?: boolean;
  archived?: boolean;
  muted?: boolean;
  hasUnread?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// Message input for sending messages
export interface SendMessageInput {
  conversationId?: number;
  recipientId?: number;
  pitchId?: number;
  content: string;
  subject?: string;
  messageType?: 'text' | 'system' | 'nda' | 'investment' | 'announcement';
  contentType?: 'text' | 'image' | 'file' | 'audio' | 'video';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  parentMessageId?: number;
  attachments?: File[];
  isEncrypted?: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// Enhanced conversation data with participants and statistics
export interface ConversationWithDetails extends ConversationType {
  participants: Array<ConversationParticipantType & { 
    user: { 
      id: number; 
      name: string; 
      username: string; 
      userType: string; 
      isOnline: boolean; 
    } 
  }>;
  lastMessage?: MessageType;
  unreadCount: number;
  totalMessages: number;
  settings?: ConversationSettingsType;
  pitch?: { id: number; title: string };
}

// Enhanced message data with all related information
export interface MessageWithDetails extends MessageType {
  sender: { 
    id: number; 
    name: string; 
    username: string; 
    userType: string; 
  };
  recipient?: { 
    id: number; 
    name: string; 
    username: string; 
    userType: string; 
  };
  conversation: ConversationType;
  attachments: MessageAttachmentType[];
  reactions: Array<MessageReactionType & { user: { name: string; username: string } }>;
  readReceipts: Array<MessageReadReceiptType & { user: { name: string; username: string } }>;
  replies?: MessageWithDetails[];
  parentMessage?: MessageWithDetails;
  isReadByCurrentUser: boolean;
  reactionCounts: Record<string, number>;
}

export class MessagingService {
  private redis: RedisService;
  private email: EmailService;
  private storage: StorageService;
  private encryption: EncryptionService;
  private webSocketConnections: Map<number, Set<any>> = new Map();

  constructor(
    private db: DatabaseService,
    redis: RedisService,
    email: EmailService,
    storage: StorageService,
    encryption: EncryptionService
  ) {
    this.redis = redis;
    this.email = email;
    this.storage = storage;
    this.encryption = encryption;
  }

  // ============================================================================
  // CONVERSATION MANAGEMENT
  // ============================================================================

  /**
   * Get conversations for a user with advanced filtering and caching
   */
  async getConversations(filters: ConversationFilters): Promise<{
    conversations: ConversationWithDetails[];
    total: number;
    unreadTotal: number;
  }> {
    const cacheKey = `user:${filters.userId}:conversations:${JSON.stringify(filters)}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Build query with filters
      let baseQuery = this.db
        .select()
        .from('conversation_participants cp')
        .innerJoin('conversations c', eq('cp.conversation_id', 'c.id'))
        .where(
          and(
            eq('cp.user_id', filters.userId),
            eq('cp.is_active', true),
            isNull('cp.left_at')
          )
        );

      // Apply filters
      if (filters.pitchId) {
        baseQuery = baseQuery.where(eq('c.pitch_id', filters.pitchId));
      }
      if (filters.isGroup !== undefined) {
        baseQuery = baseQuery.where(eq('c.is_group', filters.isGroup));
      }
      if (filters.archived !== undefined) {
        baseQuery = baseQuery.where(eq('c.archived', filters.archived));
      }
      if (filters.muted !== undefined) {
        baseQuery = baseQuery.where(eq('c.muted', filters.muted));
      }
      if (filters.search) {
        baseQuery = baseQuery.where(
          or(
            like('c.title', `%${filters.search}%`),
            // Search in latest message content would require a join
          )
        );
      }

      // Order by last message date
      baseQuery = baseQuery.orderBy(desc('c.last_message_at'));

      // Apply pagination
      if (filters.limit) {
        baseQuery = baseQuery.limit(filters.limit);
      }
      if (filters.offset) {
        baseQuery = baseQuery.offset(filters.offset);
      }

      const conversations = await baseQuery.execute();

      // Enhance each conversation with additional data
      const enhancedConversations = await Promise.all(
        conversations.map(async (conv) => await this.enhanceConversationData(conv.c, filters.userId))
      );

      // Get total counts
      const totalQuery = await this.db
        .select({ count: sql`count(*)` })
        .from('conversation_participants cp')
        .innerJoin('conversations c', eq('cp.conversation_id', 'c.id'))
        .where(
          and(
            eq('cp.user_id', filters.userId),
            eq('cp.is_active', true),
            isNull('cp.left_at')
          )
        )
        .execute();

      const total = totalQuery[0]?.count || 0;

      // Get total unread count
      const unreadQuery = await this.db
        .select({ 
          unread: sql`sum(case when m.id > coalesce(cp.last_read_message_id, 0) then 1 else 0 end)` 
        })
        .from('conversation_participants cp')
        .innerJoin('conversations c', eq('cp.conversation_id', 'c.id'))
        .leftJoin('messages m', eq('m.conversation_id', 'c.id'))
        .where(
          and(
            eq('cp.user_id', filters.userId),
            eq('cp.is_active', true),
            eq('m.is_deleted', false)
          )
        )
        .execute();

      const unreadTotal = unreadQuery[0]?.unread || 0;

      const result = {
        conversations: enhancedConversations,
        total: Number(total),
        unreadTotal: Number(unreadTotal)
      };

      // Cache the result for 2 minutes
      await this.redis.set(cacheKey, JSON.stringify(result), 120);

      return result;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  /**
   * Create or get existing conversation between users
   */
  async createOrGetConversation(
    createdById: number,
    participantIds: number[],
    pitchId?: number,
    title?: string
  ): Promise<ConversationWithDetails> {
    try {
      // Check if conversation already exists
      if (participantIds.length === 1) {
        // Direct message - check for existing conversation
        const existingConv = await this.db
          .select({ id: 'c.id' })
          .from('conversations c')
          .innerJoin('conversation_participants cp1', eq('cp1.conversation_id', 'c.id'))
          .innerJoin('conversation_participants cp2', eq('cp2.conversation_id', 'c.id'))
          .where(
            and(
              eq('c.is_group', false),
              eq('cp1.user_id', createdById),
              eq('cp2.user_id', participantIds[0]),
              eq('cp1.is_active', true),
              eq('cp2.is_active', true),
              pitchId ? eq('c.pitch_id', pitchId) : isNull('c.pitch_id')
            )
          )
          .limit(1)
          .execute();

        if (existingConv.length > 0) {
          return await this.getConversationById(existingConv[0].id, createdById);
        }
      }

      // Create new conversation
      const [newConversation] = await this.db
        .insert('conversations')
        .values({
          title: title || (participantIds.length === 1 ? null : 'Group Chat'),
          isGroup: participantIds.length > 1,
          createdById,
          pitchId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .execute();

      // Add participants
      const allParticipants = [createdById, ...participantIds];
      const participantInserts = allParticipants.map(userId => ({
        conversationId: newConversation.id,
        userId,
        role: userId === createdById ? 'admin' : 'member',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await this.db
        .insert('conversation_participants')
        .values(participantInserts)
        .execute();

      // Initialize conversation settings for all participants
      const settingsInserts = allParticipants.map(userId => ({
        conversationId: newConversation.id,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await this.db
        .insert('conversation_settings')
        .values(settingsInserts)
        .execute();

      // Clear conversations cache for all participants
      await Promise.all(
        allParticipants.map(userId => 
          this.redis.del(`user:${userId}:conversations:*`)
        )
      );

      // Notify participants via WebSocket
      await this.broadcastConversationUpdate({
        type: 'conversation_update',
        data: { action: 'created', conversation: newConversation },
        conversationId: newConversation.id,
        userId: createdById,
        timestamp: new Date().toISOString()
      });

      return await this.enhanceConversationData(newConversation, createdById);
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID with enhanced data
   */
  async getConversationById(conversationId: number, userId: number): Promise<ConversationWithDetails> {
    const cacheKey = `conversation:${conversationId}:user:${userId}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const [conversation] = await this.db
        .select()
        .from('conversations')
        .where(eq('id', conversationId))
        .execute();

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Check if user is participant
      const [participant] = await this.db
        .select()
        .from('conversation_participants')
        .where(
          and(
            eq('conversation_id', conversationId),
            eq('user_id', userId),
            eq('is_active', true)
          )
        )
        .execute();

      if (!participant) {
        throw new Error('Access denied');
      }

      const enhanced = await this.enhanceConversationData(conversation, userId);
      
      // Cache for 5 minutes
      await this.redis.set(cacheKey, JSON.stringify(enhanced), 300);
      
      return enhanced;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================

  /**
   * Send a message with real-time delivery and offline support
   */
  async sendMessage(input: SendMessageInput, senderId: number): Promise<MessageWithDetails> {
    try {
      let conversationId = input.conversationId;

      // Create conversation if needed
      if (!conversationId && input.recipientId) {
        const conversation = await this.createOrGetConversation(
          senderId,
          [input.recipientId],
          input.pitchId
        );
        conversationId = conversation.id;
      }

      if (!conversationId) {
        throw new Error('Conversation ID or recipient ID required');
      }

      // Check if sender is participant and not blocked
      await this.validateMessagePermissions(conversationId, senderId, input.recipientId);

      // Handle file attachments
      let attachmentIds: number[] = [];
      if (input.attachments && input.attachments.length > 0) {
        attachmentIds = await this.uploadMessageAttachments(input.attachments, senderId);
      }

      // Prepare message content (encrypt if needed)
      let finalContent = input.content;
      let encryptedContent = null;
      let encryptionKeys: Array<{ userId: number; encryptedKey: string }> = [];

      if (input.isEncrypted) {
        // Generate message encryption key and encrypt content
        const messageKey = await this.encryption.generateSymmetricKey();
        const encrypted = await this.encryption.encryptMessage(input.content, messageKey);
        encryptedContent = encrypted.encrypted;
        finalContent = '[Encrypted Message]';

        // Get conversation participants for key distribution
        const participants = await this.db
          .select({ userId: 'user_id', encryptionPublicKey: 'encryption_public_key' })
          .from('conversation_participants')
          .where(
            and(
              eq('conversation_id', conversationId),
              eq('is_active', true),
              isNotNull('encryption_public_key')
            )
          )
          .execute();

        // Encrypt message key for each participant
        encryptionKeys = await Promise.all(
          participants.map(async (p) => ({
            userId: p.userId,
            encryptedKey: await this.encryption.encryptKey(messageKey, p.encryptionPublicKey!)
          }))
        );
      }

      // Create message
      const [newMessage] = await this.db
        .insert('messages')
        .values({
          conversationId,
          senderId,
          recipientId: input.recipientId,
          parentMessageId: input.parentMessageId,
          content: finalContent,
          encryptedContent,
          subject: input.subject,
          messageType: input.messageType || 'text',
          contentType: input.contentType || 'text',
          priority: input.priority || 'normal',
          expiresAt: input.expiresAt,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          sentAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .execute();

      // Store encryption keys if message is encrypted
      if (encryptionKeys.length > 0) {
        await this.db
          .insert('message_encryption_keys')
          .values(
            encryptionKeys.map(key => ({
              messageId: newMessage.id,
              userId: key.userId,
              encryptedKey: key.encryptedKey,
              createdAt: new Date()
            }))
          )
          .execute();
      }

      // Link attachments to message
      if (attachmentIds.length > 0) {
        await this.db
          .update('message_attachments')
          .set({ messageId: newMessage.id, updatedAt: new Date() })
          .where(inArray('id', attachmentIds))
          .execute();
      }

      // Update conversation last message
      await this.db
        .update('conversations')
        .set({ 
          lastMessageId: newMessage.id,
          lastMessageAt: newMessage.sentAt,
          updatedAt: new Date()
        })
        .where(eq('id', conversationId))
        .execute();

      // Create read receipt for sender
      await this.db
        .insert('message_read_receipts')
        .values({
          messageId: newMessage.id,
          userId: senderId,
          deliveredAt: new Date(),
          readAt: new Date(),
          receiptType: 'read',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .execute();

      // Clear conversation caches
      await this.clearConversationCaches(conversationId);

      // Get enhanced message data
      const messageWithDetails = await this.getMessageById(newMessage.id, senderId);

      // Real-time delivery via WebSocket
      await this.broadcastMessage({
        type: 'message',
        data: messageWithDetails,
        conversationId,
        userId: senderId,
        timestamp: new Date().toISOString(),
        messageId: newMessage.id.toString()
      });

      // Handle offline notifications
      await this.handleOfflineNotifications(conversationId, messageWithDetails, senderId);

      // Update search index
      await this.updateMessageSearchIndex(newMessage.id, finalContent, conversationId);

      return messageWithDetails;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get messages in a conversation with pagination and search
   */
  async getMessages(filters: MessageFilters, userId: number): Promise<{
    messages: MessageWithDetails[];
    hasMore: boolean;
    total: number;
  }> {
    if (!filters.conversationId) {
      throw new Error('Conversation ID is required');
    }

    try {
      // Verify user access
      await this.validateUserAccess(filters.conversationId, userId);

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Build query
      let baseQuery = this.db
        .select()
        .from('messages')
        .where(
          and(
            eq('conversation_id', filters.conversationId),
            eq('is_deleted', false)
          )
        );

      // Apply filters
      if (filters.senderId) {
        baseQuery = baseQuery.where(eq('sender_id', filters.senderId));
      }
      if (filters.messageType) {
        baseQuery = baseQuery.where(eq('message_type', filters.messageType));
      }
      if (filters.contentType) {
        baseQuery = baseQuery.where(eq('content_type', filters.contentType));
      }
      if (filters.beforeDate) {
        baseQuery = baseQuery.where(sql`sent_at < ${filters.beforeDate.toISOString()}`);
      }
      if (filters.afterDate) {
        baseQuery = baseQuery.where(sql`sent_at > ${filters.afterDate.toISOString()}`);
      }
      if (filters.hasAttachments) {
        baseQuery = baseQuery.where(
          sql`EXISTS (SELECT 1 FROM message_attachments WHERE message_id = messages.id)`
        );
      }
      if (filters.search) {
        baseQuery = baseQuery.where(
          or(
            like('content', `%${filters.search}%`),
            like('subject', `%${filters.search}%`)
          )
        );
      }

      // Order by sent date (newest first)
      baseQuery = baseQuery.orderBy(desc('sent_at'));

      // Apply pagination
      const messages = await baseQuery
        .limit(limit + 1) // Get one extra to check if there are more
        .offset(offset)
        .execute();

      const hasMore = messages.length > limit;
      if (hasMore) {
        messages.pop(); // Remove the extra message
      }

      // Enhance messages with related data
      const enhancedMessages = await Promise.all(
        messages.map(async (msg) => await this.enhanceMessageData(msg, userId))
      );

      // Get total count
      const totalQuery = await this.db
        .select({ count: sql`count(*)` })
        .from('messages')
        .where(
          and(
            eq('conversation_id', filters.conversationId),
            eq('is_deleted', false)
          )
        )
        .execute();

      const total = totalQuery[0]?.count || 0;

      // Mark messages as read
      await this.markMessagesAsRead(
        enhancedMessages.map(m => m.id),
        userId,
        filters.conversationId
      );

      return {
        messages: enhancedMessages,
        hasMore,
        total: Number(total)
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Search messages across all conversations
   */
  async searchMessages(
    query: string,
    userId: number,
    options: {
      conversationId?: number;
      messageType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    messages: MessageWithDetails[];
    total: number;
    highlights: Record<number, string[]>;
  }> {
    try {
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // Get user's accessible conversation IDs
      const accessibleConversations = await this.db
        .select({ conversationId: 'conversation_id' })
        .from('conversation_participants')
        .where(
          and(
            eq('user_id', userId),
            eq('is_active', true)
          )
        )
        .execute();

      const conversationIds = accessibleConversations.map(c => c.conversationId);

      if (conversationIds.length === 0) {
        return { messages: [], total: 0, highlights: {} };
      }

      // Build search query
      let searchQuery = this.db
        .select()
        .from('messages')
        .where(
          and(
            inArray('conversation_id', conversationIds),
            eq('is_deleted', false),
            or(
              like('content', `%${query}%`),
              like('subject', `%${query}%`)
            )
          )
        );

      // Apply additional filters
      if (options.conversationId) {
        searchQuery = searchQuery.where(eq('conversation_id', options.conversationId));
      }
      if (options.messageType) {
        searchQuery = searchQuery.where(eq('message_type', options.messageType));
      }

      // Order by relevance (sent date for now, could be enhanced with search scoring)
      searchQuery = searchQuery.orderBy(desc('sent_at'));

      // Get total count
      const totalQuery = await searchQuery.execute();
      const total = totalQuery.length;

      // Apply pagination
      const messages = await searchQuery
        .limit(limit)
        .offset(offset)
        .execute();

      // Enhance messages
      const enhancedMessages = await Promise.all(
        messages.map(async (msg) => await this.enhanceMessageData(msg, userId))
      );

      // Generate highlights
      const highlights: Record<number, string[]> = {};
      enhancedMessages.forEach(msg => {
        const contentHighlights = this.extractHighlights(msg.content, query);
        const subjectHighlights = msg.subject ? this.extractHighlights(msg.subject, query) : [];
        highlights[msg.id] = [...contentHighlights, ...subjectHighlights];
      });

      return {
        messages: enhancedMessages,
        total,
        highlights
      };
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }

  // ============================================================================
  // REAL-TIME FEATURES
  // ============================================================================

  /**
   * Handle typing indicators
   */
  async startTyping(conversationId: number, userId: number): Promise<void> {
    try {
      await this.validateUserAccess(conversationId, userId);

      // Update typing indicator
      await this.db
        .insert('typing_indicators')
        .values({
          conversationId,
          userId,
          isTyping: true,
          lastTyped: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: ['conversation_id', 'user_id'],
          set: {
            isTyping: true,
            lastTyped: new Date(),
            updatedAt: new Date()
          }
        })
        .execute();

      // Cache typing status
      await this.redis.hset(`typing:${conversationId}`, userId.toString(), new Date().toISOString());
      
      // Set expiration for auto-cleanup
      await this.redis.set(`typing:${conversationId}:${userId}`, 'typing', 5);

      // Broadcast typing indicator
      await this.broadcastTyping({
        type: 'typing',
        data: { isTyping: true, userId },
        conversationId,
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error starting typing indicator:', error);
      throw error;
    }
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(conversationId: number, userId: number): Promise<void> {
    try {
      // Update database
      await this.db
        .update('typing_indicators')
        .set({
          isTyping: false,
          updatedAt: new Date()
        })
        .where(
          and(
            eq('conversation_id', conversationId),
            eq('user_id', userId)
          )
        )
        .execute();

      // Remove from cache
      await this.redis.hdel(`typing:${conversationId}`, userId.toString());
      await this.redis.del(`typing:${conversationId}:${userId}`);

      // Broadcast stop typing
      await this.broadcastTyping({
        type: 'typing',
        data: { isTyping: false, userId },
        conversationId,
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error stopping typing indicator:', error);
      // Don't throw - this shouldn't break the user experience
    }
  }

  /**
   * Get current typing users in a conversation
   */
  async getTypingUsers(conversationId: number, userId: number): Promise<Array<{ userId: number; name: string; lastTyped: Date }>> {
    try {
      await this.validateUserAccess(conversationId, userId);

      // Get recent typing indicators (within last 10 seconds)
      const cutoffTime = new Date(Date.now() - 10000);
      
      const typingUsers = await this.db
        .select({
          userId: 'ti.user_id',
          lastTyped: 'ti.last_typed',
          name: sql`COALESCE(u.first_name || ' ' || u.last_name, u.username, 'Unknown User')`,
        })
        .from('typing_indicators ti')
        .innerJoin('users u', eq('ti.user_id', 'u.id'))
        .where(
          and(
            eq('ti.conversation_id', conversationId),
            eq('ti.is_typing', true),
            sql`ti.last_typed > ${cutoffTime.toISOString()}`,
            sql`ti.user_id != ${userId}` // Exclude current user
          )
        )
        .execute();

      return typingUsers.map(user => ({
        userId: user.userId,
        name: user.name,
        lastTyped: new Date(user.lastTyped)
      }));
    } catch (error) {
      console.error('Error fetching typing users:', error);
      return [];
    }
  }

  // ============================================================================
  // READ RECEIPTS AND DELIVERY
  // ============================================================================

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(messageIds: number[], userId: number, conversationId: number): Promise<void> {
    try {
      // Validate access
      await this.validateUserAccess(conversationId, userId);

      const now = new Date();

      // Update read receipts
      await Promise.all(
        messageIds.map(async (messageId) => {
          await this.db
            .insert('message_read_receipts')
            .values({
              messageId,
              userId,
              deliveredAt: now,
              readAt: now,
              receiptType: 'read',
              createdAt: now,
              updatedAt: now
            })
            .onConflictDoUpdate({
              target: ['message_id', 'user_id'],
              set: {
                readAt: now,
                receiptType: 'read',
                updatedAt: now
              }
            })
            .execute();
        })
      );

      // Update participant's last read message
      await this.db
        .update('conversation_participants')
        .set({
          lastReadAt: now,
          updatedAt: now
        })
        .where(
          and(
            eq('conversation_id', conversationId),
            eq('user_id', userId)
          )
        )
        .execute();

      // Clear conversation cache
      await this.clearConversationCaches(conversationId);

      // Broadcast read receipts
      await this.broadcastReadReceipts({
        type: 'read_receipt',
        data: { messageIds, userId, readAt: now.toISOString() },
        conversationId,
        userId,
        timestamp: now.toISOString()
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Get read receipts for messages
   */
  async getReadReceipts(messageIds: number[], userId: number): Promise<Record<number, MessageReadReceiptType[]>> {
    try {
      const receipts = await this.db
        .select({
          messageId: 'mrr.message_id',
          userId: 'mrr.user_id',
          deliveredAt: 'mrr.delivered_at',
          readAt: 'mrr.read_at',
          receiptType: 'mrr.receipt_type',
          userName: sql`COALESCE(u.first_name || ' ' || u.last_name, u.username, 'Unknown User')`,
          userUsername: 'u.username'
        })
        .from('message_read_receipts mrr')
        .innerJoin('users u', eq('mrr.user_id', 'u.id'))
        .where(
          and(
            inArray('mrr.message_id', messageIds),
            sql`mrr.user_id != ${userId}` // Exclude sender's own receipt
          )
        )
        .execute();

      // Group by message ID
      const grouped: Record<number, MessageReadReceiptType[]> = {};
      receipts.forEach(receipt => {
        if (!grouped[receipt.messageId]) {
          grouped[receipt.messageId] = [];
        }
        grouped[receipt.messageId].push({
          id: 0, // Not needed for this response
          messageId: receipt.messageId,
          userId: receipt.userId,
          deliveredAt: receipt.deliveredAt,
          readAt: receipt.readAt,
          receiptType: receipt.receiptType as 'delivered' | 'read',
          deviceInfo: null,
          createdAt: receipt.deliveredAt,
          updatedAt: receipt.readAt || receipt.deliveredAt,
          user: {
            name: receipt.userName,
            username: receipt.userUsername
          }
        } as any);
      });

      return grouped;
    } catch (error) {
      console.error('Error fetching read receipts:', error);
      return {};
    }
  }

  // ============================================================================
  // FILE ATTACHMENTS
  // ============================================================================

  /**
   * Upload message attachments to R2 storage
   */
  async uploadMessageAttachments(files: File[], uploadedById: number): Promise<number[]> {
    try {
      const attachmentIds: number[] = [];

      await Promise.all(
        files.map(async (file) => {
          // Generate unique filename
          const extension = file.name.split('.').pop();
          const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
          const key = `attachments/${filename}`;

          // Upload to R2
          const fileUrl = await this.storage.uploadFile(file, key, {
            originalName: file.name,
            mimeType: file.type,
            uploadedBy: uploadedById.toString()
          });

          // Generate thumbnail for images/videos if needed
          let thumbnailUrl = null;
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            // This would be implemented based on your thumbnail generation service
            // thumbnailUrl = await this.generateThumbnail(fileUrl, file.type);
          }

          // Create attachment record
          const [attachment] = await this.db
            .insert('message_attachments')
            .values({
              messageId: 0, // Will be updated when message is created
              filename,
              originalName: file.name,
              mimeType: file.type,
              fileSize: file.size,
              fileUrl,
              thumbnailUrl,
              uploadedById,
              virusScanStatus: 'pending',
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .returning({ id: 'id' })
            .execute();

          attachmentIds.push(attachment.id);

          // Queue virus scan (implement based on your virus scanning service)
          // await this.queueVirusScan(attachment.id, fileUrl);
        })
      );

      return attachmentIds;
    } catch (error) {
      console.error('Error uploading attachments:', error);
      throw error;
    }
  }

  /**
   * Get attachment with signed URL for download
   */
  async getAttachment(attachmentId: number, userId: number): Promise<MessageAttachmentType & { signedUrl: string }> {
    try {
      const [attachment] = await this.db
        .select({
          id: 'ma.id',
          messageId: 'ma.message_id',
          filename: 'ma.filename',
          originalName: 'ma.original_name',
          mimeType: 'ma.mime_type',
          fileSize: 'ma.file_size',
          fileUrl: 'ma.file_url',
          thumbnailUrl: 'ma.thumbnail_url',
          conversationId: 'm.conversation_id'
        })
        .from('message_attachments ma')
        .innerJoin('messages m', eq('ma.message_id', 'm.id'))
        .where(eq('ma.id', attachmentId))
        .execute();

      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Verify user has access to the conversation
      await this.validateUserAccess(attachment.conversationId, userId);

      // Generate signed URL for secure download
      const signedUrl = await this.storage.getSignedUrl(attachment.fileUrl, 3600); // 1 hour expiry

      return {
        ...attachment,
        signedUrl,
        uploadedById: 0,
        isEncrypted: false,
        encryptedUrl: null,
        virusScanStatus: 'clean',
        virusScanResult: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as MessageAttachmentType & { signedUrl: string };
    } catch (error) {
      console.error('Error fetching attachment:', error);
      throw error;
    }
  }

  // ============================================================================
  // USER BLOCKING AND MODERATION
  // ============================================================================

  /**
   * Block a user from messaging
   */
  async blockUser(blockerId: number, blockedId: number, reason?: string): Promise<void> {
    try {
      // Insert block record
      await this.db
        .insert('blocked_users')
        .values({
          blockerId,
          blockedId,
          reason,
          blockedAt: new Date(),
          createdAt: new Date()
        })
        .onConflictDoNothing()
        .execute();

      // Cache the block status
      await this.redis.sadd(`blocked:${blockerId}`, blockedId.toString());

      // Clear conversation caches
      await Promise.all([
        this.redis.del(`user:${blockerId}:conversations:*`),
        this.redis.del(`user:${blockedId}:conversations:*`)
      ]);

      // Notify via WebSocket
      await this.broadcastUserBlocked({
        type: 'user_blocked',
        data: { blockedUserId: blockedId, reason },
        conversationId: 0,
        userId: blockerId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: number, blockedId: number): Promise<void> {
    try {
      // Remove block record
      await this.db
        .delete('blocked_users')
        .where(
          and(
            eq('blocker_id', blockerId),
            eq('blocked_id', blockedId)
          )
        )
        .execute();

      // Remove from cache
      await this.redis.srem(`blocked:${blockerId}`, blockedId.toString());

      // Clear conversation caches
      await Promise.all([
        this.redis.del(`user:${blockerId}:conversations:*`),
        this.redis.del(`user:${blockedId}:conversations:*`)
      ]);
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  }

  /**
   * Check if a user is blocked
   */
  async isUserBlocked(blockerId: number, blockedId: number): Promise<boolean> {
    try {
      // Check cache first
      const cached = await this.redis.sismember(`blocked:${blockerId}`, blockedId.toString());
      if (cached !== null) {
        return cached === 1;
      }

      // Check database
      const [blocked] = await this.db
        .select({ id: 'id' })
        .from('blocked_users')
        .where(
          and(
            eq('blocker_id', blockerId),
            eq('blocked_id', blockedId)
          )
        )
        .limit(1)
        .execute();

      const isBlocked = !!blocked;

      // Cache the result
      if (isBlocked) {
        await this.redis.sadd(`blocked:${blockerId}`, blockedId.toString());
      }

      return isBlocked;
    } catch (error) {
      console.error('Error checking block status:', error);
      return false;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async enhanceConversationData(conversation: ConversationType, userId: number): Promise<ConversationWithDetails> {
    // Get participants with user details
    const participants = await this.db
      .select({
        id: 'cp.id',
        conversationId: 'cp.conversation_id',
        userId: 'cp.user_id',
        role: 'cp.role',
        isActive: 'cp.is_active',
        joinedAt: 'cp.joined_at',
        leftAt: 'cp.left_at',
        muteNotifications: 'cp.mute_notifications',
        lastReadAt: 'cp.last_read_at',
        encryptionPublicKey: 'cp.encryption_public_key',
        createdAt: 'cp.created_at',
        updatedAt: 'cp.updated_at',
        userName: sql`COALESCE(u.first_name || ' ' || u.last_name, u.username, 'Unknown User')`,
        username: 'u.username',
        userType: 'u.user_type',
      })
      .from('conversation_participants cp')
      .innerJoin('users u', eq('cp.user_id', 'u.id'))
      .where(
        and(
          eq('cp.conversation_id', conversation.id),
          eq('cp.is_active', true)
        )
      )
      .execute();

    // Get last message
    const lastMessage = conversation.lastMessageId 
      ? await this.getMessageById(conversation.lastMessageId, userId)
      : null;

    // Get unread count for current user
    const [unreadResult] = await this.db
      .select({ 
        count: sql`COUNT(*)` 
      })
      .from('messages m')
      .leftJoin('message_read_receipts mrr', 
        and(
          eq('mrr.message_id', 'm.id'),
          eq('mrr.user_id', userId)
        )
      )
      .where(
        and(
          eq('m.conversation_id', conversation.id),
          eq('m.is_deleted', false),
          sql`m.sender_id != ${userId}`,
          isNull('mrr.read_at')
        )
      )
      .execute();

    // Get total message count
    const [totalResult] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from('messages')
      .where(
        and(
          eq('conversation_id', conversation.id),
          eq('is_deleted', false)
        )
      )
      .execute();

    // Get user's conversation settings
    const [settings] = await this.db
      .select()
      .from('conversation_settings')
      .where(
        and(
          eq('conversation_id', conversation.id),
          eq('user_id', userId)
        )
      )
      .execute();

    // Get pitch details if linked
    let pitch = null;
    if (conversation.pitchId) {
      const [pitchResult] = await this.db
        .select({ id: 'id', title: 'title' })
        .from('pitches')
        .where(eq('id', conversation.pitchId))
        .execute();
      pitch = pitchResult || null;
    }

    // Check online status for participants (implement based on your presence system)
    const enhancedParticipants = participants.map(p => ({
      ...p,
      user: {
        id: p.userId,
        name: p.userName,
        username: p.username,
        userType: p.userType,
        isOnline: false // Would be populated from presence service
      }
    }));

    return {
      ...conversation,
      participants: enhancedParticipants,
      lastMessage: lastMessage || undefined,
      unreadCount: Number(unreadResult?.count || 0),
      totalMessages: Number(totalResult?.count || 0),
      settings: settings || undefined,
      pitch
    };
  }

  private async enhanceMessageData(message: MessageType, userId: number): Promise<MessageWithDetails> {
    // Get sender and recipient details
    const [sender] = await this.db
      .select({
        id: 'id',
        name: sql`COALESCE(first_name || ' ' || last_name, username, 'Unknown User')`,
        username: 'username',
        userType: 'user_type'
      })
      .from('users')
      .where(eq('id', message.senderId))
      .execute();

    let recipient = null;
    if (message.recipientId) {
      const [recipientResult] = await this.db
        .select({
          id: 'id',
          name: sql`COALESCE(first_name || ' ' || last_name, username, 'Unknown User')`,
          username: 'username',
          userType: 'user_type'
        })
        .from('users')
        .where(eq('id', message.recipientId))
        .execute();
      recipient = recipientResult || null;
    }

    // Get conversation
    const [conversation] = await this.db
      .select()
      .from('conversations')
      .where(eq('id', message.conversationId))
      .execute();

    // Get attachments
    const attachments = await this.db
      .select()
      .from('message_attachments')
      .where(eq('message_id', message.id))
      .execute();

    // Get reactions with user details
    const reactions = await this.db
      .select({
        id: 'mr.id',
        messageId: 'mr.message_id',
        userId: 'mr.user_id',
        reactionType: 'mr.reaction_type',
        createdAt: 'mr.created_at',
        userName: sql`COALESCE(u.first_name || ' ' || u.last_name, u.username, 'Unknown User')`,
        username: 'u.username'
      })
      .from('message_reactions mr')
      .innerJoin('users u', eq('mr.user_id', 'u.id'))
      .where(eq('mr.message_id', message.id))
      .execute();

    // Get read receipts
    const readReceipts = await this.db
      .select({
        id: 'mrr.id',
        messageId: 'mrr.message_id',
        userId: 'mrr.user_id',
        deliveredAt: 'mrr.delivered_at',
        readAt: 'mrr.read_at',
        receiptType: 'mrr.receipt_type',
        deviceInfo: 'mrr.device_info',
        createdAt: 'mrr.created_at',
        updatedAt: 'mrr.updated_at',
        userName: sql`COALESCE(u.first_name || ' ' || u.last_name, u.username, 'Unknown User')`,
        username: 'u.username'
      })
      .from('message_read_receipts mrr')
      .innerJoin('users u', eq('mrr.user_id', 'u.id'))
      .where(eq('mrr.message_id', message.id))
      .execute();

    // Check if current user has read the message
    const userReadReceipt = readReceipts.find(r => r.userId === userId);
    const isReadByCurrentUser = !!userReadReceipt?.readAt;

    // Calculate reaction counts
    const reactionCounts: Record<string, number> = {};
    reactions.forEach(reaction => {
      reactionCounts[reaction.reactionType] = (reactionCounts[reaction.reactionType] || 0) + 1;
    });

    // Get replies if this is a parent message
    let replies: MessageWithDetails[] = [];
    if (message.parentMessageId === null) {
      const replyMessages = await this.db
        .select()
        .from('messages')
        .where(
          and(
            eq('parent_message_id', message.id),
            eq('is_deleted', false)
          )
        )
        .orderBy(asc('sent_at'))
        .limit(5) // Limit to first 5 replies
        .execute();

      // Recursively enhance reply messages (but avoid infinite recursion)
      replies = await Promise.all(
        replyMessages.map(async (reply) => await this.enhanceMessageData(reply, userId))
      );
    }

    // Get parent message if this is a reply
    let parentMessage: MessageWithDetails | undefined;
    if (message.parentMessageId) {
      const [parentMsg] = await this.db
        .select()
        .from('messages')
        .where(eq('id', message.parentMessageId))
        .execute();
      
      if (parentMsg) {
        parentMessage = await this.enhanceMessageData(parentMsg, userId);
      }
    }

    return {
      ...message,
      sender: sender || { id: message.senderId, name: 'Unknown User', username: 'unknown', userType: 'creator' },
      recipient,
      conversation: conversation!,
      attachments: attachments || [],
      reactions: reactions.map(r => ({
        ...r,
        user: { name: r.userName, username: r.username }
      })) as any,
      readReceipts: readReceipts.map(r => ({
        ...r,
        user: { name: r.userName, username: r.username }
      })) as any,
      replies: replies || [],
      parentMessage,
      isReadByCurrentUser,
      reactionCounts
    };
  }

  private async validateUserAccess(conversationId: number, userId: number): Promise<void> {
    const [participant] = await this.db
      .select({ id: 'id' })
      .from('conversation_participants')
      .where(
        and(
          eq('conversation_id', conversationId),
          eq('user_id', userId),
          eq('is_active', true),
          isNull('left_at')
        )
      )
      .limit(1)
      .execute();

    if (!participant) {
      throw new Error('Access denied to conversation');
    }
  }

  private async validateMessagePermissions(
    conversationId: number, 
    senderId: number, 
    recipientId?: number
  ): Promise<void> {
    // Check if sender is participant
    await this.validateUserAccess(conversationId, senderId);

    // Check if recipient is blocked
    if (recipientId) {
      const blocked = await this.isUserBlocked(recipientId, senderId);
      const blockedBy = await this.isUserBlocked(senderId, recipientId);
      
      if (blocked || blockedBy) {
        throw new Error('Cannot send message to blocked user');
      }
    }
  }

  private async clearConversationCaches(conversationId: number): Promise<void> {
    // Get all participants
    const participants = await this.db
      .select({ userId: 'user_id' })
      .from('conversation_participants')
      .where(eq('conversation_id', conversationId))
      .execute();

    // Clear caches for all participants
    await Promise.all(
      participants.map(async (p) => {
        await this.redis.del(`user:${p.userId}:conversations:*`);
        await this.redis.del(`conversation:${conversationId}:user:${p.userId}`);
      })
    );
  }

  private extractHighlights(text: string, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    let index = textLower.indexOf(queryLower);
    while (index !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + query.length + 20);
      highlights.push(text.substring(start, end));
      index = textLower.indexOf(queryLower, index + 1);
    }
    
    return highlights;
  }

  private async updateMessageSearchIndex(messageId: number, content: string, conversationId: number): Promise<void> {
    try {
      // Insert or update search index
      await this.db
        .insert('message_search_index')
        .values({
          messageId,
          conversationId,
          content,
          searchTokens: content.toLowerCase(), // Simple tokenization
          language: 'en',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: ['message_id'],
          set: {
            content,
            searchTokens: content.toLowerCase(),
            updatedAt: new Date()
          }
        })
        .execute();
    } catch (error) {
      console.error('Error updating search index:', error);
      // Don't throw - search indexing shouldn't break messaging
    }
  }

  private async getMessageById(messageId: number, userId: number): Promise<MessageWithDetails> {
    const [message] = await this.db
      .select()
      .from('messages')
      .where(eq('id', messageId))
      .execute();

    if (!message) {
      throw new Error('Message not found');
    }

    return await this.enhanceMessageData(message, userId);
  }

  private async handleOfflineNotifications(
    conversationId: number, 
    message: MessageWithDetails, 
    senderId: number
  ): Promise<void> {
    try {
      // Get offline participants (implement based on your presence system)
      const participants = await this.db
        .select({ 
          userId: 'cp.user_id',
          email: 'u.email',
          firstName: 'u.first_name',
          muteNotifications: 'cs.email_notifications'
        })
        .from('conversation_participants cp')
        .innerJoin('users u', eq('cp.user_id', 'u.id'))
        .leftJoin('conversation_settings cs', 
          and(
            eq('cs.conversation_id', conversationId),
            eq('cs.user_id', 'cp.user_id')
          )
        )
        .where(
          and(
            eq('cp.conversation_id', conversationId),
            eq('cp.is_active', true),
            sql`cp.user_id != ${senderId}`
          )
        )
        .execute();

      // Send email notifications to offline users
      await Promise.all(
        participants
          .filter(p => p.muteNotifications !== false) // Default to true if not set
          .map(async (participant) => {
            await this.email.sendEmail({
              to: participant.email,
              subject: `New message from ${message.sender.name}`,
              template: 'message-notification',
              data: {
                recipientName: participant.firstName,
                senderName: message.sender.name,
                messagePreview: message.content.substring(0, 100),
                conversationTitle: message.conversation.title,
                messageUrl: `${process.env.FRONTEND_URL}/messages?conversation=${conversationId}`
              }
            });
          })
      );
    } catch (error) {
      console.error('Error sending offline notifications:', error);
      // Don't throw - offline notifications shouldn't break messaging
    }
  }

  // ============================================================================
  // WEBSOCKET BROADCASTING METHODS
  // ============================================================================

  private async broadcastMessage(message: WebSocketMessage): Promise<void> {
    try {
      await this.redis.publish(`conversation:${message.conversationId}`, JSON.stringify(message));
    } catch (error) {
      console.error('Error broadcasting message:', error);
    }
  }

  private async broadcastTyping(message: WebSocketMessage): Promise<void> {
    try {
      await this.redis.publish(`conversation:${message.conversationId}:typing`, JSON.stringify(message));
    } catch (error) {
      console.error('Error broadcasting typing:', error);
    }
  }

  private async broadcastReadReceipts(message: WebSocketMessage): Promise<void> {
    try {
      await this.redis.publish(`conversation:${message.conversationId}:receipts`, JSON.stringify(message));
    } catch (error) {
      console.error('Error broadcasting read receipts:', error);
    }
  }

  private async broadcastConversationUpdate(message: WebSocketMessage): Promise<void> {
    try {
      await this.redis.publish(`conversation:${message.conversationId}:update`, JSON.stringify(message));
    } catch (error) {
      console.error('Error broadcasting conversation update:', error);
    }
  }

  private async broadcastUserBlocked(message: WebSocketMessage): Promise<void> {
    try {
      await this.redis.publish(`user:${message.userId}:blocked`, JSON.stringify(message));
    } catch (error) {
      console.error('Error broadcasting user blocked:', error);
    }
  }
}

export { MessagingService };
export type { 
  WebSocketMessage,
  ConversationWithDetails,
  MessageWithDetails,
  SendMessageInput,
  ConversationFilters,
  MessageFilters
};