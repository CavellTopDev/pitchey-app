DO $$ BEGIN
 CREATE TYPE "format" AS ENUM('feature', 'tv', 'short', 'webseries', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "genre" AS ENUM('drama', 'comedy', 'thriller', 'horror', 'scifi', 'fantasy', 'documentary', 'animation', 'action', 'romance', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "nda_type" AS ENUM('basic', 'enhanced', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "pitch_status" AS ENUM('draft', 'published', 'hidden', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "subscription_tier" AS ENUM('free', 'creator', 'pro', 'investor');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_type" AS ENUM('creator', 'production', 'investor', 'viewer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL,
	"pitch_id" integer,
	"creator_id" integer,
	"followed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_pitch_id_unique" UNIQUE("follower_id","pitch_id"),
	CONSTRAINT "follows_follower_id_creator_id_unique" UNIQUE("follower_id","creator_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitch_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"subject" varchar(200),
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"off_platform_requested" boolean DEFAULT false,
	"off_platform_approved" boolean DEFAULT false,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ndas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitch_id" integer NOT NULL,
	"signer_id" integer NOT NULL,
	"nda_type" "nda_type" NOT NULL,
	"nda_version" varchar(20) DEFAULT '1.0',
	"custom_nda_url" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"signature_data" jsonb,
	"access_granted" boolean DEFAULT true,
	"access_revoked_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "ndas_pitch_id_signer_id_unique" UNIQUE("pitch_id","signer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pitch_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitch_id" integer NOT NULL,
	"viewer_id" integer,
	"view_type" varchar(20),
	"ip_address" varchar(45),
	"user_agent" text,
	"referrer" text,
	"session_id" varchar(100),
	"view_duration" integer,
	"scroll_depth" integer,
	"clicked_watch_this" boolean DEFAULT false,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pitches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"logline" text NOT NULL,
	"genre" "genre" NOT NULL,
	"format" "format" NOT NULL,
	"short_synopsis" text,
	"long_synopsis" text,
	"opener" text,
	"premise" text,
	"target_audience" text,
	"characters" jsonb,
	"themes" jsonb,
	"episode_breakdown" jsonb,
	"budget_bracket" varchar(50),
	"estimated_budget" numeric(12, 2),
	"production_timeline" text,
	"title_image_url" text,
	"lookbook_url" text,
	"pitch_deck_url" text,
	"script_url" text,
	"trailer_url" text,
	"additional_media" jsonb,
	"visibility_settings" jsonb DEFAULT '{"showShortSynopsis":true,"showCharacters":false,"showBudget":false,"showMedia":false}'::jsonb,
	"status" "pitch_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"view_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"nda_count" integer DEFAULT 0,
	"ai_used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR',
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"status" varchar(50) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"user_type" "user_type" DEFAULT 'viewer' NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(20),
	"location" varchar(200),
	"bio" text,
	"profile_image_url" text,
	"company_name" text,
	"company_number" varchar(100),
	"company_website" text,
	"company_address" text,
	"email_verified" boolean DEFAULT false,
	"email_verification_token" text,
	"company_verified" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"subscription_tier" "subscription_tier" DEFAULT 'free',
	"subscription_start_date" timestamp,
	"subscription_end_date" timestamp,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follows_follower_id_idx" ON "follows" ("follower_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON "messages" ("sender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_receiver_id_idx" ON "messages" ("receiver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_pitch_id_idx" ON "messages" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ndas_pitch_id_idx" ON "ndas" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ndas_signer_id_idx" ON "ndas" ("signer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitch_views_pitch_id_idx" ON "pitch_views" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitch_views_viewer_id_idx" ON "pitch_views" ("viewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitch_views_viewed_at_idx" ON "pitch_views" ("viewed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitches_user_id_idx" ON "pitches" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitches_status_idx" ON "pitches" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitches_genre_idx" ON "pitches" ("genre");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitches_format_idx" ON "pitches" ("format");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitches_title_search_idx" ON "pitches" ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_user_type_idx" ON "users" ("user_type");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ndas" ADD CONSTRAINT "ndas_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ndas" ADD CONSTRAINT "ndas_signer_id_users_id_fk" FOREIGN KEY ("signer_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pitch_views" ADD CONSTRAINT "pitch_views_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pitch_views" ADD CONSTRAINT "pitch_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pitches" ADD CONSTRAINT "pitches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
