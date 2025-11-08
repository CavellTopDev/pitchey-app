// MINIMAL WORKING SCHEMA - Matches Neon Database Exactly
import { pgTable, serial, integer, varchar, text, boolean, timestamp, decimal } from "npm:drizzle-orm@0.35.3/pg-core";

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

// Export any additional types or relations if needed
export type User = typeof users.$inferSelect;
export type Pitch = typeof pitches.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type NDA = typeof ndas.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type PitchView = typeof pitchViews.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Portfolio = typeof portfolio.$inferSelect;
