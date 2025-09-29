-- Migration to add missing tables for complete Drizzle schema support
-- This migration adds tables that are defined in schema.ts but missing from database

-- Create missing enums first
DO $$ BEGIN
 CREATE TYPE "aggregation_period" AS ENUM('hourly', 'daily', 'weekly', 'monthly', 'yearly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "credit_transaction_type" AS ENUM('purchase', 'usage', 'refund', 'bonus');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "email_status" AS ENUM('pending', 'sent', 'delivered', 'bounced', 'failed', 'unsubscribed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "event_type" AS ENUM('view', 'click', 'scroll', 'video_play', 'video_pause', 'video_complete', 'download', 'signup', 'login', 'logout', 'nda_request', 'nda_signed', 'follow', 'unfollow', 'message_sent', 'profile_update', 'search', 'filter');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "funnel_stage" AS ENUM('view', 'engagement', 'nda_request', 'nda_signed', 'contact', 'deal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'void');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "notification_frequency" AS ENUM('instant', 'daily', 'weekly', 'never');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "subscription_tier_new" AS ENUM('BASIC', 'PRO', 'ENTERPRISE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "transaction_status" AS ENUM('pending', 'completed', 'failed', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "transaction_type" AS ENUM('subscription', 'credits', 'success_fee', 'refund');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create missing core tables

-- NDA Requests table
CREATE TABLE IF NOT EXISTS "nda_requests" (
    "id" serial PRIMARY KEY NOT NULL,
    "pitch_id" integer NOT NULL,
    "requester_id" integer NOT NULL,
    "owner_id" integer NOT NULL,
    "nda_type" "nda_type" NOT NULL DEFAULT 'basic',
    "request_message" text,
    "company_info" jsonb,
    "status" varchar(20) NOT NULL DEFAULT 'pending',
    "rejection_reason" text,
    "requested_at" timestamp DEFAULT now() NOT NULL,
    "responded_at" timestamp,
    "expires_at" timestamp,
    CONSTRAINT "nda_requests_pitch_id_requester_id_unique" UNIQUE("pitch_id","requester_id")
);

-- Conversations table
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" serial PRIMARY KEY NOT NULL,
    "pitch_id" integer,
    "created_by_id" integer NOT NULL,
    "title" varchar(200),
    "is_group" boolean DEFAULT false,
    "last_message_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Conversation Participants table
CREATE TABLE IF NOT EXISTS "conversation_participants" (
    "id" serial PRIMARY KEY NOT NULL,
    "conversation_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "joined_at" timestamp DEFAULT now() NOT NULL,
    "left_at" timestamp,
    "mute_notifications" boolean DEFAULT false,
    CONSTRAINT "conversation_participants_conversation_id_user_id_unique" UNIQUE("conversation_id","user_id")
);

-- Enhanced Messages table (update existing if needed)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversation_id" integer;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "parent_message_id" integer;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "message_type" varchar(50) DEFAULT 'text';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments" jsonb;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_edited" boolean DEFAULT false;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

-- Watchlist table
CREATE TABLE IF NOT EXISTS "watchlist" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "pitch_id" integer NOT NULL,
    "notes" text,
    "priority" text DEFAULT 'normal',
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "unique_user_pitch" UNIQUE("user_id", "pitch_id")
);

-- Portfolio table  
CREATE TABLE IF NOT EXISTS "portfolio" (
    "id" serial PRIMARY KEY NOT NULL,
    "investor_id" integer NOT NULL,
    "pitch_id" integer NOT NULL,
    "amount_invested" decimal(15,2),
    "ownership_percentage" decimal(5,2),
    "status" text DEFAULT 'active',
    "invested_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "exited_at" timestamp with time zone,
    "returns" decimal(15,2),
    "notes" text,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Analytics table
CREATE TABLE IF NOT EXISTS "analytics" (
    "id" serial PRIMARY KEY NOT NULL,
    "pitch_id" integer NOT NULL,
    "user_id" integer,
    "event_type" text NOT NULL,
    "event_data" jsonb,
    "session_id" text,
    "ip_address" text,
    "user_agent" text,
    "referrer" text,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "type" varchar(50) NOT NULL,
    "title" varchar(200) NOT NULL,
    "message" text NOT NULL,
    "related_pitch_id" integer,
    "related_user_id" integer,
    "related_nda_request_id" integer,
    "is_read" boolean DEFAULT false,
    "action_url" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "read_at" timestamp
);

-- Security Events table
CREATE TABLE IF NOT EXISTS "security_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer,
    "event_type" varchar(50) NOT NULL,
    "event_status" varchar(20) NOT NULL,
    "ip_address" varchar(45),
    "user_agent" text,
    "location" jsonb,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Analytics Events table (comprehensive)
CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "event_type" "event_type" NOT NULL,
    "category" varchar(50),
    "user_id" integer,
    "session_id" varchar(100),
    "anonymous_id" varchar(100),
    "pitch_id" integer,
    "conversation_id" integer,
    "message_id" integer,
    "ip_address" varchar(45),
    "user_agent" text,
    "referrer" text,
    "pathname" text,
    "country" varchar(3),
    "region" varchar(100),
    "city" varchar(100),
    "device_type" varchar(20),
    "browser" varchar(50),
    "os" varchar(50),
    "event_data" jsonb,
    "experiments" jsonb,
    "timestamp" timestamp DEFAULT now() NOT NULL,
    "processed_at" timestamp
);

-- Payments table (enhanced)
CREATE TABLE IF NOT EXISTS "payments" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" decimal(12,2) NOT NULL,
    "currency" varchar(3) DEFAULT 'USD',
    "stripe_payment_intent_id" text,
    "stripe_invoice_id" text,
    "stripe_customer_id" text,
    "stripe_session_id" text,
    "status" "transaction_status" NOT NULL DEFAULT 'pending',
    "failure_reason" text,
    "description" text,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "completed_at" timestamp,
    "failed_at" timestamp
);

-- User Credits table
CREATE TABLE IF NOT EXISTS "user_credits" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL UNIQUE,
    "balance" integer NOT NULL DEFAULT 0,
    "total_purchased" integer NOT NULL DEFAULT 0,
    "total_used" integer NOT NULL DEFAULT 0,
    "last_updated" timestamp DEFAULT now() NOT NULL
);

