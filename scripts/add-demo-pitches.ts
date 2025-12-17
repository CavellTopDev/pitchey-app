#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

// Script to add pitches for existing demo accounts

import { db } from "../src/db/client.ts";
import { users, pitches } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";

async function addDemoPitches() {
  console.log("🎬 Adding Pitches for Existing Demo Accounts");
  console.log("============================================\n");

  try {
    // Find existing demo accounts
    const stellarProduction = await db
      .select()
      .from(users)
      .where(eq(users.email, 'stellar.production@demo.com'))
      .limit(1);

    const sarahInvestor = await db
      .select()
      .from(users)
      .where(eq(users.email, 'sarah.investor@demo.com'))
      .limit(1);

    if (stellarProduction.length === 0) {
      console.log("❌ stellar.production@demo.com account not found in database");
      return;
    }

    if (sarahInvestor.length === 0) {
      console.log("❌ sarah.investor@demo.com account not found in database");
      return;
    }

    const stellarUser = stellarProduction[0];
    const sarahUser = sarahInvestor[0];

    console.log(`✅ Found Stellar Productions (ID: ${stellarUser.id})`);
    console.log(`✅ Found Sarah Investor (ID: ${sarahUser.id})\n`);

    // Create pitches for Stellar Productions
    const stellarPitches = [
      {
        userId: stellarUser.id,
        userType: "production" as const,
        title: "Stellar's Next Blockbuster Slate",
        logline: "Three groundbreaking films that will define the next generation of cinema.",
        genre: "action",
        format: "feature",
        budget: "$150M+",
        budgetAmount: 180000000,
        status: "published" as const,
        stage: "development",
        synopsis: "Stellar Productions presents an exclusive look at our upcoming trilogy of interconnected action films. Each movie stands alone while building toward an epic conclusion that will redefine the action genre.",
        targetAudience: "18-45, Action enthusiasts, International audiences",
        comparableTitles: "Fast & Furious franchise, Mission Impossible, John Wick",
        visibility: "public" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userId: stellarUser.id,
        userType: "production" as const,
        title: "Award Season Drama Collection",
        logline: "Character-driven stories that explore the human condition.",
        genre: "drama",
        format: "feature",
        budget: "$25M-$50M",
        budgetAmount: 35000000,
        status: "published" as const,
        stage: "pre-production",
        synopsis: "A carefully curated collection of three intimate dramas featuring A-list talent and acclaimed directors. These films are positioned for awards season recognition.",
        targetAudience: "25-65, Awards voters, Art house audiences",
        comparableTitles: "Moonlight, Manchester by the Sea, Nomadland",
        visibility: "public" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userId: stellarUser.id,
        userType: "production" as const,
        title: "Stellar Horror Universe",
        logline: "A connected universe of supernatural thrillers that will terrify and captivate.",
        genre: "horror",
        format: "feature",
        budget: "$50M-$100M",
        budgetAmount: 75000000,
        status: "published" as const,
        stage: "production",
        synopsis: "Building on the success of connected cinematic universes, Stellar Productions is launching a horror franchise with interconnected storylines and shared mythology.",
        targetAudience: "18-35, Horror fans, Genre enthusiasts",
        comparableTitles: "The Conjuring Universe, Insidious, Hereditary",
        visibility: "public" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Create pitches for Sarah Investor
    const sarahPitches = [
      {
        userId: sarahUser.id,
        userType: "investor" as const,
        title: "Sarah's Media Investment Portfolio 2025",
        logline: "Strategic investments in the future of entertainment and technology.",
        genre: "documentary",
        format: "series",
        budget: "$10M-$50M",
        budgetAmount: 30000000,
        status: "published" as const,
        stage: "development",
        synopsis: "A comprehensive investment portfolio focusing on innovative content creators, emerging platforms, and breakthrough entertainment technologies. Looking for co-investors and strategic partners.",
        targetAudience: "Accredited investors, Entertainment executives, Tech entrepreneurs",
        comparableTitles: "The Business of Film, Silicon Valley stories",
        visibility: "public" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userId: sarahUser.id,
        userType: "investor" as const,
        title: "Sustainable Cinema Initiative",
        logline: "Investing in environmentally conscious film production and distribution.",
        genre: "documentary",
        format: "feature",
        budget: "$5M-$10M",
        budgetAmount: 8000000,
        status: "published" as const,
        stage: "pre-production",
        synopsis: "A groundbreaking initiative to transform the film industry's environmental impact through sustainable production practices, green technology, and carbon-neutral distribution.",
        targetAudience: "Environmental investors, Conscious consumers, Industry professionals",
        comparableTitles: "An Inconvenient Truth, Racing Extinction",
        visibility: "public" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userId: sarahUser.id,
        userType: "investor" as const,
        title: "Next-Gen Creator Fund",
        logline: "Empowering diverse voices in digital storytelling and content creation.",
        genre: "variety",
        format: "series",
        budget: "$1M-$10M",
        budgetAmount: 5000000,
        status: "published" as const,
        stage: "development",
        synopsis: "An investment fund dedicated to supporting underrepresented creators in digital media, virtual reality experiences, and innovative storytelling platforms.",
        targetAudience: "Content creators, Digital natives, Diversity advocates",
        comparableTitles: "YouTube Originals, TikTok success stories",
        visibility: "public" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert Stellar Productions pitches
    console.log("🎬 Creating pitches for Stellar Productions...");
    for (const pitch of stellarPitches) {
      try {
        const [createdPitch] = await db.insert(pitches).values(pitch).returning();
        console.log(`  ✅ Created: "${createdPitch.title}"`);
      } catch (err) {
        console.error(`  ❌ Error creating pitch "${pitch.title}":`, err.message);
      }
    }

    // Insert Sarah's investment pitches
    console.log("\n💰 Creating pitches for Sarah Investor...");
    for (const pitch of sarahPitches) {
      try {
        const [createdPitch] = await db.insert(pitches).values(pitch).returning();
        console.log(`  ✅ Created: "${createdPitch.title}"`);
      } catch (err) {
        console.error(`  ❌ Error creating pitch "${pitch.title}":`, err.message);
      }
    }

    console.log("\n✨ Demo account pitches created successfully!");
    console.log("\n📌 Demo Accounts with New Pitches:");
    console.log("Production Company:");
    console.log("  - stellar.production@demo.com (3 pitches)");
    console.log("\nInvestor:");
    console.log("  - sarah.investor@demo.com (3 pitches)");

  } catch (error) {
    console.error("❌ Failed to add demo pitches:", error);
  }

  Deno.exit(0);
}

addDemoPitches();