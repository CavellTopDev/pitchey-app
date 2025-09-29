// Drizzle migration to sync analytics_events table
import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("Dropping existing analytics_events table if exists...");
    await db.execute(sql`DROP TABLE IF EXISTS analytics_events CASCADE`);
    
    console.log("Creating analytics_events table with proper schema...");
    
    // First create the enum if it doesn't exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE event_type AS ENUM (
          'page_view',
          'pitch_view',
          'pitch_like',
          'pitch_save',
          'nda_request',
          'nda_signed',
          'message_sent',
          'message_read',
          'profile_update',
          'search',
          'filter_applied',
          'session_start',
          'session_end'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await db.execute(sql`
      CREATE TABLE analytics_events (
        id SERIAL PRIMARY KEY,
        event_id UUID DEFAULT gen_random_uuid() NOT NULL,
        event_type event_type NOT NULL,
        category VARCHAR(50),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        session_id VARCHAR(100),
        anonymous_id VARCHAR(100),
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        referrer TEXT,
        pathname TEXT,
        country VARCHAR(3),
        region VARCHAR(100),
        city VARCHAR(100),
        device_type VARCHAR(20),
        browser VARCHAR(50),
        os VARCHAR(50),
        event_data JSONB,
        metadata JSONB,
        experiments JSONB,
        revenue DECIMAL(10,2),
        value DECIMAL(10,2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      )
    `);
    
    console.log("Creating indexes...");
    await db.execute(sql`CREATE INDEX idx_analytics_events_event_id ON analytics_events(event_id)`);
    await db.execute(sql`CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id)`);
    await db.execute(sql`CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type)`);
    await db.execute(sql`CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp)`);
    await db.execute(sql`CREATE INDEX idx_analytics_events_pitch_id ON analytics_events(pitch_id)`);
    await db.execute(sql`CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id)`);
    
    console.log("Analytics events table created successfully!");
  } catch (error) {
    console.error("Error creating analytics_events table:", error);
    throw error;
  }
}

// Run migration
await migrate();
Deno.exit(0);