#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Check Tables Properly
 * Use correct drizzle count syntax and run simple queries
 */

import { db } from "./src/db/client.ts";
import { users, pitches, ndaRequests, conversations, analyticsEvents, notifications, follows, messages, securityEvents } from "./src/db/schema.ts";
import { count, sql } from "drizzle-orm";

console.log("🔍 Checking tables with proper drizzle syntax...");

const tablesToCheck = [
  { name: "users", table: users },
  { name: "pitches", table: pitches },
  { name: "nda_requests", table: ndaRequests },
  { name: "conversations", table: conversations },
  { name: "analytics_events", table: analyticsEvents },
  { name: "notifications", table: notifications },
  { name: "follows", table: follows },
  { name: "messages", table: messages },
  { name: "security_events", table: securityEvents }
];

for (const { name, table } of tablesToCheck) {
  try {
    console.log(`\n📝 Testing ${name} table...`);
    
    // Try to count records using drizzle count function
    const result = await db.select({ count: count() }).from(table);
    const recordCount = result[0]?.count || 0;
    console.log(`✅ ${name} exists with ${recordCount} records`);
    
  } catch (error) {
    console.log(`❌ ${name} error:`, error.message);
    
    // Try alternative check using raw SQL
    try {
      const rawCheck = await db.execute(sql`SELECT 1 FROM ${sql.identifier(name)} LIMIT 1`);
      console.log(`✅ ${name} exists (verified with raw SQL)`);
    } catch (rawError) {
      console.log(`❌ ${name} does not exist:`, rawError.message);
    }
  }
}

// Also run the migration again to see what happens
console.log("\n🔄 Running migration command directly...");

try {
  await db.execute(sql`
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
  console.log("✅ conversations creation command executed");
  
  // Immediately check if it exists
  const check = await db.execute(sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'conversations'
  `);
  
  console.log("🔍 Check result:", check);
  
} catch (error) {
  console.log("❌ Direct migration error:", error.message);
}

console.log("\n✅ Table check completed");