// Simple migration to add only the visibility_settings column needed for pitch creation
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'npm:drizzle-orm@0.35.3';

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

async function addVisibilitySettings() {
  console.log("🔧 Adding visibility_settings column to pitches table...");
  
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    // Add visibility_settings column to pitches table
    await db.execute(sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS visibility_settings JSONB DEFAULT '{"showShortSynopsis": true, "showCharacters": false, "showBudget": false, "showMedia": false}'::jsonb
    `);

    console.log("✅ visibility_settings column added successfully!");
    console.log("✅ Database is ready for pitch creation!");
    
  } catch (error) {
    console.error("❌ Migration error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
if (import.meta.main) {
  await addVisibilitySettings();
}