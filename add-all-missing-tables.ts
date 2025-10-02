#!/usr/bin/env -S deno run --allow-env --allow-net

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("🔧 ADDING ALL MISSING TABLES TO DATABASE");
console.log("=========================================\n");

async function addAllMissingTables() {
  try {
    // 1. Add watchlist table
    console.log("Creating watchlist table...");
    await sql`
      CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, pitch_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_watchlist_pitch ON watchlist(pitch_id)`;
    console.log("✅ watchlist table created");

    // 2. Add conversations table
    console.log("\nCreating conversations table...");
    await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ conversations table created");

    // 3. Add conversation_participants table
    console.log("\nCreating conversation_participants table...");
    await sql`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      )
    `;
    console.log("✅ conversation_participants table created");

    // 4. Add message_read_receipts table
    console.log("\nCreating message_read_receipts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS message_read_receipts (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      )
    `;
    console.log("✅ message_read_receipts table created");

    // 5. Add typing_indicators table
    console.log("\nCreating typing_indicators table...");
    await sql`
      CREATE TABLE IF NOT EXISTS typing_indicators (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ typing_indicators table created");

    // 6. Add analytics table (simplified)
    console.log("\nCreating analytics table...");
    await sql`
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ analytics table created");

    // 7. Add nda_requests table
    console.log("\nCreating nda_requests table...");
    await sql`
      CREATE TABLE IF NOT EXISTS nda_requests (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        approved_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ nda_requests table created");

    // 8. Add security_events table
    console.log("\nCreating security_events table...");
    await sql`
      CREATE TABLE IF NOT EXISTS security_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id)`;
    console.log("✅ security_events table created");

    // List all tables to confirm
    console.log("\n📊 Final table list:");
    const allTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    allTables.forEach(t => console.log(`  ✓ ${t.table_name}`));
    
    console.log("\n🎉 All missing tables have been added successfully!");
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Run the script
await addAllMissingTables();
Deno.exit(0);