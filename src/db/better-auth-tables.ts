/**
 * Better Auth specific table definitions
 * These are required for Better Auth to work properly
 */

import { pgTable, serial, text, integer, timestamp, varchar, boolean, jsonb } from "drizzle-orm/pg-core";
import { users } from "./schema";

// Accounts table for OAuth providers
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  tokenType: text("token_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Verification tokens for email verification, password reset, etc.
export const verificationTokens = pgTable("verification_tokens", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  type: text("type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  email: text("email"),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Export as the names Better Auth expects
export const user = users; // Better Auth expects 'user' not 'users'
export const account = accounts;
export const verification = verificationTokens;