DO $$ BEGIN
 CREATE TYPE "credit_transaction_type" AS ENUM('purchase', 'usage', 'refund', 'bonus');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'void');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "subscription_tier_new" AS ENUM('BASIC', 'PRO', 'ENTERPRISE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "transaction_status" AS ENUM('pending', 'completed', 'failed', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "transaction_type" AS ENUM('subscription', 'credits', 'success_fee', 'refund');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitch_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"deal_value" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"success_fee_percentage" numeric(5, 2) DEFAULT '3.00',
	"success_fee_amount" numeric(12, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp,
	"paid_at" timestamp,
	"description" text,
	"contract_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"deal_id" integer,
	"payment_id" integer,
	"invoice_number" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp,
	"due_at" timestamp,
	"paid_at" timestamp,
	"description" text NOT NULL,
	"line_items" jsonb,
	"billing_address" jsonb,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_read_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"delivered_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	CONSTRAINT "message_read_receipts_message_id_user_id_unique" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nda_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitch_id" integer NOT NULL,
	"requester_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"nda_type" "nda_type" DEFAULT 'basic' NOT NULL,
	"request_message" text,
	"company_info" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "nda_requests_pitch_id_requester_id_unique" UNIQUE("pitch_id","requester_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stripe_payment_method_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"card_brand" varchar(20),
	"card_last4" varchar(4),
	"card_exp_month" integer,
	"card_exp_year" integer,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_methods_stripe_payment_method_id_unique" UNIQUE("stripe_payment_method_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"stripe_customer_id" text,
	"stripe_session_id" text,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"failed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tier" "subscription_tier_new" NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"status" varchar(20) NOT NULL,
	"amount" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"billing_interval" varchar(20),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"canceled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "typing_indicators" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_typing" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "typing_indicators_conversation_id_user_id_unique" UNIQUE("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"total_purchased" integer DEFAULT 0 NOT NULL,
	"total_used" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "pitch_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "receiver_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "conversation_id" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "parent_message_id" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "message_type" varchar(50) DEFAULT 'text';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "is_edited" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "pitches" ADD COLUMN "budget_breakdown_url" text;--> statement-breakpoint
ALTER TABLE "pitches" ADD COLUMN "production_timeline_url" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_participants_conversation_id_idx" ON "conversation_participants" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_participants_user_id_idx" ON "conversation_participants" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_pitch_id_idx" ON "conversations" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_created_by_id_idx" ON "conversations" ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations" ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_user_id_idx" ON "credit_transactions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_type_idx" ON "credit_transactions" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_created_at_idx" ON "credit_transactions" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_payment_id_idx" ON "credit_transactions" ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_pitch_id_idx" ON "deals" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_creator_id_idx" ON "deals" ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_investor_id_idx" ON "deals" ("investor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_status_idx" ON "deals" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_user_id_idx" ON "invoices" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_invoice_number_idx" ON "invoices" ("invoice_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_deal_id_idx" ON "invoices" ("deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_read_receipts_message_id_idx" ON "message_read_receipts" ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_read_receipts_user_id_idx" ON "message_read_receipts" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nda_requests_pitch_id_idx" ON "nda_requests" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nda_requests_requester_id_idx" ON "nda_requests" ("requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nda_requests_owner_id_idx" ON "nda_requests" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nda_requests_status_idx" ON "nda_requests" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_is_read_idx" ON "notifications" ("is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_user_id_idx" ON "payment_methods" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_stripe_payment_method_idx" ON "payment_methods" ("stripe_payment_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_default_idx" ON "payment_methods" ("is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_user_id_idx" ON "payments" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_type_idx" ON "payments" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_stripe_payment_intent_idx" ON "payments" ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_created_at_idx" ON "payments" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_history_user_id_idx" ON "subscription_history" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_history_status_idx" ON "subscription_history" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_history_stripe_subscription_idx" ON "subscription_history" ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "typing_indicators_conversation_id_idx" ON "typing_indicators" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "typing_indicators_updated_at_idx" ON "typing_indicators" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_credits_user_id_idx" ON "user_credits" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_parent_message_id_idx" ON "messages" ("parent_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_sent_at_idx" ON "messages" ("sent_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_investor_id_users_id_fk" FOREIGN KEY ("investor_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nda_requests" ADD CONSTRAINT "nda_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_pitch_id_pitches_id_fk" FOREIGN KEY ("related_pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_user_id_users_id_fk" FOREIGN KEY ("related_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_nda_request_id_nda_requests_id_fk" FOREIGN KEY ("related_nda_request_id") REFERENCES "nda_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "typing_indicators" ADD CONSTRAINT "typing_indicators_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "typing_indicators" ADD CONSTRAINT "typing_indicators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
