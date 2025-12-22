/**
 * Enhanced Messaging Database Schema
 * Comprehensive real-time messaging system with end-to-end encryption, 
 * file attachments, read receipts, and advanced features
 */

import { pgTable, serial, integer, varchar, text, boolean, timestamp, jsonb, uuid, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Conversations table - Thread/conversation management
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }),
  isGroup: boolean('is_group').default(false),
  createdById: integer('created_by_id').notNull(),
  pitchId: integer('pitch_id'), // Optional link to pitch
  lastMessageId: integer('last_message_id'),
  lastMessageAt: timestamp('last_message_at'),
  encryptionKey: varchar('encryption_key', { length: 255 }), // For E2E encryption
  isEncrypted: boolean('is_encrypted').default(false),
  archived: boolean('archived').default(false),
  muted: boolean('muted').default(false),
  metadata: jsonb('metadata'), // Additional conversation metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  pitchIdIdx: index('conversations_pitch_id_idx').on(table.pitchId),
  createdByIdIdx: index('conversations_created_by_id_idx').on(table.createdById),
  lastMessageAtIdx: index('conversations_last_message_at_idx').on(table.lastMessageAt),
  isEncryptedIdx: index('conversations_is_encrypted_idx').on(table.isEncrypted)
}));

// Conversation participants table - Who's in each conversation
export const conversationParticipants = pgTable('conversation_participants', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  userId: integer('user_id').notNull(),
  role: varchar('role', { length: 50 }).default('member'), // 'admin', 'member', 'viewer'
  isActive: boolean('is_active').default(true),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'),
  muteNotifications: boolean('mute_notifications').default(false),
  lastReadAt: timestamp('last_read_at'),
  encryptionPublicKey: text('encryption_public_key'), // For E2E encryption
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  conversationUserUnique: unique('conversation_participants_conversation_id_user_id_unique').on(table.conversationId, table.userId),
  conversationIdIdx: index('conversation_participants_conversation_id_idx').on(table.conversationId),
  userIdIdx: index('conversation_participants_user_id_idx').on(table.userId),
  isActiveIdx: index('conversation_participants_is_active_idx').on(table.isActive),
  lastReadAtIdx: index('conversation_participants_last_read_at_idx').on(table.lastReadAt)
}));

// Enhanced messages table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  senderId: integer('sender_id').notNull(),
  recipientId: integer('recipient_id'), // For direct messages, null for group messages
  parentMessageId: integer('parent_message_id'), // For replies/threads
  content: text('content').notNull(),
  encryptedContent: text('encrypted_content'), // Encrypted version if E2E enabled
  contentType: varchar('content_type', { length: 50 }).default('text'), // 'text', 'image', 'file', 'audio', 'video'
  messageType: varchar('message_type', { length: 50 }).default('text'), // 'text', 'system', 'nda', 'investment', 'announcement'
  subject: varchar('subject', { length: 255 }), // Optional message subject
  priority: varchar('priority', { length: 20 }).default('normal'), // 'low', 'normal', 'high', 'urgent'
  isEdited: boolean('is_edited').default(false),
  isDeleted: boolean('is_deleted').default(false),
  isForwarded: boolean('is_forwarded').default(false),
  deliveredAt: timestamp('delivered_at'),
  editedAt: timestamp('edited_at'),
  deletedAt: timestamp('deleted_at'),
  expiresAt: timestamp('expires_at'), // For self-destructing messages
  metadata: jsonb('metadata'), // Additional message metadata
  searchVector: text('search_vector'), // For full-text search
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId),
  senderIdIdx: index('messages_sender_id_idx').on(table.senderId),
  recipientIdIdx: index('messages_recipient_id_idx').on(table.recipientId),
  parentMessageIdIdx: index('messages_parent_message_id_idx').on(table.parentMessageId),
  sentAtIdx: index('messages_sent_at_idx').on(table.sentAt),
  messageTypeIdx: index('messages_message_type_idx').on(table.messageType),
  contentTypeIdx: index('messages_content_type_idx').on(table.contentType),
  isDeletedIdx: index('messages_is_deleted_idx').on(table.isDeleted),
  searchVectorIdx: index('messages_search_vector_idx').on(table.searchVector),
  expiresAtIdx: index('messages_expires_at_idx').on(table.expiresAt)
}));

// Message attachments table - File attachments support
export const messageAttachments = pgTable('message_attachments', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  fileUrl: text('file_url').notNull(),
  thumbnailUrl: text('thumbnail_url'), // For images/videos
  encryptedUrl: text('encrypted_url'), // If file is encrypted
  isEncrypted: boolean('is_encrypted').default(false),
  uploadedById: integer('uploaded_by_id').notNull(),
  virusScanStatus: varchar('virus_scan_status', { length: 20 }).default('pending'), // 'pending', 'clean', 'infected', 'error'
  virusScanResult: jsonb('virus_scan_result'),
  metadata: jsonb('metadata'), // Additional file metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  messageIdIdx: index('message_attachments_message_id_idx').on(table.messageId),
  uploadedByIdIdx: index('message_attachments_uploaded_by_id_idx').on(table.uploadedById),
  mimeTypeIdx: index('message_attachments_mime_type_idx').on(table.mimeType),
  virusScanStatusIdx: index('message_attachments_virus_scan_status_idx').on(table.virusScanStatus)
}));

