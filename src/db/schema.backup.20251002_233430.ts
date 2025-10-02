import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  uuid,
  index,
  unique,
  pgEnum,
  time,
  date,
} from "npm:drizzle-orm/pg-core";
import { relations, sql } from "npm:drizzle-orm";

// Enums
export const userTypeEnum = pgEnum("user_type", ["creator", "production", "investor", "viewer"]);
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "creator", "pro", "investor"]);
export const pitchStatusEnum = pgEnum("pitch_status", ["draft", "published", "hidden", "archived"]);
export const ndaTypeEnum = pgEnum("nda_type", ["basic", "enhanced", "custom"]);
export const genreEnum = pgEnum("genre", [
  "drama", "comedy", "thriller", "horror", "scifi", "fantasy",
  "documentary", "animation", "action", "romance", "other"
]);
export const formatEnum = pgEnum("format", ["feature", "tv", "short", "webseries", "other"]);

// Email notification enums
export const notificationFrequencyEnum = pgEnum("notification_frequency", ["instant", "daily", "weekly", "never"]);
export const emailStatusEnum = pgEnum("email_status", ["pending", "sent", "delivered", "bounced", "failed", "unsubscribed"]);

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  userType: userTypeEnum("user_type").notNull().default("viewer"),
  
  // Profile Information
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  location: varchar("location", { length: 200 }),
  bio: text("bio"),
  profileImage: text("profile_image_url"),
  
  // Company Information (for production/investors)
  companyName: text("company_name"),
  companyNumber: varchar("company_number", { length: 100 }),
  companyWebsite: text("company_website"),
  companyAddress: text("company_address"),
  
  // Verification & Status
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerifiedAt: timestamp("email_verified_at"),
  companyVerified: boolean("company_verified").default(false),
  isActive: boolean("is_active").default(true),
  
  // Account Security
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  accountLockedAt: timestamp("account_locked_at"),
  accountLockReason: varchar("account_lock_reason", { length: 200 }),
  lastPasswordChangeAt: timestamp("last_password_change_at"),
  passwordHistory: jsonb("password_history").$type<Array<{
    hash: string;
    changedAt: string;
  }>>().default([]),
  requirePasswordChange: boolean("require_password_change").default(false),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  
  // Subscription Information
  subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  
  // Metadata
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: index("users_email_idx").on(table.email),
    usernameIdx: index("users_username_idx").on(table.username),
    userTypeIdx: index("users_user_type_idx").on(table.userType),
  };
});

// Pitches Table
export const pitches = pgTable("pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Basic Information
  title: varchar("title", { length: 255 }).notNull(),
  logline: text("logline").notNull(),
  genre: varchar("genre", { length: 100 }),
  format: varchar("format", { length: 100 }),
  
  // Content
  shortSynopsis: text("short_synopsis"),
  longSynopsis: text("long_synopsis"),
  // Fields that don't exist in production DB:
  // opener: text("opener"),
  // premise: text("premise"),
  // targetAudience: text("target_audience"),
  
  // Structured Data - NOT IN PRODUCTION DB
  // characters: jsonb("characters"),
  // themes: jsonb("themes"),
  // episodeBreakdown: jsonb("episode_breakdown"),
  
  // Budget & Production
  budget: varchar("budget", { length: 100 }),
  // Fields not in production:
  // budgetBracket: varchar("budget_bracket", { length: 50 }),
  // estimatedBudget: decimal("estimated_budget", { precision: 12, scale: 2 }),
  
  // Media
  thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
  lookbookUrl: varchar("lookbook_url", { length: 500 }),
  pitchDeckUrl: varchar("pitch_deck_url", { length: 500 }),
  scriptUrl: varchar("script_url", { length: 500 }),
  trailerUrl: varchar("trailer_url", { length: 500 }),
  // Not in production:
  // titleImage: text("title_image"),
  // productionTimeline: text("production_timeline"),
  // additionalMedia: jsonb("additional_media"),
  
  // Visibility Settings - NOT IN PRODUCTION
  // visibilitySettings: jsonb("visibility_settings"),
  
  // Status & Metrics
  status: varchar("status", { length: 50 }).default("draft"),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  ndaCount: integer("nda_count").default(0),
  
  // NDA Requirement
  requireNda: boolean("require_nda").default(false),
  // Not in production:
  // aiUsed: boolean("ai_used").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("pitches_user_id_idx").on(table.userId),
    statusIdx: index("pitches_status_idx").on(table.status),
    genreIdx: index("pitches_genre_idx").on(table.genre),
    formatIdx: index("pitches_format_idx").on(table.format),
    titleSearchIdx: index("pitches_title_search_idx").on(table.title),
  };
});

// NDA Requests Table (tracks pending requests)
export const ndaRequests = pgTable("nda_requests", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").notNull().references(() => pitches.id, { onDelete: "cascade" }),
  requesterId: integer("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Request Details
  ndaType: ndaTypeEnum("nda_type").notNull().default("basic"),
  requestMessage: text("request_message"),
  companyInfo: jsonb("company_info").$type<{
    companyName: string;
    position: string;
    intendedUse: string;
  }>(),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, rejected, expired
  rejectionReason: text("rejection_reason"),
  
  // Timestamps
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"),
}, (table) => {
  return {
    pitchRequesterUnique: unique().on(table.pitchId, table.requesterId),
    pitchIdIdx: index("nda_requests_pitch_id_idx").on(table.pitchId),
    requesterIdIdx: index("nda_requests_requester_id_idx").on(table.requesterId),
    ownerIdIdx: index("nda_requests_owner_id_idx").on(table.ownerId),
    statusIdx: index("nda_requests_status_idx").on(table.status),
  };
});

// NDAs Table
export const ndas = pgTable("ndas", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").notNull().references(() => pitches.id, { onDelete: "cascade" }),
  signerId: integer("signer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ndaType: ndaTypeEnum("nda_type").notNull(),
  
  // NDA Details
  ndaVersion: varchar("nda_version", { length: 20 }).default("1.0"),
  customNdaUrl: text("custom_nda_url"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Signature
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  signatureData: jsonb("signature_data"),
  
  // Access Control
  accessGranted: boolean("access_granted").default(true),
  accessRevokedAt: timestamp("access_revoked_at"),
  expiresAt: timestamp("expires_at"),
}, (table) => {
  return {
    pitchSignerUnique: unique().on(table.pitchId, table.signerId),
    pitchIdIdx: index("ndas_pitch_id_idx").on(table.pitchId),
    signerIdIdx: index("ndas_signer_id_idx").on(table.signerId),
  };
});

// Pitch Views/Analytics Table
export const pitchViews = pgTable("pitch_views", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").notNull().references(() => pitches.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").references(() => users.id, { onDelete: "set null" }),
  
  // View Details
  viewType: varchar("view_type", { length: 20 }), // teaser, full, nda_signed
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  sessionId: varchar("session_id", { length: 100 }),
  
  // Engagement Metrics
  viewDuration: integer("view_duration"), // seconds
  scrollDepth: integer("scroll_depth"), // percentage
  clickedWatchThis: boolean("clicked_watch_this").default(false),
  
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
}, (table) => {
  return {
    pitchIdIdx: index("pitch_views_pitch_id_idx").on(table.pitchId),
    viewerIdIdx: index("pitch_views_viewer_id_idx").on(table.viewerId),
    viewedAtIdx: index("pitch_views_viewed_at_idx").on(table.viewedAt),
  };
});

