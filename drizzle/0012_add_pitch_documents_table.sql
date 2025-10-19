CREATE TABLE IF NOT EXISTS "pitch_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitch_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_key" text,
	"file_type" varchar(50) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"is_public" boolean DEFAULT false,
	"requires_nda" boolean DEFAULT false,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"last_modified" timestamp DEFAULT now(),
	"download_count" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'
);

DO $$ BEGIN
 ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_pitch_documents_pitch_id" ON "pitch_documents" ("pitch_id");
CREATE INDEX IF NOT EXISTS "idx_pitch_documents_document_type" ON "pitch_documents" ("document_type");
CREATE INDEX IF NOT EXISTS "idx_pitch_documents_uploaded_by" ON "pitch_documents" ("uploaded_by");