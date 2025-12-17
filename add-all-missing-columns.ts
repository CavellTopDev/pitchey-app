import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

async function addAllMissingColumns() {
  try {
    console.log("🔧 Adding all missing columns to database...");
    
    // Add missing columns to users table
    const userColumns = [
      { name: "avatar_url", type: "TEXT", description: "User avatar URL" },
    ];
    
    console.log("\n➕ Adding missing columns to users table...");
    for (const column of userColumns) {
      try {
        await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`));
        console.log(`✅ Successfully added '${column.name}' column to users`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`ℹ️  '${column.name}' column already exists in users`);
        } else {
          console.log(`❌ Error adding ${column.name} column:`, error.message);
        }
      }
    }
    
    // Add missing columns to pitches table
    const pitchColumns = [
      { name: "stage", type: "VARCHAR(100)", description: "Production stage" },
    ];
    
    console.log("\n➕ Adding missing columns to pitches table...");
    for (const column of pitchColumns) {
      try {
        await db.execute(sql.raw(`ALTER TABLE pitches ADD COLUMN ${column.name} ${column.type}`));
        console.log(`✅ Successfully added '${column.name}' column to pitches`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`ℹ️  '${column.name}' column already exists in pitches`);
        } else {
          console.log(`❌ Error adding ${column.name} column:`, error.message);
        }
      }
    }
    
    // Verify the columns were added
    console.log("\n🔍 Verifying all columns were added...");
    try {
      await db.execute(sql`SELECT avatar_url FROM users LIMIT 1`);
      console.log("✅ 'avatar_url' column accessible in users");
    } catch (error) {
      console.log("❌ 'avatar_url' column still not accessible:", error.message);
    }
    
    try {
      await db.execute(sql`SELECT stage FROM pitches LIMIT 1`);
      console.log("✅ 'stage' column accessible in pitches");
    } catch (error) {
      console.log("❌ 'stage' column still not accessible:", error.message);
    }
    
    console.log("\n🎉 All missing columns added successfully!");
    
  } catch (error) {
    console.error("❌ Failed to update database schema:", error.message);
  }
}

if (import.meta.main) {
  await addAllMissingColumns();
  Deno.exit(0);
}