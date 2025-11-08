#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * List All Tables Script
 * Shows all existing tables in the database
 */

import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

console.log("🔍 Listing all tables in database...");

try {
  // List all tables
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  
  console.log("\n📋 Tables found:");
  if (tables.rows.length === 0) {
    console.log("❌ No tables found!");
  } else {
    for (const table of tables.rows) {
      console.log(`  - ${table[0]}`);
    }
  }
  
  // Check if we can create a simple test table
  console.log("\n🧪 Testing table creation permissions...");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS test_table_permissions (
        id SERIAL PRIMARY KEY,
        test_field VARCHAR(50)
      );
    `);
    console.log("✅ Table creation permissions work");
    
    // Check if it shows up
    const testCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'test_table_permissions'
      );
    `);
    
    if (testCheck.rows[0]?.[0]) {
      console.log("✅ Test table exists and is visible");
      
      // Clean up
      await db.execute(sql`DROP TABLE test_table_permissions;`);
      console.log("✅ Test table cleaned up");
    } else {
      console.log("❌ Test table not visible after creation");
    }
    
  } catch (error) {
    console.log("❌ Table creation failed:", error.message);
  }
  
} catch (error) {
  console.error("💥 Database error:", error);
}

console.log("\n✅ Table listing completed");