// Follows/Lightbox Table
export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").references(() => users.id, { onDelete: "cascade" }),
  
  followedAt: timestamp("followed_at").defaultNow().notNull(),
}, (table) => {
  return {
    followerPitchUnique: unique().on(table.followerId, table.pitchId),
    followerCreatorUnique: unique().on(table.followerId, table.creatorId),
    followerIdx: index("follows_follower_id_idx").on(table.followerId),
  };
});

// Conversations Table (for grouping messages)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Conversation metadata
  title: varchar("title", { length: 200 }),
  isGroup: boolean("is_group").default(false),
  lastMessageAt: timestamp("last_message_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    pitchIdx: index("conversations_pitch_id_idx").on(table.pitchId),
    createdByIdx: index("conversations_created_by_id_idx").on(table.createdById),
    lastMessageIdx: index("conversations_last_message_at_idx").on(table.lastMessageAt),
  };
});

// Conversation Participants
export const conversationParticipants = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Participant settings
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
  
  // Notification preferences
  muteNotifications: boolean("mute_notifications").default(false),
  
}, (table) => {
  return {
    conversationUserUnique: unique().on(table.conversationId, table.userId),
    conversationIdx: index("conversation_participants_conversation_id_idx").on(table.conversationId),
    userIdx: index("conversation_participants_user_id_idx").on(table.userId),
  };
});

// Messages Table (Enhanced)
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id").references(() => users.id, { onDelete: "cascade" }),
  parentMessageId: integer("parent_message_id").references(() => messages.id, { onDelete: "cascade" }), // For threading
  
  // Message content
  subject: varchar("subject", { length: 200 }),
  content: text("content").notNull(),
  messageType: varchar("message_type", { length: 50 }).default("text"), // text, image, file, system
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    type: 'image' | 'document' | 'video' | 'audio';
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  }>>(),
  
  // Status flags
  isRead: boolean("is_read").default(false),
  isEdited: boolean("is_edited").default(false),
  isDeleted: boolean("is_deleted").default(false),
  
  // Off-Platform Request
  offPlatformRequested: boolean("off_platform_requested").default(false),
  offPlatformApproved: boolean("off_platform_approved").default(false),
  
  // Timestamps
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
}, (table) => {
  return {
    conversationIdx: index("messages_conversation_id_idx").on(table.conversationId),
    senderIdx: index("messages_sender_id_idx").on(table.senderId),
    receiverIdx: index("messages_receiver_id_idx").on(table.receiverId),
    pitchIdx: index("messages_pitch_id_idx").on(table.pitchId),
    parentIdx: index("messages_parent_message_id_idx").on(table.parentMessageId),
    sentAtIdx: index("messages_sent_at_idx").on(table.sentAt),
  };
});

// Message Read Receipts
export const messageReadReceipts = pgTable("message_read_receipts", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  deliveredAt: timestamp("delivered_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
}, (table) => {
  return {
    messageUserUnique: unique().on(table.messageId, table.userId),
    messageIdx: index("message_read_receipts_message_id_idx").on(table.messageId),
    userIdx: index("message_read_receipts_user_id_idx").on(table.userId),
  };
});

// Typing Indicators (for real-time typing status)
export const typingIndicators = pgTable("typing_indicators", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  isTyping: boolean("is_typing").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    conversationUserUnique: unique().on(table.conversationId, table.userId),
    conversationIdx: index("typing_indicators_conversation_id_idx").on(table.conversationId),
    updatedAtIdx: index("typing_indicators_updated_at_idx").on(table.updatedAt),
  };
});

// Enums for payment system
export const subscriptionTierNewEnum = pgEnum("subscription_tier_new", ["BASIC", "PRO", "ENTERPRISE"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["subscription", "credits", "success_fee", "refund"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "refunded"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "void"]);
export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", ["purchase", "usage", "refund", "bonus"]);

// Payments/Transactions Table (Enhanced)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Transaction details
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Stripe integration
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSessionId: text("stripe_session_id"),
  
  // Status and processing
  status: transactionStatusEnum("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
  
  // Metadata and description
  description: text("description"),
  metadata: jsonb("metadata").$type<{
    subscriptionTier?: string;
    creditAmount?: number;
    dealId?: string;
    originalAmount?: string;
  }>(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
}, (table) => {
  return {
    userIdx: index("payments_user_id_idx").on(table.userId),
    statusIdx: index("payments_status_idx").on(table.status),
    typeIdx: index("payments_type_idx").on(table.type),
    stripePaymentIntentIdx: index("payments_stripe_payment_intent_idx").on(table.stripePaymentIntentId),
    createdAtIdx: index("payments_created_at_idx").on(table.createdAt),
  };
});

// Credit Transactions Table
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  paymentId: integer("payment_id").references(() => payments.id, { onDelete: "set null" }),
  
  // Transaction details
  type: creditTransactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // positive for credit, negative for debit
  description: text("description").notNull(),
  
  // Balance tracking
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  
  // Usage tracking
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "set null" }),
  usageType: varchar("usage_type", { length: 50 }), // view, upload, message, etc.
  
  // Metadata
  metadata: jsonb("metadata").$type<{
    packageType?: string;
    originalPrice?: string;
    bonusCredits?: number;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("credit_transactions_user_id_idx").on(table.userId),
    typeIdx: index("credit_transactions_type_idx").on(table.type),
    createdAtIdx: index("credit_transactions_created_at_idx").on(table.createdAt),
    paymentIdx: index("credit_transactions_payment_id_idx").on(table.paymentId),
  };
});

// User Credits Balance
export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  balance: integer("balance").notNull().default(0),
  totalPurchased: integer("total_purchased").notNull().default(0),
  totalUsed: integer("total_used").notNull().default(0),
  
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("user_credits_user_id_idx").on(table.userId),
  };
});

