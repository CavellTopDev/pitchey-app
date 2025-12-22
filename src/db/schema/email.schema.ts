/**
 * Email Database Schema for Pitchey Platform
 * Comprehensive tables for email tracking, templates, preferences, and analytics
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  timestamp, 
  boolean, 
  integer, 
  jsonb, 
  decimal,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const emailProviderEnum = pgEnum('email_provider', ['sendgrid', 'awsSes']);
export const emailStatusEnum = pgEnum('email_status', [
  'pending', 'processing', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced', 'complained'
]);
export const emailPriorityEnum = pgEnum('email_priority', ['high', 'normal', 'low']);
export const queueStatusEnum = pgEnum('queue_status', ['pending', 'processing', 'completed', 'failed']);
export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
]);
export const suppressionTypeEnum = pgEnum('suppression_type', ['bounce', 'complaint', 'unsubscribe', 'manual']);
export const abTestStatusEnum = pgEnum('ab_test_status', ['draft', 'running', 'completed', 'cancelled']);
export const healthStatusEnum = pgEnum('health_status', ['healthy', 'warning', 'critical', 'down']);

/**
 * Email Logs - Track all sent emails
 */
export const emailLogs = pgTable('email_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: varchar('to', { length: 255 }).notNull(),
  cc: jsonb('cc').$type<string[]>(),
  bcc: jsonb('bcc').$type<string[]>(),
  subject: text('subject').notNull(),
  provider: emailProviderEnum('provider').notNull(),
  messageId: varchar('message_id', { length: 255 }),
  status: emailStatusEnum('status').notNull().default('pending'),
  error: text('error'),
  templateType: varchar('template_type', { length: 100 }),
  variables: jsonb('variables').$type<Record<string, any>>(),
  sentAt: timestamp('sent_at').defaultNow(),
  deliveredAt: timestamp('delivered_at'),
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  bouncedAt: timestamp('bounced_at'),
  complainedAt: timestamp('complained_at'),
  userId: uuid('user_id'),
  campaignId: uuid('campaign_id'),
  trackingId: varchar('tracking_id', { length: 255 }),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Email Templates - Store reusable email templates
 */
export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  subject: text('subject').notNull(),
  htmlContent: text('html_content').notNull(),
  textContent: text('text_content'),
  variables: jsonb('variables').$type<string[]>().notNull().default([]),
  previewText: varchar('preview_text', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  version: integer('version').notNull().default(1),
  tags: jsonb('tags').$type<string[]>().default([]),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>()
});

/**
 * Email Queue - Store queued emails for processing
 */
