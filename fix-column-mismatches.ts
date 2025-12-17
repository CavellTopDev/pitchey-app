#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Fix Column Mismatches
 * Add missing columns and fix column name mismatches
 */

import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

console.log("🔧 Fixing column mismatches...");

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
    }
  }
}

try {
  // Fix notifications table - add read_at column
  await executeSQL("Adding read_at column to notifications", `
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP
  `);

  // Fix follows table - add creator_id and pitch_id columns
  await executeSQL("Adding creator_id column to follows", `
    ALTER TABLE follows ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE
  `);

  await executeSQL("Adding pitch_id column to follows", `
    ALTER TABLE follows ADD COLUMN IF NOT EXISTS pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE
  `);

  // Create index for the new columns
  await executeSQL("Creating index on follows.creator_id", `
    CREATE INDEX IF NOT EXISTS follows_creator_id_idx ON follows(creator_id)
  `);

  await executeSQL("Creating index on follows.pitch_id", `
    CREATE INDEX IF NOT EXISTS follows_pitch_id_idx ON follows(pitch_id)
  `);

  console.log("\n🎉 Column fixes completed successfully!");
  
  // Verify the fixes
  console.log("\n🔍 Verifying fixes...");
  
  try {
    const notificationTest = await db.execute(sql`
      SELECT id, read_at FROM notifications LIMIT 1
    `);
    console.log("✅ notifications.read_at now works");
  } catch (error) {
    console.log("❌ notifications.read_at still failing:", error.message);
  }

  try {
    const followsTest = await db.execute(sql`
      SELECT id, creator_id, pitch_id, follower_id, following_id FROM follows LIMIT 1
    `);
    console.log("✅ follows.creator_id and pitch_id now work");
  } catch (error) {
    console.log("❌ follows columns still failing:", error.message);
  }

  // Check updated column structure
  console.log("\n📋 Updated follows table structure:");
  const followsColumns = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'follows'
    ORDER BY ordinal_position
  `);
  
  for (const col of followsColumns.rows) {
    const colName = col.column_name || col[0];
    const dataType = col.data_type || col[1];
    console.log(`  - ${colName} (${dataType})`);
  }

  console.log("\n📋 Updated notifications table structure:");
  const notificationColumns = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
    AND column_name IN ('read_at', 'is_read')
    ORDER BY ordinal_position
  `);
  
  for (const col of notificationColumns.rows) {
    const colName = col.column_name || col[0];
    const dataType = col.data_type || col[1];
    console.log(`  - ${colName} (${dataType})`);
  }

} catch (error) {
  console.error("💥 Column fix failed:", error);
}

console.log("\n✅ Column mismatch fixes completed!");