// Subscription History
export const subscriptionHistory = pgTable("subscription_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Subscription details
  tier: subscriptionTierNewEnum("tier").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  
  // Period details
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 20 }).notNull(), // active, canceled, expired
  
  // Billing
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  billingInterval: varchar("billing_interval", { length: 20 }), // monthly, yearly
  
  // Metadata
  metadata: jsonb("metadata").$type<{
    cancelReason?: string;
    upgradeFromTier?: string;
    downgradeToTier?: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  canceledAt: timestamp("canceled_at"),
}, (table) => {
  return {
    userIdx: index("subscription_history_user_id_idx").on(table.userId),
    statusIdx: index("subscription_history_status_idx").on(table.status),
    stripeSubscriptionIdx: index("subscription_history_stripe_subscription_idx").on(table.stripeSubscriptionId),
  };
});

// Success Fee Deals
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").notNull().references(() => pitches.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  investorId: integer("investor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Deal details
  dealValue: decimal("deal_value", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  successFeePercentage: decimal("success_fee_percentage", { precision: 5, scale: 2 }).default("3.00"),
  successFeeAmount: decimal("success_fee_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Status tracking
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, confirmed, paid, disputed
  confirmedAt: timestamp("confirmed_at"),
  paidAt: timestamp("paid_at"),
  
  // Deal metadata
  description: text("description"),
  contractDetails: jsonb("contract_details").$type<{
    dealType: string;
    terms: string;
    conditions: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    pitchIdx: index("deals_pitch_id_idx").on(table.pitchId),
    creatorIdx: index("deals_creator_id_idx").on(table.creatorId),
    investorIdx: index("deals_investor_id_idx").on(table.investorId),
    statusIdx: index("deals_status_idx").on(table.status),
  };
});

// Invoices
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  paymentId: integer("payment_id").references(() => payments.id, { onDelete: "set null" }),
  
  // Invoice details
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Status and dates
  status: invoiceStatusEnum("status").notNull().default("draft"),
  issuedAt: timestamp("issued_at"),
  dueAt: timestamp("due_at"),
  paidAt: timestamp("paid_at"),
  
  // Content
  description: text("description").notNull(),
  lineItems: jsonb("line_items").$type<Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    amount: string;
  }>>(),
  
  // Billing information
  billingAddress: jsonb("billing_address").$type<{
    name: string;
    company?: string;
    address: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  }>(),
  
  // File storage
  pdfUrl: text("pdf_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("invoices_user_id_idx").on(table.userId),
    statusIdx: index("invoices_status_idx").on(table.status),
    invoiceNumberIdx: index("invoices_invoice_number_idx").on(table.invoiceNumber),
    dealIdx: index("invoices_deal_id_idx").on(table.dealId),
  };
});

// Payment Methods
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Stripe details
  stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  
  // Card details (stored by Stripe, we just keep metadata)
  type: varchar("type", { length: 20 }).notNull(), // card, bank_account, etc.
  cardBrand: varchar("card_brand", { length: 20 }),
  cardLast4: varchar("card_last4", { length: 4 }),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  
  // Status
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("payment_methods_user_id_idx").on(table.userId),
    stripePaymentMethodIdx: index("payment_methods_stripe_payment_method_idx").on(table.stripePaymentMethodId),
    defaultIdx: index("payment_methods_default_idx").on(table.isDefault),
  };
});

// Keep legacy transactions table for backward compatibility
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  
  type: varchar("type", { length: 50 }).notNull(), // subscription, pitch_upload
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  status: varchar("status", { length: 50 }).notNull(), // pending, completed, failed
  
  description: text("description"),
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => {
  return {
    userIdx: index("transactions_user_id_idx").on(table.userId),
    statusIdx: index("transactions_status_idx").on(table.status),
  };
});

// Analytics enums
export const eventTypeEnum = pgEnum("event_type", [
  "view", "click", "scroll", "video_play", "video_pause", "video_complete", 
  "download", "signup", "login", "logout", "nda_request", "nda_signed", 
  "follow", "unfollow", "message_sent", "profile_update", "search", "filter"
]);

export const aggregationPeriodEnum = pgEnum("aggregation_period", [
  "hourly", "daily", "weekly", "monthly", "yearly"
]);

export const funnelStageEnum = pgEnum("funnel_stage", [
  "view", "engagement", "nda_request", "nda_signed", "contact", "deal"
]);

// Analytics Events Table - Comprehensive event tracking
export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  
  // Event identification
  eventId: uuid("event_id").defaultRandom().notNull(),
  eventType: eventTypeEnum("event_type").notNull(),
  category: varchar("category", { length: 50 }), // page, interaction, conversion, etc.
  
  // User and session tracking
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 100 }),
  anonymousId: varchar("anonymous_id", { length: 100 }), // For non-logged in users
  
  // Context information
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => messages.id, { onDelete: "cascade" }),
  
  // Technical tracking
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  pathname: text("pathname"),
  
  // Geographic and device info
  country: varchar("country", { length: 3 }),
  region: varchar("region", { length: 100 }),
  city: varchar("city", { length: 100 }),
  deviceType: varchar("device_type", { length: 20 }), // desktop, mobile, tablet
  browser: varchar("browser", { length: 50 }),
  os: varchar("os", { length: 50 }),
  
  // Event-specific data
  eventData: jsonb("event_data").$type<{
    // For view events
    viewDuration?: number;
    scrollDepth?: number;
    
    // For video events
    videoPosition?: number;
    videoDuration?: number;
    
    // For click events
    elementId?: string;
    elementText?: string;
    clickPosition?: { x: number; y: number };
    
    // For search events
    query?: string;
    resultsCount?: number;
    filters?: Record<string, any>;
    
    // For conversion events
    value?: number;
    currency?: string;
    
    // Additional metadata
    [key: string]: any;
  }>(),
  
  // A/B testing
  experiments: jsonb("experiments").$type<Array<{
    experimentId: string;
    variantId: string;
  }>>(),
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
}, (table) => {
  return {
    eventIdIdx: index("analytics_events_event_id_idx").on(table.eventId),
    eventTypeIdx: index("analytics_events_event_type_idx").on(table.eventType),
    userIdIdx: index("analytics_events_user_id_idx").on(table.userId),
    sessionIdIdx: index("analytics_events_session_id_idx").on(table.sessionId),
    pitchIdIdx: index("analytics_events_pitch_id_idx").on(table.pitchId),
    timestampIdx: index("analytics_events_timestamp_idx").on(table.timestamp),
    categoryIdx: index("analytics_events_category_idx").on(table.category),
    countryIdx: index("analytics_events_country_idx").on(table.country),
    deviceTypeIdx: index("analytics_events_device_type_idx").on(table.deviceType),
  };
});