-- Credit Transactions table
CREATE TABLE IF NOT EXISTS "credit_transactions" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "payment_id" integer,
    "type" "credit_transaction_type" NOT NULL,
    "amount" integer NOT NULL,
    "description" text NOT NULL,
    "balance_before" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "pitch_id" integer,
    "usage_type" varchar(50),
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Email Preferences table
CREATE TABLE IF NOT EXISTS "email_preferences" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL UNIQUE,
    "email_enabled" boolean DEFAULT true NOT NULL,
    "welcome_emails" boolean DEFAULT true NOT NULL,
    "nda_requests" boolean DEFAULT true NOT NULL,
    "nda_responses" boolean DEFAULT true NOT NULL,
    "message_notifications" "notification_frequency" DEFAULT 'instant' NOT NULL,
    "pitch_view_notifications" boolean DEFAULT true NOT NULL,
    "payment_confirmations" boolean DEFAULT true NOT NULL,
    "weekly_digest" boolean DEFAULT true NOT NULL,
    "marketing_emails" boolean DEFAULT false NOT NULL,
    "security_alerts" boolean DEFAULT true NOT NULL,
    "digest_day" integer DEFAULT 1 NOT NULL,
    "digest_time" time DEFAULT '09:00:00' NOT NULL,
    "timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Email Queue table
CREATE TABLE IF NOT EXISTS "email_queue" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer,
    "to_email" varchar(255) NOT NULL,
    "cc_emails" text,
    "bcc_emails" text,
    "subject" varchar(500) NOT NULL,
    "html_content" text NOT NULL,
    "text_content" text,
    "email_type" varchar(50) NOT NULL,
    "template_data" jsonb,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" "email_status" DEFAULT 'pending' NOT NULL,
    "provider_id" varchar(100),
    "provider_message_id" varchar(200),
    "tracking_id" varchar(100),
    "scheduled_for" timestamp,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "last_attempt_at" timestamp,
    "sent_at" timestamp,
    "delivered_at" timestamp,
    "error_message" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;

ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE RESTRICT;

ALTER TABLE "analytics" ADD CONSTRAINT "analytics_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;
ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_pitch_id_fkey" FOREIGN KEY ("related_pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_user_id_fkey" FOREIGN KEY ("related_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_nda_request_id_fkey" FOREIGN KEY ("related_nda_request_id") REFERENCES "nda_requests"("id") ON DELETE CASCADE;

ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE SET NULL;

ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_watchlist_user_id" ON "watchlist"("user_id");
CREATE INDEX IF NOT EXISTS "idx_watchlist_pitch_id" ON "watchlist"("pitch_id");

CREATE INDEX IF NOT EXISTS "idx_portfolio_investor_id" ON "portfolio"("investor_id");
CREATE INDEX IF NOT EXISTS "idx_portfolio_pitch_id" ON "portfolio"("pitch_id");
CREATE INDEX IF NOT EXISTS "idx_portfolio_status" ON "portfolio"("status");

