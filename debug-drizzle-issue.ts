// Debug the exact Drizzle issue by testing smaller parts
import { db } from "./src/db/client.ts";
import { pitches } from "./src/db/schema.ts";
import { sql } from "drizzle-orm";

async function debugDrizzleIssue() {
  console.log("🔍 Debugging Drizzle ORM issue step by step...");
  
  try {
    // Test 1: Direct SQL for comparison
    console.log("1. Direct SQL query:");
    const directResult = await db.execute(sql`
      SELECT id, title, logline, ai_tools, tags, status
      FROM pitches 
      WHERE status = 'published'
      LIMIT 1
    `);
    console.log("Direct SQL result:", directResult.rows[0]);
    
    // Test 2: Try Drizzle with explicit column selection (avoiding arrays)
    console.log("\n2. Drizzle ORM without array columns:");
    const drizzleNoArrays = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        status: pitches.status,
        userId: pitches.userId
      })
      .from(pitches)
      .limit(1);
    console.log("Drizzle without arrays result:", drizzleNoArrays[0]);
    
    // Test 3: Try with array columns to see if that's the issue
    console.log("\n3. Testing array columns specifically:");
    try {
      const arrayTest = await db
        .select({
          id: pitches.id,
          aiTools: pitches.aiTools,
          tags: pitches.tags
        })
        .from(pitches)
        .limit(1);
      console.log("Array test result:", arrayTest[0]);
    } catch (arrayError) {
      console.error("Array error:", arrayError.message);
    }
    
  } catch (error) {
    console.error("❌ Error in debug:", error);
  }
  
  process.exit(0);
}

debugDrizzleIssue();