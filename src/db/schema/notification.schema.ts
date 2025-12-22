/**
 * Notification Database Schema
 * Tables: notifications, notification_preferences, notification_deliveries, notification_logs
 */

import { pgTable, serial, integer, varchar, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './user.schema.ts';
import { pitches } from './pitch.schema.ts';
import { messages } from './messaging.schema.ts';
import { ndas, ndaRequests } from './nda.schema.ts';
import { investments } from './investment.schema.ts';

// Main notifications table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'nda_request', 'nda_approval', 'message', 'investment', etc.
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  priority: varchar('priority', { length: 20 }).notNull().default('normal'), // 'low', 'normal', 'high', 'urgent'
  
  // Related entities (optional foreign keys)
  relatedPitchId: integer('related_pitch_id').references(() => pitches.id, { onDelete: 'set null' }),
  relatedUserId: integer('related_user_id').references(() => users.id, { onDelete: 'set null' }),
  relatedNdaRequestId: integer('related_nda_request_id').references(() => ndaRequests.id, { onDelete: 'set null' }),
  relatedInvestmentId: integer('related_investment_id').references(() => investments.id, { onDelete: 'set null' }),
  relatedMessageId: integer('related_message_id').references(() => messages.id, { onDelete: 'set null' }),
  
  // Action and metadata
  actionUrl: varchar('action_url', { length: 500 }),
  metadata: jsonb('metadata'), // Additional data as JSON
  
  // Status and tracking
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  expiresAt: timestamp('expires_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.userId),
  typeIdx: index('notifications_type_idx').on(table.type),
  isReadIdx: index('notifications_is_read_idx').on(table.isRead),
  priorityIdx: index('notifications_priority_idx').on(table.priority),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
  userTypeIdx: index('notifications_user_type_idx').on(table.userId, table.type),
  userReadIdx: index('notifications_user_read_idx').on(table.userId, table.isRead)
}));

// User notification preferences
export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // Channel preferences
  emailNotifications: boolean('email_notifications').notNull().default(true),
  pushNotifications: boolean('push_notifications').notNull().default(true),
  smsNotifications: boolean('sms_notifications').notNull().default(false),
  marketingEmails: boolean('marketing_emails').notNull().default(false),
  
  // Delivery preferences
  digestFrequency: varchar('digest_frequency', { length: 20 }).notNull().default('instant'), // 'instant', 'hourly', 'daily', 'weekly', 'never'
  quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(false),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }), // HH:mm format
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }),     // HH:mm format
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  
  // Category-specific preferences
  ndaNotifications: boolean('nda_notifications').notNull().default(true),
  investmentNotifications: boolean('investment_notifications').notNull().default(true),
  messageNotifications: boolean('message_notifications').notNull().default(true),
  pitchUpdateNotifications: boolean('pitch_update_notifications').notNull().default(true),
  systemNotifications: boolean('system_notifications').notNull().default(true),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  userIdIdx: index('notification_preferences_user_id_idx').on(table.userId)
}));

// Notification delivery tracking
export const notificationDeliveries = pgTable('notification_deliveries', {
  id: serial('id').primaryKey(),
  notificationId: integer('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 20 }).notNull(), // 'email', 'push', 'sms', 'in_app'
  status: varchar('status', { length: 20 }).notNull().default('queued'), // 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'bounced'
  providerId: varchar('provider_id', { length: 255 }), // External provider message ID
  
  // Retry tracking
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  nextRetryAt: timestamp('next_retry_at'),
  
  // Error tracking
  errorMessage: text('error_message'),
  errorCode: varchar('error_code', { length: 100 }),
  
  // Timing
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  clickedAt: timestamp('clicked_at'),
  
  // Metadata
  deviceInfo: jsonb('device_info'),
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  notificationIdIdx: index('notification_deliveries_notification_id_idx').on(table.notificationId),
  channelIdx: index('notification_deliveries_channel_idx').on(table.channel),
  statusIdx: index('notification_deliveries_status_idx').on(table.status),
  providerIdIdx: index('notification_deliveries_provider_id_idx').on(table.providerId),
  channelStatusIdx: index('notification_deliveries_channel_status_idx').on(table.channel, table.status),
  createdAtIdx: index('notification_deliveries_created_at_idx').on(table.createdAt)
}));

