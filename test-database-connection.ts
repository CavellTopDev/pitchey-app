#!/usr/bin/env deno run --allow-all

// Load environment variables
import { load } from "https://deno.land/std@0.218.0/dotenv/mod.ts";

// Load .env file
const env = await load({ 
  allowEmptyValues: true,
  defaultsPath: null,
  examplePath: null
});

// Set environment variables
for (const [key, value] of Object.entries(env)) {
  Deno.env.set(key, value);
}

// Import database modules
import { drizzle } from "npm:drizzle-orm/neon-http";
import { neon } from "npm:@neondatabase/serverless";
import { users, pitches, ndaRequests } from "./src/db/schema.ts";
import { eq, desc, count } from "npm:drizzle-orm@0.35.3";

async function testDatabaseConnection() {
  console.log("🔍 Testing Neon PostgreSQL Database Connection...");
  
  // Check configuration
  console.log("\n📋 Configuration:");
  const dbUrl = Deno.env.get("DATABASE_URL");
  console.log(`DATABASE_URL: ${dbUrl ? dbUrl.substring(0, 50) + "..." : "[NOT SET]"}`);
  
  if (!dbUrl) {
    console.log("❌ DATABASE_URL not set. Check environment variables.");
    return;
  }
  
  try {
    // Create database connection
    console.log("\n🔌 Creating database connection...");
    const sql = neon(dbUrl);
    const db = drizzle(sql);
    
    console.log("✅ Database connection created");
    
    // Test basic query - get users count
    console.log("\n🧪 Testing basic queries...");
    
    console.log("Testing users table...");
    const usersCount = await db.select({ count: count() }).from(users);
    console.log(`Users count: ${usersCount[0]?.count || 0}`);
    
    // Get sample users
    const sampleUsers = await db.select().from(users).limit(3);
    console.log(`Sample users:`, sampleUsers.map(u => ({ id: u.id, email: u.email, userType: u.userType })));
    
    // Test pitches table
    console.log("\nTesting pitches table...");
    const pitchesCount = await db.select({ count: count() }).from(pitches);
    console.log(`Pitches count: ${pitchesCount[0]?.count || 0}`);
    
    // Get sample pitches
    const samplePitches = await db.select().from(pitches).limit(3).orderBy(desc(pitches.createdAt));
    console.log(`Sample pitches:`, samplePitches.map(p => ({ 
      id: p.id, 
      title: p.title, 
      status: p.status, 
      creatorId: p.creatorId 
    })));
    
    // Test NDA requests table
    console.log("\nTesting NDA requests table...");
    const ndaCount = await db.select({ count: count() }).from(ndaRequests);
    console.log(`NDA requests count: ${ndaCount[0]?.count || 0}`);
    
    // Test a join query
    console.log("\nTesting join query (pitches with creators)...");
    const pitchesWithCreators = await db
      .select({
        pitchId: pitches.id,
        pitchTitle: pitches.title,
        creatorId: users.id,
        creatorEmail: users.email,
        creatorUserType: users.userType
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.creatorId, users.id))
      .limit(3);
    
    console.log("Pitches with creators:", pitchesWithCreators);
    
    // Test transaction
    console.log("\nTesting database transaction...");
    try {
      await db.transaction(async (tx) => {
        // This is a read-only transaction test
        const testCount = await tx.select({ count: count() }).from(users);
        console.log(`Transaction test - users count: ${testCount[0]?.count || 0}`);
        
        // Intentionally throw to test rollback
        // throw new Error("Test rollback");
      });
      console.log("✅ Transaction completed successfully");
    } catch (error) {
      console.log("🔄 Transaction rolled back (expected):", error.message);
    }
    
    // Test specific demo user authentication
    console.log("\nTesting demo user lookup...");
    const demoCreator = await db
      .select()
      .from(users)
      .where(eq(users.email, "alex.creator@demo.com"))
      .limit(1);
    
    if (demoCreator.length > 0) {
      console.log("✅ Demo creator found:", {
        id: demoCreator[0].id,
        email: demoCreator[0].email,
        userType: demoCreator[0].userType,
        username: demoCreator[0].username
      });
    } else {
      console.log("❌ Demo creator not found");
    }
    
    console.log("\n✅ All database operations completed successfully!");
    
  } catch (error) {
    console.error("❌ Database operation failed:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
  }
}

// Run the test
if (import.meta.main) {
  await testDatabaseConnection();
}