// Migration to create analytics_events table
import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

async function createAnalyticsEventsTable() {
  try {
    console.log("Creating analytics_events table...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT,
        event_type TEXT NOT NULL,
        event_data JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("Creating indexes...");
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp)`);
    
    console.log("analytics_events table created successfully!");
  } catch (error) {
    console.error("Error creating analytics_events table:", error);
    throw error;
  }
}

// Run migration
await createAnalyticsEventsTable();
Deno.exit(0);