/**
 * Comprehensive Real-Time Messaging Service
 * Features: Real-time WebSocket messaging, E2E encryption, file attachments,
 * read receipts, typing indicators, message search, and offline support
 *
 * Refactored to use raw SQL queries via WorkerDatabase
 */

import { WorkerDatabase } from './worker-database';
import type {
  ConversationSettings,
  ConversationWithDetails,
  MessageWithDetails
} from '../types/messaging.types';

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
    data: Record<string, unknown>;
  }) => Promise<void>;
}

// R2 storage service for file attachments
interface StorageService {
  uploadFile: (file: File | Buffer, key: string, metadata?: Record<string, unknown>) => Promise<string>;
  deleteFile: (key: string) => Promise<void>;
  getSignedUrl: (key: string, expiresIn?: number) => Promise<string>;
  generateUploadUrl: (key: string, contentType: string) => Promise<{ url: string; fields: Record<string, string> }>;
}

// WebSocket message types for real-time communication
export interface WebSocketMessage {
  type: 'message' | 'typing' | 'read_receipt' | 'presence' | 'reaction' | 'conversation_update' | 'user_blocked';
  data: unknown;
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
  metadata?: Record<string, unknown>;
}

// Row types for raw SQL queries (with index signature for DatabaseRow compatibility)
interface ConversationRow {
  [key: string]: unknown;
  id: number;
  title: string | null;
  is_group: boolean;
  created_by_id: number;
  pitch_id: number | null;
  last_message_id: number | null;
  last_message_at: Date | null;
  encryption_key: string | null;
  is_encrypted: boolean;
  archived: boolean;
  muted: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface MessageRow {
  [key: string]: unknown;
  id: number;
  conversation_id: number;
  sender_id: number;
  recipient_id: number | null;
  parent_message_id: number | null;
  content: string;
  encrypted_content: string | null;
  content_type: string;
  message_type: string;
  subject: string | null;
  priority: string;
  is_edited: boolean;
  is_deleted: boolean;
  is_forwarded: boolean;
  delivered_at: Date | null;
  edited_at: Date | null;
  deleted_at: Date | null;
  expires_at: Date | null;
  metadata: Record<string, unknown> | null;
  search_vector: string | null;
  sent_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface ParticipantRow {
  [key: string]: unknown;
  id: number;
  conversation_id: number;
  user_id: number;
  role: string;
  is_active: boolean;
  joined_at: Date;
  left_at: Date | null;
  mute_notifications: boolean;
  last_read_at: Date | null;
  encryption_public_key: string | null;
  created_at: Date;
  updated_at: Date;
}

interface UserRow {
  [key: string]: unknown;
  id: number;
  name: string;
  username: string;
  email: string;
  user_type: string;
}

interface AttachmentRow {
  [key: string]: unknown;
  id: number;
  message_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url: string | null;
  encrypted_url: string | null;
  is_encrypted: boolean;
  uploaded_by_id: number;
  virus_scan_status: string;
  virus_scan_result: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface ReactionRow {
  [key: string]: unknown;
  id: number;
  message_id: number;
  user_id: number;
  reaction_type: string;
  created_at: Date;
  user_name?: string;
  user_username?: string;
}

interface ReadReceiptRow {
  [key: string]: unknown;
  id: number;
  message_id: number;
  user_id: number;
  delivered_at: Date;
  read_at: Date | null;
  receipt_type: string;
  device_info: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  user_name?: string;
  user_username?: string;
}

interface CountRow {
  [key: string]: unknown;
  count: string | number;
}

interface UnreadCountRow {
  [key: string]: unknown;
  unread: string | number;
}

interface IdRow {
  [key: string]: unknown;
  id: number;
}

interface ConversationSettingsRow {
  [key: string]: unknown;
  id: number;
  conversation_id: number;
  user_id: number;
  notifications: boolean;
  sound_notifications: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  theme: string;
  message_preview: boolean;
  read_receipts: boolean;
  typing_indicators: boolean;
  auto_delete_after: number | null;
  created_at: Date;
  updated_at: Date;
}

interface TypingIndicatorRow {
  [key: string]: unknown;
  user_id: number;
  is_typing: boolean;
  last_typed: Date;
}

export class MessagingService {
  private db: WorkerDatabase;
  private redis: RedisService;
  private email: EmailService;
  private storage: StorageService;
  private encryption: EncryptionService;
  private webSocketConnections: Map<number, Set<WebSocket>> = new Map();

  constructor(
    connectionString: string,
    redis: RedisService,
    email: EmailService,
    storage: StorageService,
    encryption: EncryptionService
  ) {
    this.db = new WorkerDatabase({ connectionString });
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
      // Build query parts
      const whereClauses: string[] = [
        'cp.user_id = $1',
        'cp.is_active = true',
        'cp.left_at IS NULL'
      ];
      const params: (string | number | boolean | null)[] = [filters.userId];
      let paramIndex = 2;

      if (filters.pitchId) {
        whereClauses.push(`c.pitch_id = $${paramIndex++}`);
        params.push(filters.pitchId);
      }
      if (filters.isGroup !== undefined) {
        whereClauses.push(`c.is_group = $${paramIndex++}`);
        params.push(filters.isGroup);
      }
      if (filters.archived !== undefined) {
        whereClauses.push(`c.archived = $${paramIndex++}`);
        params.push(filters.archived);
      }
      if (filters.muted !== undefined) {
        whereClauses.push(`c.muted = $${paramIndex++}`);
        params.push(filters.muted);
      }
      if (filters.search) {
        whereClauses.push(`c.title ILIKE $${paramIndex++}`);
        params.push(`%${filters.search}%`);
      }

      const limit = filters.limit || 20;
      const offset = filters.offset || 0;

      const query = `
        SELECT c.*
        FROM conversation_participants cp
        INNER JOIN conversations c ON cp.conversation_id = c.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      params.push(limit, offset);

      const conversations = await this.db.query<ConversationRow>(query, params);

      // Enhance each conversation with additional data
      const enhancedConversations = await Promise.all(
        conversations.map(async (conv) => await this.enhanceConversationData(conv, filters.userId))
      );

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM conversation_participants cp
        INNER JOIN conversations c ON cp.conversation_id = c.id
        WHERE cp.user_id = $1 AND cp.is_active = true AND cp.left_at IS NULL
      `;
      const totalResult = await this.db.query<CountRow>(countQuery, [filters.userId]);
      const total = Number(totalResult[0]?.count || 0);

      // Get total unread count
      const unreadQuery = `
        SELECT COALESCE(SUM(
          CASE WHEN m.id > COALESCE(
            (SELECT MAX(id) FROM message_read_receipts WHERE user_id = $1 AND message_id = m.id),
            0
          ) AND m.sender_id != $1 THEN 1 ELSE 0 END
        ), 0) as unread
        FROM conversation_participants cp
        INNER JOIN conversations c ON cp.conversation_id = c.id
        LEFT JOIN messages m ON m.conversation_id = c.id AND m.is_deleted = false
        WHERE cp.user_id = $1 AND cp.is_active = true
      `;
      const unreadResult = await this.db.query<UnreadCountRow>(unreadQuery, [filters.userId]);
      const unreadTotal = Number(unreadResult[0]?.unread || 0);

      const result = {
        conversations: enhancedConversations,
        total,
        unreadTotal
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
   * Enhance conversation data with participants, last message, and stats
   */
  private async enhanceConversationData(
    conv: ConversationRow,
    currentUserId: number
  ): Promise<ConversationWithDetails> {
    // Get participants with user info
    const participantsQuery = `
      SELECT cp.*, u.name, u.username, u.user_type, u.email
      FROM conversation_participants cp
      INNER JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id = $1 AND cp.is_active = true
    `;
    const participantsResult = await this.db.query<ParticipantRow & UserRow>(participantsQuery, [conv.id]);

    // Check online status from Redis
    const participants = await Promise.all(
      participantsResult.map(async (p) => {
        const isOnline = await this.redis.get(`user:${p.user_id}:online`) === 'true';
        return {
          id: p.id,
          conversationId: p.conversation_id,
          userId: p.user_id,
          role: p.role as 'admin' | 'member' | 'viewer',
          isActive: p.is_active,
          joinedAt: p.joined_at,
          leftAt: p.left_at || undefined,
          muteNotifications: p.mute_notifications,
          lastReadAt: p.last_read_at || undefined,
          encryptionPublicKey: p.encryption_public_key || undefined,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          user: {
            id: p.user_id,
            name: p.name,
            username: p.username,
            userType: p.user_type as 'creator' | 'investor' | 'production',
            isOnline
          }
        };
      })
    );

    // Get last message
    let lastMessage: MessageWithDetails | undefined;
    if (conv.last_message_id) {
      const messageResult = await this.db.query<MessageRow>(
        'SELECT * FROM messages WHERE id = $1',
        [conv.last_message_id]
      );
      if (messageResult[0]) {
        lastMessage = await this.enhanceMessageData(messageResult[0], currentUserId);
      }
    }

    // Get unread count for current user
    const unreadQuery = `
      SELECT COUNT(*) as count
      FROM messages m
      WHERE m.conversation_id = $1
        AND m.is_deleted = false
        AND m.sender_id != $2
        AND NOT EXISTS (
          SELECT 1 FROM message_read_receipts mrr
          WHERE mrr.message_id = m.id AND mrr.user_id = $2
        )
    `;
    const unreadResult = await this.db.query<CountRow>(unreadQuery, [conv.id, currentUserId]);
    const unreadCount = Number(unreadResult[0]?.count || 0);

    // Get total messages count
    const totalQuery = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE conversation_id = $1 AND is_deleted = false
    `;
    const totalResult = await this.db.query<CountRow>(totalQuery, [conv.id]);
    const totalMessages = Number(totalResult[0]?.count || 0);

    // Get conversation settings for current user
    const settingsResult = await this.db.query<ConversationSettingsRow>(
      'SELECT * FROM conversation_settings WHERE conversation_id = $1 AND user_id = $2',
      [conv.id, currentUserId]
    );

    return {
      id: conv.id,
      title: conv.title || undefined,
      isGroup: conv.is_group,
      createdById: conv.created_by_id,
      pitchId: conv.pitch_id || undefined,
      lastMessageId: conv.last_message_id || undefined,
      lastMessageAt: conv.last_message_at || undefined,
      encryptionKey: conv.encryption_key || undefined,
      isEncrypted: conv.is_encrypted,
      archived: conv.archived,
      muted: conv.muted,
      metadata: conv.metadata || undefined,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      participants,
      lastMessage,
      unreadCount,
      totalMessages,
      settings: settingsResult[0] ? this.convertSettingsRow(settingsResult[0]) : undefined
    };
  }

  /**
   * Enhance message data with sender, attachments, reactions, etc.
   */
  private async enhanceMessageData(
    msg: MessageRow,
    currentUserId: number
  ): Promise<MessageWithDetails> {
    // Get sender info
    const senderResult = await this.db.query<UserRow>(
      'SELECT id, name, username, email, user_type FROM users WHERE id = $1',
      [msg.sender_id]
    );
    const sender = senderResult[0] || { id: msg.sender_id, name: 'Unknown', username: 'unknown', email: '', user_type: 'creator' };

    // Get recipient info if exists
    let recipient: { id: number; name: string; username: string; userType: 'creator' | 'investor' | 'production' } | undefined;
    if (msg.recipient_id) {
      const recipientResult = await this.db.query<UserRow>(
        'SELECT id, name, username, email, user_type FROM users WHERE id = $1',
        [msg.recipient_id]
      );
      if (recipientResult[0]) {
        recipient = {
          id: recipientResult[0].id,
          name: recipientResult[0].name,
          username: recipientResult[0].username,
          userType: recipientResult[0].user_type as 'creator' | 'investor' | 'production'
        };
      }
    }

    // Get conversation
    const convResult = await this.db.query<ConversationRow>(
      'SELECT * FROM conversations WHERE id = $1',
      [msg.conversation_id]
    );

    // Get attachments
    const attachments = await this.db.query<AttachmentRow>(
      'SELECT * FROM message_attachments WHERE message_id = $1',
      [msg.id]
    );

    // Get reactions with user info
    const reactionsResult = await this.db.query<ReactionRow>(
      `SELECT mr.*, u.name as user_name, u.username as user_username
       FROM message_reactions mr
       INNER JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = $1`,
      [msg.id]
    );

    // Calculate reaction counts
    const reactionCounts: Record<string, number> = {};
    for (const r of reactionsResult) {
      reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
    }

    // Get read receipts with user info
    const readReceiptsResult = await this.db.query<ReadReceiptRow>(
      `SELECT mrr.*, u.name as user_name, u.username as user_username
       FROM message_read_receipts mrr
       INNER JOIN users u ON mrr.user_id = u.id
       WHERE mrr.message_id = $1`,
      [msg.id]
    );

    // Check if read by current user
    const isReadByCurrentUser = readReceiptsResult.some(r => r.user_id === currentUserId);

    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      recipientId: msg.recipient_id || undefined,
      parentMessageId: msg.parent_message_id || undefined,
      content: msg.content,
      encryptedContent: msg.encrypted_content || undefined,
      contentType: msg.content_type as 'text' | 'image' | 'file' | 'audio' | 'video',
      messageType: msg.message_type as 'text' | 'system' | 'nda' | 'investment' | 'announcement',
      subject: msg.subject || undefined,
      priority: msg.priority as 'low' | 'normal' | 'high' | 'urgent',
      isEdited: msg.is_edited,
      isDeleted: msg.is_deleted,
      isForwarded: msg.is_forwarded,
      deliveredAt: msg.delivered_at || undefined,
      editedAt: msg.edited_at || undefined,
      deletedAt: msg.deleted_at || undefined,
      expiresAt: msg.expires_at || undefined,
      metadata: msg.metadata || undefined,
      searchVector: msg.search_vector || undefined,
      sentAt: msg.sent_at,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
      sender: {
        id: sender.id,
        name: sender.name,
        username: sender.username,
        userType: sender.user_type as 'creator' | 'investor' | 'production'
      },
      recipient,
      conversation: {
        id: convResult[0]?.id || msg.conversation_id,
        title: convResult[0]?.title || undefined,
        isGroup: convResult[0]?.is_group || false,
        createdById: convResult[0]?.created_by_id || 0,
        pitchId: convResult[0]?.pitch_id || undefined,
        lastMessageId: convResult[0]?.last_message_id || undefined,
        lastMessageAt: convResult[0]?.last_message_at || undefined,
        encryptionKey: convResult[0]?.encryption_key || undefined,
        isEncrypted: convResult[0]?.is_encrypted || false,
        archived: convResult[0]?.archived || false,
        muted: convResult[0]?.muted || false,
        metadata: convResult[0]?.metadata || undefined,
        createdAt: convResult[0]?.created_at || new Date(),
        updatedAt: convResult[0]?.updated_at || new Date()
      },
      attachments: attachments.map(a => ({
        id: a.id,
        messageId: a.message_id,
        filename: a.filename,
        originalName: a.original_name,
        mimeType: a.mime_type,
        fileSize: a.file_size,
        fileUrl: a.file_url,
        thumbnailUrl: a.thumbnail_url || undefined,
        encryptedUrl: a.encrypted_url || undefined,
        isEncrypted: a.is_encrypted,
        uploadedById: a.uploaded_by_id,
        virusScanStatus: a.virus_scan_status as 'pending' | 'clean' | 'infected' | 'error',
        virusScanResult: a.virus_scan_result || undefined,
        metadata: a.metadata || undefined,
        createdAt: a.created_at,
        updatedAt: a.updated_at
      })),
      reactions: reactionsResult.map(r => ({
        id: r.id,
        messageId: r.message_id,
        userId: r.user_id,
        reactionType: r.reaction_type,
        createdAt: r.created_at,
        user: {
          name: r.user_name || 'Unknown',
          username: r.user_username || 'unknown'
        }
      })),
      readReceipts: readReceiptsResult.map(r => ({
        id: r.id,
        messageId: r.message_id,
        userId: r.user_id,
        deliveredAt: r.delivered_at,
        readAt: r.read_at || undefined,
        receiptType: r.receipt_type as 'delivered' | 'read',
        deviceInfo: r.device_info || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        user: {
          name: r.user_name || 'Unknown',
          username: r.user_username || 'unknown'
        }
      })),
      isReadByCurrentUser,
      reactionCounts
    };
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
      // Check if conversation already exists for direct messages
      if (participantIds.length === 1) {
        const existingQuery = pitchId
          ? `SELECT c.id
             FROM conversations c
             INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
             INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
             WHERE c.is_group = false
               AND cp1.user_id = $1 AND cp1.is_active = true
               AND cp2.user_id = $2 AND cp2.is_active = true
               AND c.pitch_id = $3
             LIMIT 1`
          : `SELECT c.id
             FROM conversations c
             INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
             INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
             WHERE c.is_group = false
               AND cp1.user_id = $1 AND cp1.is_active = true
               AND cp2.user_id = $2 AND cp2.is_active = true
               AND c.pitch_id IS NULL
             LIMIT 1`;

        const params = pitchId
          ? [createdById, participantIds[0], pitchId]
          : [createdById, participantIds[0]];

        const existing = await this.db.query<IdRow>(existingQuery, params);

        if (existing[0]) {
          return await this.getConversationById(existing[0].id, createdById);
        }
      }

      // Create new conversation
      const insertQuery = `
        INSERT INTO conversations (title, is_group, created_by_id, pitch_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `;
      const newConvResult = await this.db.query<ConversationRow>(insertQuery, [
        title || (participantIds.length === 1 ? null : 'Group Chat'),
        participantIds.length > 1,
        createdById,
        pitchId || null
      ]);
      const newConversation = newConvResult[0];

      // Add participants
      const allParticipants = [createdById, ...participantIds.filter(id => id !== createdById)];
      for (const userId of allParticipants) {
        await this.db.query(
          `INSERT INTO conversation_participants
           (conversation_id, user_id, role, joined_at, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
          [newConversation.id, userId, userId === createdById ? 'admin' : 'member']
        );

        // Initialize conversation settings
        await this.db.query(
          `INSERT INTO conversation_settings
           (conversation_id, user_id, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           ON CONFLICT (conversation_id, user_id) DO NOTHING`,
          [newConversation.id, userId]
        );
      }

      // Clear conversations cache for all participants
      await Promise.all(
        allParticipants.map(userId => this.redis.del(`user:${userId}:conversations:*`))
      );

      // Notify participants of new conversation
      await this.broadcastToConversation(newConversation.id, {
        type: 'conversation_update',
        data: {
          action: 'created',
          conversationId: newConversation.id
        },
        userId: createdById,
        timestamp: new Date().toISOString()
      });

      return await this.getConversationById(newConversation.id, createdById);
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID with full details
   */
  async getConversationById(
    conversationId: number,
    currentUserId: number
  ): Promise<ConversationWithDetails> {
    // Check if user is participant
    const participantCheck = await this.db.query<ParticipantRow>(
      `SELECT * FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND is_active = true`,
      [conversationId, currentUserId]
    );

    if (!participantCheck[0]) {
      throw new Error('Access denied: User is not a participant of this conversation');
    }

    const convResult = await this.db.query<ConversationRow>(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );

    if (!convResult[0]) {
      throw new Error('Conversation not found');
    }

    return await this.enhanceConversationData(convResult[0], currentUserId);
  }

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    senderId: number,
    input: SendMessageInput
  ): Promise<MessageWithDetails> {
    try {
      let conversationId = input.conversationId;

      // If no conversationId but recipientId, create/get conversation
      if (!conversationId && input.recipientId) {
        const conversation = await this.createOrGetConversation(
          senderId,
          [input.recipientId],
          input.pitchId
        );
        conversationId = conversation.id;
      }

      if (!conversationId) {
        throw new Error('Either conversationId or recipientId must be provided');
      }

      // Check if sender is participant
      const participantCheck = await this.db.query<ParticipantRow>(
        `SELECT * FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2 AND is_active = true`,
        [conversationId, senderId]
      );

      if (!participantCheck[0]) {
        throw new Error('Access denied: User is not a participant');
      }

      // Check if recipient is blocked
      if (input.recipientId) {
        const blockedCheck = await this.db.query<IdRow>(
          `SELECT id FROM blocked_users
           WHERE blocker_id = $1 AND blocked_id = $2`,
          [input.recipientId, senderId]
        );
        if (blockedCheck[0]) {
          throw new Error('Cannot send message: You are blocked by this user');
        }
      }

      // Handle encryption if enabled
      let encryptedContent: string | null = null;
      if (input.isEncrypted) {
        const convResult = await this.db.query<ConversationRow>(
          'SELECT encryption_key FROM conversations WHERE id = $1',
          [conversationId]
        );
        if (convResult[0]?.encryption_key) {
          const encrypted = await this.encryption.encryptMessage(
            input.content,
            convResult[0].encryption_key
          );
          encryptedContent = JSON.stringify(encrypted);
        }
      }

      // Insert message
      const insertQuery = `
        INSERT INTO messages
        (conversation_id, sender_id, recipient_id, parent_message_id, content, encrypted_content,
         content_type, message_type, subject, priority, expires_at, metadata, sent_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(), NOW())
        RETURNING *
      `;
      const messageResult = await this.db.query<MessageRow>(insertQuery, [
        conversationId,
        senderId,
        input.recipientId || null,
        input.parentMessageId || null,
        input.content,
        encryptedContent,
        input.contentType || 'text',
        input.messageType || 'text',
        input.subject || null,
        input.priority || 'normal',
        input.expiresAt || null,
        input.metadata ? JSON.stringify(input.metadata) : null
      ]);
      const message = messageResult[0];

      // Handle file attachments
      if (input.attachments && input.attachments.length > 0) {
        for (const file of input.attachments) {
          const key = `messages/${conversationId}/${message.id}/${file.name}`;
          const fileUrl = await this.storage.uploadFile(file, key);

          await this.db.query(
            `INSERT INTO message_attachments
             (message_id, filename, original_name, mime_type, file_size, file_url, uploaded_by_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [message.id, file.name, file.name, file.type, file.size, fileUrl, senderId]
          );
        }
      }

      // Update conversation's last message
      await this.db.query(
        `UPDATE conversations
         SET last_message_id = $1, last_message_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [message.id, conversationId]
      );

      // Create read receipt for sender
      await this.db.query(
        `INSERT INTO message_read_receipts (message_id, user_id, delivered_at, read_at, receipt_type, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW(), 'read', NOW(), NOW())
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [message.id, senderId]
      );

      // Clear relevant caches
      await this.redis.del(`conversation:${conversationId}:messages:*`);

      // Notify all participants
      const participants = await this.db.query<ParticipantRow>(
        `SELECT user_id FROM conversation_participants
         WHERE conversation_id = $1 AND is_active = true`,
        [conversationId]
      );

      for (const p of participants) {
        await this.redis.del(`user:${p.user_id}:conversations:*`);
      }

      // Broadcast message to WebSocket connections
      const enhancedMessage = await this.enhanceMessageData(message, senderId);
      await this.broadcastToConversation(conversationId, {
        type: 'message',
        data: enhancedMessage,
        conversationId,
        userId: senderId,
        timestamp: new Date().toISOString(),
        messageId: message.id.toString()
      });

      // Send push/email notifications to offline users
      await this.notifyOfflineUsers(conversationId, senderId, enhancedMessage);

      return enhancedMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    conversationId: number,
    currentUserId: number,
    filters: MessageFilters = {}
  ): Promise<{
    messages: MessageWithDetails[];
    total: number;
    hasMore: boolean;
  }> {
    // Check if user is participant
    const participantCheck = await this.db.query<ParticipantRow>(
      `SELECT * FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND is_active = true`,
      [conversationId, currentUserId]
    );

    if (!participantCheck[0]) {
      throw new Error('Access denied: User is not a participant');
    }

    const cacheKey = `conversation:${conversationId}:messages:${JSON.stringify(filters)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const whereClauses: string[] = [
      'conversation_id = $1',
      'is_deleted = false'
    ];
    const params: (string | number | boolean | Date | null)[] = [conversationId];
    let paramIndex = 2;

    if (filters.senderId) {
      whereClauses.push(`sender_id = $${paramIndex++}`);
      params.push(filters.senderId);
    }
    if (filters.messageType) {
      whereClauses.push(`message_type = $${paramIndex++}`);
      params.push(filters.messageType);
    }
    if (filters.contentType) {
      whereClauses.push(`content_type = $${paramIndex++}`);
      params.push(filters.contentType);
    }
    if (filters.beforeDate) {
      whereClauses.push(`sent_at < $${paramIndex++}`);
      params.push(filters.beforeDate);
    }
    if (filters.afterDate) {
      whereClauses.push(`sent_at > $${paramIndex++}`);
      params.push(filters.afterDate);
    }
    if (filters.search) {
      whereClauses.push(`content ILIKE $${paramIndex++}`);
      params.push(`%${filters.search}%`);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM messages
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY sent_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const messages = await this.db.query<MessageRow>(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count FROM messages
      WHERE ${whereClauses.slice(0, -2).join(' AND ') || 'conversation_id = $1 AND is_deleted = false'}
    `;
    const countParams = params.slice(0, -2);
    const totalResult = await this.db.query<CountRow>(countQuery, countParams.length ? countParams : [conversationId]);
    const total = Number(totalResult[0]?.count || 0);

    // Enhance messages with full data
    const enhancedMessages = await Promise.all(
      messages.map(msg => this.enhanceMessageData(msg, currentUserId))
    );

    const result = {
      messages: enhancedMessages,
      total,
      hasMore: offset + messages.length < total
    };

    // Cache for 1 minute
    await this.redis.set(cacheKey, JSON.stringify(result), 60);

    return result;
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: number,
    userId: number,
    newContent: string
  ): Promise<MessageWithDetails> {
    // Verify ownership
    const messageResult = await this.db.query<MessageRow>(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );

    if (!messageResult[0]) {
      throw new Error('Message not found');
    }

    if (messageResult[0].sender_id !== userId) {
      throw new Error('Access denied: Can only edit your own messages');
    }

    // Update message
    await this.db.query(
      `UPDATE messages
       SET content = $1, is_edited = true, edited_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [newContent, messageId]
    );

    // Get updated message
    const updatedResult = await this.db.query<MessageRow>(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );
    const updatedMessage = await this.enhanceMessageData(updatedResult[0], userId);

    // Broadcast update
    await this.broadcastToConversation(updatedMessage.conversationId, {
      type: 'message',
      data: { action: 'edited', message: updatedMessage },
      conversationId: updatedMessage.conversationId,
      userId,
      timestamp: new Date().toISOString(),
      messageId: messageId.toString()
    });

    // Clear cache
    await this.redis.del(`conversation:${updatedMessage.conversationId}:messages:*`);

    return updatedMessage;
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(
    messageId: number,
    userId: number
  ): Promise<void> {
    const messageResult = await this.db.query<MessageRow>(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );

    if (!messageResult[0]) {
      throw new Error('Message not found');
    }

    // Check if user is sender or conversation admin
    if (messageResult[0].sender_id !== userId) {
      const adminCheck = await this.db.query<ParticipantRow>(
        `SELECT * FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2 AND role = 'admin' AND is_active = true`,
        [messageResult[0].conversation_id, userId]
      );
      if (!adminCheck[0]) {
        throw new Error('Access denied: Can only delete your own messages or be admin');
      }
    }

    // Soft delete
    await this.db.query(
      `UPDATE messages
       SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [messageId]
    );

    // Broadcast deletion
    await this.broadcastToConversation(messageResult[0].conversation_id, {
      type: 'message',
      data: { action: 'deleted', messageId },
      conversationId: messageResult[0].conversation_id,
      userId,
      timestamp: new Date().toISOString(),
      messageId: messageId.toString()
    });

    // Clear cache
    await this.redis.del(`conversation:${messageResult[0].conversation_id}:messages:*`);
  }

  // ============================================================================
  // TYPING INDICATORS
  // ============================================================================

  /**
   * Update typing indicator for a user in a conversation
   */
  async setTypingIndicator(
    conversationId: number,
    userId: number,
    isTyping: boolean
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO typing_indicators (conversation_id, user_id, is_typing, last_typed, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (conversation_id, user_id)
       DO UPDATE SET is_typing = $3, last_typed = NOW(), updated_at = NOW()`,
      [conversationId, userId, isTyping]
    );

    // Broadcast typing indicator
    await this.broadcastToConversation(conversationId, {
      type: 'typing',
      data: { userId, isTyping },
      conversationId,
      userId,
      timestamp: new Date().toISOString()
    }, [userId]); // Exclude the typing user from receiving their own indicator
  }

  /**
   * Get users currently typing in a conversation
   */
  async getTypingUsers(conversationId: number): Promise<number[]> {
    // Only consider typing indicators from the last 5 seconds
    const result = await this.db.query<TypingIndicatorRow>(
      `SELECT user_id FROM typing_indicators
       WHERE conversation_id = $1
         AND is_typing = true
         AND last_typed > NOW() - INTERVAL '5 seconds'`,
      [conversationId]
    );
    return result.map(r => r.user_id);
  }

  // ============================================================================
  // READ RECEIPTS
  // ============================================================================

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(
    messageIds: number[],
    userId: number
  ): Promise<void> {
    if (messageIds.length === 0) return;

    for (const messageId of messageIds) {
      await this.db.query(
        `INSERT INTO message_read_receipts (message_id, user_id, delivered_at, read_at, receipt_type, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW(), 'read', NOW(), NOW())
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET read_at = NOW(), receipt_type = 'read', updated_at = NOW()`,
        [messageId, userId]
      );
    }

    // Get conversation ID for broadcast
    const messageResult = await this.db.query<MessageRow>(
      'SELECT conversation_id FROM messages WHERE id = $1',
      [messageIds[0]]
    );

    if (messageResult[0]) {
      // Broadcast read receipts
      await this.broadcastToConversation(messageResult[0].conversation_id, {
        type: 'read_receipt',
        data: { messageIds, userId },
        conversationId: messageResult[0].conversation_id,
        userId,
        timestamp: new Date().toISOString()
      });

      // Clear cache
      await this.redis.del(`conversation:${messageResult[0].conversation_id}:messages:*`);
    }
  }

  // ============================================================================
  // REACTIONS
  // ============================================================================

  /**
   * Add a reaction to a message
   */
  async addReaction(
    messageId: number,
    userId: number,
    reactionType: string
  ): Promise<void> {
    const messageResult = await this.db.query<MessageRow>(
      'SELECT conversation_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (!messageResult[0]) {
      throw new Error('Message not found');
    }

    await this.db.query(
      `INSERT INTO message_reactions (message_id, user_id, reaction_type, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (message_id, user_id, reaction_type) DO NOTHING`,
      [messageId, userId, reactionType]
    );

    // Broadcast reaction
    await this.broadcastToConversation(messageResult[0].conversation_id, {
      type: 'reaction',
      data: { messageId, userId, reactionType, action: 'added' },
      conversationId: messageResult[0].conversation_id,
      userId,
      timestamp: new Date().toISOString(),
      messageId: messageId.toString()
    });

    // Clear cache
    await this.redis.del(`conversation:${messageResult[0].conversation_id}:messages:*`);
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(
    messageId: number,
    userId: number,
    reactionType: string
  ): Promise<void> {
    const messageResult = await this.db.query<MessageRow>(
      'SELECT conversation_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (!messageResult[0]) {
      throw new Error('Message not found');
    }

    await this.db.query(
      'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3',
      [messageId, userId, reactionType]
    );

    // Broadcast reaction removal
    await this.broadcastToConversation(messageResult[0].conversation_id, {
      type: 'reaction',
      data: { messageId, userId, reactionType, action: 'removed' },
      conversationId: messageResult[0].conversation_id,
      userId,
      timestamp: new Date().toISOString(),
      messageId: messageId.toString()
    });

    // Clear cache
    await this.redis.del(`conversation:${messageResult[0].conversation_id}:messages:*`);
  }

  // ============================================================================
  // USER BLOCKING
  // ============================================================================

  /**
   * Block a user
   */
  async blockUser(
    blockerId: number,
    blockedId: number,
    reason?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO blocked_users (blocker_id, blocked_id, reason, blocked_at, created_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId, reason || null]
    );

    // Notify the blocked user (through WebSocket if online)
    await this.broadcastToUser(blockedId, {
      type: 'user_blocked',
      data: { blockerId },
      userId: blockerId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unblock a user
   */
  async unblockUser(
    blockerId: number,
    blockedId: number
  ): Promise<void> {
    await this.db.query(
      'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );
  }

  /**
   * Check if a user is blocked
   */
  async isUserBlocked(
    blockerId: number,
    blockedId: number
  ): Promise<boolean> {
    const result = await this.db.query<IdRow>(
      'SELECT id FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );
    return result.length > 0;
  }

  // ============================================================================
  // PRESENCE & WEBSOCKET MANAGEMENT
  // ============================================================================

  /**
   * Register a WebSocket connection for a user
   */
  registerConnection(userId: number, ws: WebSocket): void {
    if (!this.webSocketConnections.has(userId)) {
      this.webSocketConnections.set(userId, new Set());
    }
    this.webSocketConnections.get(userId)!.add(ws);

    // Mark user as online
    this.redis.set(`user:${userId}:online`, 'true');
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterConnection(userId: number, ws: WebSocket): void {
    const connections = this.webSocketConnections.get(userId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.webSocketConnections.delete(userId);
        // Mark user as offline
        this.redis.del(`user:${userId}:online`);
      }
    }
  }

  /**
   * Broadcast a message to all participants in a conversation
   */
  private async broadcastToConversation(
    conversationId: number,
    message: WebSocketMessage,
    excludeUserIds: number[] = []
  ): Promise<void> {
    const participants = await this.db.query<ParticipantRow>(
      `SELECT user_id FROM conversation_participants
       WHERE conversation_id = $1 AND is_active = true`,
      [conversationId]
    );

    for (const participant of participants) {
      if (excludeUserIds.includes(participant.user_id)) continue;
      await this.broadcastToUser(participant.user_id, message);
    }
  }

  /**
   * Broadcast a message to a specific user's connections
   */
  private async broadcastToUser(userId: number, message: WebSocketMessage): Promise<void> {
    const connections = this.webSocketConnections.get(userId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      for (const ws of connections) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error(`Failed to send message to user ${userId}:`, error);
        }
      }
    }

    // Also publish to Redis for cross-instance delivery
    await this.redis.publish(`user:${userId}:messages`, JSON.stringify(message));
  }

  /**
   * Notify offline users about new messages via email/push
   */
  private async notifyOfflineUsers(
    conversationId: number,
    senderId: number,
    message: MessageWithDetails
  ): Promise<void> {
    const participants = await this.db.query<ParticipantRow & UserRow>(
      `SELECT cp.user_id, u.email, u.name
       FROM conversation_participants cp
       INNER JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1
         AND cp.is_active = true
         AND cp.user_id != $2
         AND cp.mute_notifications = false`,
      [conversationId, senderId]
    );

    for (const participant of participants) {
      const isOnline = await this.redis.get(`user:${participant.user_id}:online`) === 'true';

      if (!isOnline) {
        // Check notification settings
        const settingsResult = await this.db.query<ConversationSettingsRow>(
          `SELECT * FROM conversation_settings
           WHERE conversation_id = $1 AND user_id = $2`,
          [conversationId, participant.user_id]
        );
        const settings = settingsResult[0];

        if (settings?.email_notifications !== false) {
          // Send email notification
          try {
            await this.email.sendEmail({
              to: participant.email,
              subject: `New message from ${message.sender.name}`,
              template: 'new_message',
              data: {
                recipientName: participant.name,
                senderName: message.sender.name,
                messagePreview: message.content.substring(0, 100),
                conversationId
              }
            });
          } catch (error) {
            console.error(`Failed to send email to ${participant.email}:`, error);
          }
        }
      }
    }
  }

  // ============================================================================
  // SEARCH
  // ============================================================================

  /**
   * Search messages across all user's conversations
   */
  async searchMessages(
    userId: number,
    query: string,
    options: {
      conversationId?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    messages: MessageWithDetails[];
    total: number;
  }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    let searchQuery: string;
    let params: (string | number)[];

    if (options.conversationId) {
      searchQuery = `
        SELECT m.* FROM messages m
        WHERE m.conversation_id = $1
          AND m.is_deleted = false
          AND m.content ILIKE $2
        ORDER BY m.sent_at DESC
        LIMIT $3 OFFSET $4
      `;
      params = [options.conversationId, `%${query}%`, limit, offset];
    } else {
      searchQuery = `
        SELECT m.* FROM messages m
        INNER JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
        WHERE cp.user_id = $1 AND cp.is_active = true
          AND m.is_deleted = false
          AND m.content ILIKE $2
        ORDER BY m.sent_at DESC
        LIMIT $3 OFFSET $4
      `;
      params = [userId, `%${query}%`, limit, offset];
    }

    const messages = await this.db.query<MessageRow>(searchQuery, params);

    // Get total count
    const countQuery = options.conversationId
      ? `SELECT COUNT(*) as count FROM messages m
         WHERE m.conversation_id = $1 AND m.is_deleted = false AND m.content ILIKE $2`
      : `SELECT COUNT(*) as count FROM messages m
         INNER JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
         WHERE cp.user_id = $1 AND cp.is_active = true AND m.is_deleted = false AND m.content ILIKE $2`;

    const countParams = options.conversationId
      ? [options.conversationId, `%${query}%`]
      : [userId, `%${query}%`];

    const totalResult = await this.db.query<CountRow>(countQuery, countParams);
    const total = Number(totalResult[0]?.count || 0);

    const enhancedMessages = await Promise.all(
      messages.map(msg => this.enhanceMessageData(msg, userId))
    );

    return {
      messages: enhancedMessages,
      total
    };
  }

  // ============================================================================
  // CONVERSATION SETTINGS
  // ============================================================================

  /**
   * Convert database row to ConversationSettings type
   */
  private convertSettingsRow(row: ConversationSettingsRow): ConversationSettings {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      userId: row.user_id,
      notifications: row.notifications,
      soundNotifications: row.sound_notifications,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      theme: row.theme as 'default' | 'dark' | 'light',
      messagePreview: row.message_preview,
      readReceipts: row.read_receipts,
      typingIndicators: row.typing_indicators,
      autoDeleteAfter: row.auto_delete_after ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update conversation settings for a user
   */
  async updateConversationSettings(
    conversationId: number,
    userId: number,
    settings: Partial<ConversationSettings>
  ): Promise<ConversationSettings> {
    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (settings.notifications !== undefined) {
      updates.push(`notifications = $${paramIndex++}`);
      params.push(settings.notifications);
    }
    if (settings.soundNotifications !== undefined) {
      updates.push(`sound_notifications = $${paramIndex++}`);
      params.push(settings.soundNotifications);
    }
    if (settings.emailNotifications !== undefined) {
      updates.push(`email_notifications = $${paramIndex++}`);
      params.push(settings.emailNotifications);
    }
    if (settings.pushNotifications !== undefined) {
      updates.push(`push_notifications = $${paramIndex++}`);
      params.push(settings.pushNotifications);
    }
    if (settings.theme !== undefined) {
      updates.push(`theme = $${paramIndex++}`);
      params.push(settings.theme);
    }
    if (settings.messagePreview !== undefined) {
      updates.push(`message_preview = $${paramIndex++}`);
      params.push(settings.messagePreview);
    }
    if (settings.readReceipts !== undefined) {
      updates.push(`read_receipts = $${paramIndex++}`);
      params.push(settings.readReceipts);
    }
    if (settings.typingIndicators !== undefined) {
      updates.push(`typing_indicators = $${paramIndex++}`);
      params.push(settings.typingIndicators);
    }
    if (settings.autoDeleteAfter !== undefined) {
      updates.push(`auto_delete_after = $${paramIndex++}`);
      params.push(settings.autoDeleteAfter ?? null);
    }

    if (updates.length === 0) {
      const existing = await this.db.query<ConversationSettingsRow>(
        'SELECT * FROM conversation_settings WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );
      return this.convertSettingsRow(existing[0]);
    }

    updates.push(`updated_at = NOW()`);
    params.push(conversationId, userId);

    const query = `
      UPDATE conversation_settings
      SET ${updates.join(', ')}
      WHERE conversation_id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await this.db.query<ConversationSettingsRow>(query, params);
    return this.convertSettingsRow(result[0]);
  }

  // ============================================================================
  // ARCHIVE & MUTE
  // ============================================================================

  /**
   * Archive a conversation for a user
   */
  async archiveConversation(
    conversationId: number,
    userId: number
  ): Promise<void> {
    // Check if user is participant
    const participantCheck = await this.db.query<ParticipantRow>(
      `SELECT * FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND is_active = true`,
      [conversationId, userId]
    );

    if (!participantCheck[0]) {
      throw new Error('Access denied');
    }

    await this.db.query(
      'UPDATE conversations SET archived = true, updated_at = NOW() WHERE id = $1',
      [conversationId]
    );

    // Clear cache
    await this.redis.del(`user:${userId}:conversations:*`);
  }

  /**
   * Mute a conversation for a user
   */
  async muteConversation(
    conversationId: number,
    userId: number,
    muted: boolean = true
  ): Promise<void> {
    await this.db.query(
      `UPDATE conversation_participants
       SET mute_notifications = $1, updated_at = NOW()
       WHERE conversation_id = $2 AND user_id = $3`,
      [muted, conversationId, userId]
    );

    // Clear cache
    await this.redis.del(`user:${userId}:conversations:*`);
  }

  // ============================================================================
  // PARTICIPANT MANAGEMENT
  // ============================================================================

  /**
   * Add participants to a group conversation
   */
  async addParticipants(
    conversationId: number,
    requesterId: number,
    userIds: number[]
  ): Promise<void> {
    // Verify requester is admin
    const adminCheck = await this.db.query<ParticipantRow>(
      `SELECT * FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND role = 'admin' AND is_active = true`,
      [conversationId, requesterId]
    );

    if (!adminCheck[0]) {
      throw new Error('Access denied: Only admins can add participants');
    }

    for (const userId of userIds) {
      await this.db.query(
        `INSERT INTO conversation_participants
         (conversation_id, user_id, role, joined_at, created_at, updated_at)
         VALUES ($1, $2, 'member', NOW(), NOW(), NOW())
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET is_active = true, left_at = NULL, updated_at = NOW()`,
        [conversationId, userId]
      );

      // Initialize settings
      await this.db.query(
        `INSERT INTO conversation_settings (conversation_id, user_id, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversationId, userId]
      );

      // Clear cache for new participant
      await this.redis.del(`user:${userId}:conversations:*`);
    }

    // Broadcast update
    await this.broadcastToConversation(conversationId, {
      type: 'conversation_update',
      data: { action: 'participant_added', userIds },
      conversationId,
      userId: requesterId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Remove a participant from a conversation
   */
  async removeParticipant(
    conversationId: number,
    requesterId: number,
    userId: number
  ): Promise<void> {
    // Allow self-removal or admin removal
    if (requesterId !== userId) {
      const adminCheck = await this.db.query<ParticipantRow>(
        `SELECT * FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2 AND role = 'admin' AND is_active = true`,
        [conversationId, requesterId]
      );

      if (!adminCheck[0]) {
        throw new Error('Access denied: Only admins can remove other participants');
      }
    }

    await this.db.query(
      `UPDATE conversation_participants
       SET is_active = false, left_at = NOW(), updated_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    // Clear cache
    await this.redis.del(`user:${userId}:conversations:*`);

    // Broadcast update
    await this.broadcastToConversation(conversationId, {
      type: 'conversation_update',
      data: { action: 'participant_removed', userId },
      conversationId,
      userId: requesterId,
      timestamp: new Date().toISOString()
    });
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  /**
   * Get a signed URL for an attachment download
   */
  async getAttachmentDownloadUrl(
    attachmentId: number,
    userId: number
  ): Promise<{ url: string; expiresAt: Date }> {
    // Verify user has access
    const attachment = await this.db.query<AttachmentRow>(
      `SELECT ma.* FROM message_attachments ma
       INNER JOIN messages m ON ma.message_id = m.id
       INNER JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
       WHERE ma.id = $1 AND cp.user_id = $2 AND cp.is_active = true`,
      [attachmentId, userId]
    );

    if (!attachment[0]) {
      throw new Error('Attachment not found or access denied');
    }

    const url = await this.storage.getSignedUrl(attachment[0].file_url, 3600); // 1 hour expiry
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    return { url, expiresAt };
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(
    attachmentId: number,
    userId: number
  ): Promise<void> {
    // Verify ownership
    const attachment = await this.db.query<AttachmentRow>(
      `SELECT ma.* FROM message_attachments ma
       WHERE ma.id = $1 AND ma.uploaded_by_id = $2`,
      [attachmentId, userId]
    );

    if (!attachment[0]) {
      throw new Error('Attachment not found or access denied');
    }

    // Delete from storage
    await this.storage.deleteFile(attachment[0].file_url);

    // Delete from database
    await this.db.query('DELETE FROM message_attachments WHERE id = $1', [attachmentId]);
  }
}
