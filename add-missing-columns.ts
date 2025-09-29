// Migration to add missing columns to the database using Drizzle
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

async function addMissingColumns() {
  console.log("🔄 Adding missing columns to database...");
  
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    // Add visibility_settings column to pitches table
    console.log("Adding visibility_settings column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS visibility_settings JSONB DEFAULT '{"showShortSynopsis": true, "showCharacters": true, "showBudget": false, "showLocation": false}'::jsonb
    `);

    // Add ai_used column if missing
    console.log("Adding ai_used column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS ai_used BOOLEAN DEFAULT false
    `);

    // Add ai_tools column if missing
    console.log("Adding ai_tools column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS ai_tools VARCHAR(100)[] DEFAULT '{}'::varchar[]
    `);

    // Add ai_disclosure column if missing
    console.log("Adding ai_disclosure column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS ai_disclosure TEXT
    `);

    // Add view_count column if missing
    console.log("Adding view_count column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0
    `);

    // Add like_count column if missing
    console.log("Adding like_count column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0
    `);

    // Add share_count column if missing
    console.log("Adding share_count column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0
    `);

    // Add feedback column if missing
    console.log("Adding feedback column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS feedback JSONB DEFAULT '[]'::jsonb
    `);

    // Add estimated_budget column if missing
    console.log("Adding estimated_budget column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(15,2)
    `);

    // Add production_timeline column if missing
    console.log("Adding production_timeline column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS production_timeline VARCHAR(100)
    `);

    // Add themes column if missing
    console.log("Adding themes column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS themes VARCHAR(100)[] DEFAULT '{}'::varchar[]
    `);

    // Add characters column if missing
    console.log("Adding characters column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS characters JSONB DEFAULT '[]'::jsonb
    `);

    // Add tags column if missing
    console.log("Adding tags column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS tags VARCHAR(50)[] DEFAULT '{}'::varchar[]
    `);

    // Add visibility column if missing
    console.log("Adding visibility column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private'
    `);

    // Add archived column if missing
    console.log("Adding archived column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false
    `);

    // Add archived_at column if missing
    console.log("Adding archived_at column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP
    `);

    // Add metadata column if missing
    console.log("Adding metadata column...");
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
    `);

    console.log("✅ All missing columns added successfully!");
    
  } catch (error) {
    console.error("❌ Error adding columns:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
if (import.meta.main) {
  await addMissingColumns();
}
