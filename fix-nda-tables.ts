// Fix NDA tables to match Drizzle schema
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'npm:drizzle-orm@0.35.3';

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

async function fixNDATables() {
  console.log("🔧 Fixing NDA tables...");
  
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    // Add signer_id column to ndas table if it doesn't exist
    console.log("Adding signer_id column to ndas table...");
    await db.execute(sql`
      ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS signer_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    `);

    // Add nda_type column if missing
    console.log("Adding nda_type column to ndas table...");
    await db.execute(sql`
      ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS nda_type VARCHAR(20) DEFAULT 'basic'
    `);

    // Ensure all required columns exist in nda_requests
    console.log("Ensuring nda_requests table has all columns...");
    
    await db.execute(sql`
      ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS nda_type VARCHAR(20) DEFAULT 'basic'
    `);

    await db.execute(sql`
      ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
    `);

    // Create indexes for better performance
    console.log("Creating indexes...");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ndas_signer_id_idx ON ndas(signer_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ndas_pitch_id_idx ON ndas(pitch_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS nda_requests_owner_id_idx ON nda_requests(owner_id)
    `);

    console.log("✅ NDA tables fixed successfully!");
    
  } catch (error) {
    console.error("❌ Error fixing NDA tables:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the fix
if (import.meta.main) {
  await fixNDATables();
}