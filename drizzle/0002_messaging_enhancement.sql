-- Enhanced messaging system with real-time support

-- Create conversations table
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitch_id" integer,
	"created_by_id" integer NOT NULL,
	"title" varchar(200),
	"is_group" boolean DEFAULT false,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create conversation participants table
CREATE TABLE IF NOT EXISTS "conversation_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"mute_notifications" boolean DEFAULT false,
	CONSTRAINT "conversation_participants_conversation_id_user_id_unique" UNIQUE("conversation_id","user_id")
);--> statement-breakpoint

-- Create message read receipts table
CREATE TABLE IF NOT EXISTS "message_read_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"delivered_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	CONSTRAINT "message_read_receipts_message_id_user_id_unique" UNIQUE("message_id","user_id")
);--> statement-breakpoint

-- Create typing indicators table
CREATE TABLE IF NOT EXISTS "typing_indicators" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_typing" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "typing_indicators_conversation_id_user_id_unique" UNIQUE("conversation_id","user_id")
);--> statement-breakpoint

-- Add new columns to existing messages table
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversation_id" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "parent_message_id" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "message_type" varchar(50) DEFAULT 'text';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_edited" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint

-- Make pitch_id and receiver_id nullable (for conversation-based messaging)
ALTER TABLE "messages" ALTER COLUMN "pitch_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "receiver_id" DROP NOT NULL;--> statement-breakpoint

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "typing_indicators" ADD CONSTRAINT "typing_indicators_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "typing_indicators" ADD CONSTRAINT "typing_indicators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "conversations_pitch_id_idx" ON "conversations" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_created_by_id_idx" ON "conversations" ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations" ("last_message_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "conversation_participants_conversation_id_idx" ON "conversation_participants" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_participants_user_id_idx" ON "conversation_participants" ("user_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_parent_message_id_idx" ON "messages" ("parent_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_sent_at_idx" ON "messages" ("sent_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "message_read_receipts_message_id_idx" ON "message_read_receipts" ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_read_receipts_user_id_idx" ON "message_read_receipts" ("user_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "typing_indicators_conversation_id_idx" ON "typing_indicators" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "typing_indicators_updated_at_idx" ON "typing_indicators" ("updated_at");--> statement-breakpoint