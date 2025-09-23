#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

import { db } from "../src/db/client.ts";
import { users, pitches } from "../src/db/schema.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

async function seedDatabase() {
  try {
    console.log("🌱 Starting database seeding...");
    
    // Create demo users
    const passwordHash = await bcrypt.hash("password123");
    
    // Creator users
    const [creator1] = await db.insert(users)
      .values({
        email: "john@filmstudio.com",
        username: "john_filmmaker",
        passwordHash,
        userType: "creator",
        firstName: "John",
        lastName: "Smith",
        companyName: "Indie Film Studio",
        bio: "Award-winning filmmaker with 10+ years of experience",
        emailVerified: true,
      })
      .returning();
    
    const [creator2] = await db.insert(users)
      .values({
        email: "sarah@productions.com",
        username: "sarah_creator",
        passwordHash,
        userType: "creator",
        firstName: "Sarah",
        lastName: "Johnson",
        companyName: "Creative Productions",
        bio: "Passionate storyteller specializing in documentaries",
        emailVerified: true,
      })
      .returning();
    
    // Investor user
    const [investor1] = await db.insert(users)
      .values({
        email: "investor@venture.com",
        username: "venture_investor",
        passwordHash,
        userType: "investor",
        firstName: "Michael",
        lastName: "Chen",
        companyName: "Venture Films Capital",
        bio: "Film investor focusing on innovative content",
        emailVerified: true,
      })
      .returning();
    
    // Production company user
    const [production1] = await db.insert(users)
      .values({
        email: "contact@bigpicture.com",
        username: "bigpicture_prod",
        passwordHash,
        userType: "production",
        firstName: "Emily",
        lastName: "Davis",
        companyName: "Big Picture Productions",
        bio: "Full-service production company",
        emailVerified: true,
      })
      .returning();
    
    console.log("✅ Created demo users");
    
    // Create demo pitches
    await db.insert(pitches)
      .values([
        {
          userId: creator1.id,
          title: "The Last Frontier",
          logline: "A gripping sci-fi thriller about humanity's final stand on Mars.",
          genre: "scifi",
          format: "feature",
          status: "published",
          shortSynopsis: "In 2089, Earth's last colony on Mars faces an unprecedented threat when mysterious signals from deep space trigger a series of catastrophic events. As resources dwindle and communication with Earth is severed, colony commander Sarah Chen must unite the fractured survivors to uncover an ancient Martian secret that could either save humanity or doom it forever.",
          themes: ["survival", "humanity", "discovery", "sacrifice"],
          budgetBracket: "$5M-$10M",
          estimatedBudget: 7500000,
          viewCount: 156,
          likeCount: 23,
          ndaCount: 5,
          publishedAt: new Date(),
        },
        {
          userId: creator1.id,
          title: "Echoes of Tomorrow",
          logline: "A time-travel drama exploring the consequences of changing the past.",
          genre: "drama",
          format: "tv",
          status: "published",
          shortSynopsis: "When brilliant physicist Dr. Alex Rivera accidentally discovers time travel, they must navigate the moral implications of altering history while being pursued by a shadowy organization that wants to weaponize the technology.",
          themes: ["time", "consequences", "ethics", "family"],
          budgetBracket: "$2M-$5M",
          estimatedBudget: 3500000,
          viewCount: 89,
          likeCount: 15,
          ndaCount: 3,
          publishedAt: new Date(),
        },
        {
          userId: creator2.id,
          title: "City of Dreams",
          logline: "A documentary exploring the lives of street artists in New York City.",
          genre: "documentary",
          format: "feature",
          status: "published",
          shortSynopsis: "This intimate documentary follows five street artists over the course of a year as they navigate the challenges of creating art in public spaces while fighting for recognition and dealing with city regulations.",
          themes: ["art", "expression", "urban life", "creativity"],
          budgetBracket: "$500K-$1M",
          estimatedBudget: 750000,
          viewCount: 234,
          likeCount: 45,
          ndaCount: 8,
          publishedAt: new Date(),
        },
        {
          userId: creator2.id,
          title: "The Memory Keeper",
          logline: "A psychological thriller about a woman who can steal and manipulate memories.",
          genre: "thriller",
          format: "feature",
          status: "published",
          shortSynopsis: "Lila possesses an extraordinary gift - she can extract and alter human memories. When she's hired to help a wealthy family recover a lost inheritance, she uncovers dark secrets that put her own life in danger.",
          themes: ["memory", "identity", "truth", "power"],
          budgetBracket: "$10M-$20M",
          estimatedBudget: 15000000,
          viewCount: 312,
          likeCount: 67,
          ndaCount: 12,
          publishedAt: new Date(),
        },
        {
          userId: creator1.id,
          title: "The Art of Silence",
          logline: "A deaf artist's journey to recognition in the competitive world of contemporary art.",
          genre: "drama",
          format: "feature",
          status: "published",
          shortSynopsis: "Maya, a talented deaf artist, struggles to make her voice heard in the visual art world. Through innovative use of technology and determination, she challenges perceptions about disability and artistic expression.",
          themes: ["art", "disability", "perseverance", "innovation"],
          budgetBracket: "$1M-$2M",
          estimatedBudget: 1500000,
          viewCount: 178,
          likeCount: 34,
          ndaCount: 6,
          publishedAt: new Date(),
        },
      ]);
    
    console.log("✅ Created demo pitches");
    
    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\nDemo accounts created:");
    console.log("------------------------");
    console.log("Creators:");
    console.log("  Email: john@filmstudio.com | Password: password123");
    console.log("  Email: sarah@productions.com | Password: password123");
    console.log("\nInvestor:");
    console.log("  Email: investor@venture.com | Password: password123");
    console.log("\nProduction:");
    console.log("  Email: contact@bigpicture.com | Password: password123");
    
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Run the seeding
await seedDatabase();