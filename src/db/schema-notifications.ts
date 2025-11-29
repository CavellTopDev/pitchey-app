// Notification System Schema
import { 
  pgTable, 
  serial, 
  integer, 
  varchar, 
  text, 
  boolean, 
  timestamp, 
  jsonb,
  index,
  pgEnum
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./schema";

// Notification types enum
export const notificationTypeEnum = pgEnum("notification_type", [
  // Pitch-related
  "pitch_viewed",
  "pitch_liked",
  "pitch_saved",
  "pitch_commented",
  "pitch_status_changed",
  
  // NDA-related
  "nda_requested",
  "nda_approved",
  "nda_rejected",
  "nda_signed",
  "nda_expiring",
  
  // Investment-related
  "investment_received",
  "investment_milestone",
  "investment_withdrawn",
  
  // Messaging
  "message_received",
  "message_read",
  
  // Follow system
  "new_follower",
  "creator_posted",
  
  // System
  "system_announcement",
  "system_maintenance",
  "account_verified",
  "password_changed",
  
  // Collaboration
  "collaboration_invite",
  "collaboration_accepted",
  "collaboration_rejected",
  
  // Analytics
  "milestone_reached",
  "weekly_report",
  "monthly_summary"
]);

// Notification priority levels
export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "medium",
  "high",
  "urgent"
]);

// Notification delivery channels
export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  "sms",
  "push",
  "webhook"
]);

// Main notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  
  // User relationship
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Notification details
  type: notificationTypeEnum("type").notNull(),
  priority: notificationPriorityEnum("priority").default("medium").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  
  // Metadata for rich notifications
  metadata: jsonb("metadata").default('{}'),
  
  // Related entities (optional)
  relatedUserId: integer("related_user_id").references(() => users.id, { onDelete: "set null" }),
  relatedPitchId: integer("related_pitch_id"),
  relatedNdaId: integer("related_nda_id"),
  relatedInvestmentId: integer("related_investment_id"),
  
  // Actions and links
  actionUrl: text("action_url"),
  actionText: varchar("action_text", { length: 100 }),
  
  // Status tracking
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  
  // Delivery status
  delivered: boolean("delivered").default(false).notNull(),
  deliveredAt: timestamp("delivered_at"),
  deliveryChannel: notificationChannelEnum("delivery_channel").default("in_app"),
  
  // Error tracking
  deliveryError: text("delivery_error"),
  retryCount: integer("retry_count").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  
  // Grouping for batched notifications
  groupId: varchar("group_id", { length: 100 }),
  groupCount: integer("group_count").default(1)
}, (table) => ({
  // Indexes for performance
  userIdIdx: index("notifications_user_id_idx").on(table.userId),
  typeIdx: index("notifications_type_idx").on(table.type),
  isReadIdx: index("notifications_is_read_idx").on(table.isRead),
  createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  groupIdIdx: index("notifications_group_id_idx").on(table.groupId),
  relatedPitchIdx: index("notifications_related_pitch_idx").on(table.relatedPitchId),
  relatedUserIdx: index("notifications_related_user_idx").on(table.relatedUserId)
}));

// User notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Channel preferences
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  smsEnabled: boolean("sms_enabled").default(false).notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  
  // Type-specific preferences (JSONB for flexibility)
  typePreferences: jsonb("type_preferences").default('{}'),
  
  // Quiet hours
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 }), // HH:MM format
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 }), // HH:MM format
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  
  // Frequency settings
  emailDigest: varchar("email_digest", { length: 20 }).default("immediate"), // immediate, daily, weekly, never
  maxDailyEmails: integer("max_daily_emails").default(20),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  userIdIdx: index("notification_preferences_user_id_idx").on(table.userId)
}));

// Notification queue for async delivery
export const notificationQueue = pgTable("notification_queue", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  channel: notificationChannelEnum("channel").notNull(),
  
  // Delivery scheduling
  scheduledFor: timestamp("scheduled_for").defaultNow().notNull(),
  
  // Status
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, processing, delivered, failed
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  
  // Error tracking
  lastError: text("last_error"),
  lastAttemptAt: timestamp("last_attempt_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  
  // Priority for queue processing
  priority: notificationPriorityEnum("priority").default("medium").notNull()
}, (table) => ({
  statusIdx: index("notification_queue_status_idx").on(table.status),
  scheduledForIdx: index("notification_queue_scheduled_for_idx").on(table.scheduledFor),
  priorityIdx: index("notification_queue_priority_idx").on(table.priority)
}));

// Notification templates for consistent messaging
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  
  // Template identification
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  locale: varchar("locale", { length: 10 }).default("en").notNull(),
  
  // Template content
  titleTemplate: text("title_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  
  // Variables and metadata
  variables: jsonb("variables").default('[]'), // Array of variable names used in template
  metadata: jsonb("metadata").default('{}'),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  typeChannelIdx: index("notification_templates_type_channel_idx").on(table.type, table.channel)
}));

// Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  }),
  relatedUser: one(users, {
    fields: [notifications.relatedUserId],
    references: [users.id]
  })
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id]
  })
}));

export const notificationQueueRelations = relations(notificationQueue, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationQueue.notificationId],
    references: [notifications.id]
  })
}));