#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

// Script to add production and investor accounts with pitches

import { db } from "../src/db/client.ts";
import { users, pitches } from "../src/db/schema.ts";
import { hash } from "bcrypt";

async function seedDatabase() {
  console.log("🎬 Seeding Production and Investor Accounts");
  console.log("==========================================\n");

  try {
    // Hash password for all accounts
    const hashedPassword = await hash("Demo123!", 10);

    // Create Production Company accounts
    const productionAccounts = [
      {
        email: "warner@pitchey.com",
        username: "warnerbros",
        password: hashedPassword,
        userType: "production" as const,
        companyName: "Warner Bros. Pictures",
        firstName: "Sarah",
        lastName: "Johnson",
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        email: "universal@pitchey.com", 
        username: "universal",
        password: hashedPassword,
        userType: "production" as const,
        companyName: "Universal Pictures",
        firstName: "Michael",
        lastName: "Chen",
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        email: "a24@pitchey.com",
        username: "a24films",
        password: hashedPassword,
        userType: "production" as const,
        companyName: "A24 Films",
        firstName: "Alex",
        lastName: "Rivera",
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Create Investor accounts
    const investorAccounts = [
      {
        email: "techventures@pitchey.com",
        username: "techventures",
        password: hashedPassword,
        userType: "investor" as const,
        companyName: "Tech Ventures Capital",
        firstName: "David",
        lastName: "Morgan",
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        email: "filmfund@pitchey.com",
        username: "globalfilm",
        password: hashedPassword,
        userType: "investor" as const,
        companyName: "Global Film Fund",
        firstName: "Rebecca",
        lastName: "Stone",
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert production companies
    console.log("📽️ Creating production companies...");
    for (const account of productionAccounts) {
      try {
        const [user] = await db.insert(users).values(account).returning();
        console.log(`✅ Created: ${account.companyName} (ID: ${user.id})`);
        
        // Create a pitch for this production company
        const pitch = {
          userId: user.id,
          userType: "production" as const,
          title: `${account.companyName} - Exclusive Slate 2025`,
          logline: `An exclusive look at our upcoming production slate featuring blockbusters and award contenders.`,
          genre: account.username === "a24films" ? "drama" : "action",
          format: "feature",
          budget: "$150M+",
          budgetAmount: 150000000,
          status: "published" as const,
          stage: "production",
          synopsis: `Our studio is proud to present our 2025 slate.`,
          targetAudience: "18-54, Film enthusiasts, General audiences",
          comparableTitles: "Top Gun: Maverick, Everything Everywhere All at Once, Dune",
          visibility: "public" as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const [createdPitch] = await db.insert(pitches).values(pitch).returning();
        console.log(`  📋 Created pitch: ${createdPitch.title}`);
        
      } catch (err) {
        console.error(`  ❌ Error creating ${account.companyName}:`, err.message);
      }
    }

    // Insert investors
    console.log("\n💰 Creating investor accounts...");
    for (const account of investorAccounts) {
      try {
        const [user] = await db.insert(users).values(account).returning();
        console.log(`✅ Created: ${account.companyName} (ID: ${user.id})`);
        
        // Create a pitch for this investor
        const pitch = {
          userId: user.id,
          userType: "investor" as const,
          title: `Investment Opportunity: ${account.companyName} Media Fund`,
          logline: `Join us in financing the next generation of breakthrough entertainment.`,
          genre: "documentary",
          format: "series",
          budget: "$10M-$50M",
          budgetAmount: 25000000,
          status: "published" as const,
          stage: "development",
          synopsis: `${account.companyName} is launching a new media investment fund.`,
          targetAudience: "Accredited investors, Production companies",
          comparableTitles: "The Social Network, The Big Short",
          visibility: "public" as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const [createdPitch] = await db.insert(pitches).values(pitch).returning();
        console.log(`  📋 Created pitch: ${createdPitch.title}`);
        
      } catch (err) {
        console.error(`  ❌ Error creating ${account.companyName}:`, err.message);
      }
    }

    console.log("\n✨ Seeding complete!");
    console.log("\n📌 Test Accounts (password: Demo123!):");
    console.log("Production Companies:");
    console.log("  - warner@pitchey.com");
    console.log("  - universal@pitchey.com");
    console.log("  - a24@pitchey.com");
    console.log("\nInvestors:");
    console.log("  - techventures@pitchey.com");
    console.log("  - filmfund@pitchey.com");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
  }

  Deno.exit(0);
}

seedDatabase();
