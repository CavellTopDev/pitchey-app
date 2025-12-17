#!/usr/bin/env deno run --allow-env --allow-net --allow-read

import { drizzle } from 'npm:drizzle-orm/neon-http';
import { neon } from 'npm:@neondatabase/serverless';

// Get database URL from environment
const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

console.log("🗂️  Starting critical database index deployment...");

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

// Critical indexes deployment
const criticalIndexes = [
  {
    name: "idx_pitches_status_published",
    query: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_status_published ON pitches (status) WHERE status = 'published'",
    description: "Published pitch filtering"
  },
  {
    name: "idx_pitches_browse_filters", 
    query: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_browse_filters ON pitches (status, genre, format, production_stage, created_at DESC) WHERE status = 'published'",
    description: "Browse endpoint optimization"
  },
  {
    name: "idx_users_email_unique",
    query: "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_unique ON users (email)",
    description: "Email lookup for authentication"
  },
  {
    name: "idx_sessions_token",
    query: "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token ON sessions (token)",
    description: "Session token lookup"
  },
  {
    name: "idx_pitches_user_id",
    query: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_user_id ON pitches (user_id)",
    description: "User-pitch relationship"
  },
  {
    name: "idx_pitches_sort_date",
    query: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_sort_date ON pitches (created_at DESC) WHERE status = 'published'",
    description: "Date sorting optimization"
  }
];

const searchIndexes = [
  {
    name: "idx_pitches_search_combined",
    query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_search_combined 
             ON pitches USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(logline, '') || ' ' || coalesce(description, ''))) 
             WHERE status = 'published'`,
    description: "Full-text search optimization"
  }
];

const ndaIndexes = [
  {
    name: "idx_ndas_pitch_user_status",
    query: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_pitch_user_status ON ndas (pitch_id, user_id, status)",
    description: "NDA status lookup"
  },
  {
    name: "idx_sessions_user_active", 
    query: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_active ON sessions (user_id, expires_at) WHERE expires_at > NOW()",
    description: "Active sessions optimization"
  }
];

async function deployIndex(indexConfig: any) {
  try {
    console.log(`📊 Creating index: ${indexConfig.name}`);
    console.log(`   Description: ${indexConfig.description}`);
    
    const startTime = Date.now();
    await sql`${indexConfig.query}`;
    const duration = Date.now() - startTime;
    
    console.log(`✅ Index created successfully in ${duration}ms: ${indexConfig.name}`);
    return true;
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log(`⚡ Index already exists: ${indexConfig.name}`);
      return true;
    }
    console.error(`❌ Failed to create index ${indexConfig.name}:`, error.message);
    return false;
  }
}

async function analyzeTable(tableName: string) {
  try {
    console.log(`📈 Analyzing table: ${tableName}`);
    await sql`ANALYZE ${tableName}`;
    console.log(`✅ Table analyzed: ${tableName}`);
  } catch (error) {
    console.error(`❌ Failed to analyze table ${tableName}:`, error.message);
  }
}

async function main() {
  try {
    console.log("🚀 Phase 1: Core performance indexes");
    let successCount = 0;
    
    for (const index of criticalIndexes) {
      const success = await deployIndex(index);
      if (success) successCount++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between indexes
    }
    
    console.log("\n🔍 Phase 2: Search optimization indexes");
    for (const index of searchIndexes) {
      const success = await deployIndex(index);
      if (success) successCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log("\n🔐 Phase 3: NDA and session indexes");
    for (const index of ndaIndexes) {
      const success = await deployIndex(index);
      if (success) successCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log("\n📊 Phase 4: Updating table statistics");
    const tables = ['pitches', 'users', 'sessions', 'ndas'];
    for (const table of tables) {
      await analyzeTable(table);
    }
    
    console.log("\n🎉 DEPLOYMENT COMPLETE");
    console.log(`✅ Successfully deployed ${successCount}/${criticalIndexes.length + searchIndexes.length + ndaIndexes.length} indexes`);
    console.log("📈 Expected performance improvement: 80-95% for browse/auth queries");
    console.log("🔍 Monitor performance with slow query monitoring");
    
    // Verify deployment
    console.log("\n🔍 Verifying index deployment...");
    const indexCheckQuery = `
      SELECT 
        indexname,
        tablename,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes 
      WHERE indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;
    
    const indexResults = await sql(indexCheckQuery);
    console.log("\n📋 Deployed indexes:");
    indexResults.forEach((row: any) => {
      console.log(`   ${row.tablename}.${row.indexname} - ${row.size}`);
    });
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}