// User Sessions Table - Track user sessions for analytics
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull().unique(),
  
  // User identification
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  anonymousId: varchar("anonymous_id", { length: 100 }),
  
  // Session metadata
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  pageViews: integer("page_views").default(0),
  eventCount: integer("event_count").default(0),
  
  // Entry and exit information
  entryPage: text("entry_page"),
  exitPage: text("exit_page"),
  referrer: text("referrer"),
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),
  
  // Technical information
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Geographic and device info
  country: varchar("country", { length: 3 }),
  region: varchar("region", { length: 100 }),
  city: varchar("city", { length: 100 }),
  deviceType: varchar("device_type", { length: 20 }),
  browser: varchar("browser", { length: 50 }),
  os: varchar("os", { length: 50 }),
  
  // Engagement metrics
  bounced: boolean("bounced").default(true), // Single page session
  converted: boolean("converted").default(false), // Had conversion event
  conversionValue: decimal("conversion_value", { precision: 12, scale: 2 }),
  
  // Session quality
  engagementScore: decimal("engagement_score", { precision: 5, scale: 2 }), // 0-100
  
  isActive: boolean("is_active").default(true),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
}, (table) => {
  return {
    sessionIdIdx: index("user_sessions_session_id_idx").on(table.sessionId),
    userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
    startTimeIdx: index("user_sessions_start_time_idx").on(table.startTime),
    countryIdx: index("user_sessions_country_idx").on(table.country),
    deviceTypeIdx: index("user_sessions_device_type_idx").on(table.deviceType),
    convertedIdx: index("user_sessions_converted_idx").on(table.converted),
    isActiveIdx: index("user_sessions_is_active_idx").on(table.isActive),
  };
});

// Analytics Aggregates Table - Pre-computed metrics for performance
export const analyticsAggregates = pgTable("analytics_aggregates", {
  id: serial("id").primaryKey(),
  
  // Aggregation metadata
  period: aggregationPeriodEnum("period").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Dimension keys
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  eventType: eventTypeEnum("event_type"),
  country: varchar("country", { length: 3 }),
  deviceType: varchar("device_type", { length: 20 }),
  userType: userTypeEnum("user_type"),
  
  // Metrics
  eventCount: integer("event_count").default(0),
  uniqueUsers: integer("unique_users").default(0),
  uniqueSessions: integer("unique_sessions").default(0),
  totalDuration: integer("total_duration").default(0), // in seconds
  averageDuration: decimal("average_duration", { precision: 10, scale: 2 }),
  
  // Engagement metrics
  totalScrollDepth: integer("total_scroll_depth").default(0),
  averageScrollDepth: decimal("average_scroll_depth", { precision: 5, scale: 2 }),
  bounceRate: decimal("bounce_rate", { precision: 5, scale: 2 }),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }),
  
  // Revenue metrics
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  averageOrderValue: decimal("average_order_value", { precision: 10, scale: 2 }),
  
  // Additional metrics stored as JSON for flexibility
  additionalMetrics: jsonb("additional_metrics").$type<{
    topPages?: Array<{ page: string; views: number }>;
    topReferrers?: Array<{ referrer: string; sessions: number }>;
    hourlyDistribution?: Record<string, number>;
    [key: string]: any;
  }>(),
  
  // Processing metadata
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  version: varchar("version", { length: 10 }).default("1.0"), // For schema evolution
}, (table) => {
  return {
    periodIdx: index("analytics_aggregates_period_idx").on(table.period, table.periodStart),
    userIdIdx: index("analytics_aggregates_user_id_idx").on(table.userId),
    pitchIdIdx: index("analytics_aggregates_pitch_id_idx").on(table.pitchId),
    eventTypeIdx: index("analytics_aggregates_event_type_idx").on(table.eventType),
    countryIdx: index("analytics_aggregates_country_idx").on(table.country),
    deviceTypeIdx: index("analytics_aggregates_device_type_idx").on(table.deviceType),
    periodStartIdx: index("analytics_aggregates_period_start_idx").on(table.periodStart),
  };
});

// Conversion Funnels Table - Track user progression through defined funnels
export const conversionFunnels = pgTable("conversion_funnels", {
  id: serial("id").primaryKey(),
  
  // Funnel identification
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  
  // Funnel configuration
  stages: jsonb("stages").$type<Array<{
    stageId: string;
    name: string;
    description?: string;
    eventType: string;
    filters?: Record<string, any>;
    timeoutMinutes?: number; // Stage timeout
  }>>().notNull(),
  
  // Funnel settings
  isActive: boolean("is_active").default(true),
  timeWindowHours: integer("time_window_hours").default(24), // Max time to complete funnel
  
  // A/B testing
  experimentId: varchar("experiment_id", { length: 100 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    nameIdx: index("conversion_funnels_name_idx").on(table.name),
    experimentIdIdx: index("conversion_funnels_experiment_id_idx").on(table.experimentId),
    isActiveIdx: index("conversion_funnels_is_active_idx").on(table.isActive),
  };
});

// Funnel Events Table - Track user progression through funnels
export const funnelEvents = pgTable("funnel_events", {
  id: serial("id").primaryKey(),
  
  // Event identification
  funnelId: integer("funnel_id").notNull().references(() => conversionFunnels.id, { onDelete: "cascade" }),
  stageId: varchar("stage_id", { length: 100 }).notNull(),
  
  // User identification
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 100 }),
  anonymousId: varchar("anonymous_id", { length: 100 }),
  
  // Event tracking
  eventId: uuid("event_id").references(() => analyticsEvents.eventId, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  
  // Funnel progression
  funnelSessionId: varchar("funnel_session_id", { length: 100 }), // Groups related funnel events
  stageOrder: integer("stage_order").notNull(),
  isCompleted: boolean("is_completed").default(false),
  timeToComplete: integer("time_to_complete"), // seconds from first stage
  
  // A/B testing
  experimentVariant: varchar("experiment_variant", { length: 50 }),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => {
  return {
    funnelIdIdx: index("funnel_events_funnel_id_idx").on(table.funnelId),
    userIdIdx: index("funnel_events_user_id_idx").on(table.userId),
    sessionIdIdx: index("funnel_events_session_id_idx").on(table.sessionId),
    funnelSessionIdIdx: index("funnel_events_funnel_session_id_idx").on(table.funnelSessionId),
    timestampIdx: index("funnel_events_timestamp_idx").on(table.timestamp),
    stageOrderIdx: index("funnel_events_stage_order_idx").on(table.stageOrder),
  };
});

// User Cohorts Table - Track user cohorts for retention analysis
export const userCohorts = pgTable("user_cohorts", {
  id: serial("id").primaryKey(),
  
  // Cohort identification
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  cohortType: varchar("cohort_type", { length: 50 }).notNull(), // registration, first_pitch, first_nda, etc.
  
  // Time period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Filters for cohort definition
  filters: jsonb("filters").$type<{
    userType?: string[];
    country?: string[];
    deviceType?: string[];
    utmSource?: string[];
    minEngagementScore?: number;
    [key: string]: any;
  }>(),
  
  // Cohort metrics
  totalUsers: integer("total_users").default(0),
  activeUsers: integer("active_users").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    nameIdx: index("user_cohorts_name_idx").on(table.name),
    cohortTypeIdx: index("user_cohorts_cohort_type_idx").on(table.cohortType),
    periodStartIdx: index("user_cohorts_period_start_idx").on(table.periodStart),
  };
});

