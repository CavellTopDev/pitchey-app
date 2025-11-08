// Add these to src/db/schema.ts for the missing tables

import { pgTable, serial, integer, varchar, text, timestamp, jsonb, decimal, boolean, unique, index } from "drizzle-orm@0.35.3/pg-core";

// ============================================
// NEW TABLES FOR CRITICAL ENDPOINTS
// ============================================

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
}, (table) => ({
  uniquePitchReviewer: unique().on(table.pitchId, table.reviewerId),
  pitchIdx: index("idx_reviews_pitch_id").on(table.pitchId),
  reviewerIdx: index("idx_reviews_reviewer_id").on(table.reviewerId),
}));

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
}, (table) => ({
  userIdx: index("idx_calendar_events_user_id").on(table.userId),
  datesIdx: index("idx_calendar_events_dates").on(table.startDate, table.endDate),
}));

// 3. Saved Pitches table (for creators and investors)
export const savedPitches = pgTable("saved_pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserPitch: unique().on(table.userId, table.pitchId),
  userIdx: index("idx_saved_pitches_user_id").on(table.userId),
  pitchIdx: index("idx_saved_pitches_pitch_id").on(table.pitchId),
}));

// 4. Investment Documents table
export const investmentDocuments = pgTable("investment_documents", {
  id: serial("id").primaryKey(),
  investmentId: integer("investment_id").references(() => investments.id, { onDelete: "cascade" }).notNull(),
  documentName: varchar("document_name", { length: 255 }).notNull(),
  documentUrl: text("document_url"),
  documentType: varchar("document_type", { length: 50 }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => ({
  investmentIdx: index("idx_investment_docs_investment_id").on(table.investmentId),
}));

// 5. Investment Timeline Events
export const investmentTimeline = pgTable("investment_timeline", {
  id: serial("id").primaryKey(),
  investmentId: integer("investment_id").references(() => investments.id, { onDelete: "cascade" }).notNull(),
  eventType: varchar("event_type", { length: 50 }),
  eventDescription: text("event_description"),
  eventDate: timestamp("event_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  investmentIdx: index("idx_investment_timeline_investment_id").on(table.investmentId),
  dateIdx: index("idx_investment_timeline_date").on(table.eventDate),
}));