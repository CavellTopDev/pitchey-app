// Fix null array columns that are breaking Drizzle ORM
import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

async function fixArrayColumns() {
  console.log("🔧 Fixing null array columns...");
  
  try {
    // Fix ai_tools array
    console.log("1. Fixing ai_tools array column...");
    await db.execute(sql`
      UPDATE pitches 
      SET ai_tools = '{}' 
      WHERE ai_tools IS NULL
    `);
    
    // Fix tags array  
    console.log("2. Fixing tags array column...");
    await db.execute(sql`
      UPDATE pitches 
      SET tags = '{}' 
      WHERE tags IS NULL
    `);
    
    console.log("✅ Fixed array columns");
    
    // Test if we can now query pitches
    console.log("🧪 Testing simple query after fixes...");
    const test = await db.execute(sql`
      SELECT id, title, ai_tools, tags 
      FROM pitches 
      LIMIT 1
    `);
    
    console.log("Test result:", test.rows[0]);
    
  } catch (error) {
    console.error("❌ Error fixing array columns:", error);
  }
  
  process.exit(0);
}

fixArrayColumns();