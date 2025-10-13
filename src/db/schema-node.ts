import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from "npm:drizzle-orm/pg-core";
import { relations } from "npm:drizzle-orm";

// Enums
export const userTypeEnum = pgEnum('user_type', ['creator', 'production', 'investor']);
export const pitchStatusEnum = pgEnum('pitch_status', ['draft', 'published', 'archived', 'hidden']);
export const genreEnum = pgEnum('genre', ['drama', 'comedy', 'thriller', 'horror', 'scifi', 'fantasy', 'documentary', 'animation', 'action', 'romance', 'other']);
export const formatEnum = pgEnum('format', ['feature', 'tv', 'short', 'webseries', 'other']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'nda_request',
  'nda_approved', 
  'nda_rejected',
  'nda_revoked',
  'pitch_view',
  'pitch_like',
  'message_received',
  'follow',
  'comment',
]);
export const ndaTypeEnum = pgEnum('nda_type', ['basic', 'enhanced']);
export const ndaRequestStatusEnum = pgEnum('nda_request_status', ['pending', 'approved', 'rejected', 'expired']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro', 'enterprise']);
export const mediaTypeEnum = pgEnum('media_type', [
  'lookbook',
  'script', 
  'trailer',
  'pitch_deck',
  'budget_breakdown',
  'production_timeline',
  'other',
]);

// Tables
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  userType: userTypeEnum('user_type').notNull(),
  
  // Profile fields
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  phone: varchar('phone', { length: 30 }),
  location: varchar('location', { length: 200 }),
  bio: text('bio'),
  profileImage: text('profile_image'),
  
  // Company info
  companyName: varchar('company_name', { length: 200 }),
  companyNumber: varchar('company_number', { length: 100 }),
  companyWebsite: text('company_website'),
  companyAddress: text('company_address'),
  companyVerified: boolean('company_verified').default(false),
  
  // Account status
  emailVerified: boolean('email_verified').default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  isActive: boolean('is_active').default(true),
  subscriptionTier: subscriptionTierEnum('subscription_tier').default('free'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
  userTypeIdx: index('users_user_type_idx').on(table.userType),
}));

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenIdx: uniqueIndex('sessions_token_idx').on(table.token),
  userIdx: index('sessions_user_idx').on(table.userId),
}));

export const pitches = pgTable('pitches', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Basic info
  title: varchar('title', { length: 200 }).notNull(),
  logline: text('logline').notNull(),
  genre: genreEnum('genre').notNull(),
  format: formatEnum('format').notNull(),
  status: pitchStatusEnum('status').default('draft').notNull(),
  
  // Content
  shortSynopsis: text('short_synopsis'),
  longSynopsis: text('long_synopsis'),
  themes: jsonb('themes').$type<string[]>(),
  characters: jsonb('characters').$type<Array<{
    name: string;
    description: string;
    age?: string;
    gender?: string;
    actor?: string;
  }>>(),
  
  // Financial
  budgetBracket: varchar('budget_bracket', { length: 100 }),
  estimatedBudget: integer('estimated_budget'),
  productionTimeline: text('production_timeline'),
  
  // Media
  titleImage: text('title_image'),
  lookbookUrl: text('lookbook_url'),
  pitchDeckUrl: text('pitch_deck_url'),
  scriptUrl: text('script_url'),
  trailerUrl: text('trailer_url'),
  additionalMedia: jsonb('additional_media').$type<Array<{
    type: string;
    url: string;
    title: string;
    description?: string;
    uploadedAt: string;
  }>>(),
  
  // Stats
  viewCount: integer('view_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  ndaCount: integer('nda_count').default(0).notNull(),
  
  // Metadata
  aiUsed: boolean('ai_used').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('pitches_user_idx').on(table.userId),
  statusIdx: index('pitches_status_idx').on(table.status),
  genreIdx: index('pitches_genre_idx').on(table.genre),
  formatIdx: index('pitches_format_idx').on(table.format),
  publishedAtIdx: index('pitches_published_at_idx').on(table.publishedAt),
}));