// Message reactions table - Emoji reactions and likes
export const messageReactions = pgTable('message_reactions', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  userId: integer('user_id').notNull(),
  reactionType: varchar('reaction_type', { length: 100 }).notNull(), // 'like', 'love', 'laugh', 'wow', 'sad', 'angry', or emoji
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  messageUserReactionUnique: unique('message_reactions_message_id_user_id_reaction_type_unique').on(table.messageId, table.userId, table.reactionType),
  messageIdIdx: index('message_reactions_message_id_idx').on(table.messageId),
  userIdIdx: index('message_reactions_user_id_idx').on(table.userId),
  reactionTypeIdx: index('message_reactions_reaction_type_idx').on(table.reactionType)
}));

// Message read receipts table - Track message delivery and read status
export const messageReadReceipts = pgTable('message_read_receipts', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  userId: integer('user_id').notNull(),
  deliveredAt: timestamp('delivered_at').defaultNow().notNull(),
  readAt: timestamp('read_at'),
  receiptType: varchar('receipt_type', { length: 20 }).default('delivered'), // 'delivered', 'read'
  deviceInfo: jsonb('device_info'), // Device/client information
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  messageUserUnique: unique('message_read_receipts_message_id_user_id_unique').on(table.messageId, table.userId),
  messageIdIdx: index('message_read_receipts_message_id_idx').on(table.messageId),
  userIdIdx: index('message_read_receipts_user_id_idx').on(table.userId),
  readAtIdx: index('message_read_receipts_read_at_idx').on(table.readAt),
  receiptTypeIdx: index('message_read_receipts_receipt_type_idx').on(table.receiptType)
}));

// Typing indicators table - Real-time typing status
export const typingIndicators = pgTable('typing_indicators', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  userId: integer('user_id').notNull(),
  isTyping: boolean('is_typing').default(true),
  lastTyped: timestamp('last_typed').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  conversationUserUnique: unique('typing_indicators_conversation_id_user_id_unique').on(table.conversationId, table.userId),
  conversationIdIdx: index('typing_indicators_conversation_id_idx').on(table.conversationId),
  userIdIdx: index('typing_indicators_user_id_idx').on(table.userId),
  lastTypedIdx: index('typing_indicators_last_typed_idx').on(table.lastTyped),
  isTypingIdx: index('typing_indicators_is_typing_idx').on(table.isTyping)
}));

// Message encryption keys table - For end-to-end encryption
export const messageEncryptionKeys = pgTable('message_encryption_keys', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  userId: integer('user_id').notNull(), // Which user this encrypted key is for
  encryptedKey: text('encrypted_key').notNull(), // Message key encrypted with user's public key
  keyVersion: integer('key_version').default(1),
  algorithm: varchar('algorithm', { length: 50 }).default('AES-256-GCM'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  messageUserUnique: unique('message_encryption_keys_message_id_user_id_unique').on(table.messageId, table.userId),
  messageIdIdx: index('message_encryption_keys_message_id_idx').on(table.messageId),
  userIdIdx: index('message_encryption_keys_user_id_idx').on(table.userId)
}));

// Message search index table - For advanced search functionality
export const messageSearchIndex = pgTable('message_search_index', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  conversationId: integer('conversation_id').notNull(),
  content: text('content').notNull(),
  searchTokens: text('search_tokens'), // Preprocessed search tokens
  language: varchar('language', { length: 10 }).default('en'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  messageIdIdx: index('message_search_index_message_id_idx').on(table.messageId),
  conversationIdIdx: index('message_search_index_conversation_id_idx').on(table.conversationId),
  searchTokensIdx: index('message_search_index_search_tokens_idx').on(table.searchTokens),
  languageIdx: index('message_search_index_language_idx').on(table.language)
}));

// Blocked users table - User blocking for messaging
export const blockedUsers = pgTable('blocked_users', {
  id: serial('id').primaryKey(),
  blockerId: integer('blocker_id').notNull(), // User who blocked
  blockedId: integer('blocked_id').notNull(), // User who was blocked
  reason: text('reason'), // Optional reason for blocking
  blockedAt: timestamp('blocked_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  blockerBlockedUnique: unique('blocked_users_blocker_id_blocked_id_unique').on(table.blockerId, table.blockedId),
  blockerIdIdx: index('blocked_users_blocker_id_idx').on(table.blockerId),
  blockedIdIdx: index('blocked_users_blocked_id_idx').on(table.blockedId)
}));

