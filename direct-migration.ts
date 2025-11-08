#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

async function createMissingTables() {
  console.log("🚀 Creating missing tables directly...");
  
  try {
    // Create watchlist table
    console.log("Creating watchlist table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "watchlist" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "pitch_id" integer NOT NULL,
        "notes" text,
        "priority" text DEFAULT 'normal',
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "unique_user_pitch" UNIQUE("user_id", "pitch_id")
      )
    `);
    
    // Create portfolio table
    console.log("Creating portfolio table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "portfolio" (
        "id" serial PRIMARY KEY NOT NULL,
        "investor_id" integer NOT NULL,
        "pitch_id" integer NOT NULL,
        "amount_invested" decimal(15,2),
        "ownership_percentage" decimal(5,2),
        "status" text DEFAULT 'active',
        "invested_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "exited_at" timestamp with time zone,
        "returns" decimal(15,2),
        "notes" text,
        "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    
    // Create analytics table
    console.log("Creating analytics table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "analytics" (
        "id" serial PRIMARY KEY NOT NULL,
        "pitch_id" integer NOT NULL,
        "user_id" integer,
        "event_type" text NOT NULL,
        "event_data" jsonb,
        "session_id" text,
        "ip_address" text,
        "user_agent" text,
        "referrer" text,
        "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    
    // Create security_events table
    console.log("Creating security_events table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "security_events" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer,
        "event_type" varchar(50) NOT NULL,
        "event_status" varchar(20) NOT NULL,
        "ip_address" varchar(45),
        "user_agent" text,
        "location" jsonb,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    
    // Create notifications table
    console.log("Creating notifications table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "type" varchar(50) NOT NULL,
        "title" varchar(200) NOT NULL,
        "message" text NOT NULL,
        "related_pitch_id" integer,
        "related_user_id" integer,
        "related_nda_request_id" integer,
        "is_read" boolean DEFAULT false,
        "action_url" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "read_at" timestamp
      )
    `);
    
    // Add foreign key constraints
    console.log("Adding foreign key constraints...");
    try {
      await db.execute(sql`
        ALTER TABLE "watchlist" 
        ADD CONSTRAINT "watchlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    } catch (e) {
      console.log("Watchlist user FK already exists or failed:", e.message);
    }
    
    try {
      await db.execute(sql`
        ALTER TABLE "watchlist" 
        ADD CONSTRAINT "watchlist_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE
      `);
    } catch (e) {
      console.log("Watchlist pitch FK already exists or failed:", e.message);
    }
    
    try {
      await db.execute(sql`
        ALTER TABLE "portfolio" 
        ADD CONSTRAINT "portfolio_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    } catch (e) {
      console.log("Portfolio investor FK already exists or failed:", e.message);
    }
    
    try {
      await db.execute(sql`
        ALTER TABLE "portfolio" 
        ADD CONSTRAINT "portfolio_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE RESTRICT
      `);
    } catch (e) {
      console.log("Portfolio pitch FK already exists or failed:", e.message);
    }
    
    try {
      await db.execute(sql`
        ALTER TABLE "analytics" 
        ADD CONSTRAINT "analytics_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE
      `);
    } catch (e) {
      console.log("Analytics pitch FK already exists or failed:", e.message);
    }
    
    try {
      await db.execute(sql`
        ALTER TABLE "analytics" 
        ADD CONSTRAINT "analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      `);
    } catch (e) {
      console.log("Analytics user FK already exists or failed:", e.message);
    }
    
    // Add indexes
    console.log("Adding indexes...");
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_watchlist_user_id" ON "watchlist"("user_id")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_watchlist_pitch_id" ON "watchlist"("pitch_id")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_portfolio_investor_id" ON "portfolio"("investor_id")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_portfolio_pitch_id" ON "portfolio"("pitch_id")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_analytics_pitch_id" ON "analytics"("pitch_id")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_analytics_user_id" ON "analytics"("user_id")`);
    } catch (e) {
      console.log("Index creation warning:", e.message);
    }
    
    console.log("✅ All tables created successfully!");
    
    // Test the tables
    console.log("\n🧪 Testing table accessibility...");
    
    try {
      const watchlistCount = await db.execute(sql`SELECT COUNT(*) FROM watchlist`);
      console.log(`✅ Watchlist table accessible (${watchlistCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Watchlist table test failed: ${error.message}`);
    }
    
    try {
      const portfolioCount = await db.execute(sql`SELECT COUNT(*) FROM portfolio`);
      console.log(`✅ Portfolio table accessible (${portfolioCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Portfolio table test failed: ${error.message}`);
    }
    
    try {
      const analyticsCount = await db.execute(sql`SELECT COUNT(*) FROM analytics`);
      console.log(`✅ Analytics table accessible (${analyticsCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Analytics table test failed: ${error.message}`);
    }
    
    try {
      const securityEventsCount = await db.execute(sql`SELECT COUNT(*) FROM security_events`);
      console.log(`✅ Security Events table accessible (${securityEventsCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Security Events table test failed: ${error.message}`);
    }
    
    try {
      const notificationsCount = await db.execute(sql`SELECT COUNT(*) FROM notifications`);
      console.log(`✅ Notifications table accessible (${notificationsCount.rows[0][0]} rows)`);
    } catch (error) {
      console.log(`❌ Notifications table test failed: ${error.message}`);
    }
    
    console.log("\n🎉 Database setup completed successfully!");
    
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    throw error;
  }
}

if (import.meta.main) {
  await createMissingTables();
}