export const ndas = pgTable('ndas', {
  id: serial('id').primaryKey(),
  pitchId: integer('pitch_id').notNull().references(() => pitches.id, { onDelete: 'cascade' }),
  signerId: integer('signer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ndaType: ndaTypeEnum('nda_type').default('basic').notNull(),
  accessGranted: boolean('access_granted').default(true).notNull(),
  accessRevokedAt: timestamp('access_revoked_at'),
  expiresAt: timestamp('expires_at'),
  signedAt: timestamp('signed_at').defaultNow().notNull(),
}, (table) => ({
  pitchSignerIdx: uniqueIndex('ndas_pitch_signer_idx').on(table.pitchId, table.signerId),
  pitchIdx: index('ndas_pitch_idx').on(table.pitchId),
  signerIdx: index('ndas_signer_idx').on(table.signerId),
}));

export const ndaRequests = pgTable('nda_requests', {
  id: serial('id').primaryKey(),
  pitchId: integer('pitch_id').notNull().references(() => pitches.id, { onDelete: 'cascade' }),
  requesterId: integer('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ndaType: ndaTypeEnum('nda_type').default('basic').notNull(),
  status: ndaRequestStatusEnum('status').default('pending').notNull(),
  requestMessage: text('request_message'),
  rejectionReason: text('rejection_reason'),
  companyInfo: jsonb('company_info').$type<{
    companyName: string;
    position: string;
    intendedUse: string;
  }>(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  respondedAt: timestamp('responded_at'),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  pitchRequesterIdx: index('nda_requests_pitch_requester_idx').on(table.pitchId, table.requesterId),
  ownerIdx: index('nda_requests_owner_idx').on(table.ownerId),
  statusIdx: index('nda_requests_status_idx').on(table.status),
}));

export const pitchViews = pgTable('pitch_views', {
  id: serial('id').primaryKey(),
  pitchId: integer('pitch_id').notNull().references(() => pitches.id, { onDelete: 'cascade' }),
  viewerId: integer('viewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewType: varchar('view_type', { length: 50 }).default('full'),
  viewedAt: timestamp('viewed_at').defaultNow().notNull(),
}, (table) => ({
  pitchViewerIdx: index('pitch_views_pitch_viewer_idx').on(table.pitchId, table.viewerId),
  viewedAtIdx: index('pitch_views_viewed_at_idx').on(table.viewedAt),
}));

export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerId: integer('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pitchId: integer('pitch_id').notNull().references(() => pitches.id, { onDelete: 'cascade' }),
  followedAt: timestamp('followed_at').defaultNow().notNull(),
}, (table) => ({
  followerPitchIdx: uniqueIndex('follows_follower_pitch_idx').on(table.followerId, table.pitchId),
  followerIdx: index('follows_follower_idx').on(table.followerId),
  pitchIdx: index('follows_pitch_idx').on(table.pitchId),
}));

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  relatedPitchId: integer('related_pitch_id').references(() => pitches.id, { onDelete: 'set null' }),
  relatedUserId: integer('related_user_id').references(() => users.id, { onDelete: 'set null' }),
  relatedNdaRequestId: integer('related_nda_request_id').references(() => ndaRequests.id, { onDelete: 'set null' }),
  actionUrl: text('action_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.userId),
  isReadIdx: index('notifications_is_read_idx').on(table.isRead),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  pitches: many(pitches),
  sessions: many(sessions),
  signedNdas: many(ndas),
  sentNdaRequests: many(ndaRequests, {
    relationName: 'requester',
  }),
  receivedNdaRequests: many(ndaRequests, {
    relationName: 'owner',
  }),
  follows: many(follows),
  notifications: many(notifications),
  views: many(pitchViews),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const pitchesRelations = relations(pitches, ({ one, many }) => ({
  creator: one(users, {
    fields: [pitches.userId],
    references: [users.id],
  }),
  ndas: many(ndas),
  ndaRequests: many(ndaRequests),
  views: many(pitchViews),
  followers: many(follows),
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

export const ndaRequestsRelations = relations(ndaRequests, ({ one }) => ({
  pitch: one(pitches, {
    fields: [ndaRequests.pitchId],
    references: [pitches.id],
  }),
  requester: one(users, {
    fields: [ndaRequests.requesterId],
    references: [users.id],
    relationName: 'requester',
  }),
  owner: one(users, {
    fields: [ndaRequests.ownerId],
    references: [users.id],
    relationName: 'owner',
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
  relatedPitch: one(pitches, {
    fields: [notifications.relatedPitchId],
    references: [pitches.id],
  }),
  relatedUser: one(users, {
    fields: [notifications.relatedUserId],
    references: [users.id],
  }),
  relatedNdaRequest: one(ndaRequests, {
    fields: [notifications.relatedNdaRequestId],
    references: [ndaRequests.id],
  }),
}));