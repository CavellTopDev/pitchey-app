// COMPLETE SCHEMA - Matches Neon Database with All Tables
import { pgTable, serial, integer, varchar, text, boolean, timestamp, decimal, jsonb, unique, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Define the event_type enum to match the database
export const eventTypeEnum = pgEnum("event_type", [
  // Basic analytics events
  "page_view", "pitch_view", "pitch_like", "pitch_save", "nda_request", "nda_signed", 
  "message_sent", "message_read", "profile_update", "search", "filter_applied", 
  "session_start", "session_end",
  
  // WebSocket events (legacy format)
  "websocket_connected", "websocket_message", "websocket_disconnected", "websocket_message_processed",
  
  // Authentication and Security events
  "registration_attempt", "registration", "login_failed", "login", "suspicious_token_use", 
  "fingerprint_mismatch", "password_reset_request", "password_reset_rate_limit", 
  "password_reset_attempt", "password_reset", "email_verified", "logout",
  
  // User Activity events
  "view", "like", "unlike", "rate_limit_exceeded", "user_presence_changed",
  
  // WebSocket Analytics events (with ws_ prefix)
  "ws_connection_established", "ws_connection_lost", "ws_connection_failed", "ws_reconnection_attempt",
  "ws_message_sent", "ws_message_received", "ws_message_failed", "ws_message_queued", "ws_message_delivered",
  "ws_presence_changed", "ws_user_activity", "ws_typing_indicator", "ws_draft_sync", 
  "ws_notification_read", "ws_upload_progress", "ws_pitch_view", "ws_latency_measured", 
  "ws_rate_limit_hit", "ws_error_occurred", "ws_server_broadcast", "ws_maintenance_mode"
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(), // Legacy password field - still required by database
  passwordHash: text("password_hash").notNull(),
  userType: varchar("user_type", { length: 50 }).notNull().default("viewer"),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  location: varchar("location", { length: 200 }),
  bio: text("bio"),
  website: text("website"), // Added website field
  avatar_url: text("avatar_url"), // Added for frontend compatibility
  profileImageUrl: text("profile_image_url"),
  companyName: text("company_name"),
  companyNumber: varchar("company_number", { length: 100 }),
  companyWebsite: text("company_website"),
  companyAddress: text("company_address"),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerifiedAt: timestamp("email_verified_at"),
  companyVerified: boolean("company_verified").default(false),
  isActive: boolean("is_active").default(true),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lastFailedLogin: timestamp("last_failed_login"),
  accountLockedUntil: timestamp("account_locked_until"),
  accountLockedAt: timestamp("account_locked_at"),
  accountLockReason: varchar("account_lock_reason", { length: 200 }),
  lastPasswordChangeAt: timestamp("last_password_change_at"),
  passwordHistory: jsonb("password_history").default("[]"),
  requirePasswordChange: boolean("require_password_change").default(false),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  email_notifications: boolean("email_notifications").default(true),
  marketing_emails: boolean("marketing_emails").default(false),
  privacy_settings: jsonb("privacy_settings").default("{}"),
  preferred_genres: varchar("preferred_genres", { length: 50 }).array().default([]),
  preferred_formats: varchar("preferred_formats", { length: 50 }).array().default([]),
  preferred_budget_ranges: varchar("preferred_budget_ranges", { length: 50 }).array().default([]),
  notification_frequency: varchar("notification_frequency", { length: 50 }).default("daily"),
  subscriptionTier: varchar("subscription_tier", { length: 50 }).default("free"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pitches = pgTable("pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  logline: text("logline").notNull(),
  description: text("description"), // Added for search functionality
  genre: varchar("genre", { length: 100 }),
  format: varchar("format", { length: 100 }),
  formatCategory: varchar("format_category", { length: 100 }),
  formatSubtype: varchar("format_subtype", { length: 100 }),
  customFormat: varchar("custom_format", { length: 255 }),
  shortSynopsis: text("short_synopsis"),
  longSynopsis: text("long_synopsis"),
  opener: text("opener"),
  premise: text("premise"),
  targetAudience: text("target_audience"),
  characters: text("characters"),
  themes: text("themes"),
  worldDescription: text("world_description"),
  episodeBreakdown: text("episode_breakdown"),
  budgetRange: varchar("budget_range", { length: 100 }), // Changed from budgetBracket to budgetRange
  budgetBracket: varchar("budget_bracket", { length: 100 }), // Keep legacy field for compatibility
  estimatedBudget: decimal("estimated_budget", { precision: 15, scale: 2 }),
  stage: varchar("stage", { length: 100 }), // Added stage field for production pipeline
  videoUrl: varchar("video_url", { length: 500 }),
  posterUrl: varchar("poster_url", { length: 500 }),
  pitchDeckUrl: varchar("pitch_deck_url", { length: 500 }),
  additionalMaterials: jsonb("additional_materials"),
  visibility: varchar("visibility", { length: 50 }).default("public"),
  status: varchar("status", { length: 50 }).default("active"),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  ndaCount: integer("nda_count").default(0),
  titleImage: text("title_image"),
  lookbookUrl: text("lookbook_url"),
  scriptUrl: text("script_url"),
  trailerUrl: text("trailer_url"),
  additionalMedia: jsonb("additional_media"),
  productionTimeline: text("production_timeline"),
  requireNda: boolean("require_nda").default(false),
  seekingInvestment: boolean("seeking_investment").default(false),
  productionStage: varchar("production_stage", { length: 100 }).default("concept"),
  publishedAt: timestamp("published_at"),
  visibilitySettings: jsonb("visibility_settings").default('{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}'),
  aiUsed: boolean("ai_used").default(false),
  aiTools: varchar("ai_tools", { length: 100 }).array().default([]),
  aiDisclosure: text("ai_disclosure"),
  shareCount: integer("share_count").default(0),
  feedback: jsonb("feedback").default("[]"),
  tags: varchar("tags", { length: 50 }).array().default([]),
  archived: boolean("archived").default(false),
  archivedAt: timestamp("archived_at"),
  metadata: jsonb("metadata").default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => users.id, { onDelete: "cascade" }),
  followingId: integer("following_id").references(() => users.id, { onDelete: "cascade" }), // Added for user-to-user follows
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").references(() => users.id, { onDelete: "cascade" }),
  followedAt: timestamp("followed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ndas = pgTable("ndas", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  signerId: integer("signer_id").references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("pending"),
  ndaType: varchar("nda_type", { length: 50 }).default("basic"),
  accessGranted: boolean("access_granted").default(false),
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  documentUrl: varchar("document_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").references(() => users.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id").references(() => users.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 255 }),
  content: text("content"),
  messageType: varchar("message_type", { length: 50 }).default("text"),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "set null" }),
  read: boolean("read").default(false), // Changed from isRead to read for consistency
  isRead: boolean("is_read").default(false), // Keep legacy field
  metadata: jsonb("metadata"),
  offPlatformRequested: boolean("off_platform_requested").default(false),
  offPlatformApproved: boolean("off_platform_approved").default(false),
  sentAt: timestamp("sent_at").defaultNow(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pitchViews = pgTable("pitch_views", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").references(() => users.id, { onDelete: "cascade" }),
  ipAddress: varchar("ip_address", { length: 100 }),
  viewType: varchar("view_type", { length: 20 }),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  sessionId: varchar("session_id", { length: 100 }),
  viewDuration: integer("view_duration"),
  scrollDepth: integer("scroll_depth"),
  clickedWatchThis: boolean("clicked_watch_this").default(false),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }),
  title: varchar("title", { length: 255 }),
  message: text("message"),
  data: jsonb("data"), // Added for structured notification data
  relatedId: integer("related_id"),
  relatedType: varchar("related_type", { length: 50 }),
  read: boolean("read").default(false), // Added for consistency with routes
  isRead: boolean("is_read").default(false), // Keep legacy field
  readAt: timestamp("read_at"), // Added for when notification was read
  createdAt: timestamp("created_at").defaultNow(),
});

export const portfolio = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 50 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Watchlist table for saved pitches
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Additional tables that were missing
export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventType: eventTypeEnum("event_type").notNull(),
  eventCategory: varchar("event_category", { length: 50 }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 255 }),
  eventData: jsonb("event_data"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyticsAggregates = pgTable("analytics_aggregates", {
  id: serial("id").primaryKey(),
  period: varchar("period", { length: 20 }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  metricType: varchar("metric_type", { length: 50 }).notNull(),
  metricValue: jsonb("metric_value"),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: integer("entity_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  lastActivity: timestamp("last_activity").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const searchAnalytics = pgTable("search_analytics", {
  id: serial("id").primaryKey(),
  searchQuery: text("search_query").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  resultsCount: integer("results_count").default(0),
  clickedResultId: integer("clicked_result_id"),
  clickedResultType: varchar("clicked_result_type", { length: 50 }),
  searchFilters: jsonb("search_filters"),
  sessionId: varchar("session_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchSuggestions = pgTable("search_suggestions", {
  id: serial("id").primaryKey(),
  suggestionText: text("suggestion_text").notNull().unique(),
  suggestionType: varchar("suggestion_type", { length: 50 }),
  popularityScore: integer("popularity_score").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  filters: jsonb("filters").notNull().default("{}"),
  useCount: integer("use_count").default(0),
  lastUsed: timestamp("last_used"),
  isPublic: boolean("is_public").default(false),
  notifyOnResults: boolean("notify_on_results").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Additional messaging tables
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversationParticipants = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const messageReadReceipts = pgTable("message_read_receipts", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").defaultNow(),
});

export const typingIndicators = pgTable("typing_indicators", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").defaultNow(),
});

// Analytics table (simplified)
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// NDA Requests table
export const ndaRequests = pgTable("nda_requests", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  requesterId: integer("requester_id").references(() => users.id, { onDelete: "cascade" }),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "cascade" }),
  ndaType: varchar("nda_type", { length: 50 }).default("basic"),
  status: varchar("status", { length: 50 }).default("pending"),
  requestMessage: text("request_message"),
  rejectionReason: text("rejection_reason"),
  companyInfo: jsonb("company_info"),
  requestedAt: timestamp("requested_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"),
});

// Missing essential tables from database
export const pitchLikes = pgTable("pitch_likes", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pitchSaves = pgTable("pitch_saves", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").default(0),
  totalPurchased: integer("total_purchased").default(0),
  totalUsed: integer("total_used").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "set null" }),
  paymentId: integer("payment_id").references(() => payments.id, { onDelete: "set null" }),
  type: varchar("type", { length: 50 }), // 'purchase', 'usage', 'refund', 'bonus'
  amount: integer("amount"),
  balanceBefore: integer("balance_before"),
  balanceAfter: integer("balance_after"),
  description: text("description"),
  usageType: varchar("usage_type", { length: 50 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSessionId: text("stripe_session_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  type: varchar("type", { length: 50 }), // 'subscription', 'credits', 'one_time'
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("usd"),
  status: varchar("status", { length: 50 }),
  description: text("description"),
  metadata: jsonb("metadata"),
  failureReason: text("failure_reason"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  transactionType: varchar("transaction_type", { length: 50 }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailPreferences = pgTable("email_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  newsletters: boolean("newsletters").default(true),
  pitchUpdates: boolean("pitch_updates").default(true),
  messages: boolean("messages").default(true),
  security: boolean("security").default(true),
  emailEnabled: boolean("email_enabled").default(true),
  weeklyDigest: boolean("weekly_digest").default(true),
  digestDay: varchar("digest_day", { length: 10 }).default("sunday"), // day of week
  digestTime: varchar("digest_time", { length: 5 }).default("09:00"), // HH:MM format
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailQueue = pgTable("email_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  toEmail: varchar("to_email", { length: 255 }),
  fromEmail: varchar("from_email", { length: 255 }),
  subject: varchar("subject", { length: 255 }),
  htmlContent: text("html_content"),
  textContent: text("text_content"),
  status: varchar("status", { length: 50 }).default("queued"),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  lastAttemptAt: timestamp("last_attempt_at"),
  scheduledFor: timestamp("scheduled_for"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailEvents = pgTable("email_events", {
  id: serial("id").primaryKey(),
  emailQueueId: integer("email_queue_id").references(() => emailQueue.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventData: jsonb("event_data").default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailSuppression = pgTable("email_suppression", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  reason: varchar("reason", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const unsubscribeTokens = pgTable("unsubscribe_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const digestHistory = pgTable("digest_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  stats: jsonb("stats").notNull().default("{}"),
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Security Events table
export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 100 }),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Content Management System Tables
export const contentTypes = pgTable("content_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  schema: jsonb("schema"), // JSON schema for validation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  contentTypeId: integer("content_type_id").references(() => contentTypes.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 200 }).notNull(), // unique identifier like "portal.creator.title"
  portalType: varchar("portal_type", { length: 50 }), // creator, investor, production, admin, global
  locale: varchar("locale", { length: 10 }).default("en"), // for i18n support
  content: jsonb("content").notNull(), // the actual content in JSON format
  metadata: jsonb("metadata").default("{}"),
  status: varchar("status", { length: 20 }).default("active"), // active, inactive, draft
  version: integer("version").default(1),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isEnabled: boolean("is_enabled").default(false),
  portalType: varchar("portal_type", { length: 50 }), // specific portal or null for global
  userType: varchar("user_type", { length: 50 }), // specific user type or null for all
  rolloutPercentage: integer("rollout_percentage").default(0), // 0-100 for gradual rollout
  conditions: jsonb("conditions").default("{}"), // complex conditions for targeting
  metadata: jsonb("metadata").default("{}"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const portalConfigurations = pgTable("portal_configurations", {
  id: serial("id").primaryKey(),
  portalType: varchar("portal_type", { length: 50 }).notNull(), // creator, investor, production, admin
  configKey: varchar("config_key", { length: 100 }).notNull(), // branding.logo, features.messaging, etc.
  configValue: jsonb("config_value").notNull(),
  isSecret: boolean("is_secret").default(false), // for sensitive configs like API keys
  description: text("description"),
  validationSchema: jsonb("validation_schema"), // JSON schema for value validation
  category: varchar("category", { length: 50 }), // branding, features, integrations, etc.
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const translationKeys = pgTable("translation_keys", {
  id: serial("id").primaryKey(),
  keyPath: varchar("key_path", { length: 200 }).notNull(), // dot-notation like "auth.login.title"
  defaultValue: text("default_value").notNull(),
  description: text("description"),
  context: varchar("context", { length: 100 }), // page, component, or feature context
  category: varchar("category", { length: 50 }), // ui, validation, error, success, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  translationKeyId: integer("translation_key_id").references(() => translationKeys.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(), // en, es, fr, etc.
  value: text("value").notNull(),
  isApproved: boolean("is_approved").default(false),
  translatedBy: integer("translated_by").references(() => users.id, { onDelete: "set null" }),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const navigationMenus = pgTable("navigation_menus", {
  id: serial("id").primaryKey(),
  portalType: varchar("portal_type", { length: 50 }).notNull(),
  menuType: varchar("menu_type", { length: 50 }).notNull(), // header, sidebar, footer, etc.
  items: jsonb("items").notNull(), // array of menu items with structure
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentApprovals = pgTable("content_approvals", {
  id: serial("id").primaryKey(),
  contentItemId: integer("content_item_id").references(() => contentItems.id, { onDelete: "cascade" }),
  requestedBy: integer("requested_by").references(() => users.id, { onDelete: "cascade" }),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, rejected
  comments: text("comments"),
  requestedAt: timestamp("requested_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

// Unique constraints for content management
export const contentItemsUnique = unique("content_items_key_portal_locale").on(
  contentItems.key, 
  contentItems.portalType, 
  contentItems.locale
);

export const portalConfigurationsUnique = unique("portal_configurations_portal_key").on(
  portalConfigurations.portalType, 
  portalConfigurations.configKey
);

export const translationKeysUnique = unique("translation_keys_key_path").on(
  translationKeys.keyPath
);

export const translationsUnique = unique("translations_key_locale").on(
  translations.translationKeyId, 
  translations.locale
);

export const navigationMenusUnique = unique("navigation_menus_portal_type").on(
  navigationMenus.portalType, 
  navigationMenus.menuType
);

// Subscription History Table - Track subscription changes and billing history
export const subscriptionHistory = pgTable("subscription_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Previous and new subscription details
  previousTier: varchar("previous_tier", { length: 50 }),
  newTier: varchar("new_tier", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // upgrade, downgrade, cancel, renew, create
  
  // Stripe details
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  
  // Billing details
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("usd"),
  billingInterval: varchar("billing_interval", { length: 20 }), // monthly, yearly
  
  // Period details
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  
  // Status and metadata
  status: varchar("status", { length: 50 }).notNull(), // active, canceled, expired, pending
  metadata: jsonb("metadata").default("{}"),
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("subscription_history_user_id_idx").on(table.userId),
  statusIdx: index("subscription_history_status_idx").on(table.status),
  stripeSubscriptionIdx: index("subscription_history_stripe_subscription_idx").on(table.stripeSubscriptionId),
  timestampIdx: index("subscription_history_timestamp_idx").on(table.timestamp),
  actionIdx: index("subscription_history_action_idx").on(table.action),
}));

// Payment Methods Table - Store user payment methods
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Stripe details
  stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  
  // Payment method details
  type: varchar("type", { length: 20 }).notNull(), // card, bank_account, paypal, etc.
  
  // Card details (for card type)
  brand: varchar("brand", { length: 20 }), // visa, mastercard, amex, etc.
  lastFour: varchar("last_four", { length: 4 }),
  expMonth: integer("exp_month"),
  expYear: integer("exp_year"),
  
  // Bank account details (for bank_account type)
  bankName: varchar("bank_name", { length: 100 }),
  accountType: varchar("account_type", { length: 20 }), // checking, savings
  
  // Status and preferences
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  
  // Billing details
  billingName: varchar("billing_name", { length: 255 }),
  billingEmail: varchar("billing_email", { length: 255 }),
  billingAddress: jsonb("billing_address"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("payment_methods_user_id_idx").on(table.userId),
  stripePaymentMethodIdx: index("payment_methods_stripe_payment_method_idx").on(table.stripePaymentMethodId),
  stripeCustomerIdx: index("payment_methods_stripe_customer_idx").on(table.stripeCustomerId),
  typeIdx: index("payment_methods_type_idx").on(table.type),
  defaultIdx: index("payment_methods_default_idx").on(table.isDefault),
  activeIdx: index("payment_methods_active_idx").on(table.isActive),
}));

// Export types
export type User = typeof users.$inferSelect;
export type Pitch = typeof pitches.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type NDA = typeof ndas.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type PitchView = typeof pitchViews.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Portfolio = typeof portfolio.$inferSelect;
export type Watchlist = typeof watchlist.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type AnalyticsAggregate = typeof analyticsAggregates.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type SearchAnalytic = typeof searchAnalytics.$inferSelect;
export type SearchSuggestion = typeof searchSuggestions.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type MessageReadReceipt = typeof messageReadReceipts.$inferSelect;
export type TypingIndicator = typeof typingIndicators.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;
export type NdaRequest = typeof ndaRequests.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type PitchLike = typeof pitchLikes.$inferSelect;
export type PitchSave = typeof pitchSaves.$inferSelect;
export type UserCredit = typeof userCredits.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type EmailPreference = typeof emailPreferences.$inferSelect;
export type EmailQueue = typeof emailQueue.$inferSelect;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type EmailSuppression = typeof emailSuppression.$inferSelect;
export type UnsubscribeToken = typeof unsubscribeTokens.$inferSelect;
export type DigestHistory = typeof digestHistory.$inferSelect;
export type ContentType = typeof contentTypes.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type PortalConfiguration = typeof portalConfigurations.$inferSelect;
export type TranslationKey = typeof translationKeys.$inferSelect;
export type Translation = typeof translations.$inferSelect;
export type NavigationMenu = typeof navigationMenus.$inferSelect;
export type ContentApproval = typeof contentApprovals.$inferSelect;
export type InfoRequest = typeof infoRequests.$inferSelect;
export type InfoRequestAttachment = typeof infoRequestAttachments.$inferSelect;
export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type PitchCharacter = typeof pitchCharacters.$inferSelect;

// ============= RELATIONS =============
// Define all table relations for Drizzle ORM

export const usersRelations = relations(users, ({ many }) => ({
  pitches: many(pitches),
  ndas: many(ndas),
  ndaRequests: many(ndaRequests),
  sentMessages: many(messages),
  notifications: many(notifications),
  follows: many(follows),
  pitchViews: many(pitchViews),
  sessions: many(sessions),
  subscriptionHistory: many(subscriptionHistory),
  paymentMethods: many(paymentMethods),
}));

export const pitchesRelations = relations(pitches, ({ one, many }) => ({
  creator: one(users, {
    fields: [pitches.userId],
    references: [users.id],
  }),
  ndas: many(ndas),
  ndaRequests: many(ndaRequests),
  messages: many(messages),
  views: many(pitchViews),
  characters: many(pitchCharacters),
  // media: many(pitchMedia), // pitchMedia table not defined yet
  follows: many(follows),
}));

export const ndasRelations = relations(ndas, ({ one }) => ({
  pitch: one(pitches, {
    fields: [ndas.pitchId],
    references: [pitches.id],
  }),
  user: one(users, {
    fields: [ndas.userId],
    references: [users.id],
  }),
  signer: one(users, {
    fields: [ndas.signerId],
    references: [users.id],
  }),
}));

export const ndaRequestsRelations = relations(ndaRequests, ({ one }) => ({
  pitch: one(pitches, {
    fields: [ndaRequests.pitchId],
    references: [pitches.id],
  }),
  requester: one(users, {
    fields: [ndaRequests.requesterId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  recipient: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [messages.pitchId],
    references: [pitches.id],
  }),
}));

export const pitchViewsRelations = relations(pitchViews, ({ one }) => ({
  pitch: one(pitches, {
    fields: [pitchViews.pitchId],
    references: [pitches.id],
  }),
  viewer: one(users, {
    fields: [pitchViews.viewerId],
    references: [users.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [follows.creatorId],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [follows.pitchId],
    references: [pitches.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Note: pitchMedia table is not defined in schema yet, commenting out relation
// export const pitchMediaRelations = relations(pitchMedia, ({ one }) => ({
//   pitch: one(pitches, {
//     fields: [pitchMedia.pitchId],
//     references: [pitches.id],
//   }),
// }));

// ============================================
// CRITICAL MISSING TABLES FOR API CONSISTENCY
// ============================================

// Investments table (was missing)
export const investmentInterests = pgTable("investment_interests", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  interestLevel: text("interest_level").default('moderate'),
  notes: text("notes"),
  status: text("status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default('pending'),
  terms: text("terms"),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  documents: jsonb("documents").$type<any[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 1. Reviews table (for production pitch reviews)
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").$type<"approved" | "rejected" | "pending" | "needs_revision">().notNull(),
  feedback: text("feedback"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Calendar Events table (for production calendar)
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  type: text("type").$type<"meeting" | "deadline" | "screening" | "production" | "review" | "other">(),
  relatedPitchId: integer("related_pitch_id").references(() => pitches.id, { onDelete: "set null" }),
  location: varchar("location", { length: 255 }),
  attendees: jsonb("attendees").$type<string[]>().default([]),
  reminderMinutes: integer("reminder_minutes").default(15),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3. Saved Pitches table (for creators and investors)
export const savedPitches = pgTable("saved_pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. Investment Documents table
export const investmentDocuments = pgTable("investment_documents", {
  id: serial("id").primaryKey(),
  investmentId: integer("investment_id").references(() => investments.id, { onDelete: "cascade" }).notNull(),
  documentName: varchar("document_name", { length: 255 }).notNull(),
  documentUrl: text("document_url"),
  documentType: varchar("document_type", { length: 50 }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// 5. Investment Timeline Events
export const investmentTimeline = pgTable("investment_timeline", {
  id: serial("id").primaryKey(),
  investmentId: integer("investment_id").references(() => investments.id, { onDelete: "cascade" }).notNull(),
  eventType: varchar("event_type", { length: 50 }),
  eventDescription: text("event_description"),
  eventDate: timestamp("event_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Information Requests table (for post-NDA communication)
export const infoRequests = pgTable("info_requests", {
  id: serial("id").primaryKey(),
  ndaId: integer("nda_id").references(() => ndas.id, { onDelete: "cascade" }).notNull(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }).notNull(),
  requesterId: integer("requester_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  requestType: varchar("request_type", { length: 50 }).notNull(), // financial, production, legal, marketing, etc.
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, urgent
  status: varchar("status", { length: 50 }).default("pending"), // pending, responded, closed
  response: text("response"),
  responseAt: timestamp("response_at"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 7. Info Request Attachments table
export const infoRequestAttachments = pgTable("info_request_attachments", {
  id: serial("id").primaryKey(),
  infoRequestId: integer("info_request_id").references(() => infoRequests.id, { onDelete: "cascade" }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 50 }),
  fileSize: integer("file_size"),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const pitchDocuments = pgTable("pitch_documents", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileKey: text("file_key"), // For S3 key or local path
  fileType: varchar("file_type", { length: 50 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  documentType: varchar("document_type", { length: 50 }).notNull(), // script, treatment, pitch_deck, nda, supporting
  isPublic: boolean("is_public").default(false),
  requiresNda: boolean("requires_nda").default(false),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  lastModified: timestamp("last_modified").defaultNow(),
  downloadCount: integer("download_count").default(0),
  metadata: jsonb("metadata").default("{}"), // For additional file metadata
});

// Pitch Characters table - normalized character management
export const pitchCharacters = pgTable("pitch_characters", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  age: varchar("age", { length: 50 }),
  gender: varchar("gender", { length: 50 }),
  actor: varchar("actor", { length: 255 }),
  role: varchar("role", { length: 255 }),
  relationship: text("relationship"),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  pitchIdDisplayOrderIdx: index("pitch_characters_pitch_id_display_order_idx").on(table.pitchId, table.displayOrder),
  pitchIdIdx: index("pitch_characters_pitch_id_idx").on(table.pitchId),
}));

// Saved Filter Presets Table
export const savedFilters = pgTable("saved_filters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  filters: jsonb("filters").notNull().default("{}"),
  isDefault: boolean("is_default").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Email Alert Subscriptions Table
export const emailAlerts = pgTable("email_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  filters: jsonb("filters").notNull().default("{}"),
  frequency: varchar("frequency", { length: 50 }).notNull().default("daily"), // 'immediate', 'daily', 'weekly'
  isActive: boolean("is_active").default(true),
  lastSentAt: timestamp("last_sent_at"),
  matchesFound: integer("matches_found").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Alert Sent Pitches Tracking Table
export const alertSentPitches = pgTable("alert_sent_pitches", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").references(() => emailAlerts.id, { onDelete: "cascade" }).notNull(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }).notNull(),
  sentAt: timestamp("sent_at").defaultNow()
}, (table) => ({
  uniqueAlertPitch: unique().on(table.alertId, table.pitchId)
}));

// Subscription History Relations
export const subscriptionHistoryRelations = relations(subscriptionHistory, ({ one }) => ({
  user: one(users, {
    fields: [subscriptionHistory.userId],
    references: [users.id],
  }),
}));

// Payment Methods Relations
export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  user: one(users, {
    fields: [paymentMethods.userId],
    references: [users.id],
  }),
}));

// ============================================
// ADVANCED FEATURES TABLES
// ============================================

// User Preferences for Smart Recommendations
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  preferredGenres: varchar("preferred_genres", { length: 50 }).array().default([]),
  preferredFormats: varchar("preferred_formats", { length: 50 }).array().default([]),
  preferredBudgetRange: varchar("preferred_budget_range", { length: 100 }),
  investmentInterests: varchar("investment_interests", { length: 50 }).array().default([]),
  collaborationTypes: varchar("collaboration_types", { length: 50 }).array().default([]),
  notificationFrequency: varchar("notification_frequency", { length: 20 }).default("daily"),
  recommendationStyle: varchar("recommendation_style", { length: 20 }).default("balanced"), // aggressive, balanced, conservative
  marketingOptIn: boolean("marketing_opt_in").default(false),
  dataProcessingConsent: boolean("data_processing_consent").default(true),
  experienceLevel: varchar("experience_level", { length: 20 }).default("intermediate"),
  industry: varchar("industry", { length: 100 }),
  companySize: varchar("company_size", { length: 50 }),
  location: varchar("location", { length: 200 }),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  language: varchar("language", { length: 10 }).default("en"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Smart Recommendation Cache
export const recommendationCache = pgTable("recommendation_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  cacheKey: varchar("cache_key", { length: 255 }).notNull(),
  recommendations: jsonb("recommendations").notNull(),
  algorithmVersion: varchar("algorithm_version", { length: 20 }).default("v1.0"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userCacheKeyIdx: index("recommendation_cache_user_cache_key_idx").on(table.userId, table.cacheKey),
  expiresAtIdx: index("recommendation_cache_expires_at_idx").on(table.expiresAt),
}));

// User Interaction History for ML
export const userInteractions = pgTable("user_interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  interactionType: varchar("interaction_type", { length: 50 }).notNull(), // view, like, save, share, comment, nda_request
  targetType: varchar("target_type", { length: 50 }).notNull(), // pitch, user, message
  targetId: integer("target_id").notNull(),
  duration: integer("duration"), // in seconds
  metadata: jsonb("metadata").default("{}"),
  sessionId: varchar("session_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userInteractionIdx: index("user_interactions_user_interaction_idx").on(table.userId, table.interactionType),
  targetIdx: index("user_interactions_target_idx").on(table.targetType, table.targetId),
  sessionIdx: index("user_interactions_session_idx").on(table.sessionId),
  createdAtIdx: index("user_interactions_created_at_idx").on(table.createdAt),
}));

// Search Patterns for Advanced Search
export const searchPatterns = pgTable("search_patterns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  searchQuery: text("search_query").notNull(),
  filters: jsonb("filters").default("{}"),
  resultsCount: integer("results_count").default(0),
  clickedResults: jsonb("clicked_results").default("[]"),
  searchVector: text("search_vector"), // For semantic search
  sessionId: varchar("session_id", { length: 255 }),
  searchSource: varchar("search_source", { length: 50 }), // homepage, browse, dashboard, etc.
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userSearchIdx: index("search_patterns_user_idx").on(table.userId),
  queryIdx: index("search_patterns_query_idx").on(table.searchQuery),
  createdAtIdx: index("search_patterns_created_at_idx").on(table.createdAt),
}));

// Workflow Automation Rules
export const workflowRules = pgTable("workflow_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // pitch_created, nda_signed, investment_made
  triggerConditions: jsonb("trigger_conditions").notNull().default("{}"),
  actions: jsonb("actions").notNull().default("[]"),
  enabled: boolean("enabled").default(true),
  priority: integer("priority").default(0),
  userType: varchar("user_type", { length: 50 }), // creator, investor, production, admin
  portalType: varchar("portal_type", { length: 50 }), // creator, investor, production, admin
  executionCount: integer("execution_count").default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  triggerTypeIdx: index("workflow_rules_trigger_type_idx").on(table.triggerType),
  enabledIdx: index("workflow_rules_enabled_idx").on(table.enabled),
  priorityIdx: index("workflow_rules_priority_idx").on(table.priority),
}));

// Workflow Execution Log
export const workflowExecutions = pgTable("workflow_executions", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").references(() => workflowRules.id, { onDelete: "cascade" }).notNull(),
  triggerEventId: integer("trigger_event_id"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, success, failed, skipped
  executionData: jsonb("execution_data").default("{}"),
  resultData: jsonb("result_data").default("{}"),
  errorMessage: text("error_message"),
  executionTimeMs: integer("execution_time_ms"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  ruleStatusIdx: index("workflow_executions_rule_status_idx").on(table.ruleId, table.status),
  startedAtIdx: index("workflow_executions_started_at_idx").on(table.startedAt),
}));

// Smart Notifications Queue
export const smartNotifications = pgTable("smart_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  notificationType: varchar("notification_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"),
  actionText: varchar("action_text", { length: 100 }),
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, urgent
  channels: varchar("channels", { length: 20 }).array().default(["in_app"]), // in_app, email, push, sms
  metadata: jsonb("metadata").default("{}"),
  groupingKey: varchar("grouping_key", { length: 255 }), // For grouping similar notifications
  status: varchar("status", { length: 20 }).default("pending"), // pending, sent, read, dismissed
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  dismissedAt: timestamp("dismissed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userStatusIdx: index("smart_notifications_user_status_idx").on(table.userId, table.status),
  scheduledIdx: index("smart_notifications_scheduled_idx").on(table.scheduledFor),
  groupingIdx: index("smart_notifications_grouping_idx").on(table.groupingKey),
}));

// User Similarity Scores (for collaborative filtering)
export const userSimilarity = pgTable("user_similarity", {
  id: serial("id").primaryKey(),
  userId1: integer("user_id_1").references(() => users.id, { onDelete: "cascade" }).notNull(),
  userId2: integer("user_id_2").references(() => users.id, { onDelete: "cascade" }).notNull(),
  similarityScore: decimal("similarity_score", { precision: 5, scale: 4 }).notNull(),
  algorithmVersion: varchar("algorithm_version", { length: 20 }).default("cosine_v1"),
  commonInteractions: integer("common_interactions").default(0),
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => ({
  userPairIdx: index("user_similarity_pair_idx").on(table.userId1, table.userId2),
  scoreIdx: index("user_similarity_score_idx").on(table.similarityScore),
  calculatedAtIdx: index("user_similarity_calculated_at_idx").on(table.calculatedAt),
  uniquePair: unique().on(table.userId1, table.userId2),
}));

// Trending Topics and Insights
export const trendingTopics = pgTable("trending_topics", {
  id: serial("id").primaryKey(),
  topicType: varchar("topic_type", { length: 50 }).notNull(), // genre, format, budget, theme, keyword
  topicValue: varchar("topic_value", { length: 255 }).notNull(),
  trendScore: decimal("trend_score", { precision: 8, scale: 4 }).notNull(),
  changePercent: decimal("change_percent", { precision: 5, scale: 2 }),
  timeframe: varchar("timeframe", { length: 10 }).notNull(), // 24h, 7d, 30d
  dataPoints: jsonb("data_points").default("[]"),
  predictedPeak: timestamp("predicted_peak"),
  marketOpportunity: decimal("market_opportunity", { precision: 3, scale: 2 }),
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => ({
  topicTypeValueIdx: index("trending_topics_type_value_idx").on(table.topicType, table.topicValue),
  trendScoreIdx: index("trending_topics_trend_score_idx").on(table.trendScore),
  timeframeIdx: index("trending_topics_timeframe_idx").on(table.timeframe),
  calculatedAtIdx: index("trending_topics_calculated_at_idx").on(table.calculatedAt),
}));

// Advanced Search Filters and Facets
export const searchFacets = pgTable("search_facets", {
  id: serial("id").primaryKey(),
  facetType: varchar("facet_type", { length: 50 }).notNull(), // genre, format, budget, location, etc.
  facetValue: varchar("facet_value", { length: 255 }).notNull(),
  count: integer("count").default(0),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  facetTypeValueIdx: index("search_facets_type_value_idx").on(table.facetType, table.facetValue),
  countIdx: index("search_facets_count_idx").on(table.count),
  lastUpdatedIdx: index("search_facets_last_updated_idx").on(table.lastUpdated),
  uniqueFacet: unique().on(table.facetType, table.facetValue),
}));

// Performance Metrics and Monitoring
export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  metricType: varchar("metric_type", { length: 50 }).notNull(), // api_response_time, db_query_time, cache_hit_rate
  metricName: varchar("metric_name", { length: 255 }).notNull(),
  value: decimal("value", { precision: 10, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 20 }), // ms, seconds, percentage, count
  tags: jsonb("tags").default("{}"),
  endpoint: varchar("endpoint", { length: 255 }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 255 }),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  metricTypeNameIdx: index("performance_metrics_type_name_idx").on(table.metricType, table.metricName),
  timestampIdx: index("performance_metrics_timestamp_idx").on(table.timestamp),
  endpointIdx: index("performance_metrics_endpoint_idx").on(table.endpoint),
}));

// ============================================
// A/B TESTING FRAMEWORK TABLES
// ============================================

// Experiments table - stores experiment configurations
export const experiments = pgTable("experiments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  hypothesis: text("hypothesis"), // What are we trying to prove?
  
  // Experiment status and timing
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, active, paused, completed, archived
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  
  // Configuration
  trafficAllocation: decimal("traffic_allocation", { precision: 5, scale: 4 }).notNull().default("0.1"), // 0-1, percentage of users
  variants: jsonb("variants").notNull().default("[]"), // Array of variant configurations
  
  // Targeting criteria
  targetingRules: jsonb("targeting_rules").default("{}"), // Who should see this experiment
  userSegments: varchar("user_segments", { length: 50 }).array().default([]), // new, returning, creator, investor, etc.
  
  // Success metrics
  primaryMetric: varchar("primary_metric", { length: 100 }).notNull(), // conversion_rate, click_through_rate, etc.
  secondaryMetrics: varchar("secondary_metrics", { length: 100 }).array().default([]),
  
  // Statistical configuration
  minimumSampleSize: integer("minimum_sample_size").default(100),
  statisticalPower: decimal("statistical_power", { precision: 3, scale: 2 }).default("0.80"),
  significanceLevel: decimal("significance_level", { precision: 3, scale: 2 }).default("0.05"),
  
  // Metadata and tracking
  featureFlag: varchar("feature_flag", { length: 100 }), // Associated feature flag
  tags: varchar("tags", { length: 50 }).array().default([]),
  priority: integer("priority").default(0), // For experiment conflict resolution
  rolloutStrategy: varchar("rollout_strategy", { length: 50 }).default("immediate"), // immediate, gradual, scheduled
  
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("experiments_name_idx").on(table.name),
  statusIdx: index("experiments_status_idx").on(table.status),
  startEndDateIdx: index("experiments_start_end_date_idx").on(table.startDate, table.endDate),
  createdByIdx: index("experiments_created_by_idx").on(table.createdBy),
}));

// User experiment assignments table - tracks which variant each user sees
export const userExperimentAssignments = pgTable("user_experiment_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 255 }), // For anonymous users
  experimentId: integer("experiment_id").references(() => experiments.id, { onDelete: "cascade" }).notNull(),
  variantId: varchar("variant_id", { length: 100 }).notNull(), // control, variant_a, variant_b, etc.
  
  // Assignment details
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignmentMethod: varchar("assignment_method", { length: 50 }).default("hash"), // hash, random, manual
  bucketing: jsonb("bucketing").default("{}"), // Bucketing algorithm details
  
  // User context at assignment
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  referrer: text("referrer"),
  
  // Override and exclusion
  isOverride: boolean("is_override").default(false), // Manually assigned for testing
  excludedFromAnalysis: boolean("excluded_from_analysis").default(false),
  exclusionReason: varchar("exclusion_reason", { length: 255 }),
}, (table) => ({
  userExperimentIdx: index("user_experiment_assignments_user_experiment_idx").on(table.userId, table.experimentId),
  sessionExperimentIdx: index("user_experiment_assignments_session_experiment_idx").on(table.sessionId, table.experimentId),
  experimentVariantIdx: index("user_experiment_assignments_experiment_variant_idx").on(table.experimentId, table.variantId),
  assignedAtIdx: index("user_experiment_assignments_assigned_at_idx").on(table.assignedAt),
  uniqueUserExperiment: unique().on(table.userId, table.experimentId),
  uniqueSessionExperiment: unique().on(table.sessionId, table.experimentId),
}));

// Experiment events table - tracks user interactions and conversions
export const experimentEvents = pgTable("experiment_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 255 }),
  experimentId: integer("experiment_id").references(() => experiments.id, { onDelete: "cascade" }).notNull(),
  variantId: varchar("variant_id", { length: 100 }).notNull(),
  
  // Event details
  eventType: varchar("event_type", { length: 100 }).notNull(), // page_view, button_click, conversion, etc.
  eventName: varchar("event_name", { length: 255 }), // Human-readable event name
  eventValue: decimal("event_value", { precision: 10, scale: 2 }), // Monetary value or custom metric
  
  // Context and properties
  properties: jsonb("properties").default("{}"), // Custom event properties
  url: text("url"),
  elementId: varchar("element_id", { length: 255 }),
  elementText: text("element_text"),
  
  // Technical details
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  userExperimentIdx: index("experiment_events_user_experiment_idx").on(table.userId, table.experimentId),
  sessionExperimentIdx: index("experiment_events_session_experiment_idx").on(table.sessionId, table.experimentId),
  experimentEventTypeIdx: index("experiment_events_experiment_event_type_idx").on(table.experimentId, table.eventType),
  timestampIdx: index("experiment_events_timestamp_idx").on(table.timestamp),
  variantEventTypeIdx: index("experiment_events_variant_event_type_idx").on(table.variantId, table.eventType),
}));

// Experiment results cache - stores pre-calculated statistics
export const experimentResults = pgTable("experiment_results", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id").references(() => experiments.id, { onDelete: "cascade" }).notNull(),
  
  // Result summary
  status: varchar("status", { length: 20 }).notNull().default("calculating"), // calculating, ready, significant, inconclusive
  calculatedAt: timestamp("calculated_at").defaultNow(),
  
  // Sample sizes
  totalParticipants: integer("total_participants").default(0),
  variantSampleSizes: jsonb("variant_sample_sizes").default("{}"), // {control: 1000, variant_a: 1050}
  
  // Primary metric results
  primaryMetricResults: jsonb("primary_metric_results").notNull().default("{}"),
  conversionRates: jsonb("conversion_rates").default("{}"), // {control: 0.15, variant_a: 0.18}
  
  // Statistical significance
  pValue: decimal("p_value", { precision: 10, scale: 8 }),
  confidenceLevel: decimal("confidence_level", { precision: 5, scale: 4 }),
  isStatisticallySignificant: boolean("is_statistically_significant").default(false),
  winningVariant: varchar("winning_variant", { length: 100 }),
  liftPercentage: decimal("lift_percentage", { precision: 8, scale: 4 }), // % improvement
  
  // Confidence intervals
  confidenceIntervals: jsonb("confidence_intervals").default("{}"),
  
  // Secondary metrics
  secondaryMetricResults: jsonb("secondary_metric_results").default("{}"),
  
  // Additional insights
  segments: jsonb("segments").default("{}"), // Results broken down by user segments
  timeSeriesData: jsonb("time_series_data").default("{}"), // Daily/hourly performance data
  
  // Recommendations
  recommendation: text("recommendation"), // What action should be taken based on results
  confidence: varchar("confidence", { length: 20 }), // high, medium, low
  
  nextCalculationAt: timestamp("next_calculation_at"),
}, (table) => ({
  experimentIdx: index("experiment_results_experiment_idx").on(table.experimentId),
  statusIdx: index("experiment_results_status_idx").on(table.status),
  calculatedAtIdx: index("experiment_results_calculated_at_idx").on(table.calculatedAt),
  significantIdx: index("experiment_results_significant_idx").on(table.isStatisticallySignificant),
  uniqueExperiment: unique().on(table.experimentId),
}));

// Experiment audit log - tracks all changes to experiments
export const experimentAuditLog = pgTable("experiment_audit_log", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id").references(() => experiments.id, { onDelete: "cascade" }).notNull(),
  
  // Change details
  action: varchar("action", { length: 50 }).notNull(), // created, started, paused, updated, completed
  previousValues: jsonb("previous_values").default("{}"),
  newValues: jsonb("new_values").default("{}"),
  changedFields: varchar("changed_fields", { length: 50 }).array().default([]),
  
  // Context
  reason: text("reason"), // Why was the change made?
  automaticChange: boolean("automatic_change").default(false), // Was this an automated change?
  
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  experimentIdx: index("experiment_audit_log_experiment_idx").on(table.experimentId),
  actionIdx: index("experiment_audit_log_action_idx").on(table.action),
  timestampIdx: index("experiment_audit_log_timestamp_idx").on(table.timestamp),
  userIdx: index("experiment_audit_log_user_idx").on(table.userId),
}));

// Feature flags table (enhanced with A/B testing support)
export const abFeatureFlags = pgTable("ab_feature_flags", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Flag configuration
  enabled: boolean("enabled").default(false),
  type: varchar("type", { length: 50 }).notNull().default("boolean"), // boolean, string, number, json
  defaultValue: jsonb("default_value").notNull(),
  
  // A/B testing integration
  experimentId: integer("experiment_id").references(() => experiments.id, { onDelete: "set null" }),
  variantValues: jsonb("variant_values").default("{}"), // {control: false, variant_a: true}
  
  // Targeting and rollout
  rolloutPercentage: decimal("rollout_percentage", { precision: 5, scale: 2 }).default("0"), // 0-100
  targetingRules: jsonb("targeting_rules").default("{}"),
  userSegments: varchar("user_segments", { length: 50 }).array().default([]),
  
  // Management
  tags: varchar("tags", { length: 50 }).array().default([]),
  environment: varchar("environment", { length: 50 }).default("production"), // development, staging, production
  
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  keyIdx: index("ab_feature_flags_key_idx").on(table.key),
  enabledIdx: index("ab_feature_flags_enabled_idx").on(table.enabled),
  experimentIdx: index("ab_feature_flags_experiment_idx").on(table.experimentId),
  environmentIdx: index("ab_feature_flags_environment_idx").on(table.environment),
}));

// Export additional types
export type UserPreference = typeof userPreferences.$inferSelect;
export type RecommendationCache = typeof recommendationCache.$inferSelect;
export type UserInteraction = typeof userInteractions.$inferSelect;
export type SearchPattern = typeof searchPatterns.$inferSelect;
export type WorkflowRule = typeof workflowRules.$inferSelect;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type SmartNotification = typeof smartNotifications.$inferSelect;
export type UserSimilarity = typeof userSimilarity.$inferSelect;
export type TrendingTopic = typeof trendingTopics.$inferSelect;
export type SearchFacet = typeof searchFacets.$inferSelect;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;

// A/B Testing types
export type Experiment = typeof experiments.$inferSelect;
export type UserExperimentAssignment = typeof userExperimentAssignments.$inferSelect;
export type ExperimentEvent = typeof experimentEvents.$inferSelect;
export type ExperimentResult = typeof experimentResults.$inferSelect;
export type ExperimentAuditLog = typeof experimentAuditLog.$inferSelect;
export type ABFeatureFlag = typeof abFeatureFlags.$inferSelect;

// Additional Relations
export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const userInteractionsRelations = relations(userInteractions, ({ one }) => ({
  user: one(users, {
    fields: [userInteractions.userId],
    references: [users.id],
  }),
}));

export const workflowRulesRelations = relations(workflowRules, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [workflowRules.createdBy],
    references: [users.id],
  }),
  executions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one }) => ({
  rule: one(workflowRules, {
    fields: [workflowExecutions.ruleId],
    references: [workflowRules.id],
  }),
}));

export const smartNotificationsRelations = relations(smartNotifications, ({ one }) => ({
  user: one(users, {
    fields: [smartNotifications.userId],
    references: [users.id],
  }),
}));

export const pitchCharactersRelations = relations(pitchCharacters, ({ one }) => ({
  pitch: one(pitches, {
    fields: [pitchCharacters.pitchId],
    references: [pitches.id],
  }),
}));

// A/B Testing Relations
export const experimentsRelations = relations(experiments, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [experiments.createdBy],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [experiments.updatedBy],
    references: [users.id],
  }),
  assignments: many(userExperimentAssignments),
  events: many(experimentEvents),
  results: one(experimentResults),
  auditLogs: many(experimentAuditLog),
  featureFlag: many(abFeatureFlags),
}));

export const userExperimentAssignmentsRelations = relations(userExperimentAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userExperimentAssignments.userId],
    references: [users.id],
  }),
  experiment: one(experiments, {
    fields: [userExperimentAssignments.experimentId],
    references: [experiments.id],
  }),
}));

export const experimentEventsRelations = relations(experimentEvents, ({ one }) => ({
  user: one(users, {
    fields: [experimentEvents.userId],
    references: [users.id],
  }),
  experiment: one(experiments, {
    fields: [experimentEvents.experimentId],
    references: [experiments.id],
  }),
}));

export const experimentResultsRelations = relations(experimentResults, ({ one }) => ({
  experiment: one(experiments, {
    fields: [experimentResults.experimentId],
    references: [experiments.id],
  }),
}));

export const experimentAuditLogRelations = relations(experimentAuditLog, ({ one }) => ({
  experiment: one(experiments, {
    fields: [experimentAuditLog.experimentId],
    references: [experiments.id],
  }),
  user: one(users, {
    fields: [experimentAuditLog.userId],
    references: [users.id],
  }),
}));

export const abFeatureFlagsRelations = relations(abFeatureFlags, ({ one }) => ({
  experiment: one(experiments, {
    fields: [abFeatureFlags.experimentId],
    references: [experiments.id],
  }),
  createdBy: one(users, {
    fields: [abFeatureFlags.createdBy],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [abFeatureFlags.updatedBy],
    references: [users.id],
  }),
}));
