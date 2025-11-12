#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { db } from "./src/db/client.ts";
import { users, pitches, investments, ndas, follows, notifications } from "./src/db/schema.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

console.log("🌱 Seeding Demo Data into Neon PostgreSQL...");
console.log("=" .repeat(50));

const PASSWORD_HASH = await bcrypt.hash("Demo123");

async function seedDemoData() {
  try {
    // 1. Create demo users
    console.log("Creating demo users...");
    
    const demoUsers = [
      {
        email: "alex.creator@demo.com",
        username: "alexcreator",
        password: PASSWORD_HASH,
        userType: "creator" as const,
        bio: "Award-winning filmmaker with a passion for sci-fi narratives",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
        createdAt: new Date()
      },
      {
        email: "sarah.investor@demo.com",
        username: "sarahinvestor",
        password: PASSWORD_HASH,
        userType: "investor" as const,
        bio: "Angel investor focused on entertainment and media projects",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
        createdAt: new Date()
      },
      {
        email: "stellar.production@demo.com",
        username: "stellarproduction",
        password: PASSWORD_HASH,
        userType: "production" as const,
        bio: "Boutique production house specializing in indie films",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=stellar",
        createdAt: new Date()
      }
    ];
    
    // Insert users
    const insertedUsers = [];
    for (const userData of demoUsers) {
      try {
        const existing = await db.select().from(users)
          .where(eq(users.email, userData.email))
          .limit(1);
        
        if (existing.length > 0) {
          console.log(`   ⚠️ User ${userData.email} already exists`);
          insertedUsers.push(existing[0]);
        } else {
          const [newUser] = await db.insert(users).values(userData).returning();
          console.log(`   ✅ Created user: ${userData.email} (ID: ${newUser.id})`);
          insertedUsers.push(newUser);
        }
      } catch (error) {
        console.error(`   ❌ Failed to create user ${userData.email}:`, error.message);
      }
    }
    
    const creatorUser = insertedUsers.find(u => u.userType === "creator");
    const investorUser = insertedUsers.find(u => u.userType === "investor");
    const productionUser = insertedUsers.find(u => u.userType === "production");
    
    if (!creatorUser || !investorUser) {
      console.error("❌ Could not create required users");
      return;
    }
    
    // 2. Create sample pitches for creator
    console.log("\nCreating sample pitches...");
    
    const samplePitches = [
      {
        userId: creatorUser.id,
        title: "Quantum Paradox",
        logline: "A quantum physicist discovers parallel universes are colliding, threatening reality itself",
        synopsis: "When Dr. Elena Ross accidentally opens a portal between parallel universes, she must race against time to prevent a catastrophic collision that would destroy all realities.",
        genre: "sci-fi",
        format: "feature",
        status: "published" as const,
        thumbnailUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=quantum",
        budget: 5000000,
        targetAudience: "Sci-fi enthusiasts aged 18-45",
        comparableTitles: "Inception, Interstellar, The Matrix",
        viewCount: 1532,
        likeCount: 89,
        createdAt: new Date(),
        publishedAt: new Date()
      },
      {
        userId: creatorUser.id,
        title: "The Last Colony",
        logline: "Earth's final colony ship discovers the planet they're heading to is already inhabited",
        synopsis: "The crew of humanity's last hope must decide whether to turn back to a dying Earth or fight for their new home against an alien civilization.",
        genre: "thriller",
        format: "limited-series",
        status: "published" as const,
        thumbnailUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=colony",
        budget: 8000000,
        targetAudience: "Thriller and sci-fi fans",
        comparableTitles: "The Expanse, Battlestar Galactica",
        viewCount: 987,
        likeCount: 67,
        createdAt: new Date(),
        publishedAt: new Date()
      },
      {
        userId: creatorUser.id,
        title: "Digital Minds",
        logline: "A documentary exploring the rise of AI consciousness",
        synopsis: "An in-depth look at the development of artificial intelligence and the ethical questions surrounding machine consciousness.",
        genre: "documentary",
        format: "feature",
        status: "draft" as const,
        thumbnailUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=digital",
        budget: 500000,
        targetAudience: "Tech enthusiasts and documentary lovers",
        comparableTitles: "AlphaGo, The Social Dilemma",
        viewCount: 0,
        likeCount: 0,
        createdAt: new Date()
      }
    ];
    
    const insertedPitches = [];
    for (const pitchData of samplePitches) {
      try {
        const [newPitch] = await db.insert(pitches).values(pitchData).returning();
        console.log(`   ✅ Created pitch: ${pitchData.title} (ID: ${newPitch.id})`);
        insertedPitches.push(newPitch);
      } catch (error) {
        console.error(`   ❌ Failed to create pitch ${pitchData.title}:`, error.message);
      }
    }
    
    // 3. Create investments
    if (investorUser && insertedPitches.length > 0) {
      console.log("\nCreating sample investments...");
      
      try {
        const investmentData = {
          investorId: investorUser.id,
          pitchId: insertedPitches[0].id,
          amount: 100000,
          investmentType: "equity" as const,
          status: "active" as const,
          percentage: 5,
          notes: "Excited about the potential of this project",
          createdAt: new Date()
        };
        
        await db.insert(investments).values(investmentData);
        console.log(`   ✅ Created investment from ${investorUser.username} to ${insertedPitches[0].title}`);
      } catch (error) {
        console.error("   ❌ Failed to create investment:", error.message);
      }
    }
    
    // 4. Create NDAs
    if (investorUser && insertedPitches.length > 0) {
      console.log("\nCreating sample NDAs...");
      
      try {
        const ndaData = {
          pitchId: insertedPitches[0].id,
          userId: investorUser.id,
          status: "signed" as const,
          signedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          createdAt: new Date()
        };
        
        await db.insert(ndas).values(ndaData);
        console.log(`   ✅ Created NDA for ${investorUser.username} on ${insertedPitches[0].title}`);
      } catch (error) {
        console.error("   ❌ Failed to create NDA:", error.message);
      }
    }
    
    // 5. Create follows
    if (investorUser && creatorUser) {
      console.log("\nCreating follow relationships...");
      
      try {
        await db.insert(follows).values({
          followerId: investorUser.id,
          creatorId: creatorUser.id,
          createdAt: new Date()
        });
        console.log(`   ✅ ${investorUser.username} now follows ${creatorUser.username}`);
      } catch (error) {
        console.error("   ❌ Failed to create follow:", error.message);
      }
    }
    
    // 6. Create notifications
    console.log("\nCreating sample notifications...");
    
    const notificationData = [
      {
        userId: creatorUser.id,
        type: "pitch_view" as const,
        title: "Your pitch was viewed",
        message: "Someone viewed your pitch 'Quantum Paradox'",
        read: false,
        createdAt: new Date()
      },
      {
        userId: investorUser.id,
        type: "investment_update" as const,
        title: "Investment update",
        message: "New update on your investment in 'Quantum Paradox'",
        read: false,
        createdAt: new Date()
      }
    ];
    
    for (const notif of notificationData) {
      try {
        await db.insert(notifications).values(notif);
        console.log(`   ✅ Created notification for user ID ${notif.userId}`);
      } catch (error) {
        console.error("   ❌ Failed to create notification:", error.message);
      }
    }
    
    console.log("\n✅ Demo Data Seeding Complete!");
    console.log("=" .repeat(50));
    
    // Final summary
    console.log("\n📊 Summary:");
    console.log(`   - Users created: ${insertedUsers.length}`);
    console.log(`   - Pitches created: ${insertedPitches.length}`);
    console.log(`   - Demo accounts ready for testing`);
    console.log("\n🔑 Login Credentials:");
    console.log("   - alex.creator@demo.com / Demo123");
    console.log("   - sarah.investor@demo.com / Demo123");
    console.log("   - stellar.production@demo.com / Demo123");
    
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    console.error("Details:", error.message);
    Deno.exit(1);
  }
}

// Import eq for queries
import { eq } from "npm:drizzle-orm@0.35.3";

// Run the seeding
await seedDemoData();
Deno.exit(0);