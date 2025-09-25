#!/usr/bin/env -S deno run --allow-net --allow-env

// Simplified script to add production company pitches using direct SQL

import { neon } from "npm:@neondatabase/serverless";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  Deno.exit(1);
}

const sql = neon(DATABASE_URL);

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
      const existing = await sql`
        SELECT id, company_name FROM users WHERE email = ${company.email}
      `;

      if (existing.length > 0) {
        console.log(`✓ ${company.companyName} already exists (ID: ${existing[0].id})`);
      } else {
        const hashedPassword = await hash(company.password);
        const result = await sql`
          INSERT INTO users (
            email, username, password_hash, user_type, 
            company_name, bio, subscription_tier, created_at, updated_at
          ) VALUES (
            ${company.email}, ${company.username}, ${hashedPassword}, 'production',
            ${company.companyName}, ${company.bio}, 'premium', NOW(), NOW()
          ) RETURNING id, company_name
        `;
        console.log(`✓ Created ${company.companyName} (ID: ${result[0].id})`);
      }
    }

    // Get all production users
    const productionUsers = await sql`
      SELECT id, company_name, username FROM users WHERE user_type = 'production'
    `;

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
      const existingPitch = await sql`
        SELECT id FROM pitches 
        WHERE user_id = ${user.id} AND title = ${pitch.title}
      `;

      if (existingPitch.length === 0) {
        await sql`
          INSERT INTO pitches (
            user_id, title, logline, genre, format, short_synopsis,
            estimated_budget, status, view_count, like_count, nda_count,
            target_audience, comparable_films, distribution_strategy,
            created_at, updated_at
          ) VALUES (
            ${user.id}, ${pitch.title}, ${pitch.logline}, ${pitch.genre}, 
            ${pitch.format}, ${pitch.shortSynopsis}, ${pitch.budget},
            'published', ${Math.floor(Math.random() * 500) + 100},
            ${Math.floor(Math.random() * 50) + 10},
            ${Math.floor(Math.random() * 20) + 5},
            'Adult audiences 18-45, Film enthusiasts',
            ARRAY['Interstellar', 'The Martian', 'Blade Runner 2049'],
            'Theatrical release with streaming follow-up',
            NOW(), NOW()
          )
        `;
        console.log(`✓ Created pitch "${pitch.title}" for ${user.company_name}`);
      } else {
        console.log(`✓ Pitch "${pitch.title}" already exists for ${user.company_name}`);
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