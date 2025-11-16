import { db } from "./src/db/client.ts";
import { users, pitches } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";

async function createTestData() {
  try {
    console.log("📊 Checking current data...");
    
    // Check if we have users
    const existingUsers = await db.select().from(users).limit(1);
    console.log(`Found ${existingUsers.length} users in database`);
    
    // Check if we have pitches
    const existingPitches = await db.select().from(pitches).limit(1);
    console.log(`Found ${existingPitches.length} pitches in database`);
    
    // Create test user if none exist
    if (existingUsers.length === 0) {
      console.log("\n👤 Creating test user...");
      // Use a simple hash for testing purposes
      const passwordHash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewsY0A0.YGg5w8DO"; // Hash of "Demo123"
      
      const [newUser] = await db.insert(users).values({
        email: "test@example.com",
        username: "testuser",
        password: "legacy", // Legacy field
        passwordHash,
        userType: "creator",
        firstName: "Test",
        lastName: "User",
        emailVerified: true,
        isActive: true,
      }).returning();
      console.log("✅ Test user created with ID:", newUser.id);
    }
    
    // Create test pitch if none exist
    if (existingPitches.length === 0) {
      console.log("\n🎬 Creating test pitch...");
      
      // Get the test user ID
      const testUser = await db.select().from(users).where(eq(users.email, "test@example.com")).limit(1);
      if (testUser.length > 0) {
        const [newPitch] = await db.insert(pitches).values({
          userId: testUser[0].id,
          title: "Test Movie Pitch",
          logline: "A test pitch for development purposes",
          description: "This is a test pitch created for development and testing",
          genre: "Drama",
          format: "Feature Film",
          shortSynopsis: "A short synopsis for testing",
          budgetRange: "$1M - $5M",
          visibility: "public",
          status: "active",
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          ndaCount: 0,
          seekingInvestment: false,
          requireNda: false,
          productionStage: "concept"
        }).returning();
        console.log("✅ Test pitch created with ID:", newPitch.id);
      }
    }
    
    // Verify data was created
    const finalUsers = await db.select().from(users).limit(5);
    const finalPitches = await db.select().from(pitches).limit(5);
    
    console.log(`\n✅ Final verification:`);
    console.log(`Users in database: ${finalUsers.length}`);
    console.log(`Pitches in database: ${finalPitches.length}`);
    
    if (finalUsers.length > 0 && finalPitches.length > 0) {
      console.log("🎉 Test data created successfully!");
    } else {
      console.log("❌ Test data creation may have failed");
    }
    
  } catch (error) {
    console.error("❌ Failed to create test data:", error.message);
    console.error("Full error:", error);
  }
}

if (import.meta.main) {
  await createTestData();
  Deno.exit(0);
}