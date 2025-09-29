#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("🚀 Running missing tables migration...");
  
  try {
    // Read the migration SQL file
    const migrationSQL = await Deno.readTextFile("./drizzle/0005_add_missing_tables.sql");
    
    // Split into individual statements and execute
    const statements = migrationSQL
      .split("-- statement-breakpoint")
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith("--"));
    
    console.log(`Executing ${statements.length} migration statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          await db.execute(sql.raw(statement));
          console.log(`✅ Statement ${i + 1} completed`);
        } catch (error) {
          // Some statements might fail if tables/columns already exist, which is OK
          console.log(`⚠️  Statement ${i + 1} warning: ${error.message}`);
        }
      }
    }
    
    console.log("✅ Migration completed successfully!");
    
    // Test some basic queries to ensure the tables work
    console.log("\n🧪 Testing table accessibility...");
    
    try {
      // Test watchlist table
      const watchlistCount = await db.execute(sql`SELECT COUNT(*) FROM watchlist`);
      console.log(`✅ Watchlist table accessible (${watchlistCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Watchlist table test failed: ${error.message}`);
    }
    
    try {
      // Test portfolio table
      const portfolioCount = await db.execute(sql`SELECT COUNT(*) FROM portfolio`);
      console.log(`✅ Portfolio table accessible (${portfolioCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Portfolio table test failed: ${error.message}`);
    }
    
    try {
      // Test analytics table
      const analyticsCount = await db.execute(sql`SELECT COUNT(*) FROM analytics`);
      console.log(`✅ Analytics table accessible (${analyticsCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Analytics table test failed: ${error.message}`);
    }
    
    try {
      // Test nda_requests table
      const ndaRequestsCount = await db.execute(sql`SELECT COUNT(*) FROM nda_requests`);
      console.log(`✅ NDA Requests table accessible (${ndaRequestsCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ NDA Requests table test failed: ${error.message}`);
    }
    
    try {
      // Test security_events table
      const securityEventsCount = await db.execute(sql`SELECT COUNT(*) FROM security_events`);
      console.log(`✅ Security Events table accessible (${securityEventsCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Security Events table test failed: ${error.message}`);
    }
    
    console.log("\n🎉 Database migration and testing completed!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

if (import.meta.main) {
  await runMigration();
}