// Notification logs for debugging and analytics
export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  notificationId: integer('notification_id').references(() => notifications.id, { onDelete: 'cascade' }),
  deliveryId: integer('delivery_id').references(() => notificationDeliveries.id, { onDelete: 'cascade' }),
  
  // Log details
  level: varchar('level', { length: 20 }).notNull(), // 'debug', 'info', 'warn', 'error'
  message: text('message').notNull(),
  context: jsonb('context'), // Additional context data
  
  // Error details
  errorStack: text('error_stack'),
  errorDetails: jsonb('error_details'),
  
  // Processing details
  processingTime: integer('processing_time_ms'), // Time in milliseconds
  queueTime: integer('queue_time_ms'),           // Time spent in queue
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  notificationIdIdx: index('notification_logs_notification_id_idx').on(table.notificationId),
  deliveryIdIdx: index('notification_logs_delivery_id_idx').on(table.deliveryId),
  levelIdx: index('notification_logs_level_idx').on(table.level),
  createdAtIdx: index('notification_logs_created_at_idx').on(table.createdAt)
}));

// Notification templates for consistent messaging
export const notificationTemplates = pgTable('notification_templates', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Template content
  subjectTemplate: varchar('subject_template', { length: 500 }).notNull(),
  bodyTemplate: text('body_template').notNull(),
  htmlTemplate: text('html_template'),
  
  // Channel-specific templates
  emailTemplate: text('email_template'),
  pushTemplate: text('push_template'),
  smsTemplate: text('sms_template'),
  
  // Variables and configuration
  requiredVariables: jsonb('required_variables'), // Array of required variable names
  defaultVariables: jsonb('default_variables'),   // Default values for variables
  
  // Metadata
  isActive: boolean('is_active').notNull().default(true),
  version: integer('version').notNull().default(1),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  typeIdx: index('notification_templates_type_idx').on(table.type),
  isActiveIdx: index('notification_templates_is_active_idx').on(table.isActive)
}));

// Digest notifications for batched delivery
export const notificationDigests = pgTable('notification_digests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  frequency: varchar('frequency', { length: 20 }).notNull(), // 'hourly', 'daily', 'weekly'
  
  // Digest content
  notificationIds: jsonb('notification_ids').notNull(), // Array of notification IDs
  totalCount: integer('total_count').notNull(),
  unreadCount: integer('unread_count').notNull(),
  
  // Status
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'sent', 'failed'
  sentAt: timestamp('sent_at'),
  
  // Period covered by digest
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  userIdIdx: index('notification_digests_user_id_idx').on(table.userId),
  frequencyIdx: index('notification_digests_frequency_idx').on(table.frequency),
  statusIdx: index('notification_digests_status_idx').on(table.status),
  periodIdx: index('notification_digests_period_idx').on(table.periodStart, table.periodEnd)
}));

// Notification analytics and metrics
export const notificationMetrics = pgTable('notification_metrics', {
  id: serial('id').primaryKey(),
  
  // Time period
  date: timestamp('date').notNull(), // Daily metrics
  hour: integer('hour'),             // Hourly breakdown (0-23)
  
  // Dimensions
  channel: varchar('channel', { length: 20 }), // 'email', 'push', 'sms', 'in_app'
  type: varchar('type', { length: 50 }),       // Notification type
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  
  // Metrics
  totalSent: integer('total_sent').notNull().default(0),
  totalDelivered: integer('total_delivered').notNull().default(0),
  totalRead: integer('total_read').notNull().default(0),
  totalClicked: integer('total_clicked').notNull().default(0),
  totalFailed: integer('total_failed').notNull().default(0),
  totalBounced: integer('total_bounced').notNull().default(0),
  
  // Response times
  avgDeliveryTime: integer('avg_delivery_time_ms'),
  avgReadTime: integer('avg_read_time_ms'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  dateIdx: index('notification_metrics_date_idx').on(table.date),
  channelIdx: index('notification_metrics_channel_idx').on(table.channel),
  typeIdx: index('notification_metrics_type_idx').on(table.type),
  userIdIdx: index('notification_metrics_user_id_idx').on(table.userId),
  dateChannelIdx: index('notification_metrics_date_channel_idx').on(table.date, table.channel)
}));

// Export types for TypeScript
export type NotificationType = typeof notifications.$inferSelect;
export type NewNotificationType = typeof notifications.$inferInsert;

export type NotificationPreferencesType = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferencesType = typeof notificationPreferences.$inferInsert;

export type NotificationDeliveryType = typeof notificationDeliveries.$inferSelect;
export type NewNotificationDeliveryType = typeof notificationDeliveries.$inferInsert;

export type NotificationLogType = typeof notificationLogs.$inferSelect;
export type NewNotificationLogType = typeof notificationLogs.$inferInsert;

export type NotificationTemplateType = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplateType = typeof notificationTemplates.$inferInsert;

export type NotificationDigestType = typeof notificationDigests.$inferSelect;
export type NewNotificationDigestType = typeof notificationDigests.$inferInsert;

export type NotificationMetricType = typeof notificationMetrics.$inferSelect;
export type NewNotificationMetricType = typeof notificationMetrics.$inferInsert;