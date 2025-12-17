#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Minimal Tables Migration Script
 * Creates only the essential tables without complex constraints
 */

import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

console.log("🚀 Creating minimal essential database tables...");

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
      // Don't throw - continue with other tables
    }
  }
}

try {
  // Create event_type enum first
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

  // Create conversations table
  await executeSQL("Creating conversations table", `
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      pitch_id INTEGER,
      created_by_id INTEGER NOT NULL,
      title VARCHAR(200),
      is_group BOOLEAN DEFAULT FALSE,
      last_message_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Create analytics_events table
  await executeSQL("Creating analytics_events table", `
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      event_id UUID DEFAULT gen_random_uuid() NOT NULL,
      event_type event_type NOT NULL,
      category VARCHAR(50),
      user_id INTEGER,
      session_id VARCHAR(100),
      anonymous_id VARCHAR(100),
      pitch_id INTEGER,
      conversation_id INTEGER,
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

  // Create notifications table with read_at
  await executeSQL("Creating notifications table", `
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      related_pitch_id INTEGER,
      related_user_id INTEGER,
      related_nda_request_id INTEGER,
      is_read BOOLEAN DEFAULT FALSE,
      action_url TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      read_at TIMESTAMP
    )
  `);

  // Create follows table (note: using creator_id not creatorId to match error message)
  await executeSQL("Creating follows table", `
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER NOT NULL,
      pitch_id INTEGER,
      creator_id INTEGER,
      followed_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Create messages table
  await executeSQL("Creating messages table", `
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER,
      pitch_id INTEGER,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER,
      parent_message_id INTEGER,
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

  // Create security_events table
  await executeSQL("Creating security_events table", `
    CREATE TABLE IF NOT EXISTS security_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      event_type VARCHAR(50) NOT NULL,
      event_status VARCHAR(20) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      location JSONB,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  console.log("\n🎉 Essential tables created successfully!");
  
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
        
        // Check specific columns for key tables
        if (tableName === 'notifications') {
          const readAtCheck = await db.execute(sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'notifications' 
            AND column_name = 'read_at';
          `);
          
          if (readAtCheck.rows.length > 0) {
            console.log(`  ✅ notifications.read_at column exists`);
          } else {
            console.log(`  ❌ notifications.read_at column missing`);
          }
        }
        
        if (tableName === 'follows') {
          const creatorIdCheck = await db.execute(sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'follows' 
            AND column_name = 'creator_id';
          `);
          
          if (creatorIdCheck.rows.length > 0) {
            console.log(`  ✅ follows.creator_id column exists`);
          } else {
            console.log(`  ❌ follows.creator_id column missing`);
          }
        }
        
      } else {
        console.log(`❌ ${tableName} NOT found`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${tableName}:`, error.message);
    }
  }

} catch (error) {
  console.error("💥 Migration failed:", error);
}

console.log("\n✅ Minimal tables migration completed!");