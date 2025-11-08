#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Database Structure Check Script
 * Verifies which tables exist and their column structures
 */

import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

console.log("🔍 Checking database structure...");

try {
  // Check if tables exist
  const tableChecks = [
    'conversations',
    'analytics_events', 
    'notifications',
    'follows'
  ];

  for (const tableName of tableChecks) {
    try {
      console.log(`\n📋 Checking table: ${tableName}`);
      
      // Check if table exists
      const tableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        );
      `);
      
      if (tableExists.rows[0]?.[0]) {
        console.log(`✅ Table ${tableName} exists`);
        
        // Get column information
        const columns = await db.execute(sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
          ORDER BY ordinal_position;
        `);
        
        console.log(`📝 Columns in ${tableName}:`);
        for (const col of columns.rows) {
          console.log(`   - ${col[0]} (${col[1]}) ${col[2] === 'YES' ? 'NULL' : 'NOT NULL'}`);
        }
        
      } else {
        console.log(`❌ Table ${tableName} does NOT exist`);
      }
      
    } catch (error) {
      console.log(`❌ Error checking ${tableName}:`, error.message);
    }
  }

  // Check for specific columns that are causing issues
  console.log("\n🔍 Checking specific problematic columns...");
  
  try {
    const notificationsReadAt = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'read_at';
    `);
    
    if (notificationsReadAt.rows.length > 0) {
      console.log("✅ notifications.read_at column exists");
    } else {
      console.log("❌ notifications.read_at column MISSING");
    }
  } catch (error) {
    console.log("❌ Error checking notifications.read_at:", error.message);
  }

  try {
    const followsColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'follows'
      AND column_name IN ('creator_id', 'creatorId', 'followingId');
    `);
    
    console.log("🔍 follows table columns found:");
    for (const col of followsColumns.rows) {
      console.log(`   - ${col[0]}`);
    }
  } catch (error) {
    console.log("❌ Error checking follows columns:", error.message);
  }

} catch (error) {
  console.error("💥 Database connection error:", error);
}

console.log("\n✅ Database structure check completed");