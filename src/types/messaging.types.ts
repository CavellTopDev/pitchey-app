/**
 * Comprehensive Type Definitions for Messaging System
 * Includes all interfaces and types for real-time messaging,
 * WebSocket communication, encryption, and file handling
 */

// ============================================================================
// CORE MESSAGING TYPES
// ============================================================================

export interface User {
  id: number;
  name: string;
  username: string;
  email?: string;
  userType: 'creator' | 'investor' | 'production';
  firstName?: string;
  lastName?: string;
  isOnline?: boolean;
  lastSeen?: Date;
  avatar?: string;
}

export interface Conversation {
  id: number;
  title?: string;
  isGroup: boolean;
  createdById: number;
  pitchId?: number;
  lastMessageId?: number;
  lastMessageAt?: Date;
  encryptionKey?: string;
  isEncrypted: boolean;
  archived: boolean;
  muted: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationParticipant {
  id: number;
  conversationId: number;
  userId: number;
  role: 'admin' | 'member' | 'viewer';
  isActive: boolean;
  joinedAt: Date;
  leftAt?: Date;
  muteNotifications: boolean;
  lastReadAt?: Date;
  encryptionPublicKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  recipientId?: number;
  parentMessageId?: number;
  content: string;
  encryptedContent?: string;
  contentType: 'text' | 'image' | 'file' | 'audio' | 'video';
  messageType: 'text' | 'system' | 'nda' | 'investment' | 'announcement';
  subject?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isEdited: boolean;
  isDeleted: boolean;
  isForwarded: boolean;
  deliveredAt?: Date;
  editedAt?: Date;
  deletedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  searchVector?: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageAttachment {
  id: number;
  messageId: number;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  thumbnailUrl?: string;
  encryptedUrl?: string;
  isEncrypted: boolean;
  uploadedById: number;
  virusScanStatus: 'pending' | 'clean' | 'infected' | 'error';
  virusScanResult?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  reactionType: string; // 'like', 'love', 'laugh', 'wow', 'sad', 'angry', or emoji
  createdAt: Date;
}

export interface MessageReadReceipt {
  id: number;
  messageId: number;
  userId: number;
  deliveredAt: Date;
  readAt?: Date;
  receiptType: 'delivered' | 'read';
  deviceInfo?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TypingIndicator {
  id: number;
  conversationId: number;
  userId: number;
  isTyping: boolean;
  lastTyped: Date;
  updatedAt: Date;
}

export interface ConversationSettings {
  id: number;
  conversationId: number;
  userId: number;
  notifications: boolean;
  soundNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  theme: 'default' | 'dark' | 'light';
  messagePreview: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  autoDeleteAfter?: number; // Days
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockedUser {
  id: number;
  blockerId: number;
  blockedId: number;
  reason?: string;
  blockedAt: Date;
  createdAt: Date;
}

// ============================================================================
// ENHANCED DATA TYPES WITH RELATIONS
// ============================================================================

export interface ConversationWithDetails extends Conversation {
  participants: Array<ConversationParticipant & { 
    user: User;
  }>;
  lastMessage?: MessageWithDetails;
  unreadCount: number;
  totalMessages: number;
  settings?: ConversationSettings;
  pitch?: {
    id: number;
    title: string;
  };
  createdBy?: User;
}

export interface MessageWithDetails extends Message {
  sender: User;
  recipient?: User;
  conversation: Conversation;
  attachments: MessageAttachment[];
  reactions: Array<MessageReaction & { 
    user: { 
      name: string; 
      username: string;
    };
  }>;
  readReceipts: Array<MessageReadReceipt & { 
    user: { 
      name: string; 
      username: string;
    };
  }>;
  replies?: MessageWithDetails[];
  parentMessage?: MessageWithDetails;
  isReadByCurrentUser: boolean;
  reactionCounts: Record<string, number>;
  encryptionKeys?: MessageEncryptionKey[];
}

export interface MessageEncryptionKey {
  id: number;
  messageId: number;
  userId: number;
  encryptedKey: string;
  keyVersion: number;
  algorithm: string;
  createdAt: Date;
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

export type WebSocketMessageType = 
  | 'message'
  | 'typing'
  | 'read_receipt'
  | 'presence'
  | 'reaction'
  | 'conversation_update'
  | 'user_blocked'
  | 'connection_ack'
  | 'message_sent'
  | 'conversation_joined'
  | 'conversation_left'
  | 'typing_users'
  | 'error'
  | 'heartbeat'
  | 'pong'
  | 'join_conversation'
  | 'leave_conversation'
  | 'ping';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  conversationId?: number;
  userId: number;
  timestamp: string;
  messageId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// Specific WebSocket message data types
export interface ChatMessageData {
  conversationId: number;
  content: string;
  subject?: string;
  messageType?: 'text' | 'system' | 'nda' | 'investment' | 'announcement';
  contentType?: 'text' | 'image' | 'file' | 'audio' | 'video';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  parentMessageId?: number;
  isEncrypted?: boolean;
  metadata?: Record<string, any>;
  attachments?: AttachmentUploadData[];
}

export interface TypingIndicatorData {
  conversationId: number;
  isTyping: boolean;
  userId?: number;
  timestamp?: string;
}

export interface ReadReceiptData {
  messageIds: number[];
  conversationId: number;
  userId?: number;
  timestamp?: string;
}

export interface PresenceData {
  status: 'online' | 'away' | 'offline';
  userId?: number;
  timestamp?: string;
}

export interface ReactionData {
  messageId: number;
  conversationId: number;
  reactionType: string;
  userId?: number;
  timestamp?: string;
}

export interface ConversationUpdateData {
  action: 'created' | 'updated' | 'deleted' | 'participant_added' | 'participant_removed';
  conversation?: ConversationWithDetails;
  participantId?: number;
  updatedFields?: Partial<Conversation>;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface SendMessageRequest {
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

export interface CreateConversationRequest {
  participantIds: number[];
  pitchId?: number;
  title?: string;
  isEncrypted?: boolean;
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

export interface MessageFilters {
  conversationId: number;
  senderId?: number;
  messageType?: 'text' | 'system' | 'nda' | 'investment' | 'announcement';
  contentType?: 'text' | 'image' | 'file' | 'audio' | 'video';
  beforeDate?: Date;
  afterDate?: Date;
  hasAttachments?: boolean;
  isUnread?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MessageSearchOptions {
  conversationId?: number;
  messageType?: string;
  contentType?: string;
  senderId?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  hasAttachments?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// FILE UPLOAD TYPES
// ============================================================================

export interface AttachmentUploadData {
  file: File;
  filename?: string;
  metadata?: Record<string, any>;
}

export interface AttachmentUploadResponse {
  id: number;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  thumbnailUrl?: string;
}

export interface AttachmentDownloadRequest {
  attachmentId: number;
  conversationId?: number;
}

export interface AttachmentDownloadResponse extends MessageAttachment {
  signedUrl: string;
  expiresAt: Date;
}

// ============================================================================
// ENCRYPTION TYPES
// ============================================================================

export interface EncryptionKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedContent {
  encrypted: string;
  iv: string;
  algorithm: string;
  keyVersion: number;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  keySize: number;
  keyRotationInterval: number; // Days
}

// ============================================================================
// PRESENCE AND STATUS TYPES
// ============================================================================

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface UserPresence {
  userId: number;
  status: PresenceStatus;
  lastSeen: Date;
  connections: Set<string>;
  customStatus?: string;
  device?: {
    type: 'desktop' | 'mobile' | 'tablet' | 'web';
    name?: string;
  };
}

export interface OnlineUser {
  userId: number;
  user: User;
  status: PresenceStatus;
  lastSeen: Date;
  connectionCount: number;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationPreferences {
  conversations: {
    newMessage: boolean;
    mentions: boolean;
    reactions: boolean;
  };
  email: {
    enabled: boolean;
    frequency: 'immediate' | 'digest' | 'never';
    quietHours?: {
      start: string; // HH:mm format
      end: string;
      timezone: string;
    };
  };
  push: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
  };
  desktop: {
    enabled: boolean;
    sound: boolean;
    showPreview: boolean;
  };
}

export interface MessageNotification {
  id: string;
  type: 'message' | 'mention' | 'reaction';
  conversationId: number;
  messageId: number;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: Date;
  read: boolean;
  delivered: boolean;
}

// ============================================================================
// SEARCH AND ANALYTICS TYPES
// ============================================================================

export interface MessageSearchResult {
  messages: MessageWithDetails[];
  total: number;
  highlights: Record<number, string[]>; // messageId -> highlighted text snippets
  facets?: {
    senders: Array<{ userId: number; name: string; count: number }>;
    contentTypes: Array<{ type: string; count: number }>;
    timeRanges: Array<{ range: string; count: number }>;
  };
}

export interface ConversationAnalytics {
  conversationId: number;
  messageCount: number;
  participantCount: number;
  averageResponseTime: number; // Milliseconds
  mostActiveParticipant: {
    userId: number;
    messageCount: number;
  };
  messagesByDay: Array<{
    date: string;
    count: number;
  }>;
  attachmentStats: {
    total: number;
    byType: Record<string, number>;
    totalSize: number; // Bytes
  };
}

export interface MessagingMetrics {
  totalConversations: number;
  totalMessages: number;
  totalUsers: number;
  averageResponseTime: number;
  messagesByType: Record<string, number>;
  messagesByContentType: Record<string, number>;
  encryptedMessagesPercent: number;
  onlineUsers: number;
  averageSessionDuration: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface MessagingError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
}

export type MessagingErrorCode = 
  | 'CONVERSATION_NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'MESSAGE_NOT_FOUND'
  | 'USER_BLOCKED'
  | 'ATTACHMENT_TOO_LARGE'
  | 'VIRUS_DETECTED'
  | 'ENCRYPTION_FAILED'
  | 'RATE_LIMITED'
  | 'INVALID_CONTENT'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR';

// ============================================================================
// HOOK TYPES FOR REACT INTEGRATION
// ============================================================================

export interface UseMessagingOptions {
  userId: number;
  autoConnect?: boolean;
  reconnectOnError?: boolean;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface UseMessagingReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Conversations
  conversations: ConversationWithDetails[];
  selectedConversation: number | null;
  setSelectedConversation: (id: number | null) => void;
  createConversation: (request: CreateConversationRequest) => Promise<ConversationWithDetails>;
  
  // Messages
  messages: Record<number, MessageWithDetails[]>; // conversationId -> messages
  sendMessage: (request: SendMessageRequest) => Promise<MessageWithDetails>;
  editMessage: (messageId: number, content: string) => Promise<MessageWithDetails>;
  deleteMessage: (messageId: number) => Promise<void>;
  markAsRead: (messageIds: number[], conversationId: number) => Promise<void>;
  
  // Real-time features
  typingUsers: Record<number, string[]>; // conversationId -> usernames
  onlineUsers: Record<number, boolean>; // userId -> online status
  startTyping: (conversationId: number) => void;
  stopTyping: (conversationId: number) => void;
  
  // Reactions
  addReaction: (messageId: number, reaction: string) => Promise<void>;
  removeReaction: (messageId: number, reaction: string) => Promise<void>;
  
  // Attachments
  uploadAttachment: (file: File, conversationId: number) => Promise<AttachmentUploadResponse>;
  downloadAttachment: (attachmentId: number) => Promise<AttachmentDownloadResponse>;
  
  // Search
  searchMessages: (query: string, options?: MessageSearchOptions) => Promise<MessageSearchResult>;
  
  // User management
  blockUser: (userId: number) => Promise<void>;
  unblockUser: (userId: number) => Promise<void>;
  
  // Settings
  updateConversationSettings: (conversationId: number, settings: Partial<ConversationSettings>) => Promise<void>;
  
  // Presence
  updatePresence: (status: PresenceStatus) => void;
  getUserPresence: (userId: number) => UserPresence | null;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface MessagingConfig {
  websocket: {
    url: string;
    reconnectInterval: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
    messageQueueSize: number;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
    thumbnailSizes: number[];
    virusScanEnabled: boolean;
  };
  encryption: EncryptionConfig;
  notifications: {
    maxQueueSize: number;
    offlineRetentionDays: number;
  };
  ui: {
    messagePageSize: number;
    conversationPageSize: number;
    typingTimeout: number;
    messagePreviewLength: number;
  };
}

// ============================================================================
// VALIDATION SCHEMAS (for runtime validation)
// ============================================================================

export interface MessageValidationRules {
  content: {
    minLength: number;
    maxLength: number;
    allowedTags?: string[];
    blockedPatterns?: RegExp[];
  };
  attachments: {
    maxCount: number;
    maxTotalSize: number;
    allowedTypes: string[];
  };
  subject: {
    maxLength: number;
  };
}

export interface ConversationValidationRules {
  title: {
    minLength: number;
    maxLength: number;
    pattern?: RegExp;
  };
  participants: {
    minCount: number;
    maxCount: number;
  };
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export type {
  // Core entities
  User,
  Conversation,
  ConversationParticipant,
  Message,
  MessageAttachment,
  MessageReaction,
  MessageReadReceipt,
  TypingIndicator,
  ConversationSettings,
  BlockedUser,

  // Enhanced entities
  ConversationWithDetails,
  MessageWithDetails,
  MessageEncryptionKey,

  // WebSocket types
  WebSocketMessage,
  WebSocketMessageType,
  ChatMessageData,
  TypingIndicatorData,
  ReadReceiptData,
  PresenceData,
  ReactionData,
  ConversationUpdateData,

  // API types
  SendMessageRequest,
  CreateConversationRequest,
  ConversationFilters,
  MessageFilters,
  MessageSearchOptions,

  // File types
  AttachmentUploadData,
  AttachmentUploadResponse,
  AttachmentDownloadRequest,
  AttachmentDownloadResponse,

  // Encryption types
  EncryptionKeyPair,
  EncryptedContent,
  EncryptionConfig,

  // Presence types
  PresenceStatus,
  UserPresence,
  OnlineUser,

  // Notification types
  NotificationPreferences,
  MessageNotification,

  // Search and analytics
  MessageSearchResult,
  ConversationAnalytics,
  MessagingMetrics,

  // Error types
  MessagingError,
  MessagingErrorCode,

  // Hook types
  UseMessagingOptions,
  UseMessagingReturn,

  // Configuration types
  MessagingConfig,

  // Validation types
  MessageValidationRules,
  ConversationValidationRules
};