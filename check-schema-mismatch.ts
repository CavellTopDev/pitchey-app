import { db } from "./src/db/client.ts";

async function checkSchemaMismatch() {
  try {
    console.log("🔍 Checking database schema...");
    
    // Check users table columns
    console.log("\n📋 Checking users table...");
    try {
      const userResult = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY column_name
      `);
      console.log("Users columns:", userResult.rows.map(r => r.column_name));
    } catch (error) {
      console.log("❌ Error checking users table:", error.message);
    }
    
    // Check pitches table columns
    console.log("\n📝 Checking pitches table...");
    try {
      const pitchResult = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'pitches' 
        ORDER BY column_name
      `);
      console.log("Pitches columns:", pitchResult.rows.map(r => r.column_name));
      
      // Specifically check for missing columns
      const columns = pitchResult.rows.map(r => r.column_name);
      const requiredColumns = ['description', 'website'];
      const missing = requiredColumns.filter(col => !columns.includes(col));
      if (missing.length > 0) {
        console.log("❌ Missing columns in pitches:", missing);
      } else {
        console.log("✅ All required columns present");
      }
    } catch (error) {
      console.log("❌ Error checking pitches table:", error.message);
    }
    
    // Check if we can select with specific columns
    console.log("\n🧪 Testing specific column queries...");
    try {
      const testQuery = await db.execute(sql`SELECT id, title FROM pitches LIMIT 1`);
      console.log("✅ Basic query works");
    } catch (error) {
      console.log("❌ Basic query failed:", error.message);
    }
    
    try {
      const websiteQuery = await db.execute(sql`SELECT id, website FROM users LIMIT 1`);
      console.log("✅ Website column exists in users");
    } catch (error) {
      console.log("❌ Website column missing from users:", error.message);
    }
    
    try {
      const descQuery = await db.execute(sql`SELECT id, description FROM pitches LIMIT 1`);
      console.log("✅ Description column exists in pitches");
    } catch (error) {
      console.log("❌ Description column missing from pitches:", error.message);
    }
    
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
}

// Import sql from drizzle-orm
import { sql } from "drizzle-orm";

if (import.meta.main) {
  await checkSchemaMismatch();
  Deno.exit(0);
}