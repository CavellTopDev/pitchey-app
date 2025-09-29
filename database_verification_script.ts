#!/usr/bin/env -S deno run --allow-net --allow-env

// Database verification script to compare schema.ts with actual database
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

const client = new Client(DATABASE_URL);

try {
  await client.connect();
  console.log("✅ Connected to database");

  // Schema-defined tables (from reading the schema.ts file)
  const schemaTables = [
    "users", "pitches", "nda_requests", "ndas", "pitch_views", "follows", 
    "conversations", "conversation_participants", "messages", "message_read_receipts", 
    "typing_indicators", "payments", "credit_transactions", "user_credits", 
    "subscription_history", "deals", "invoices", "payment_methods", "transactions",
    "analytics_events", "user_sessions", "analytics_aggregates", "conversion_funnels",
    "funnel_events", "user_cohorts", "cohort_users", "realtime_analytics", 
    "notifications", "sessions", "password_reset_tokens", "email_verification_tokens",
    "login_attempts", "two_factor_auth", "security_events", "email_preferences",
    "email_queue", "email_events", "unsubscribe_tokens", "email_suppression",
    "digest_history", "saved_searches", "search_history", "search_suggestions",
    "search_click_tracking", "search_analytics", "watchlist", "analytics", "portfolio"
  ];

  // Get existing tables from database
  const result = await client.queryObject(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  
  const existingTables = result.rows.map(row => row.table_name as string);
  
  console.log("\n📊 DATABASE VERIFICATION REPORT");
  console.log("=" .repeat(50));
  
  console.log(`\n✅ EXISTING TABLES (${existingTables.length}):`);
  existingTables.forEach(table => console.log(`  - ${table}`));
  
  // Find missing tables
  const missingTables = schemaTables.filter(table => !existingTables.includes(table));
  
  console.log(`\n❌ MISSING TABLES (${missingTables.length}):`);
  if (missingTables.length > 0) {
    missingTables.forEach(table => console.log(`  - ${table}`));
  } else {
    console.log("  None - All schema tables exist!");
  }
  
  // Find extra tables (not in schema)
  const extraTables = existingTables.filter(table => !schemaTables.includes(table));
  
  console.log(`\n⚠️  EXTRA TABLES (${extraTables.length}):`);
  if (extraTables.length > 0) {
    extraTables.forEach(table => console.log(`  - ${table}`));
  } else {
    console.log("  None");
  }

  // Check enums
  const enumResult = await client.queryObject(
    "SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname"
  );
  const existingEnums = enumResult.rows.map(row => row.typname as string);
  
  console.log(`\n🔧 EXISTING ENUMS (${existingEnums.length}):`);
  existingEnums.forEach(enumName => console.log(`  - ${enumName}`));

  // Critical columns check for key tables
  console.log("\n🔍 CRITICAL COLUMNS CHECK:");
  
  // Check follows table for required columns
  const followsResult = await client.queryObject(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'follows' AND table_schema = 'public'
    ORDER BY column_name
  `);
  const followsColumns = followsResult.rows.map(row => row.column_name as string);
  console.log(`\n  follows table columns: ${followsColumns.join(', ')}`);
  
  const requiredFollowsColumns = ['creator_id', 'pitch_id', 'follower_id'];
  const missingFollowsColumns = requiredFollowsColumns.filter(col => !followsColumns.includes(col));
  if (missingFollowsColumns.length > 0) {
    console.log(`  ❌ Missing in follows: ${missingFollowsColumns.join(', ')}`);
  } else {
    console.log(`  ✅ All required follows columns present`);
  }

  // Check notifications table for read_at column
  const notificationsResult = await client.queryObject(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'notifications' AND table_schema = 'public'
    ORDER BY column_name
  `);
  const notificationsColumns = notificationsResult.rows.map(row => row.column_name as string);
  console.log(`\n  notifications table columns: ${notificationsColumns.join(', ')}`);
  
  if (notificationsColumns.includes('read_at')) {
    console.log(`  ✅ read_at column exists in notifications`);
  } else {
    console.log(`  ❌ read_at column missing in notifications`);
  }

  console.log("\n" + "=" .repeat(50));
  console.log("📈 SUMMARY:");
  console.log(`  Total schema tables: ${schemaTables.length}`);
  console.log(`  Total existing tables: ${existingTables.length}`);
  console.log(`  Missing tables: ${missingTables.length}`);
  console.log(`  Extra tables: ${extraTables.length}`);
  console.log(`  Total enums: ${existingEnums.length}`);

} catch (error) {
  console.error("❌ Error:", error);
} finally {
  await client.end();
}