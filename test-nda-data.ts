#!/usr/bin/env -S deno run --allow-all

// Test script to check NDA data for testing info requests
import { db } from './src/db/client.ts';
import { ndas, pitches, users } from './src/db/schema.ts';
import { eq } from 'npm:drizzle-orm@0.35.3';

async function checkNDAData() {
  try {
    console.log("🔍 Checking NDA data for testing...\n");

    // Check if we have any NDAs
    const ndasData = await db.select().from(ndas).limit(5);
    console.log("📋 NDAs in database:", ndasData.length);
    if (ndasData.length > 0) {
      console.log("First NDA:", ndasData[0]);
    }

    // Check if we have pitches
    const pitchesData = await db.select().from(pitches).limit(5);
    console.log("\n📋 Pitches in database:", pitchesData.length);
    if (pitchesData.length > 0) {
      console.log("First pitch:", pitchesData[0]);
    }

    // Check if we have users
    const usersData = await db.select().from(users).limit(5);
    console.log("\n📋 Users in database:", usersData.length);
    if (usersData.length > 0) {
      console.log("First user:", usersData[0]);
    }

    // Create test NDA if none exists
    if (ndasData.length === 0 && pitchesData.length > 0 && usersData.length >= 2) {
      console.log("\n🔧 Creating test NDA...");
      
      const testNDA = await db.insert(ndas).values({
        pitchId: pitchesData[0].id,
        signerId: usersData[1].id, // Use second user as signer (investor)
        templateType: 'standard',
        content: 'Test NDA content for info request testing',
        signed: true,
        signedAt: new Date(),
        accessGranted: true,
        accessGrantedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      }).returning();
      
      console.log("✅ Test NDA created:", testNDA[0]);
      return testNDA[0];
    }

    return ndasData[0] || null;
  } catch (error) {
    console.error("❌ Error checking NDA data:", error.message);
    return null;
  }
}

if (import.meta.main) {
  checkNDAData();
}