#!/usr/bin/env deno run --allow-all

import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

console.log("🔄 Running pitch_documents table migration...");

try {
  // Create the pitch_documents table directly
  await db.execute(sql`
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
    )
  `);
  
  console.log("✅ pitch_documents table created");

  // Add foreign key constraints
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_pitch_id_pitches_id_fk" 
      FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pitch_documents" ADD CONSTRAINT "pitch_documents_uploaded_by_users_id_fk" 
      FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  console.log("✅ Foreign key constraints added");

  // Add indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_pitch_documents_pitch_id" ON "pitch_documents" ("pitch_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_pitch_documents_document_type" ON "pitch_documents" ("document_type")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_pitch_documents_uploaded_by" ON "pitch_documents" ("uploaded_by")`);
  
  console.log("✅ Indexes created");
  
  // Verify the table was created
  const result = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pitch_documents'
  `);
  
  if (result.rows.length > 0) {
    console.log("✅ pitch_documents table verified!");
  } else {
    console.log("❌ pitch_documents table not found after migration");
  }
  
  console.log("🎉 Migration completed successfully!");
  
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  Deno.exit(1);
}

Deno.exit(0);