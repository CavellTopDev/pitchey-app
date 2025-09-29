#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Complete Missing Tables Migration Script
 * Creates all missing tables based on current schema requirements
 */

import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

console.log("🚀 Creating missing database tables...");

const migrations = [
  {
    name: "conversations table",
    statements: [
      `CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200),
        is_group BOOLEAN DEFAULT FALSE,
        last_message_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS conversations_pitch_id_idx ON conversations(pitch_id)`,
      `CREATE INDEX IF NOT EXISTS conversations_created_by_id_idx ON conversations(created_by_id)`,
      `CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx ON conversations(last_message_at)`
    ]
  },
  {
    name: "conversation_participants table", 
    sql: `
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT TRUE,
        joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
        left_at TIMESTAMP,
        mute_notifications BOOLEAN DEFAULT FALSE,
        UNIQUE(conversation_id, user_id)
      );
      
      CREATE INDEX IF NOT EXISTS conversation_participants_conversation_id_idx ON conversation_participants(conversation_id);
      CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx ON conversation_participants(user_id);
    `
  },
  {
    name: "messages table",
    sql: `
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
      );
      
      CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS messages_pitch_id_idx ON messages(pitch_id);
      CREATE INDEX IF NOT EXISTS messages_parent_message_id_idx ON messages(parent_message_id);
      CREATE INDEX IF NOT EXISTS messages_sent_at_idx ON messages(sent_at);
    `
  },
  {
    name: "message_read_receipts table",
    sql: `
      CREATE TABLE IF NOT EXISTS message_read_receipts (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delivered_at TIMESTAMP DEFAULT NOW() NOT NULL,
        read_at TIMESTAMP,
        UNIQUE(message_id, user_id)
      );
      
      CREATE INDEX IF NOT EXISTS message_read_receipts_message_id_idx ON message_read_receipts(message_id);
      CREATE INDEX IF NOT EXISTS message_read_receipts_user_id_idx ON message_read_receipts(user_id);
    `
  },
  {
    name: "typing_indicators table",
    sql: `
      CREATE TABLE IF NOT EXISTS typing_indicators (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_typing BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(conversation_id, user_id)
      );
      
      CREATE INDEX IF NOT EXISTS typing_indicators_conversation_id_idx ON typing_indicators(conversation_id);
      CREATE INDEX IF NOT EXISTS typing_indicators_updated_at_idx ON typing_indicators(updated_at);
    `
  },
  {
    name: "follows table",
    sql: `
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        followed_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(follower_id, pitch_id),
        UNIQUE(follower_id, creator_id)
      );
      
      CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows(follower_id);
    `
  },
  {
    name: "notifications table",
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        related_pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        related_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        related_nda_request_id INTEGER REFERENCES nda_requests(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        action_url TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        read_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
    `
  },
  {
    name: "analytics_events table",
    sql: `
      CREATE TYPE IF NOT EXISTS event_type AS ENUM (
        'view', 'click', 'scroll', 'video_play', 'video_pause', 'video_complete', 
        'download', 'signup', 'login', 'logout', 'nda_request', 'nda_signed', 
        'follow', 'unfollow', 'message_sent', 'profile_update', 'search', 'filter'
      );
      
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
        experiments JSONB,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
        processed_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS analytics_events_event_id_idx ON analytics_events(event_id);
      CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON analytics_events(event_type);
      CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx ON analytics_events(user_id);
      CREATE INDEX IF NOT EXISTS analytics_events_session_id_idx ON analytics_events(session_id);
      CREATE INDEX IF NOT EXISTS analytics_events_pitch_id_idx ON analytics_events(pitch_id);
      CREATE INDEX IF NOT EXISTS analytics_events_timestamp_idx ON analytics_events(timestamp);
      CREATE INDEX IF NOT EXISTS analytics_events_category_idx ON analytics_events(category);
      CREATE INDEX IF NOT EXISTS analytics_events_country_idx ON analytics_events(country);
      CREATE INDEX IF NOT EXISTS analytics_events_device_type_idx ON analytics_events(device_type);
    `
  },
  {
    name: "watchlist table",
    sql: `
      CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        notes TEXT,
        priority TEXT DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(user_id, pitch_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
      CREATE INDEX IF NOT EXISTS idx_watchlist_pitch_id ON watchlist(pitch_id);
    `
  },
  {
    name: "analytics table",
    sql: `
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
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_analytics_pitch_id ON analytics(pitch_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);
    `
  },
  {
    name: "portfolio table",
    sql: `
      CREATE TABLE IF NOT EXISTS portfolio (
        id SERIAL PRIMARY KEY,
        investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE RESTRICT,
        amount_invested DECIMAL(15, 2),
        ownership_percentage DECIMAL(5, 2),
        status TEXT DEFAULT 'active',
        invested_at TIMESTAMP DEFAULT NOW() NOT NULL,
        exited_at TIMESTAMP,
        returns DECIMAL(15, 2),
        notes TEXT,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_portfolio_investor_id ON portfolio(investor_id);
      CREATE INDEX IF NOT EXISTS idx_portfolio_pitch_id ON portfolio(pitch_id);
      CREATE INDEX IF NOT EXISTS idx_portfolio_status ON portfolio(status);
    `
  },
  {
    name: "security_events table",
    sql: `
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
      );
      
      CREATE INDEX IF NOT EXISTS security_events_user_id_idx ON security_events(user_id);
      CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON security_events(event_type);
      CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events(created_at);
    `
  }
];

async function runMigrations() {
  try {
    for (const migration of migrations) {
      console.log(`\n📝 Creating ${migration.name}...`);
      try {
        await db.execute(sql.raw(migration.sql));
        console.log(`✅ Successfully created ${migration.name}`);
      } catch (error) {
        console.error(`❌ Error creating ${migration.name}:`, error.message);
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`ℹ️  ${migration.name} already exists, skipping...`);
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    }
    
    console.log("\n🎉 All missing tables created successfully!");
    
    // Verify tables were created
    console.log("\n🔍 Verifying created tables...");
    
    const tableChecks = [
      'conversations', 'analytics_events', 'notifications', 'follows',
      'watchlist', 'analytics', 'portfolio', 'security_events'
    ];
    
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
}

await runMigrations();
console.log("\n✅ Migration completed successfully!");