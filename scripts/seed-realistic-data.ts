#!/usr/bin/env -S deno run --allow-all

/**
 * Realistic Data Seeder for Pitchey Platform
 * 
 * This script creates realistic test data for development and testing.
 * It ensures all data relationships are properly maintained and creates
 * a realistic distribution of users, pitches, views, likes, and interactions.
 */

import { db } from "../src/db/client.ts";
import { 
  users, 
  pitches, 
  follows, 
  analyticsEvents,
  pitchViews,
  notifications,
  messages,
  conversations,
  conversationParticipants
} from "../src/db/schema.ts";
import { eq, sql } from "npm:drizzle-orm";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Configuration
const CONFIG = {
  users: {
    creators: 10,
    investors: 15,
    producers: 5,
  },
  pitchesPerCreator: { min: 1, max: 5 },
  viewsPerPitch: { min: 50, max: 500 },
  likesPerPitch: { min: 5, max: 50 },
  followsPerUser: { min: 2, max: 10 },
  messagesPerConversation: { min: 3, max: 20 },
};

// Sample data pools
const FIRST_NAMES = ["Alex", "Sarah", "Michael", "Emma", "David", "Lisa", "James", "Maria", "Robert", "Jennifer"];
const LAST_NAMES = ["Chen", "Johnson", "Williams", "Brown", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Wilson"];
const COMPANY_NAMES = ["Stellar", "Quantum", "Phoenix", "Atlas", "Nexus", "Aurora", "Titan", "Vertex", "Zenith", "Orion"];
const COMPANY_TYPES = ["Studios", "Films", "Pictures", "Productions", "Entertainment", "Media", "Creative", "Cinema"];

const PITCH_TITLES = [
  "The Last Horizon", "Quantum Dreams", "Silent Echo", "Midnight Protocol", "The Memory Keeper",
  "Urban Legends", "Digital Souls", "The Time Merchant", "Forgotten Stars", "Neon Nights",
  "The Signal", "Parallel Lives", "Ghost in the Machine", "The Void Walker", "Crystal Empire",
  "Shadow Protocol", "The Architect", "Neural Interface", "The Last Colony", "Eden's Gate"
];

const GENRES = ["drama", "comedy", "thriller", "horror", "scifi", "fantasy", "documentary", "animation", "action", "romance"];
const FORMATS = ["feature", "tv", "short", "webseries"];

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateUsername(firstName: string, lastName: string): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}`;
}

function generateCompanyName(): string {
  return `${randomElement(COMPANY_NAMES)} ${randomElement(COMPANY_TYPES)}`;
}

function generateLogline(): string {
  const templates = [
    "A {adjective} {genre} about {subject} who must {action} to {goal}.",
    "When {event} happens, {protagonist} must {action} before {consequence}.",
    "In a world where {premise}, {protagonist} discovers {revelation} and must {action}.",
    "{protagonist} {action} while {conflict}, leading to {outcome}.",
    "A {adjective} story of {subject} fighting against {antagonist} to {goal}."
  ];
  
  const adjectives = ["gripping", "thought-provoking", "intense", "heartwarming", "suspenseful", "epic", "intimate", "revolutionary"];
  const subjects = ["a detective", "a scientist", "a teacher", "an artist", "a soldier", "a family", "two strangers", "a small town"];
  const actions = ["uncover the truth", "save humanity", "find redemption", "overcome impossible odds", "make a choice", "solve the mystery"];
  const goals = ["save the world", "find love", "expose corruption", "prevent disaster", "achieve justice", "discover themselves"];
  
  let logline = randomElement(templates);
  logline = logline.replace("{adjective}", randomElement(adjectives));
  logline = logline.replace("{genre}", randomElement(GENRES));
  logline = logline.replace("{subject}", randomElement(subjects));
  logline = logline.replace("{protagonist}", randomElement(subjects));
  logline = logline.replace("{action}", randomElement(actions));
  logline = logline.replace("{goal}", randomElement(goals));
  logline = logline.replace("{event}", "the unexpected");
  logline = logline.replace("{consequence}", "it's too late");
  logline = logline.replace("{premise}", "technology controls everything");
  logline = logline.replace("{revelation}", "a shocking truth");
  logline = logline.replace("{conflict}", "facing their fears");
  logline = logline.replace("{antagonist}", "the system");
  logline = logline.replace("{outcome}", "unexpected consequences");
  
  return logline;
}

// Main seeding function
async function seedDatabase() {
  console.log("🌱 Starting realistic data seeding...\n");

  try {
    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log("🗑️  Clearing existing test data...");
    await db.delete(analyticsEvents).execute();
    await db.delete(pitchViews).execute();
    await db.delete(notifications).execute();
    await db.delete(messages).execute();
    await db.delete(conversationParticipants).execute();
    await db.delete(conversations).execute();
    await db.delete(follows).execute();
    await db.delete(pitches).execute();
    await db.delete(users).execute();
    
    // Reset sequences
    await db.execute(sql`ALTER SEQUENCE users_id_seq RESTART WITH 1`);
    await db.execute(sql`ALTER SEQUENCE pitches_id_seq RESTART WITH 1`);

    // 1. Create Users
    console.log("👥 Creating users...");
    const createdUsers: any[] = [];
    const passwordHash = await bcrypt.hash("Demo123!", 10);

    // Create creators
    for (let i = 0; i < CONFIG.users.creators; i++) {
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const username = generateUsername(firstName, lastName);
      
      const [user] = await db.insert(users).values({
        email: `${username}@demo.com`,
        username,
        passwordHash,
        userType: "creator",
        firstName,
        lastName,
        companyName: Math.random() > 0.5 ? generateCompanyName() : null,
        bio: `Award-winning filmmaker with ${randomInt(5, 20)} years of experience in ${randomElement(GENRES)} films.`,
        location: randomElement(["Los Angeles, CA", "New York, NY", "Atlanta, GA", "Austin, TX", "Portland, OR"]),
        verified: Math.random() > 0.3,
      }).returning();
      
      createdUsers.push({ ...user, role: "creator" });
      console.log(`  ✅ Creator: ${username}`);
    }

    // Create investors
    for (let i = 0; i < CONFIG.users.investors; i++) {
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const username = generateUsername(firstName, lastName);
      
      const [user] = await db.insert(users).values({
        email: `${username}@demo.com`,
        username,
        passwordHash,
        userType: "investor",
        firstName,
        lastName,
        companyName: Math.random() > 0.7 ? generateCompanyName() : null,
        bio: `Active investor focusing on ${randomElement(GENRES)} and ${randomElement(GENRES)} projects. Portfolio of ${randomInt(10, 50)} films.`,
        location: randomElement(["San Francisco, CA", "Boston, MA", "Chicago, IL", "Seattle, WA", "Miami, FL"]),
        verified: Math.random() > 0.5,
      }).returning();
      
      createdUsers.push({ ...user, role: "investor" });
      console.log(`  ✅ Investor: ${username}`);
    }

    // Create producers
    for (let i = 0; i < CONFIG.users.producers; i++) {
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const username = generateUsername(firstName, lastName);
      
      const [user] = await db.insert(users).values({
        email: `${username}@demo.com`,
        username,
        passwordHash,
        userType: "production",
        firstName,
        lastName,
        companyName: generateCompanyName(),
        bio: `Production company specializing in ${randomElement(FORMATS)} format. Produced ${randomInt(20, 100)}+ projects.`,
        location: randomElement(["Vancouver, BC", "Toronto, ON", "London, UK", "Sydney, AU", "Mumbai, IN"]),
        verified: true,
      }).returning();
      
      createdUsers.push({ ...user, role: "production" });
      console.log(`  ✅ Producer: ${username}`);
    }

    // 2. Create Pitches
    console.log("\n🎬 Creating pitches...");
    const createdPitches: any[] = [];
    const creators = createdUsers.filter(u => u.role === "creator");
    
    for (const creator of creators) {
      const pitchCount = randomInt(CONFIG.pitchesPerCreator.min, CONFIG.pitchesPerCreator.max);
      
      for (let i = 0; i < pitchCount; i++) {
        const budget = randomInt(100000, 10000000);
        const [pitch] = await db.insert(pitches).values({
          userId: creator.id,
          title: randomElement(PITCH_TITLES) + (Math.random() > 0.5 ? ` ${randomInt(2, 3)}` : ""),
          logline: generateLogline(),
          genre: randomElement(GENRES),
          format: randomElement(FORMATS),
          status: randomElement(["draft", "published", "published", "published"]), // More published than draft
          shortSynopsis: "A compelling story that explores the human condition through the lens of " + randomElement(GENRES) + ".",
          longSynopsis: "This is a detailed synopsis that would normally be much longer and contain plot details, character arcs, and thematic elements. " +
                       "The story follows our protagonist through a journey of discovery and transformation, facing challenges that test their resolve.",
          estimatedBudget: budget.toString(),
          budgetBracket: budget < 1000000 ? "Under $1M" : 
                        budget < 5000000 ? "$1M-$5M" : 
                        "$5M-$10M",
          targetAudience: `${randomElement(["Young adults", "Adults", "Mature audiences"])} who enjoy ${randomElement(GENRES)} films`,
          viewCount: 0,
          likeCount: 0,
          ndaCount: 0,
        }).returning();
        
        createdPitches.push(pitch);
        console.log(`  ✅ Pitch: "${pitch.title}" by ${creator.username}`);
      }
    }

    // 3. Create realistic view patterns
    console.log("\n👁️  Generating realistic view patterns...");
    const investors = createdUsers.filter(u => u.role === "investor");
    const producers = createdUsers.filter(u => u.role === "production");
    const allViewers = [...investors, ...producers];
    
    for (const pitch of createdPitches.filter(p => p.status === "published")) {
      const viewCount = randomInt(CONFIG.viewsPerPitch.min, CONFIG.viewsPerPitch.max);
      const uniqueViewers = new Set<number>();
      
      // Generate views over time (last 30 days)
      for (let v = 0; v < viewCount; v++) {
        const viewer = Math.random() > 0.3 ? randomElement(allViewers) : null; // 30% anonymous views
        const daysAgo = randomInt(0, 30);
        const viewedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        
        await db.insert(analyticsEvents).values({
          eventType: "view",
          userId: viewer?.id,
          pitchId: pitch.id,
          timestamp: viewedAt,
          eventData: {
            source: randomElement(["browse", "search", "recommendation", "direct"]),
          },
        });
        
        if (viewer) {
          uniqueViewers.add(viewer.id);
        }
      }
      
      // Update pitch view count
      await db.update(pitches)
        .set({ viewCount })
        .where(eq(pitches.id, pitch.id));
      
      console.log(`  👁️  ${viewCount} views for "${pitch.title}"`);
    }

    // 4. Generate likes (subset of viewers)
    console.log("\n❤️  Generating likes...");
    for (const pitch of createdPitches.filter(p => p.status === "published")) {
      const likeCount = Math.min(
        randomInt(CONFIG.likesPerPitch.min, CONFIG.likesPerPitch.max),
        Math.floor(pitch.viewCount * 0.2) // Max 20% of views become likes
      );
      
      const likers = new Set<number>();
      for (let l = 0; l < likeCount; l++) {
        const liker = randomElement(allViewers);
        if (!likers.has(liker.id)) {
          likers.add(liker.id);
          
          const daysAgo = randomInt(0, 25);
          await db.insert(analyticsEvents).values({
            eventType: "like",
            userId: liker.id,
            pitchId: pitch.id,
            timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          });
        }
      }
      
      // Update pitch like count
      await db.update(pitches)
        .set({ likeCount: likers.size })
        .where(eq(pitches.id, pitch.id));
      
      console.log(`  ❤️  ${likers.size} likes for "${pitch.title}"`);
    }

    // 5. Create follow relationships
    console.log("\n👥 Creating follow relationships...");
    for (const user of createdUsers) {
      const followCount = randomInt(CONFIG.followsPerUser.min, CONFIG.followsPerUser.max);
      const followed = new Set<number>();
      
      for (let f = 0; f < followCount; f++) {
        const target = randomElement(createdUsers.filter(u => u.id !== user.id));
        if (!followed.has(target.id)) {
          followed.add(target.id);
          
          await db.insert(follows).values({
            followerId: user.id,
            creatorId: target.id,
            followedAt: new Date(Date.now() - randomInt(0, 60) * 24 * 60 * 60 * 1000),
          });
        }
      }
      
      console.log(`  👥 ${user.username} follows ${followed.size} users`);
    }

    // 6. Generate some conversations and messages
    console.log("\n💬 Creating sample conversations...");
    const conversationPairs = [
      { from: investors[0], to: creators[0] },
      { from: investors[1], to: creators[1] },
      { from: producers[0], to: creators[0] },
    ].filter(p => p.from && p.to);
    
    for (const pair of conversationPairs) {
      const [conversation] = await db.insert(conversations).values({
        title: `Discussion about ${randomElement(createdPitches).title}`,
        createdById: pair.from.id,
        lastMessageAt: new Date(),
      }).returning();
      
      // Add participants
      await db.insert(conversationParticipants).values([
        { conversationId: conversation.id, userId: pair.from.id },
        { conversationId: conversation.id, userId: pair.to.id },
      ]);
      
      // Add messages
      const messageCount = randomInt(CONFIG.messagesPerConversation.min, CONFIG.messagesPerConversation.max);
      for (let m = 0; m < messageCount; m++) {
        const sender = Math.random() > 0.5 ? pair.from : pair.to;
        const receiver = sender === pair.from ? pair.to : pair.from;
        
        await db.insert(messages).values({
          conversationId: conversation.id,
          senderId: sender.id,
          receiverId: receiver.id,
          content: randomElement([
            "I'm very interested in your project.",
            "Can we schedule a call to discuss further?",
            "The concept looks promising. What's your timeline?",
            "I'd like to see more details about the budget breakdown.",
            "This aligns well with our investment criteria.",
            "When can we arrange a pitch meeting?",
            "I've reviewed the materials. Impressive work!",
            "Let's discuss the terms and conditions.",
          ]),
          sentAt: new Date(Date.now() - randomInt(0, 7) * 24 * 60 * 60 * 1000),
        });
      }
      
      console.log(`  💬 Conversation between ${pair.from.username} and ${pair.to.username}`);
    }

    // 7. Generate realistic notifications
    console.log("\n🔔 Creating notifications...");
    for (const user of randomElement([creators, investors])) {
      const notificationTypes = ["message", "follow", "pitch_update", "system"];
      const notifCount = randomInt(3, 10);
      
      for (let n = 0; n < notifCount; n++) {
        await db.insert(notifications).values({
          userId: user.id,
          type: randomElement(notificationTypes),
          title: randomElement([
            "New follower",
            "New message received",
            "Your pitch was viewed",
            "Investment opportunity",
            "System update",
          ]),
          message: "You have a new notification",
          isRead: Math.random() > 0.3, // 70% read
          createdAt: new Date(Date.now() - randomInt(0, 14) * 24 * 60 * 60 * 1000),
        });
      }
    }

    // Summary
    console.log("\n✨ Seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`  • Users created: ${createdUsers.length}`);
    console.log(`    - Creators: ${creators.length}`);
    console.log(`    - Investors: ${investors.length}`);
    console.log(`    - Producers: ${producers.length}`);
    console.log(`  • Pitches created: ${createdPitches.length}`);
    console.log(`  • Total views generated: ${createdPitches.reduce((sum, p) => sum + (p.viewCount || 0), 0)}`);
    console.log(`  • Total likes generated: ${createdPitches.reduce((sum, p) => sum + (p.likeCount || 0), 0)}`);
    
    console.log("\n🔑 Test Accounts:");
    console.log("  All accounts use password: Demo123!");
    console.log("\n  Creators:");
    creators.slice(0, 3).forEach(u => {
      console.log(`    • ${u.email}`);
    });
    console.log("\n  Investors:");
    investors.slice(0, 3).forEach(u => {
      console.log(`    • ${u.email}`);
    });
    
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    Deno.exit(1);
  }
}

// Run seeding
if (import.meta.main) {
  await seedDatabase();
  Deno.exit(0);
}