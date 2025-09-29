#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Critical Tables Migration Script
 * Creates only the essential missing tables that tests are failing on
 */

import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

console.log("🚀 Creating critical missing database tables...");

async function executeSQL(description: string, sqlStatement: string) {
  try {
    console.log(`📝 ${description}...`);
    await db.execute(sql.raw(sqlStatement));
    console.log(`✅ Success: ${description}`);
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`ℹ️  ${description} already exists, skipping...`);
    } else {
      console.error(`❌ Error: ${description}:`, error.message);
      throw error;
    }
  }
}

try {
  // 1. Create conversations table
  await executeSQL("Creating conversations table", `
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200),
      is_group BOOLEAN DEFAULT FALSE,
      last_message_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await executeSQL("Creating conversations indexes", `
    CREATE INDEX IF NOT EXISTS conversations_pitch_id_idx ON conversations(pitch_id)
  `);

  // 2. Create analytics_events table with enum
  await executeSQL("Creating event_type enum", `
    DO $$ BEGIN
      CREATE TYPE event_type AS ENUM (
        'view', 'click', 'scroll', 'video_play', 'video_pause', 'video_complete', 
        'download', 'signup', 'login', 'logout', 'nda_request', 'nda_signed', 
        'follow', 'unfollow', 'message_sent', 'profile_update', 'search', 'filter'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);

  await executeSQL("Creating analytics_events table", `
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      event_id UUID DEFAULT gen_random_uuid() NOT NULL,
      event_type event_type NOT NULL,
      category VARCHAR(50),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_id VARCHAR(100),
      anonymous_id VARCHAR(100),
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
      message_id INTEGER,
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
      experiments JSONB,
      timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
      processed_at TIMESTAMP
    )
  `);

  await executeSQL("Creating analytics_events indexes", `
    CREATE INDEX IF NOT EXISTS analytics_events_pitch_id_idx ON analytics_events(pitch_id)
  `);

  // 3. Create notifications table  
  await executeSQL("Creating notifications table", `
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      related_pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      related_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      related_nda_request_id INTEGER,
      is_read BOOLEAN DEFAULT FALSE,
      action_url TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      read_at TIMESTAMP
    )
  `);

  await executeSQL("Creating notifications indexes", `
    CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id)
  `);

  // 4. Create follows table
  await executeSQL("Creating follows table", `
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      followed_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await executeSQL("Creating follows indexes", `
    CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows(follower_id)
  `);

  // Skip unique constraints for now since pitch_id can be NULL
  console.log("ℹ️  Skipping follows unique constraints (pitch_id can be NULL)");

  // 5. Create messages table
  await executeSQL("Creating messages table", `
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      parent_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      subject VARCHAR(200),
      content TEXT NOT NULL,
      message_type VARCHAR(50) DEFAULT 'text',
      attachments JSONB,
      is_read BOOLEAN DEFAULT FALSE,
      is_edited BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      off_platform_requested BOOLEAN DEFAULT FALSE,
      off_platform_approved BOOLEAN DEFAULT FALSE,
      sent_at TIMESTAMP DEFAULT NOW() NOT NULL,
      read_at TIMESTAMP,
      edited_at TIMESTAMP,
      deleted_at TIMESTAMP
    )
  `);

  await executeSQL("Creating messages indexes", `
    CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id)
  `);

  // 6. Create security_events table
  await executeSQL("Creating security_events table", `
    CREATE TABLE IF NOT EXISTS security_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(50) NOT NULL,
      event_status VARCHAR(20) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      location JSONB,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  console.log("\n🎉 All critical tables created successfully!");
  
  // Verify tables exist
  console.log("\n🔍 Verifying created tables...");
  const tableChecks = ['conversations', 'analytics_events', 'notifications', 'follows', 'messages', 'security_events'];
  
  for (const tableName of tableChecks) {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        );
      `);
      
      if (result.rows[0]?.[0]) {
        console.log(`✅ ${tableName} exists`);
      } else {
        console.log(`❌ ${tableName} NOT found`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${tableName}:`, error.message);
    }
  }

} catch (error) {
  console.error("💥 Migration failed:", error);
  process.exit(1);
}

console.log("\n✅ Critical tables migration completed!");