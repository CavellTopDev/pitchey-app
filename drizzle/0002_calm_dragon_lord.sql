DO $$ BEGIN
 CREATE TYPE "aggregation_period" AS ENUM('hourly', 'daily', 'weekly', 'monthly', 'yearly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "event_type" AS ENUM('view', 'click', 'scroll', 'video_play', 'video_pause', 'video_complete', 'download', 'signup', 'login', 'logout', 'nda_request', 'nda_signed', 'follow', 'unfollow', 'message_sent', 'profile_update', 'search', 'filter');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "funnel_stage" AS ENUM('view', 'engagement', 'nda_request', 'nda_signed', 'contact', 'deal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_aggregates" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" "aggregation_period" NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"user_id" integer,
	"pitch_id" integer,
	"event_type" "event_type",
	"country" varchar(3),
	"device_type" varchar(20),
	"user_type" "user_type",
	"event_count" integer DEFAULT 0,
	"unique_users" integer DEFAULT 0,
	"unique_sessions" integer DEFAULT 0,
	"total_duration" integer DEFAULT 0,
	"average_duration" numeric(10, 2),
	"total_scroll_depth" integer DEFAULT 0,
	"average_scroll_depth" numeric(5, 2),
	"bounce_rate" numeric(5, 2),
	"conversion_rate" numeric(5, 2),
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"average_order_value" numeric(10, 2),
	"additional_metrics" jsonb,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"version" varchar(10) DEFAULT '1.0'
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cohort_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp NOT NULL,
	"last_active_at" timestamp,
	"is_retained" boolean DEFAULT false,
	"retention_periods" jsonb,
	"lifetime_value" numeric(12, 2) DEFAULT '0',
	"total_events" integer DEFAULT 0,
	"total_sessions" integer DEFAULT 0,
	CONSTRAINT "cohort_users_cohort_id_user_id_unique" UNIQUE("cohort_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversion_funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"stages" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"time_window_hours" integer DEFAULT 24,
	"experiment_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funnel_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnel_id" integer NOT NULL,
	"stage_id" varchar(100) NOT NULL,
	"user_id" integer,
	"session_id" varchar(100),
	"anonymous_id" varchar(100),
	"event_id" uuid,
	"pitch_id" integer,
	"funnel_session_id" varchar(100),
	"stage_order" integer NOT NULL,
	"is_completed" boolean DEFAULT false,
	"time_to_complete" integer,
	"experiment_variant" varchar(50),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "realtime_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" varchar(200) NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1,
	CONSTRAINT "realtime_analytics_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_cohorts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"cohort_type" varchar(50) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"filters" jsonb,
	"total_users" integer DEFAULT 0,
	"active_users" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(100) NOT NULL,
	"user_id" integer,
	"anonymous_id" varchar(100),
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"duration" integer,
	"page_views" integer DEFAULT 0,
	"event_count" integer DEFAULT 0,
	"entry_page" text,
	"exit_page" text,
	"referrer" text,
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"country" varchar(3),
	"region" varchar(100),
	"city" varchar(100),
	"device_type" varchar(20),
	"browser" varchar(50),
	"os" varchar(50),
	"bounced" boolean DEFAULT true,
	"converted" boolean DEFAULT false,
	"conversion_value" numeric(12, 2),
	"engagement_score" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_aggregates_period_idx" ON "analytics_aggregates" ("period","period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_aggregates_user_id_idx" ON "analytics_aggregates" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_aggregates_pitch_id_idx" ON "analytics_aggregates" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_aggregates_event_type_idx" ON "analytics_aggregates" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_aggregates_country_idx" ON "analytics_aggregates" ("country");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_aggregates_device_type_idx" ON "analytics_aggregates" ("device_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_aggregates_period_start_idx" ON "analytics_aggregates" ("period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_event_id_idx" ON "analytics_events" ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_event_type_idx" ON "analytics_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_user_id_idx" ON "analytics_events" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_session_id_idx" ON "analytics_events" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_pitch_id_idx" ON "analytics_events" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_timestamp_idx" ON "analytics_events" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_category_idx" ON "analytics_events" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_country_idx" ON "analytics_events" ("country");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_device_type_idx" ON "analytics_events" ("device_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cohort_users_cohort_id_idx" ON "cohort_users" ("cohort_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cohort_users_user_id_idx" ON "cohort_users" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cohort_users_is_retained_idx" ON "cohort_users" ("is_retained");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversion_funnels_name_idx" ON "conversion_funnels" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversion_funnels_experiment_id_idx" ON "conversion_funnels" ("experiment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversion_funnels_is_active_idx" ON "conversion_funnels" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_funnel_id_idx" ON "funnel_events" ("funnel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_user_id_idx" ON "funnel_events" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_session_id_idx" ON "funnel_events" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_funnel_session_id_idx" ON "funnel_events" ("funnel_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_timestamp_idx" ON "funnel_events" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_stage_order_idx" ON "funnel_events" ("stage_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "realtime_analytics_cache_key_idx" ON "realtime_analytics" ("cache_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "realtime_analytics_expires_at_idx" ON "realtime_analytics" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_cohorts_name_idx" ON "user_cohorts" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_cohorts_cohort_type_idx" ON "user_cohorts" ("cohort_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_cohorts_period_start_idx" ON "user_cohorts" ("period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_session_id_idx" ON "user_sessions" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_start_time_idx" ON "user_sessions" ("start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_country_idx" ON "user_sessions" ("country");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_device_type_idx" ON "user_sessions" ("device_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_converted_idx" ON "user_sessions" ("converted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_is_active_idx" ON "user_sessions" ("is_active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_aggregates" ADD CONSTRAINT "analytics_aggregates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_aggregates" ADD CONSTRAINT "analytics_aggregates_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_users" ADD CONSTRAINT "cohort_users_cohort_id_user_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "user_cohorts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_users" ADD CONSTRAINT "cohort_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_funnel_id_conversion_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "conversion_funnels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_event_id_analytics_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "analytics_events"("event_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
