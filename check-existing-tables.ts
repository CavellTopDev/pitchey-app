#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Check Existing Tables with Drizzle
 * Use proper drizzle methods to check database
 */

import { db } from "./src/db/client.ts";
import { users, pitches, ndaRequests } from "./src/db/schema.ts";

console.log("🔍 Checking existing tables with drizzle...");

try {
  // Test existing tables first
  console.log("\n📝 Testing existing table queries...");
  
  try {
    const userCount = await db.$count(users);
    console.log(`✅ users table exists with ${userCount} records`);
  } catch (error) {
    console.log(`❌ users table issue:`, error.message);
  }
  
  try {
    const pitchCount = await db.$count(pitches);
    console.log(`✅ pitches table exists with ${pitchCount} records`);
  } catch (error) {
    console.log(`❌ pitches table issue:`, error.message);
  }
  
  try {
    const ndaCount = await db.$count(ndaRequests);
    console.log(`✅ nda_requests table exists with ${ndaCount} records`);
  } catch (error) {
    console.log(`❌ nda_requests table issue:`, error.message);
  }

  // Now test the missing tables by trying to import them
  console.log("\n📝 Testing missing table imports...");
  
  try {
    const { conversations } = await import("./src/db/schema.ts");
    const convCount = await db.$count(conversations);
    console.log(`✅ conversations table exists with ${convCount} records`);
  } catch (error) {
    console.log(`❌ conversations table missing:`, error.message);
  }
  
  try {
    const { analyticsEvents } = await import("./src/db/schema.ts");
    const analyticsCount = await db.$count(analyticsEvents);
    console.log(`✅ analytics_events table exists with ${analyticsCount} records`);
  } catch (error) {
    console.log(`❌ analytics_events table missing:`, error.message);
  }
  
  try {
    const { notifications } = await import("./src/db/schema.ts");
    const notificationCount = await db.$count(notifications);
    console.log(`✅ notifications table exists with ${notificationCount} records`);
  } catch (error) {
    console.log(`❌ notifications table missing:`, error.message);
  }
  
  try {
    const { follows } = await import("./src/db/schema.ts");
    const followCount = await db.$count(follows);
    console.log(`✅ follows table exists with ${followCount} records`);
  } catch (error) {
    console.log(`❌ follows table missing:`, error.message);
  }

} catch (error) {
  console.error("💥 Database connection error:", error);
}

console.log("\n✅ Database check completed");