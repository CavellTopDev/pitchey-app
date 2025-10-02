// COMPLETE SCHEMA - Matches Neon Database with All Tables
import { pgTable, serial, integer, varchar, text, boolean, timestamp, decimal, jsonb, unique } from "npm:drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  userType: varchar("user_type", { length: 50 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  bio: text("bio"),
  location: varchar("location", { length: 255 }),
  profileImageUrl: varchar("profile_image", { length: 500 }),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pitches = pgTable("pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  logline: text("logline").notNull(),
  genre: varchar("genre", { length: 100 }),
  format: varchar("format", { length: 100 }),
  budget: varchar("budget", { length: 100 }),
  shortSynopsis: text("short_synopsis"),
  longSynopsis: text("long_synopsis"),
  status: varchar("status", { length: 50 }).default("draft"),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  ndaCount: integer("nda_count").default(0),
  thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
  lookbookUrl: varchar("lookbook_url", { length: 500 }),
  scriptUrl: varchar("script_url", { length: 500 }),
  trailerUrl: varchar("trailer_url", { length: 500 }),
  pitchDeckUrl: varchar("pitch_deck_url", { length: 500 }),
  requireNda: boolean("require_nda").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => users.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").references(() => users.id, { onDelete: "cascade" }),
  followedAt: timestamp("followed_at").defaultNow(),
});

export const ndas = pgTable("ndas", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  requesterId: integer("requester_id").references(() => users.id, { onDelete: "cascade" }),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("pending"),
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  documentUrl: varchar("document_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").references(() => users.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 255 }),
  content: text("content"),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "set null" }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pitchViews = pgTable("pitch_views", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").references(() => users.id, { onDelete: "cascade" }),
  viewType: varchar("view_type", { length: 50 }),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }),
  title: varchar("title", { length: 255 }),
  message: text("message"),
  relatedId: integer("related_id"),
  relatedType: varchar("related_type", { length: 50 }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portfolio = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  category: varchar("category", { length: 50 }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 255 }),
  eventData: jsonb("event_data"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
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
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("pending"),
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
export type Conversation = typeof conversations.$inferSelect;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type MessageReadReceipt = typeof messageReadReceipts.$inferSelect;
export type TypingIndicator = typeof typingIndicators.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;
export type NdaRequest = typeof ndaRequests.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
