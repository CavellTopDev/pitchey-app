#!/usr/bin/env -S deno run --allow-net --allow-env

// Simplified script to add production company pitches using Drizzle ORM

import { db } from "./src/db/client.ts";
import { users, pitches } from "./src/db/schema.ts";
import { eq, and } from "npm:drizzle-orm";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

async function addProductionPitches() {
  try {
    console.log("🎬 Creating production company accounts and pitches...\n");

    // Production company data
    const companies = [
      {
        email: "warner@pitchey.com",
        username: "warnerbros",
        password: "Warner2024!",
        companyName: "Warner Bros. Pictures",
        bio: "One of the Big Five major American film studios.",
      },
      {
        email: "universal@pitchey.com",
        username: "universalpictures",
        password: "Universal2024!",
        companyName: "Universal Pictures",
        bio: "Leading global entertainment company.",
      },
      {
        email: "a24@pitchey.com",
        username: "a24films",
        password: "A24Films2024!",
        companyName: "A24 Films",
        bio: "Independent entertainment company specializing in film production.",
      },
      {
        email: "paramount@pitchey.com",
        username: "paramountpictures",
        password: "Paramount2024!",
        companyName: "Paramount Pictures",
        bio: "Major American film studio and subsidiary of Paramount Global.",
      },
    ];

    // Create users
    for (const company of companies) {
      // Check if user exists
      const existing = await db
        .select({ id: users.id, companyName: users.companyName })
        .from(users)
        .where(eq(users.email, company.email))
        .limit(1);

      if (existing.length > 0) {
        console.log(`✓ ${company.companyName} already exists (ID: ${existing[0].id})`);
      } else {
        const hashedPassword = await hash(company.password);
        const result = await db.insert(users).values({
          email: company.email,
          username: company.username,
          passwordHash: hashedPassword,
          userType: 'production',
          companyName: company.companyName,
          bio: company.bio,
          subscriptionTier: 'premium',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning({ id: users.id, companyName: users.companyName });
        console.log(`✓ Created ${company.companyName} (ID: ${result[0].id})`);
      }
    }

    // Get all production users
    const productionUsers = await db
      .select({
        id: users.id,
        companyName: users.companyName,
        username: users.username
      })
      .from(users)
      .where(eq(users.userType, 'production'));

    console.log(`\n📽️  Adding pitches for ${productionUsers.length} production companies...\n`);

    // Pitches to add
    const pitchTemplates = [
      {
        title: "Quantum Paradox",
        logline: "A quantum physicist discovers parallel universes are colliding, threatening all existence",
        genre: "Sci-Fi Thriller",
        format: "Feature Film",
        shortSynopsis: "Dr. Elena Vasquez's quantum experiment goes wrong, opening doorways to parallel universes. As realities begin to merge, she races against time to close the rifts before all universes collapse into chaos.",
        budget: 175000000,
      },
      {
        title: "The Venice Murders",
        logline: "A detective investigates a series of murders during the Venice Film Festival",
        genre: "Mystery Thriller",
        format: "Limited Series",
        shortSynopsis: "During the glamorous Venice Film Festival, bodies start appearing in the canals. Detective Marco Rossi must navigate the world of cinema elite to catch a killer who's turning Venice into their personal stage.",
        budget: 60000000,
      },
      {
        title: "Silicon Dreams",
        logline: "The rise and fall of a tech startup that promised to revolutionize human consciousness",
        genre: "Tech Drama",
        format: "Feature Film",
        shortSynopsis: "Follow the meteoric rise of NeuroLink, a startup that claimed it could upload human consciousness to the cloud. Based on true events that shook Silicon Valley and questioned what it means to be human.",
        budget: 45000000,
      },
      {
        title: "The Last Heist",
        logline: "An aging thief plans one final score to secure his family's future",
        genre: "Crime Drama",
        format: "Feature Film",
        shortSynopsis: "After 30 years in the game, master thief Vincent Romano plans his retirement heist - stealing $100 million from a casino owned by his former partner who betrayed him decades ago.",
        budget: 90000000,
      },
    ];

    // Add pitches for each production company
    for (let i = 0; i < productionUsers.length && i < pitchTemplates.length; i++) {
      const user = productionUsers[i];
      const pitch = pitchTemplates[i];

      // Check if pitch exists
      const existingPitch = await db
        .select({ id: pitches.id })
        .from(pitches)
        .where(
          and(
            eq(pitches.userId, user.id),
            eq(pitches.title, pitch.title)
          )
        )
        .limit(1);

      if (existingPitch.length === 0) {
        await db.insert(pitches).values({
          userId: user.id,
          title: pitch.title,
          logline: pitch.logline,
          genre: pitch.genre,
          format: pitch.format,
          shortSynopsis: pitch.shortSynopsis,
          estimatedBudget: pitch.budget.toString(),
          status: 'published',
          viewCount: Math.floor(Math.random() * 500) + 100,
          likeCount: Math.floor(Math.random() * 50) + 10,
          ndaCount: Math.floor(Math.random() * 20) + 5,
          targetAudience: 'Adult audiences 18-45, Film enthusiasts',
          distributionStrategy: 'Theatrical release with streaming follow-up',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✓ Created pitch "${pitch.title}" for ${user.companyName}`);
      } else {
        console.log(`✓ Pitch "${pitch.title}" already exists for ${user.companyName}`);
      }
    }

    console.log("\n✅ Successfully added production company pitches!");
    console.log("\n📝 Production Company Login Credentials:");
    console.log("========================================");
    for (const company of companies) {
      console.log(`\n${company.companyName}:`);
      console.log(`  Email: ${company.email}`);
      console.log(`  Password: ${company.password}`);
    }
    console.log("\n========================================");
    console.log("\n🎯 You can now:");
    console.log("1. View these pitches in the public marketplace");
    console.log("2. Sign in as a different user type to request NDAs");
    console.log("3. Test the full NDA workflow\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    Deno.exit(1);
  }
}

await addProductionPitches();
Deno.exit(0);