CREATE INDEX IF NOT EXISTS "idx_analytics_pitch_id" ON "analytics"("pitch_id");
CREATE INDEX IF NOT EXISTS "idx_analytics_user_id" ON "analytics"("user_id");
CREATE INDEX IF NOT EXISTS "idx_analytics_event_type" ON "analytics"("event_type");
CREATE INDEX IF NOT EXISTS "idx_analytics_timestamp" ON "analytics"("timestamp");

CREATE INDEX IF NOT EXISTS "idx_nda_requests_pitch_id" ON "nda_requests"("pitch_id");
CREATE INDEX IF NOT EXISTS "idx_nda_requests_requester_id" ON "nda_requests"("requester_id");
CREATE INDEX IF NOT EXISTS "idx_nda_requests_owner_id" ON "nda_requests"("owner_id");
CREATE INDEX IF NOT EXISTS "idx_nda_requests_status" ON "nda_requests"("status");

CREATE INDEX IF NOT EXISTS "idx_conversations_pitch_id" ON "conversations"("pitch_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_created_by_id" ON "conversations"("created_by_id");

CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_is_read" ON "notifications"("is_read");
CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "notifications"("created_at");

CREATE INDEX IF NOT EXISTS "idx_security_events_user_id" ON "security_events"("user_id");
CREATE INDEX IF NOT EXISTS "idx_security_events_event_type" ON "security_events"("event_type");
CREATE INDEX IF NOT EXISTS "idx_security_events_created_at" ON "security_events"("created_at");

CREATE INDEX IF NOT EXISTS "idx_analytics_events_event_type" ON "analytics_events"("event_type");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_user_id" ON "analytics_events"("user_id");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_pitch_id" ON "analytics_events"("pitch_id");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_timestamp" ON "analytics_events"("timestamp");

CREATE INDEX IF NOT EXISTS "idx_payments_user_id" ON "payments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "idx_payments_type" ON "payments"("type");

CREATE INDEX IF NOT EXISTS "idx_user_credits_user_id" ON "user_credits"("user_id");

CREATE INDEX IF NOT EXISTS "idx_credit_transactions_user_id" ON "credit_transactions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_credit_transactions_type" ON "credit_transactions"("type");
CREATE INDEX IF NOT EXISTS "idx_credit_transactions_created_at" ON "credit_transactions"("created_at");

CREATE INDEX IF NOT EXISTS "idx_email_preferences_user_id" ON "email_preferences"("user_id");

CREATE INDEX IF NOT EXISTS "idx_email_queue_status" ON "email_queue"("status");
CREATE INDEX IF NOT EXISTS "idx_email_queue_scheduled_for" ON "email_queue"("scheduled_for");
CREATE INDEX IF NOT EXISTS "idx_email_queue_user_id" ON "email_queue"("user_id");

-- Comments for documentation
COMMENT ON TABLE "watchlist" IS 'Tracks investor watchlist for interesting pitches';
COMMENT ON TABLE "portfolio" IS 'Tracks investor portfolio and investments';
COMMENT ON TABLE "analytics" IS 'Stores analytics events for pitch tracking';
COMMENT ON TABLE "nda_requests" IS 'Tracks NDA requests between users';
COMMENT ON TABLE "security_events" IS 'Audit log for security-related events';
COMMENT ON TABLE "analytics_events" IS 'Comprehensive analytics event tracking';
COMMENT ON TABLE "notifications" IS 'User notification system';

-- Add any missing columns to existing tables
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" varchar(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" varchar(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" varchar(200);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_image_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_number" varchar(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_website" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_address" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_verified" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_locked_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_lock_reason" varchar(200);

-- Add any missing columns to pitches table
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "long_synopsis" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "opener" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "premise" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "target_audience" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "characters" jsonb;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "themes" jsonb;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "episode_breakdown" jsonb;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "budget_bracket" varchar(50);
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "estimated_budget" decimal(12,2);
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "title_image" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "lookbook_url" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "pitch_deck_url" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "script_url" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "trailer_url" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "production_timeline" text;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "additional_media" jsonb;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "visibility_settings" jsonb DEFAULT '{"showShortSynopsis": true, "showCharacters": false, "showBudget": false, "showMedia": false}';
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "like_count" integer DEFAULT 0;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "nda_count" integer DEFAULT 0;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "ai_used" boolean DEFAULT false;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "require_nda" boolean DEFAULT false;
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

-- Add default values for pitches enum status if missing
ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "status" "pitch_status" DEFAULT 'draft' NOT NULL;

-- Add pitch_id reference to messages if not exists (for legacy compatibility)
ALTER TABLE "messages" ALTER COLUMN "pitch_id" DROP NOT NULL;

COMMENT ON MIGRATION IS 'Added all missing tables and columns for complete Drizzle schema support';