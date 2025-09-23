-- Email notification preferences and tracking tables

-- Notification preferences enum
CREATE TYPE "notification_frequency" AS ENUM ('instant', 'daily', 'weekly', 'never');
CREATE TYPE "email_status" AS ENUM ('pending', 'sent', 'delivered', 'bounced', 'failed', 'unsubscribed');

-- User email notification preferences
CREATE TABLE IF NOT EXISTS "email_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"welcome_emails" boolean DEFAULT true NOT NULL,
	"nda_requests" boolean DEFAULT true NOT NULL,
	"nda_responses" boolean DEFAULT true NOT NULL,
	"message_notifications" notification_frequency DEFAULT 'instant' NOT NULL,
	"pitch_view_notifications" boolean DEFAULT true NOT NULL,
	"payment_confirmations" boolean DEFAULT true NOT NULL,
	"weekly_digest" boolean DEFAULT true NOT NULL,
	"marketing_emails" boolean DEFAULT false NOT NULL,
	"security_alerts" boolean DEFAULT true NOT NULL,
	"digest_day" integer DEFAULT 1 NOT NULL, -- 1=Monday, 7=Sunday
	"digest_time" time DEFAULT '09:00:00' NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Email queue for batch sending
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
	"priority" integer DEFAULT 5 NOT NULL, -- 1=highest, 10=lowest
	"status" email_status DEFAULT 'pending' NOT NULL,
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

-- Email tracking events
CREATE TABLE IF NOT EXISTS "email_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_queue_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL, -- sent, delivered, opened, clicked, bounced, complained, unsubscribed
	"event_data" jsonb,
	"user_agent" text,
	"ip_address" varchar(45),
	"timestamp" timestamp DEFAULT now() NOT NULL
);

-- Unsubscribe tokens and management
CREATE TABLE IF NOT EXISTS "unsubscribe_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(100) NOT NULL UNIQUE,
	"email_type" varchar(50), -- specific type to unsubscribe from, null = all
	"expires_at" timestamp,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Email bounces and complaints tracking
CREATE TABLE IF NOT EXISTS "email_suppression" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"suppression_type" varchar(50) NOT NULL, -- bounce, complaint, unsubscribe
	"reason" text,
	"bounce_type" varchar(50), -- hard, soft, undetermined
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Weekly digest tracking
CREATE TABLE IF NOT EXISTS "digest_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"email_queue_id" integer,
	"stats" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "email_preferences_user_id_idx" ON "email_preferences" ("user_id");
CREATE INDEX IF NOT EXISTS "email_queue_status_idx" ON "email_queue" ("status");
CREATE INDEX IF NOT EXISTS "email_queue_scheduled_for_idx" ON "email_queue" ("scheduled_for");
CREATE INDEX IF NOT EXISTS "email_queue_user_id_idx" ON "email_queue" ("user_id");
CREATE INDEX IF NOT EXISTS "email_queue_email_type_idx" ON "email_queue" ("email_type");
CREATE INDEX IF NOT EXISTS "email_queue_created_at_idx" ON "email_queue" ("created_at");
CREATE INDEX IF NOT EXISTS "email_events_email_queue_id_idx" ON "email_events" ("email_queue_id");
CREATE INDEX IF NOT EXISTS "email_events_event_type_idx" ON "email_events" ("event_type");
CREATE INDEX IF NOT EXISTS "email_events_timestamp_idx" ON "email_events" ("timestamp");
CREATE INDEX IF NOT EXISTS "unsubscribe_tokens_token_idx" ON "unsubscribe_tokens" ("token");
CREATE INDEX IF NOT EXISTS "unsubscribe_tokens_user_id_idx" ON "unsubscribe_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "email_suppression_email_idx" ON "email_suppression" ("email");
CREATE INDEX IF NOT EXISTS "digest_history_user_id_idx" ON "digest_history" ("user_id");
CREATE INDEX IF NOT EXISTS "digest_history_week_start_idx" ON "digest_history" ("week_start");

-- Foreign key constraints
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_queue_id_email_queue_id_fk" FOREIGN KEY ("email_queue_id") REFERENCES "email_queue"("id") ON DELETE cascade;
ALTER TABLE "unsubscribe_tokens" ADD CONSTRAINT "unsubscribe_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "digest_history" ADD CONSTRAINT "digest_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "digest_history" ADD CONSTRAINT "digest_history_email_queue_id_email_queue_id_fk" FOREIGN KEY ("email_queue_id") REFERENCES "email_queue"("id") ON DELETE set null;

-- Unique constraints
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_unique" UNIQUE("user_id");
ALTER TABLE "digest_history" ADD CONSTRAINT "digest_history_user_id_week_start_unique" UNIQUE("user_id", "week_start");