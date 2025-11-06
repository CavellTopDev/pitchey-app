// Test simple Drizzle queries to isolate the issue
import { db } from "./src/db/client.ts";
import { pitches, users } from "./src/db/schema.ts";
import { eq, desc } from "drizzle-orm";

async function testSimpleDrizzleQuery() {
  console.log("🧪 Testing simple Drizzle queries...");
  
  try {
    // Test 1: Simple select all from pitches
    console.log("1. Simple select * from pitches:");
    const allPitches = await db.select().from(pitches).limit(1);
    console.log("Result 1:", JSON.stringify(allPitches[0], null, 2));
    
    // Test 2: Select specific fields
    console.log("\n2. Select specific fields:");
    const specificFields = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        status: pitches.status
      })
      .from(pitches)
      .limit(1);
    console.log("Result 2:", JSON.stringify(specificFields[0], null, 2));
    
    // Test 3: Join with users
    console.log("\n3. Join with users:");
    const withUsers = await db
      .select({
        pitchId: pitches.id,
        pitchTitle: pitches.title,
        userId: users.id,
        userName: users.username
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
      .limit(1);
    console.log("Result 3:", JSON.stringify(withUsers[0], null, 2));
    
  } catch (error) {
    console.error("❌ Error in simple queries:", error);
  }
  
  process.exit(0);
}

testSimpleDrizzleQuery();