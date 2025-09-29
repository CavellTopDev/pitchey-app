// Database migration script to add missing columns for pitch creation
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

console.log("🔧 Running database migration to add missing pitch columns...");

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

try {
  console.log("📝 Adding media-related columns...");
  
  // Add media-related columns
  await sql`
    ALTER TABLE pitches 
    ADD COLUMN IF NOT EXISTS title_image TEXT,
    ADD COLUMN IF NOT EXISTS lookbook_url TEXT,
    ADD COLUMN IF NOT EXISTS pitch_deck_url TEXT,
    ADD COLUMN IF NOT EXISTS script_url TEXT,
    ADD COLUMN IF NOT EXISTS trailer_url TEXT,
    ADD COLUMN IF NOT EXISTS additional_media JSONB,
    ADD COLUMN IF NOT EXISTS production_timeline TEXT
  `;
  
  console.log("📝 Adding NDA and publishing columns...");
  
  // Add NDA requirement column
  await sql`
    ALTER TABLE pitches
    ADD COLUMN IF NOT EXISTS require_nda BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP
  `;
  
  console.log("📝 Creating indexes for better performance...");
  
  // Add indexes for better query performance
  await sql`CREATE INDEX IF NOT EXISTS idx_pitches_require_nda ON pitches(require_nda)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pitches_published_at ON pitches(published_at)`;
  
  // Verify the columns were added
  const result = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'pitches' 
    AND column_name IN (
      'title_image', 'lookbook_url', 'pitch_deck_url', 
      'script_url', 'trailer_url', 'additional_media', 
      'production_timeline', 'require_nda', 'published_at'
    )
  `;
  
  console.log("\n✅ Migration completed successfully!");
  console.log("📋 Verified columns in database:");
  for (const row of result) {
    console.log(`   ✓ ${row.column_name}`);
  }
  
} catch (error) {
  console.error("❌ Migration error:", error);
  Deno.exit(1);
} finally {
  await sql.end();
}

console.log("\n🎉 Database schema updated successfully!");