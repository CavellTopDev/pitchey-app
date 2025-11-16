import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

async function fixMissingColumns() {
  try {
    console.log("🔧 Adding missing columns to database...");
    
    // Add website column to users table
    console.log("\n➕ Adding 'website' column to users table...");
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN website TEXT`);
      console.log("✅ Successfully added 'website' column to users");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("ℹ️  'website' column already exists in users");
      } else {
        console.log("❌ Error adding website column:", error.message);
      }
    }
    
    // Add description column to pitches table
    console.log("\n➕ Adding 'description' column to pitches table...");
    try {
      await db.execute(sql`ALTER TABLE pitches ADD COLUMN description TEXT`);
      console.log("✅ Successfully added 'description' column to pitches");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("ℹ️  'description' column already exists in pitches");
      } else {
        console.log("❌ Error adding description column:", error.message);
      }
    }
    
    // Verify the columns were added
    console.log("\n🔍 Verifying columns were added...");
    try {
      await db.execute(sql`SELECT website FROM users LIMIT 1`);
      console.log("✅ 'website' column accessible in users");
    } catch (error) {
      console.log("❌ 'website' column still not accessible:", error.message);
    }
    
    try {
      await db.execute(sql`SELECT description FROM pitches LIMIT 1`);
      console.log("✅ 'description' column accessible in pitches");
    } catch (error) {
      console.log("❌ 'description' column still not accessible:", error.message);
    }
    
    console.log("\n🎉 Database schema update completed!");
    
  } catch (error) {
    console.error("❌ Failed to update database schema:", error.message);
  }
}

if (import.meta.main) {
  await fixMissingColumns();
  Deno.exit(0);
}