export const emailQueue = pgTable('email_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: varchar('to', { length: 255 }).notNull(),
  cc: jsonb('cc').$type<string[]>(),
  bcc: jsonb('bcc').$type<string[]>(),
  subject: text('subject').notNull(),
  htmlContent: text('html_content').notNull(),
  textContent: text('text_content'),
  attachments: jsonb('attachments').$type<Array<{
    filename: string;
    content: string;
    type: string;
    size?: number;
  }>>(),
  templateType: varchar('template_type', { length: 100 }),
  variables: jsonb('variables').$type<Record<string, any>>(),
  priority: emailPriorityEnum('priority').notNull().default('normal'),
  sendAt: timestamp('send_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  status: queueStatusEnum('status').notNull().default('pending'),
  error: text('error'),
  nextRetry: timestamp('next_retry'),
  userId: uuid('user_id'),
  campaignId: uuid('campaign_id'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Email Preferences - User email notification preferences
 */
export const emailPreferences = pgTable('email_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
  emailAddress: varchar('email_address', { length: 255 }).notNull(),
  
  // Communication preferences
  marketingEmails: boolean('marketing_emails').notNull().default(true),
  transactionalEmails: boolean('transactional_emails').notNull().default(true),
  notificationEmails: boolean('notification_emails').notNull().default(true),
  weeklyDigest: boolean('weekly_digest').notNull().default(true),
  monthlyReport: boolean('monthly_report').notNull().default(false),
  
  // Pitch-related notifications
  pitchViews: boolean('pitch_views').notNull().default(true),
  pitchLikes: boolean('pitch_likes').notNull().default(true),
  pitchComments: boolean('pitch_comments').notNull().default(true),
  ndaRequests: boolean('nda_requests').notNull().default(true),
  ndaResponses: boolean('nda_responses').notNull().default(true),
  
  // Investment notifications
  investmentUpdates: boolean('investment_updates').notNull().default(true),
  paymentNotifications: boolean('payment_notifications').notNull().default(true),
  portfolioUpdates: boolean('portfolio_updates').notNull().default(true),
  
  // Messaging notifications
  newMessages: boolean('new_messages').notNull().default(true),
  messageReplies: boolean('message_replies').notNull().default(true),
  collaborationInvites: boolean('collaboration_invites').notNull().default(true),
  
  // Security notifications
  securityAlerts: boolean('security_alerts').notNull().default(true),
  loginNotifications: boolean('login_notifications').notNull().default(false),
  
  // System notifications
  maintenanceAlerts: boolean('maintenance_alerts').notNull().default(true),
  productUpdates: boolean('product_updates').notNull().default(false),
  
  // Frequency and timing
  frequency: varchar('frequency', { length: 20 }).notNull().default('immediate'), // immediate, daily, weekly, never
  digestDay: varchar('digest_day', { length: 20 }).default('monday'),
  digestTime: varchar('digest_time', { length: 5 }).default('09:00'), // HH:MM format
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  
  // Unsubscribe management
  unsubscribeToken: varchar('unsubscribe_token', { length: 255 }).unique(),
  globalUnsubscribe: boolean('global_unsubscribe').notNull().default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Email Tracking Events - Track individual email events
 */
export const emailTrackingEvents = pgTable('email_tracking_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailLogId: uuid('email_log_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // sent, delivered, opened, clicked, bounced, complained, failed
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  location: jsonb('location').$type<{
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  }>(),
  clickUrl: text('click_url'), // For click events
  reason: text('reason'), // For bounce/complaint events
  provider: emailProviderEnum('provider'),
  providerEventId: varchar('provider_event_id', { length: 255 }),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Email Campaigns - Bulk email campaigns
 */
export const emailCampaigns = pgTable('email_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  templateId: uuid('template_id'),
  templateType: varchar('template_type', { length: 100 }),
  status: campaignStatusEnum('status').notNull().default('draft'),
  
  // Scheduling
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  completedAt: timestamp('completed_at'),
  
  // Recipient targeting
  targetingCriteria: jsonb('targeting_criteria').$type<{
    userTypes?: ('creator' | 'investor' | 'production')[];
    tags?: string[];
    customQuery?: string;
    excludeUnsubscribed?: boolean;
  }>(),
  
  // Statistics
  totalRecipients: integer('total_recipients').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  pendingCount: integer('pending_count').notNull().default(0),
  
  // Template variables
  variables: jsonb('variables').$type<Record<string, any>>(),
  
  // A/B Testing
  abTestId: uuid('ab_test_id'),
  
  // Management
  createdBy: uuid('created_by').notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Email Suppression List - Emails that should not receive messages
 */
export const emailSuppressions = pgTable('email_suppressions', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  type: suppressionTypeEnum('type').notNull(),
  reason: text('reason'),
  source: varchar('source', { length: 100 }), // webhook, manual, api, etc.
  addedAt: timestamp('added_at').defaultNow().notNull(),
  addedBy: uuid('added_by'),
  expiresAt: timestamp('expires_at'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Email Webhooks - Track webhook events from providers
 */
export const emailWebhooks = pgTable('email_webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: emailProviderEnum('provider').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  messageId: varchar('message_id', { length: 255 }),
  email: varchar('email', { length: 255 }),
  timestamp: timestamp('timestamp').notNull(),
  eventData: jsonb('event_data').$type<Record<string, any>>().notNull(),
  processed: boolean('processed').notNull().default(false),
  processedAt: timestamp('processed_at'),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Email Lists - Manage recipient lists
 */
export const emailLists = pgTable('email_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).notNull(), // static, dynamic
  
  // Dynamic list criteria
  criteria: jsonb('criteria').$type<{
    userTypes?: ('creator' | 'investor' | 'production')[];
    tags?: string[];
    lastActiveDate?: string; // ISO date string
    signupDateRange?: { start: string; end: string };
    customQuery?: string;
  }>(),
  
  // Statistics
  totalSubscribers: integer('total_subscribers').notNull().default(0),
  activeSubscribers: integer('active_subscribers').notNull().default(0),
  unsubscribedCount: integer('unsubscribed_count').notNull().default(0),
  
  // Management
  createdBy: uuid('created_by').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  tags: jsonb('tags').$type<string[]>().default([]),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Email List Subscribers - Many-to-many relationship
 */
export const emailListSubscribers = pgTable('email_list_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  userId: uuid('user_id'),
  subscribed: boolean('subscribed').notNull().default(true),
  subscribedAt: timestamp('subscribed_at').defaultNow(),
  unsubscribedAt: timestamp('unsubscribed_at'),
  source: varchar('source', { length: 100 }), // signup, import, api, etc.
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Email A/B Tests - A/B testing for email campaigns
 */
export const emailABTests = pgTable('email_ab_tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: abTestStatusEnum('status').notNull().default('draft'),
  
  // Test configuration
  testType: varchar('test_type', { length: 50 }).notNull(), // subject, content, sender, time
  variants: jsonb('variants').$type<Array<{
    id: string;
    name: string;
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    trafficPercentage: number;
    metrics: {
      sent: number;
      opened: number;
      clicked: number;
      converted: number;
    };
  }>>().notNull(),
  
  // Test results
  winningVariant: varchar('winning_variant', { length: 255 }),
  confidenceLevel: decimal('confidence_level', { precision: 5, scale: 2 }),
  
  // Test timing
  testDuration: integer('test_duration').notNull(), // hours
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  // Management
  createdBy: uuid('created_by').notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Email Health Metrics - Monitor email service health
 */
export const emailHealthMetrics = pgTable('email_health_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: emailProviderEnum('provider').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  
  // Performance metrics
  deliveryRate: decimal('delivery_rate', { precision: 5, scale: 2 }).notNull(),
  bounceRate: decimal('bounce_rate', { precision: 5, scale: 2 }).notNull(),
  complaintRate: decimal('complaint_rate', { precision: 5, scale: 2 }).notNull(),
  responseTime: integer('response_time').notNull(), // milliseconds
  errorRate: decimal('error_rate', { precision: 5, scale: 2 }).notNull(),
  queueSize: integer('queue_size').notNull(),
  
  // Volume metrics
  emailsSent: integer('emails_sent').notNull(),
  emailsDelivered: integer('emails_delivered').notNull(),
  emailsBounced: integer('emails_bounced').notNull(),
  emailsComplained: integer('emails_complained').notNull(),
  
  // Health status
  status: healthStatusEnum('status').notNull().default('healthy'),
  alerts: jsonb('alerts').$type<string[]>().default([]),
  
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Email Unsubscribe Requests - Track unsubscribe requests
 */
export const emailUnsubscribeRequests = pgTable('email_unsubscribe_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  userId: uuid('user_id'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  reason: text('reason'),
  categories: jsonb('categories').$type<string[]>(), // Which email types to unsubscribe from
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  processed: boolean('processed').notNull().default(false),
  source: varchar('source', { length: 100 }).notNull(), // link, reply, manual, bounce, complaint
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Email Analytics Summary - Pre-computed analytics for performance
 */
export const emailAnalyticsSummary = pgTable('email_analytics_summary', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD format
  provider: emailProviderEnum('provider'),
  templateType: varchar('template_type', { length: 100 }),
  campaignId: uuid('campaign_id'),
  
  // Volume metrics
  sent: integer('sent').notNull().default(0),
  delivered: integer('delivered').notNull().default(0),
  opened: integer('opened').notNull().default(0),
  clicked: integer('clicked').notNull().default(0),
  bounced: integer('bounced').notNull().default(0),
  complained: integer('complained').notNull().default(0),
  unsubscribed: integer('unsubscribed').notNull().default(0),
  
  // Calculated rates (stored as percentages)
  deliveryRate: decimal('delivery_rate', { precision: 5, scale: 2 }),
  openRate: decimal('open_rate', { precision: 5, scale: 2 }),
  clickRate: decimal('click_rate', { precision: 5, scale: 2 }),
  clickToOpenRate: decimal('click_to_open_rate', { precision: 5, scale: 2 }),
  bounceRate: decimal('bounce_rate', { precision: 5, scale: 2 }),
  complaintRate: decimal('complaint_rate', { precision: 5, scale: 2 }),
  unsubscribeRate: decimal('unsubscribe_rate', { precision: 5, scale: 2 }),
  
  // Top performing content
  topClickedUrls: jsonb('top_clicked_urls').$type<Array<{
    url: string;
    clicks: number;
  }>>(),
  
  // Device/location breakdown
  deviceStats: jsonb('device_stats').$type<{
    desktop: number;
    mobile: number;
    tablet: number;
  }>(),
  locationStats: jsonb('location_stats').$type<Array<{
    country: string;
    opens: number;
    clicks: number;
  }>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Define relationships
export const emailLogsRelations = relations(emailLogs, ({ one, many }) => ({
  campaign: one(emailCampaigns, {
    fields: [emailLogs.campaignId],
    references: [emailCampaigns.id],
  }),
  trackingEvents: many(emailTrackingEvents),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({
  campaigns: many(emailCampaigns),
}));

export const emailQueueRelations = relations(emailQueue, ({ one }) => ({
  campaign: one(emailCampaigns, {
    fields: [emailQueue.campaignId],
    references: [emailCampaigns.id],
  }),
}));

export const emailTrackingEventsRelations = relations(emailTrackingEvents, ({ one }) => ({
  emailLog: one(emailLogs, {
    fields: [emailTrackingEvents.emailLogId],
    references: [emailLogs.id],
  }),
}));

export const emailCampaignsRelations = relations(emailCampaigns, ({ one, many }) => ({
  template: one(emailTemplates, {
    fields: [emailCampaigns.templateId],
    references: [emailTemplates.id],
  }),
  logs: many(emailLogs),
  queueItems: many(emailQueue),
  abTest: one(emailABTests, {
    fields: [emailCampaigns.abTestId],
    references: [emailABTests.id],
  }),
}));

export const emailListsRelations = relations(emailLists, ({ many }) => ({
  subscribers: many(emailListSubscribers),
}));

export const emailListSubscribersRelations = relations(emailListSubscribers, ({ one }) => ({
  list: one(emailLists, {
    fields: [emailListSubscribers.listId],
    references: [emailLists.id],
  }),
}));

export const emailABTestsRelations = relations(emailABTests, ({ one, many }) => ({
  campaign: one(emailCampaigns, {
    fields: [emailABTests.campaignId],
    references: [emailCampaigns.id],
  }),
  campaigns: many(emailCampaigns),
}));

// Indexes for performance (would be added as separate migration files)
export const emailIndexes = {
  // Email logs indexes
  emailLogsMessageId: 'CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id)',
  emailLogsStatus: 'CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status)',
  emailLogsUserId: 'CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id)',
  emailLogsCampaignId: 'CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_id ON email_logs(campaign_id)',
  emailLogsSentAt: 'CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at)',
  emailLogsProvider: 'CREATE INDEX IF NOT EXISTS idx_email_logs_provider ON email_logs(provider)',
  emailLogsTemplateType: 'CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON email_logs(template_type)',
  
  // Email queue indexes
  emailQueueStatus: 'CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status)',
  emailQueueSendAt: 'CREATE INDEX IF NOT EXISTS idx_email_queue_send_at ON email_queue(send_at)',
  emailQueuePriority: 'CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority)',
  emailQueueNextRetry: 'CREATE INDEX IF NOT EXISTS idx_email_queue_next_retry ON email_queue(next_retry)',
  
  // Email preferences indexes
  emailPreferencesUserId: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_email_preferences_user_id ON email_preferences(user_id)',
  emailPreferencesEmail: 'CREATE INDEX IF NOT EXISTS idx_email_preferences_email ON email_preferences(email_address)',
  emailPreferencesToken: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_email_preferences_token ON email_preferences(unsubscribe_token)',
  
  // Email tracking events indexes
  emailTrackingEmailLogId: 'CREATE INDEX IF NOT EXISTS idx_email_tracking_email_log_id ON email_tracking_events(email_log_id)',
  emailTrackingType: 'CREATE INDEX IF NOT EXISTS idx_email_tracking_type ON email_tracking_events(type)',
  emailTrackingTimestamp: 'CREATE INDEX IF NOT EXISTS idx_email_tracking_timestamp ON email_tracking_events(timestamp)',
  
  // Email suppressions indexes
  emailSuppressionsEmail: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions(email)',
  emailSuppressionsType: 'CREATE INDEX IF NOT EXISTS idx_email_suppressions_type ON email_suppressions(type)',
  emailSuppressionsExpires: 'CREATE INDEX IF NOT EXISTS idx_email_suppressions_expires ON email_suppressions(expires_at)',
  
  // Email webhooks indexes
  emailWebhooksProcessed: 'CREATE INDEX IF NOT EXISTS idx_email_webhooks_processed ON email_webhooks(processed)',
  emailWebhooksMessageId: 'CREATE INDEX IF NOT EXISTS idx_email_webhooks_message_id ON email_webhooks(message_id)',
  emailWebhooksProvider: 'CREATE INDEX IF NOT EXISTS idx_email_webhooks_provider ON email_webhooks(provider)',
  
  // Email analytics summary indexes
  emailAnalyticsDate: 'CREATE INDEX IF NOT EXISTS idx_email_analytics_date ON email_analytics_summary(date)',
  emailAnalyticsProvider: 'CREATE INDEX IF NOT EXISTS idx_email_analytics_provider ON email_analytics_summary(provider)',
  emailAnalyticsTemplate: 'CREATE INDEX IF NOT EXISTS idx_email_analytics_template ON email_analytics_summary(template_type)',
  emailAnalyticsCampaign: 'CREATE INDEX IF NOT EXISTS idx_email_analytics_campaign ON email_analytics_summary(campaign_id)',
};

// Export all tables for use in queries
export {
  emailLogs,
  emailTemplates,
  emailQueue,
  emailPreferences,
  emailTrackingEvents,
  emailCampaigns,
  emailSuppressions,
  emailWebhooks,
  emailLists,
  emailListSubscribers,
  emailABTests,
  emailHealthMetrics,
  emailUnsubscribeRequests,
  emailAnalyticsSummary
};