// Conversation settings table - Per-user conversation preferences
export const conversationSettings = pgTable('conversation_settings', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  userId: integer('user_id').notNull(),
  notifications: boolean('notifications').default(true),
  soundNotifications: boolean('sound_notifications').default(true),
  emailNotifications: boolean('email_notifications').default(true),
  pushNotifications: boolean('push_notifications').default(true),
  theme: varchar('theme', { length: 20 }).default('default'), // 'default', 'dark', 'light'
  messagePreview: boolean('message_preview').default(true),
  readReceipts: boolean('read_receipts').default(true),
  typingIndicators: boolean('typing_indicators').default(true),
  autoDeleteAfter: integer('auto_delete_after'), // Auto-delete messages after X days
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  conversationUserUnique: unique('conversation_settings_conversation_id_user_id_unique').on(table.conversationId, table.userId),
  conversationIdIdx: index('conversation_settings_conversation_id_idx').on(table.conversationId),
  userIdIdx: index('conversation_settings_user_id_idx').on(table.userId)
}));

// Define relationships
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  createdBy: one(conversations, {
    fields: [conversations.createdById],
    references: [conversations.id]
  }),
  participants: many(conversationParticipants),
  messages: many(messages),
  lastMessage: one(messages, {
    fields: [conversations.lastMessageId],
    references: [messages.id]
  }),
  settings: many(conversationSettings)
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id]
  }),
  settings: one(conversationSettings, {
    fields: [conversationParticipants.conversationId, conversationParticipants.userId],
    references: [conversationSettings.conversationId, conversationSettings.userId]
  })
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  parentMessage: one(messages, {
    fields: [messages.parentMessageId],
    references: [messages.id]
  }),
  replies: many(messages),
  attachments: many(messageAttachments),
  reactions: many(messageReactions),
  readReceipts: many(messageReadReceipts),
  encryptionKeys: many(messageEncryptionKeys),
  searchIndex: one(messageSearchIndex, {
    fields: [messages.id],
    references: [messageSearchIndex.messageId]
  })
}));

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
  message: one(messages, {
    fields: [messageAttachments.messageId],
    references: [messages.id]
  })
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id]
  })
}));

export const messageReadReceiptsRelations = relations(messageReadReceipts, ({ one }) => ({
  message: one(messages, {
    fields: [messageReadReceipts.messageId],
    references: [messages.id]
  })
}));

export const typingIndicatorsRelations = relations(typingIndicators, ({ one }) => ({
  conversation: one(conversations, {
    fields: [typingIndicators.conversationId],
    references: [conversations.id]
  })
}));

export const messageEncryptionKeysRelations = relations(messageEncryptionKeys, ({ one }) => ({
  message: one(messages, {
    fields: [messageEncryptionKeys.messageId],
    references: [messages.id]
  })
}));

export const messageSearchIndexRelations = relations(messageSearchIndex, ({ one }) => ({
  message: one(messages, {
    fields: [messageSearchIndex.messageId],
    references: [messages.id]
  }),
  conversation: one(conversations, {
    fields: [messageSearchIndex.conversationId],
    references: [conversations.id]
  })
}));

export const conversationSettingsRelations = relations(conversationSettings, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationSettings.conversationId],
    references: [conversations.id]
  })
}));

// Type exports for use in other parts of the application
export type ConversationType = typeof conversations.$inferSelect;
export type NewConversationType = typeof conversations.$inferInsert;
export type ConversationParticipantType = typeof conversationParticipants.$inferSelect;
export type NewConversationParticipantType = typeof conversationParticipants.$inferInsert;
export type MessageType = typeof messages.$inferSelect;
export type NewMessageType = typeof messages.$inferInsert;
export type MessageAttachmentType = typeof messageAttachments.$inferSelect;
export type NewMessageAttachmentType = typeof messageAttachments.$inferInsert;
export type MessageReactionType = typeof messageReactions.$inferSelect;
export type NewMessageReactionType = typeof messageReactions.$inferInsert;
export type MessageReadReceiptType = typeof messageReadReceipts.$inferSelect;
export type NewMessageReadReceiptType = typeof messageReadReceipts.$inferInsert;
export type TypingIndicatorType = typeof typingIndicators.$inferSelect;
export type NewTypingIndicatorType = typeof typingIndicators.$inferInsert;
export type MessageEncryptionKeyType = typeof messageEncryptionKeys.$inferSelect;
export type NewMessageEncryptionKeyType = typeof messageEncryptionKeys.$inferInsert;
export type MessageSearchIndexType = typeof messageSearchIndex.$inferSelect;
export type NewMessageSearchIndexType = typeof messageSearchIndex.$inferInsert;
export type BlockedUserType = typeof blockedUsers.$inferSelect;
export type NewBlockedUserType = typeof blockedUsers.$inferInsert;
export type ConversationSettingsType = typeof conversationSettings.$inferSelect;
export type NewConversationSettingsType = typeof conversationSettings.$inferInsert;