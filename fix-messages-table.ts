// Fix messages table to include receiver_id column
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

async function fixMessagesTable() {
  console.log("🔧 Fixing messages table...");
  
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    // Check if receiver_id column exists, if not add it
    console.log("Adding receiver_id column if missing...");
    await db.execute(sql`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS receiver_id INTEGER
    `);

    console.log("✅ Messages table fixed!");
    
  } catch (error) {
    console.error("❌ Error fixing messages table:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the fix
if (import.meta.main) {
  await fixMessagesTable();
}