// Cohort Users Table - Track which users belong to which cohorts
export const cohortUsers = pgTable("cohort_users", {
  id: serial("id").primaryKey(),
  
  cohortId: integer("cohort_id").notNull().references(() => userCohorts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // User status in cohort
  joinedAt: timestamp("joined_at").notNull(),
  lastActiveAt: timestamp("last_active_at"),
  
  // Retention tracking
  isRetained: boolean("is_retained").default(false),
  retentionPeriods: jsonb("retention_periods").$type<{
    day1?: boolean;
    day7?: boolean;
    day30?: boolean;
    day90?: boolean;
    day365?: boolean;
  }>(),
  
  // Lifetime value
  lifetimeValue: decimal("lifetime_value", { precision: 12, scale: 2 }).default("0"),
  totalEvents: integer("total_events").default(0),
  totalSessions: integer("total_sessions").default(0),
}, (table) => {
  return {
    cohortUserUnique: unique().on(table.cohortId, table.userId),
    cohortIdIdx: index("cohort_users_cohort_id_idx").on(table.cohortId),
    userIdIdx: index("cohort_users_user_id_idx").on(table.userId),
    isRetainedIdx: index("cohort_users_is_retained_idx").on(table.isRetained),
  };
});

// Real-time Analytics Cache - For fast real-time queries
export const realtimeAnalytics = pgTable("realtime_analytics", {
  id: serial("id").primaryKey(),
  
  // Cache key
  cacheKey: varchar("cache_key", { length: 200 }).notNull().unique(),
  
  // Cached data
  data: jsonb("data").notNull(),
  
  // Cache metadata
  expiresAt: timestamp("expires_at").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  version: integer("version").default(1),
}, (table) => {
  return {
    cacheKeyIdx: index("realtime_analytics_cache_key_idx").on(table.cacheKey),
    expiresAtIdx: index("realtime_analytics_expires_at_idx").on(table.expiresAt),
  };
});

// Notifications Table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  type: varchar("type", { length: 50 }).notNull(), // nda_request, nda_approved, nda_rejected, message, follow, off_platform_approved
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  
  // Related entities
  relatedPitchId: integer("related_pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  relatedUserId: integer("related_user_id").references(() => users.id, { onDelete: "cascade" }),
  relatedNdaRequestId: integer("related_nda_request_id").references(() => ndaRequests.id, { onDelete: "cascade" }),
  
  // Status
  isRead: boolean("is_read").default(false),
  actionUrl: text("action_url"), // URL to navigate to when clicked
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
}, (table) => {
  return {
    userIdIdx: index("notifications_user_id_idx").on(table.userId),
    isReadIdx: index("notifications_is_read_idx").on(table.isRead),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  };
});

// Sessions Table (for auth)
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  token: text("token").notNull().unique(),
  refreshToken: text("refresh_token").unique(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  fingerprint: text("fingerprint"), // Browser fingerprint for session validation
  
  expiresAt: timestamp("expires_at").notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at"),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("sessions_user_id_idx").on(table.userId),
    tokenIdx: index("sessions_token_idx").on(table.token),
    refreshTokenIdx: index("sessions_refresh_token_idx").on(table.refreshToken),
  };
});

// Password Reset Tokens Table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  token: text("token").notNull().unique(),
  tokenHash: text("token_hash").notNull().unique(), // Store hashed version
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  used: boolean("used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("password_reset_tokens_user_id_idx").on(table.userId),
    tokenHashIdx: index("password_reset_tokens_token_hash_idx").on(table.tokenHash),
    expiresAtIdx: index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  };
});

// Email Verification Tokens Table
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  email: varchar("email", { length: 255 }).notNull(), // Email being verified
  token: text("token").notNull().unique(),
  tokenHash: text("token_hash").notNull().unique(),
  
  verified: boolean("verified").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("email_verification_tokens_user_id_idx").on(table.userId),
    tokenHashIdx: index("email_verification_tokens_token_hash_idx").on(table.tokenHash),
    emailIdx: index("email_verification_tokens_email_idx").on(table.email),
  };
});

// Login Attempts Table
export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  
  email: varchar("email", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  
  successful: boolean("successful").default(false),
  failureReason: varchar("failure_reason", { length: 100 }), // wrong_password, account_locked, etc.
  
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: index("login_attempts_email_idx").on(table.email),
    ipAddressIdx: index("login_attempts_ip_address_idx").on(table.ipAddress),
    attemptedAtIdx: index("login_attempts_attempted_at_idx").on(table.attemptedAt),
  };
});

// Two-Factor Authentication Table
export const twoFactorAuth = pgTable("two_factor_auth", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  secret: text("secret").notNull(), // Encrypted TOTP secret
  enabled: boolean("enabled").default(false),
  verifiedAt: timestamp("verified_at"),
  
  // Backup codes
  backupCodes: jsonb("backup_codes").$type<Array<{
    code: string;
    used: boolean;
    usedAt?: string;
  }>>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index("two_factor_auth_user_id_idx").on(table.userId),
  };
});

// Security Events Table (for audit logging)
export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 50 }).notNull(), // login, logout, password_reset, account_locked, etc.
  eventStatus: varchar("event_status", { length: 20 }).notNull(), // success, failure, warning
  
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  location: jsonb("location").$type<{
    country?: string;
    city?: string;
    region?: string;
  }>(),
  
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("security_events_user_id_idx").on(table.userId),
    eventTypeIdx: index("security_events_event_type_idx").on(table.eventType),
    createdAtIdx: index("security_events_created_at_idx").on(table.createdAt),
  };
});

