import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";
import { users, pitches } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcrypt";

async function fixFinalSchemaAndData() {
  try {
    console.log("🔧 Adding final missing columns...");
    
    // Add email_notifications column to users table
    console.log("\n➕ Adding 'email_notifications' column to users table...");
    try {
      await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT true`));
      console.log("✅ Successfully added 'email_notifications' column to users");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("ℹ️  'email_notifications' column already exists in users");
      } else {
        console.log("❌ Error adding email_notifications column:", error.message);
      }
    }
    
    // Add marketing_emails column to users table
    console.log("\n➕ Adding 'marketing_emails' column to users table...");
    try {
      await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN marketing_emails BOOLEAN DEFAULT false`));
      console.log("✅ Successfully added 'marketing_emails' column to users");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("ℹ️  'marketing_emails' column already exists in users");
      } else {
        console.log("❌ Error adding marketing_emails column:", error.message);
      }
    }
    
    // Add privacy_settings column to users table
    console.log("\n➕ Adding 'privacy_settings' column to users table...");
    try {
      await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN privacy_settings JSONB DEFAULT '{}'`));
      console.log("✅ Successfully added 'privacy_settings' column to users");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("ℹ️  'privacy_settings' column already exists in users");
      } else {
        console.log("❌ Error adding privacy_settings column:", error.message);
      }
    }
    
    // Add array columns with proper SQL syntax
    console.log("\n➕ Adding array columns to users table...");
    const arrayColumns = [
      "preferred_genres",
      "preferred_formats", 
      "preferred_budget_ranges",
      "ai_tools"
    ];
    
    for (const column of arrayColumns) {
      try {
        await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN ${column} TEXT[] DEFAULT '{}'`));
        console.log(`✅ Successfully added '${column}' column to users`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`ℹ️  '${column}' column already exists in users`);
        } else {
          console.log(`❌ Error adding ${column} column:`, error.message);
        }
      }
    }
    
    // Add array columns to pitches table
    console.log("\n➕ Adding array columns to pitches table...");
    const pitchArrayColumns = ["ai_tools", "tags"];
    
    for (const column of pitchArrayColumns) {
      try {
        await db.execute(sql.raw(`ALTER TABLE pitches ADD COLUMN ${column} TEXT[] DEFAULT '{}'`));
        console.log(`✅ Successfully added '${column}' column to pitches`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`ℹ️  '${column}' column already exists in pitches`);
        } else {
          console.log(`❌ Error adding ${column} column:`, error.message);
        }
      }
    }
    
    // Add other required columns with proper defaults
    console.log("\n➕ Adding remaining required columns...");
    const additionalColumns = [
      { table: "users", name: "notification_frequency", type: "VARCHAR(50)", default: "'daily'" },
      { table: "pitches", name: "published_at", type: "TIMESTAMP", default: "NULL" }
    ];
    
    for (const column of additionalColumns) {
      try {
        await db.execute(sql.raw(`ALTER TABLE ${column.table} ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}`));
        console.log(`✅ Successfully added '${column.name}' column to ${column.table}`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`ℹ️  '${column.name}' column already exists in ${column.table}`);
        } else {
          console.log(`❌ Error adding ${column.name} column:`, error.message);
        }
      }
    }
    
    console.log("\n📊 Checking current data...");
    
    // Check if we have users
    const existingUsers = await db.select().from(users).limit(1);
    console.log(`Found ${existingUsers.length} users in database`);
    
    // Check if we have pitches
    const existingPitches = await db.select().from(pitches).limit(1);
    console.log(`Found ${existingPitches.length} pitches in database`);
    
    // Create test user if none exist
    if (existingUsers.length === 0) {
      console.log("\n👤 Creating test user...");
      const passwordHash = await bcrypt.hash("Demo123", 12);
      
      await db.insert(users).values({
        email: "test@example.com",
        username: "testuser",
        password: "legacy", // Legacy field
        passwordHash,
        userType: "creator",
        firstName: "Test",
        lastName: "User",
        emailVerified: true,
        isActive: true,
      });
      console.log("✅ Test user created");
    }
    
    // Create test pitch if none exist
    if (existingPitches.length === 0) {
      console.log("\n🎬 Creating test pitch...");
      
      // Get the test user ID
      const testUser = await db.select().from(users).where(eq(users.email, "test@example.com")).limit(1);
      if (testUser.length > 0) {
        await db.insert(pitches).values({
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
        });
        console.log("✅ Test pitch created");
      }
    }
    
    console.log("\n🎉 Schema and test data setup completed!");
    
  } catch (error) {
    console.error("❌ Failed to complete setup:", error.message);
    console.error("Full error:", error);
  }
}

if (import.meta.main) {
  await fixFinalSchemaAndData();
  Deno.exit(0);
}