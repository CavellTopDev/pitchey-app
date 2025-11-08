// Migration to create analytics table
import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

async function createAnalyticsTable() {
  try {
    console.log("Creating analytics table...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        event_data JSONB,
        session_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        referrer TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    
    console.log("Creating indexes...");
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_pitch_id ON analytics(pitch_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp)`);
    
    console.log("Analytics table created successfully!");
  } catch (error) {
    console.error("Error creating analytics table:", error);
    throw error;
  }
}

// Run migration
await createAnalyticsTable();
Deno.exit(0);