// Define Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  pitches: many(pitches),
  signedNdas: many(ndas),
  sentMessages: many(messages),
  receivedMessages: many(messages),
  conversations: many(conversations),
  conversationParticipants: many(conversationParticipants),
  messageReadReceipts: many(messageReadReceipts),
  typingIndicators: many(typingIndicators),
  follows: many(follows),
  sessions: many(sessions),
  transactions: many(transactions),
  payments: many(payments),
  creditTransactions: many(creditTransactions),
  userCredits: one(userCredits),
  subscriptionHistory: many(subscriptionHistory),
  createdDeals: many(deals),
  investorDeals: many(deals),
  invoices: many(invoices),
  paymentMethods: many(paymentMethods),
  emailPreferences: one(emailPreferences),
  emailQueue: many(emailQueue),
  unsubscribeTokens: many(unsubscribeTokens),
  digestHistory: many(digestHistory),
}));

export const pitchesRelations = relations(pitches, ({ one, many }) => ({
  creator: one(users, {
    fields: [pitches.userId],
    references: [users.id],
  }),
  ndas: many(ndas),
  views: many(pitchViews),
  messages: many(messages),
  conversations: many(conversations),
  follows: many(follows),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [conversations.createdById],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [conversations.pitchId],
    references: [pitches.id],
  }),
  participants: many(conversationParticipants),
  messages: many(messages),
  typingIndicators: many(typingIndicators),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  pitch: one(pitches, {
    fields: [messages.pitchId],
    references: [pitches.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
  }),
  parentMessage: one(messages, {
    fields: [messages.parentMessageId],
    references: [messages.id],
  }),
  replies: many(messages),
  readReceipts: many(messageReadReceipts),
}));

export const messageReadReceiptsRelations = relations(messageReadReceipts, ({ one }) => ({
  message: one(messages, {
    fields: [messageReadReceipts.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReadReceipts.userId],
    references: [users.id],
  }),
}));

export const typingIndicatorsRelations = relations(typingIndicators, ({ one }) => ({
  conversation: one(conversations, {
    fields: [typingIndicators.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [typingIndicators.userId],
    references: [users.id],
  }),
}));

export const ndasRelations = relations(ndas, ({ one }) => ({
  pitch: one(pitches, {
    fields: [ndas.pitchId],
    references: [pitches.id],
  }),
  signer: one(users, {
    fields: [ndas.signerId],
    references: [users.id],
  }),
}));

// Payment system relations
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  creditTransactions: many(creditTransactions),
  invoices: many(invoices),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
  payment: one(payments, {
    fields: [creditTransactions.paymentId],
    references: [payments.id],
  }),
  pitch: one(pitches, {
    fields: [creditTransactions.pitchId],
    references: [pitches.id],
  }),
}));

export const userCreditsRelations = relations(userCredits, ({ one }) => ({
  user: one(users, {
    fields: [userCredits.userId],
    references: [users.id],
  }),
}));

export const subscriptionHistoryRelations = relations(subscriptionHistory, ({ one }) => ({
  user: one(users, {
    fields: [subscriptionHistory.userId],
    references: [users.id],
  }),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  pitch: one(pitches, {
    fields: [deals.pitchId],
    references: [pitches.id],
  }),
  creator: one(users, {
    fields: [deals.creatorId],
    references: [users.id],
  }),
  investor: one(users, {
    fields: [deals.investorId],
    references: [users.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  deal: one(deals, {
    fields: [invoices.dealId],
    references: [deals.id],
  }),
  payment: one(payments, {
    fields: [invoices.paymentId],
    references: [payments.id],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  user: one(users, {
    fields: [paymentMethods.userId],
    references: [users.id],
  }),
}));

// Analytics relations
export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [analyticsEvents.pitchId],
    references: [pitches.id],
  }),
  conversation: one(conversations, {
    fields: [analyticsEvents.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [analyticsEvents.messageId],
    references: [messages.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
  events: many(analyticsEvents),
}));

export const analyticsAggregatesRelations = relations(analyticsAggregates, ({ one }) => ({
  user: one(users, {
    fields: [analyticsAggregates.userId],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [analyticsAggregates.pitchId],
    references: [pitches.id],
  }),
}));

export const conversionFunnelsRelations = relations(conversionFunnels, ({ many }) => ({
  funnelEvents: many(funnelEvents),
}));

export const funnelEventsRelations = relations(funnelEvents, ({ one }) => ({
  funnel: one(conversionFunnels, {
    fields: [funnelEvents.funnelId],
    references: [conversionFunnels.id],
  }),
  user: one(users, {
    fields: [funnelEvents.userId],
    references: [users.id],
  }),
  event: one(analyticsEvents, {
    fields: [funnelEvents.eventId],
    references: [analyticsEvents.eventId],
  }),
  pitch: one(pitches, {
    fields: [funnelEvents.pitchId],
    references: [pitches.id],
  }),
}));

export const userCohortsRelations = relations(userCohorts, ({ many }) => ({
  cohortUsers: many(cohortUsers),
}));

export const cohortUsersRelations = relations(cohortUsers, ({ one }) => ({
  cohort: one(userCohorts, {
    fields: [cohortUsers.cohortId],
    references: [userCohorts.id],
  }),
  user: one(users, {
    fields: [cohortUsers.userId],
    references: [users.id],
  }),
}));

// Email Notification Tables
export const emailPreferences = pgTable("email_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // General email settings
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  welcomeEmails: boolean("welcome_emails").default(true).notNull(),
  
  // NDA notifications
  ndaRequests: boolean("nda_requests").default(true).notNull(),
  ndaResponses: boolean("nda_responses").default(true).notNull(),
  
  // Message notifications
  messageNotifications: notificationFrequencyEnum("message_notifications").default("instant").notNull(),
  
  // Pitch notifications
  pitchViewNotifications: boolean("pitch_view_notifications").default(true).notNull(),
  
  // Payment notifications
  paymentConfirmations: boolean("payment_confirmations").default(true).notNull(),
  
  // Digest and marketing
  weeklyDigest: boolean("weekly_digest").default(true).notNull(),
  marketingEmails: boolean("marketing_emails").default(false).notNull(),
  
  // Security alerts (always enabled by default)
  securityAlerts: boolean("security_alerts").default(true).notNull(),
  
  // Digest scheduling
  digestDay: integer("digest_day").default(1).notNull(), // 1=Monday, 7=Sunday
  digestTime: time("digest_time").default("09:00:00").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("email_preferences_user_id_idx").on(table.userId),
  };
});

// Email Queue for batch sending
export const emailQueue = pgTable("email_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Email addresses
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  ccEmails: text("cc_emails"),
  bccEmails: text("bcc_emails"),
  
  // Email content
  subject: varchar("subject", { length: 500 }).notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  
  // Metadata
  emailType: varchar("email_type", { length: 50 }).notNull(),
  templateData: jsonb("template_data"),
  priority: integer("priority").default(5).notNull(), // 1=highest, 10=lowest
  
  // Status tracking
  status: emailStatusEnum("status").default("pending").notNull(),
  providerId: varchar("provider_id", { length: 100 }),
  providerMessageId: varchar("provider_message_id", { length: 200 }),
  trackingId: varchar("tracking_id", { length: 100 }),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for"),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  lastAttemptAt: timestamp("last_attempt_at"),
  
  // Delivery tracking
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    statusIdx: index("email_queue_status_idx").on(table.status),
    scheduledForIdx: index("email_queue_scheduled_for_idx").on(table.scheduledFor),
    userIdIdx: index("email_queue_user_id_idx").on(table.userId),
    emailTypeIdx: index("email_queue_email_type_idx").on(table.emailType),
    createdAtIdx: index("email_queue_created_at_idx").on(table.createdAt),
  };
});

