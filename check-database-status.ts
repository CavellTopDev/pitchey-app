#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { db } from "./src/db/client.ts";
import { users, pitches, investments, ndas, follows, notifications } from "./src/db/schema.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

const DATABASE_URL = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

console.log("🔍 Checking Neon PostgreSQL Database Status...");
console.log("=" .repeat(50));

async function checkDatabase() {
  try {
    // Test connection
    const startTime = performance.now();
    const testQuery = await db.execute(sql`SELECT 1 as test`);
    const latency = (performance.now() - startTime).toFixed(2);
    
    console.log("✅ Database Connection: SUCCESSFUL");
    console.log(`   Latency: ${latency}ms`);
    console.log("");
    
    // Get table counts
    console.log("📊 Table Statistics:");
    console.log("-" .repeat(50));
    
    // Users
    const userCount = await db.select({ count: sql`count(*)::int` }).from(users);
    console.log(`   Users: ${userCount[0]?.count || 0}`);
    
    // Get user breakdown by type
    const userTypes = await db.execute(sql`
      SELECT user_type, COUNT(*)::int as count 
      FROM users 
      GROUP BY user_type
    `);
    for (const type of userTypes) {
      console.log(`     - ${type.user_type}: ${type.count}`);
    }
    
    // Pitches
    const pitchCount = await db.select({ count: sql`count(*)::int` }).from(pitches);
    console.log(`   Pitches: ${pitchCount[0]?.count || 0}`);
    
    // Get pitch status breakdown
    const pitchStatuses = await db.execute(sql`
      SELECT status, COUNT(*)::int as count 
      FROM pitches 
      GROUP BY status
    `);
    for (const status of pitchStatuses) {
      console.log(`     - ${status.status || 'draft'}: ${status.count}`);
    }
    
    // Investments
    const investmentCount = await db.select({ count: sql`count(*)::int` }).from(investments);
    console.log(`   Investments: ${investmentCount[0]?.count || 0}`);
    
    // NDAs
    const ndaCount = await db.select({ count: sql`count(*)::int` }).from(ndas);
    console.log(`   NDAs: ${ndaCount[0]?.count || 0}`);
    
    // Follows
    const followCount = await db.select({ count: sql`count(*)::int` }).from(follows);
    console.log(`   Follows: ${followCount[0]?.count || 0}`);
    
    // Notifications
    const notificationCount = await db.select({ count: sql`count(*)::int` }).from(notifications);
    console.log(`   Notifications: ${notificationCount[0]?.count || 0}`);
    
    console.log("");
    console.log("🔍 Demo Accounts Check:");
    console.log("-" .repeat(50));
    
    // Check demo accounts
    const demoAccounts = [
      { email: "alex.creator@demo.com", type: "creator" },
      { email: "sarah.investor@demo.com", type: "investor" },
      { email: "stellar.production@demo.com", type: "production" }
    ];
    
    for (const demo of demoAccounts) {
      const user = await db.execute(sql`
        SELECT id, email, username, user_type 
        FROM users 
        WHERE email = ${demo.email}
      `);
      
      if (user.length > 0) {
        console.log(`   ✅ ${demo.type}: ${demo.email} (ID: ${user[0].id})`);
      } else {
        console.log(`   ❌ ${demo.type}: ${demo.email} NOT FOUND`);
      }
    }
    
    console.log("");
    console.log("📈 Database Health Metrics:");
    console.log("-" .repeat(50));
    
    // Database size
    const dbSize = await db.execute(sql`
      SELECT pg_database_size(current_database())::bigint / (1024*1024) as size_mb
    `);
    console.log(`   Database Size: ${dbSize[0]?.size_mb || 0} MB`);
    
    // Active connections
    const connections = await db.execute(sql`
      SELECT count(*)::int as active_connections 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    console.log(`   Active Connections: ${connections[0]?.active_connections || 0}`);
    
    // Cache hit ratio
    const cacheRatio = await db.execute(sql`
      SELECT 
        sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read))::numeric * 100 as cache_hit_ratio
      FROM pg_statio_user_tables
    `);
    const hitRatio = parseFloat(cacheRatio[0]?.cache_hit_ratio || "0").toFixed(2);
    console.log(`   Cache Hit Ratio: ${hitRatio}%`);
    
    console.log("");
    console.log("✅ Database Status Check Complete!");
    console.log("=" .repeat(50));
    
    // Generate summary
    const summary = {
      status: "healthy",
      connection: {
        success: true,
        latency: `${latency}ms`
      },
      data: {
        users: userCount[0]?.count || 0,
        pitches: pitchCount[0]?.count || 0,
        investments: investmentCount[0]?.count || 0,
        ndas: ndaCount[0]?.count || 0
      },
      health: {
        size_mb: dbSize[0]?.size_mb || 0,
        connections: connections[0]?.active_connections || 0,
        cache_hit_ratio: hitRatio
      },
      demoAccounts: {
        creator: user.length > 0 ? "present" : "missing",
        investor: user.length > 0 ? "present" : "missing",
        production: user.length > 0 ? "present" : "missing"
      }
    };
    
    // Write to JSON file for CI/CD
    await Deno.writeTextFile(
      "database-status-report.json",
      JSON.stringify(summary, null, 2)
    );
    console.log("\n📄 Report saved to: database-status-report.json");
    
    return summary;
    
  } catch (error) {
    console.error("❌ Database Check Failed:", error.message);
    console.error("   Details:", error);
    
    const errorSummary = {
      status: "error",
      connection: {
        success: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    };
    
    await Deno.writeTextFile(
      "database-status-report.json", 
      JSON.stringify(errorSummary, null, 2)
    );
    
    Deno.exit(1);
  }
}

// Run the check
await checkDatabase();
Deno.exit(0);