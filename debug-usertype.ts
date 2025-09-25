#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

// Debug script to check if userType is properly set in database

import { db } from "./src/db/client.ts";
import { users, pitches } from "./src/db/schema.ts";
import { eq, desc } from "drizzle-orm";

async function debugUserTypes() {
  console.log("🔍 Checking user types in database...\n");

  try {
    // Get all users with their types
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        companyName: users.companyName,
        userType: users.userType,
        email: users.email
      })
      .from(users)
      .limit(10);

    console.log("📋 Users in database:");
    console.log("========================");
    allUsers.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Company: ${user.companyName || 'N/A'}`);
      console.log(`  Type: ${user.userType}`);
      console.log(`  Email: ${user.email}`);
      console.log("------------------------");
    });

    // Get all pitches with their creator info
    const allPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        userId: pitches.userId,
        userType: pitches.userType,
        creatorId: users.id,
        creatorUsername: users.username,
        creatorCompanyName: users.companyName,
        creatorUserType: users.userType
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
      .orderBy(desc(pitches.createdAt))
      .limit(10);

    console.log("\n📽️ Pitches with creator info:");
    console.log("================================");
    allPitches.forEach(pitch => {
      console.log(`Pitch ID: ${pitch.id} - "${pitch.title}"`);
      console.log(`  Creator ID: ${pitch.creatorId}`);
      console.log(`  Creator Username: ${pitch.creatorUsername}`);
      console.log(`  Creator Company: ${pitch.creatorCompanyName || 'N/A'}`);
      console.log(`  Creator Type: ${pitch.creatorUserType}`);
      console.log(`  Pitch userType field: ${pitch.userType || 'null'}`);
      console.log("------------------------");
    });

    // Check if we have any non-creator users
    const productionUsers = await db
      .select()
      .from(users)
      .where(eq(users.userType, 'production'))
      .limit(5);

    const investorUsers = await db
      .select()
      .from(users)
      .where(eq(users.userType, 'investor'))
      .limit(5);

    console.log(`\n📊 Summary:`);
    console.log(`  Production companies: ${productionUsers.length}`);
    console.log(`  Investors: ${investorUsers.length}`);

    if (productionUsers.length > 0) {
      console.log("\n🏢 Production Companies:");
      productionUsers.forEach(u => {
        console.log(`  - ${u.companyName || u.username} (${u.email})`);
      });
    }

    if (investorUsers.length > 0) {
      console.log("\n💰 Investors:");
      investorUsers.forEach(u => {
        console.log(`  - ${u.companyName || u.username} (${u.email})`);
      });
    }

  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

debugUserTypes();