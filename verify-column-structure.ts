#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Verify Column Structure
 * Check specific columns that were causing issues
 */

import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

console.log("🔍 Verifying specific column structures...");

async function checkColumns(tableName: string, expectedColumns: string[]) {
  try {
    console.log(`\n📋 Checking ${tableName} table columns...`);
    
    const columns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
      ORDER BY ordinal_position
    `);
    
    console.log(`📝 ${tableName} columns found:`);
    for (const col of columns.rows) {
      const colName = col.column_name || col[0];
      const dataType = col.data_type || col[1];
      const nullable = col.is_nullable || col[2];
      console.log(`  - ${colName} (${dataType}) ${nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    }
    
    // Check for specific expected columns
    for (const expectedCol of expectedColumns) {
      const found = columns.rows.some(row => {
        const colName = row.column_name || row[0];
        return colName === expectedCol;
      });
      
      if (found) {
        console.log(`  ✅ ${expectedCol} exists`);
      } else {
        console.log(`  ❌ ${expectedCol} MISSING`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Error checking ${tableName}:`, error.message);
  }
}

// Check notifications table for read_at column
await checkColumns('notifications', ['read_at', 'user_id', 'type', 'title', 'message']);

// Check follows table for creator_id vs creatorId
await checkColumns('follows', ['creator_id', 'follower_id', 'pitch_id']);

// Check conversations table
await checkColumns('conversations', ['id', 'pitch_id', 'created_by_id']);

// Check analytics_events table
await checkColumns('analytics_events', ['id', 'event_type', 'user_id', 'pitch_id']);

// Test a few critical queries that were failing
console.log("\n🧪 Testing critical queries...");

try {
  console.log("\n📝 Testing notifications.read_at query...");
  const notificationTest = await db.execute(sql`
    SELECT id, read_at FROM notifications LIMIT 1
  `);
  console.log("✅ notifications.read_at query works");
} catch (error) {
  console.log("❌ notifications.read_at query failed:", error.message);
}

try {
  console.log("\n📝 Testing follows.creator_id query...");
  const followsTest = await db.execute(sql`
    SELECT id, creator_id, follower_id FROM follows LIMIT 1
  `);
  console.log("✅ follows.creator_id query works");
} catch (error) {
  console.log("❌ follows.creator_id query failed:", error.message);
}

try {
  console.log("\n📝 Testing conversations existence...");
  const conversationsTest = await db.execute(sql`
    SELECT id, created_by_id FROM conversations LIMIT 1
  `);
  console.log("✅ conversations query works");
} catch (error) {
  console.log("❌ conversations query failed:", error.message);
}

try {
  console.log("\n📝 Testing analytics_events existence...");
  const analyticsTest = await db.execute(sql`
    SELECT id, event_type FROM analytics_events LIMIT 1
  `);
  console.log("✅ analytics_events query works");
} catch (error) {
  console.log("❌ analytics_events query failed:", error.message);
}

console.log("\n✅ Column structure verification completed!");