// Email tracking events
export const emailEvents = pgTable("email_events", {
  id: serial("id").primaryKey(),
  emailQueueId: integer("email_queue_id").notNull().references(() => emailQueue.id, { onDelete: "cascade" }),
  
  // Event details
  eventType: varchar("event_type", { length: 50 }).notNull(), // sent, delivered, opened, clicked, bounced, complained, unsubscribed
  eventData: jsonb("event_data"),
  
  // Client information
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => {
  return {
    emailQueueIdIdx: index("email_events_email_queue_id_idx").on(table.emailQueueId),
    eventTypeIdx: index("email_events_event_type_idx").on(table.eventType),
    timestampIdx: index("email_events_timestamp_idx").on(table.timestamp),
  };
});

// Unsubscribe tokens and management
export const unsubscribeTokens = pgTable("unsubscribe_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  token: varchar("token", { length: 100 }).notNull().unique(),
  emailType: varchar("email_type", { length: 50 }), // specific type to unsubscribe from, null = all
  
  expiresAt: timestamp("expires_at"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    tokenIdx: index("unsubscribe_tokens_token_idx").on(table.token),
    userIdIdx: index("unsubscribe_tokens_user_id_idx").on(table.userId),
  };
});

// Email suppression list (bounces, complaints, unsubscribes)
export const emailSuppression = pgTable("email_suppression", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  
  suppressionType: varchar("suppression_type", { length: 50 }).notNull(), // bounce, complaint, unsubscribe
  reason: text("reason"),
  bounceType: varchar("bounce_type", { length: 50 }), // hard, soft, undetermined
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: index("email_suppression_email_idx").on(table.email),
  };
});

// Weekly digest tracking
export const digestHistory = pgTable("digest_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Date range
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  
  // Email reference
  emailQueueId: integer("email_queue_id").references(() => emailQueue.id, { onDelete: "set null" }),
  
  // Digest content
  stats: jsonb("stats").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("digest_history_user_id_idx").on(table.userId),
    weekStartIdx: index("digest_history_week_start_idx").on(table.weekStart),
    userWeekUnique: unique().on(table.userId, table.weekStart),
  };
});

// Email notification relations
export const emailPreferencesRelations = relations(emailPreferences, ({ one }) => ({
  user: one(users, {
    fields: [emailPreferences.userId],
    references: [users.id],
  }),
}));

export const emailQueueRelations = relations(emailQueue, ({ one, many }) => ({
  user: one(users, {
    fields: [emailQueue.userId],
    references: [users.id],
  }),
  events: many(emailEvents),
  digestHistory: many(digestHistory),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  emailQueue: one(emailQueue, {
    fields: [emailEvents.emailQueueId],
    references: [emailQueue.id],
  }),
}));

export const unsubscribeTokensRelations = relations(unsubscribeTokens, ({ one }) => ({
  user: one(users, {
    fields: [unsubscribeTokens.userId],
    references: [users.id],
  }),
}));

export const digestHistoryRelations = relations(digestHistory, ({ one }) => ({
  user: one(users, {
    fields: [digestHistory.userId],
    references: [users.id],
  }),
  emailQueue: one(emailQueue, {
    fields: [digestHistory.emailQueueId],
    references: [emailQueue.id],
  }),
}));

// Search tables
export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  
  // Search filters stored as JSON
  filters: jsonb("filters").$type<{
    query?: string;
    genres?: string[];
    formats?: string[];
    budgetMin?: number;
    budgetMax?: number;
    dateFrom?: string;
    dateTo?: string;
    status?: string[];
    hasNDA?: boolean;
    isFollowing?: boolean;
    hasMedia?: string[];
    viewCountMin?: number;
    viewCountMax?: number;
    likeCountMin?: number;
    likeCountMax?: number;
    ndaCountMin?: number;
    ndaCountMax?: number;
    creatorType?: 'creator' | 'production' | 'any';
    verifiedOnly?: boolean;
    location?: string;
    fundingProgress?: {
      min?: number;
      max?: number;
    };
    ndaRequirement?: 'none' | 'basic' | 'enhanced' | 'any';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }>().notNull(),
  
  // Usage tracking
  useCount: integer("use_count").default(0),
  lastUsed: timestamp("last_used"),
  
  // Settings
  isPublic: boolean("is_public").default(false),
  notifyOnResults: boolean("notify_on_results").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("saved_searches_user_id_idx").on(table.userId),
    nameIdx: index("saved_searches_name_idx").on(table.name),
    lastUsedIdx: index("saved_searches_last_used_idx").on(table.lastUsed),
  };
});

export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 100 }),
  
  // Search details
  query: text("query").notNull(),
  filters: jsonb("filters").$type<Record<string, any>>(),
  
  // Results info
  resultCount: integer("result_count").default(0),
  clickedResults: jsonb("clicked_results").$type<Array<{
    pitchId: number;
    position: number;
    clickedAt: string;
  }>>().default([]),
  
  // Performance metrics
  searchDuration: integer("search_duration"), // milliseconds
  
  // Context
  source: varchar("source", { length: 50 }).default("web"), // web, mobile, api
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  searchedAt: timestamp("searched_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("search_history_user_id_idx").on(table.userId),
    sessionIdIdx: index("search_history_session_id_idx").on(table.sessionId),
    queryIdx: index("search_history_query_idx").on(table.query),
    searchedAtIdx: index("search_history_searched_at_idx").on(table.searchedAt),
  };
});

