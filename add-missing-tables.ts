#!/usr/bin/env -S deno run --allow-env --allow-net

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("🔧 ADDING MISSING TABLES TO DATABASE");
console.log("=====================================\n");

async function addMissingTables() {
  try {
    // 1. Add analytics_events table (already exists, but let's verify)
    console.log("Checking analytics_events table...");
    const analyticsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'analytics_events'
      )
    `;
    
    if (!analyticsExists[0].exists) {
      console.log("Creating analytics_events table...");
      await sql`
        CREATE TABLE analytics_events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          category VARCHAR(50),
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
          session_id VARCHAR(255),
          event_data JSONB,
          metadata JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await sql`CREATE INDEX idx_analytics_events_user ON analytics_events(user_id)`;
      await sql`CREATE INDEX idx_analytics_events_pitch ON analytics_events(pitch_id)`;
      await sql`CREATE INDEX idx_analytics_events_type ON analytics_events(event_type)`;
      await sql`CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp)`;
      console.log("✅ analytics_events table created");
    } else {
      console.log("✅ analytics_events table already exists");
    }

    // 2. Add analytics_aggregates table
    console.log("\nCreating analytics_aggregates table...");
    await sql`
      CREATE TABLE IF NOT EXISTS analytics_aggregates (
        id SERIAL PRIMARY KEY,
        period VARCHAR(20) NOT NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        metric_type VARCHAR(50) NOT NULL,
        metric_value JSONB,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(period, period_start, metric_type, entity_type, entity_id)
      )
    `;
    console.log("✅ analytics_aggregates table created");

    // 3. Add user_sessions table
    console.log("\nCreating user_sessions table...");
    await sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
      )
    `;
    console.log("✅ user_sessions table created");

    // 4. Add search_analytics table
    console.log("\nCreating search_analytics table...");
    await sql`
      CREATE TABLE IF NOT EXISTS search_analytics (
        id SERIAL PRIMARY KEY,
        search_query TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        results_count INTEGER DEFAULT 0,
        clicked_result_id INTEGER,
        clicked_result_type VARCHAR(50),
        search_filters JSONB,
        session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(search_query)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at)`;
    console.log("✅ search_analytics table created");

    // 5. Add search_suggestions table
    console.log("\nCreating search_suggestions table...");
    await sql`
      CREATE TABLE IF NOT EXISTS search_suggestions (
        id SERIAL PRIMARY KEY,
        suggestion_text TEXT NOT NULL UNIQUE,
        suggestion_type VARCHAR(50),
        popularity_score INTEGER DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ search_suggestions table created");

    // 6. Verify sessions table exists (for auth)
    console.log("\nChecking sessions table...");
    const sessionsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sessions'
      )
    `;
    
    if (!sessionsExists[0].exists) {
      console.log("Creating sessions table...");
      await sql`
        CREATE TABLE sessions (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await sql`CREATE INDEX idx_sessions_token ON sessions(token)`;
      await sql`CREATE INDEX idx_sessions_user ON sessions(user_id)`;
      console.log("✅ sessions table created");
    } else {
      console.log("✅ sessions table already exists");
    }

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
await addMissingTables();
Deno.exit(0);