export const searchSuggestions = pgTable("search_suggestions", {
  id: serial("id").primaryKey(),
  
  // Suggestion details
  query: varchar("query", { length: 200 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // search, genre, format, creator, title
  category: varchar("category", { length: 50 }),
  
  // Relevance and popularity
  searchCount: integer("search_count").default(1),
  clickCount: integer("click_count").default(0),
  resultCount: integer("result_count").default(0),
  
  // Metrics
  averageClickThroughRate: decimal("avg_click_through_rate", { precision: 5, scale: 4 }).default("0"),
  lastSearched: timestamp("last_searched").defaultNow().notNull(),
  
  // Status
  isActive: boolean("is_active").default(true),
  isPromoted: boolean("is_promoted").default(false), // Manually promoted suggestions
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    queryIdx: index("search_suggestions_query_idx").on(table.query),
    typeIdx: index("search_suggestions_type_idx").on(table.type),
    searchCountIdx: index("search_suggestions_search_count_idx").on(table.searchCount),
    lastSearchedIdx: index("search_suggestions_last_searched_idx").on(table.lastSearched),
    activeIdx: index("search_suggestions_active_idx").on(table.isActive),
  };
});

export const searchClickTracking = pgTable("search_click_tracking", {
  id: serial("id").primaryKey(),
  
  // Search context
  searchHistoryId: integer("search_history_id").references(() => searchHistory.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 100 }),
  
  // Click details
  pitchId: integer("pitch_id").notNull().references(() => pitches.id, { onDelete: "cascade" }),
  resultPosition: integer("result_position").notNull(), // Position in search results (1-indexed)
  query: text("query").notNull(),
  
  // Context
  source: varchar("source", { length: 50 }).default("web"),
  clickedAt: timestamp("clicked_at").defaultNow().notNull(),
}, (table) => {
  return {
    searchHistoryIdIdx: index("search_click_tracking_search_history_id_idx").on(table.searchHistoryId),
    pitchIdIdx: index("search_click_tracking_pitch_id_idx").on(table.pitchId),
    userIdIdx: index("search_click_tracking_user_id_idx").on(table.userId),
    queryIdx: index("search_click_tracking_query_idx").on(table.query),
    clickedAtIdx: index("search_click_tracking_clicked_at_idx").on(table.clickedAt),
  };
});

// Search analytics aggregates for reporting
export const searchAnalytics = pgTable("search_analytics", {
  id: serial("id").primaryKey(),
  
  // Time period
  date: date("date").notNull(),
  hour: integer("hour"), // 0-23, null for daily aggregates
  
  // Search metrics
  totalSearches: integer("total_searches").default(0),
  uniqueUsers: integer("unique_users").default(0),
  uniqueQueries: integer("unique_queries").default(0),
  
  // Result metrics
  averageResultCount: decimal("avg_result_count", { precision: 8, scale: 2 }),
  zeroResultSearches: integer("zero_result_searches").default(0),
  
  // Engagement metrics
  totalClicks: integer("total_clicks").default(0),
  clickThroughRate: decimal("click_through_rate", { precision: 5, scale: 4 }),
  averagePosition: decimal("avg_position", { precision: 5, scale: 2 }),
  
  // Performance metrics
  averageSearchDuration: decimal("avg_search_duration", { precision: 8, scale: 2 }),
  
  // Top queries (stored as JSON for flexibility)
  topQueries: jsonb("top_queries").$type<Array<{
    query: string;
    count: number;
    ctr: number;
  }>>(),
  
  topFilters: jsonb("top_filters").$type<Record<string, any>>(),
  
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => {
  return {
    dateHourIdx: index("search_analytics_date_hour_idx").on(table.date, table.hour),
    dateIdx: index("search_analytics_date_idx").on(table.date),
    calculatedAtIdx: index("search_analytics_calculated_at_idx").on(table.calculatedAt),
  };
});

// Search relations
export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one, many }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
  clickTracking: many(searchClickTracking),
}));

export const searchClickTrackingRelations = relations(searchClickTracking, ({ one }) => ({
  searchHistory: one(searchHistory, {
    fields: [searchClickTracking.searchHistoryId],
    references: [searchHistory.id],
  }),
  user: one(users, {
    fields: [searchClickTracking.userId],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [searchClickTracking.pitchId],
    references: [pitches.id],
  }),
}));

// ============================================
// INVESTOR WATCHLIST & PORTFOLIO TABLES
// ============================================

// Watchlist for investors to track interesting pitches
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id")
    .notNull()
    .references(() => pitches.id, { onDelete: "cascade" }),
  notes: text("notes"),
  priority: text("priority").default("normal"), // high, normal, low
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (table) => ({
  uniqueUserPitch: unique("unique_user_pitch").on(table.userId, table.pitchId),
  userIdIdx: index("idx_watchlist_user_id").on(table.userId),
  pitchIdIdx: index("idx_watchlist_pitch_id").on(table.pitchId),
}));

// Analytics table for tracking pitch performance
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").notNull().references(() => pitches.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(), // view, like, share, nda_request, etc.
  eventData: jsonb("event_data"), // Additional event-specific data
  sessionId: text("session_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  timestamp: timestamp("timestamp", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  pitchIdIdx: index("idx_analytics_pitch_id").on(table.pitchId),
  userIdIdx: index("idx_analytics_user_id").on(table.userId),
  eventTypeIdx: index("idx_analytics_event_type").on(table.eventType),
  timestampIdx: index("idx_analytics_timestamp").on(table.timestamp),
}));

// Portfolio for tracking investor's investments
export const portfolio = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id")
    .notNull()
    .references(() => pitches.id, { onDelete: "restrict" }),
  amountInvested: decimal("amount_invested", { precision: 15, scale: 2 }),
  ownershipPercentage: decimal("ownership_percentage", { precision: 5, scale: 2 }),
  status: text("status").default("active"), // active, exited, pending
  investedAt: timestamp("invested_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  exitedAt: timestamp("exited_at", { withTimezone: true }),
  returns: decimal("returns", { precision: 15, scale: 2 }),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (table) => ({
  investorIdIdx: index("idx_portfolio_investor_id").on(table.investorId),
  pitchIdIdx: index("idx_portfolio_pitch_id").on(table.pitchId),
  statusIdx: index("idx_portfolio_status").on(table.status),
}));

// Watchlist Relations
export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [watchlist.pitchId],
    references: [pitches.id],
  }),
}));

// Portfolio Relations
export const portfolioRelations = relations(portfolio, ({ one }) => ({
  investor: one(users, {
    fields: [portfolio.investorId],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [portfolio.pitchId],
    references: [pitches.id],
  }),
}));