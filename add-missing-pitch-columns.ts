#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

async function addMissingPitchColumns() {
  console.log("🚀 Adding missing pitch columns...");
  
  try {
    // Add all missing columns from the schema
    const columnsToAdd = [
      { name: "title_image", type: "text" },
      { name: "long_synopsis", type: "text" },
      { name: "opener", type: "text" },
      { name: "premise", type: "text" },
      { name: "target_audience", type: "text" },
      { name: "characters", type: "jsonb" },
      { name: "themes", type: "jsonb" },
      { name: "episode_breakdown", type: "jsonb" },
      { name: "budget_bracket", type: "varchar(50)" },
      { name: "estimated_budget", type: "decimal(12,2)" },
      { name: "lookbook_url", type: "text" },
      { name: "pitch_deck_url", type: "text" },
      { name: "script_url", type: "text" },
      { name: "trailer_url", type: "text" },
      { name: "production_timeline", type: "text" },
      { name: "additional_media", type: "jsonb" },
      { name: "visibility_settings", type: "jsonb", default: "'{\"showShortSynopsis\": true, \"showCharacters\": false, \"showBudget\": false, \"showMedia\": false}'" },
      { name: "published_at", type: "timestamp" },
      { name: "view_count", type: "integer", default: "0" },
      { name: "like_count", type: "integer", default: "0" },
      { name: "nda_count", type: "integer", default: "0" },
      { name: "ai_used", type: "boolean", default: "false" },
      { name: "require_nda", type: "boolean", default: "false" },
      { name: "updated_at", type: "timestamp", default: "now()" }
    ];
    
    for (const column of columnsToAdd) {
      try {
        let alterStatement = `ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type}`;
        if (column.default) {
          alterStatement += ` DEFAULT ${column.default}`;
        }
        
        await db.execute(sql.raw(alterStatement));
        console.log(`✅ Added column: ${column.name}`);
      } catch (error) {
        console.log(`⚠️  Column ${column.name} warning: ${error.message}`);
      }
    }
    
    // Add missing user columns too
    console.log("\nAdding missing user columns...");
    const userColumnsToAdd = [
      { name: "first_name", type: "varchar(100)" },
      { name: "last_name", type: "varchar(100)" },
      { name: "phone", type: "varchar(20)" },
      { name: "location", type: "varchar(200)" },
      { name: "bio", type: "text" },
      { name: "profile_image_url", type: "text" },
      { name: "company_name", type: "text" },
      { name: "company_number", type: "varchar(100)" },
      { name: "company_website", type: "text" },
      { name: "company_address", type: "text" },
      { name: "company_verified", type: "boolean", default: "false" },
      { name: "is_active", type: "boolean", default: "true" },
      { name: "failed_login_attempts", type: "integer", default: "0" },
      { name: "account_locked_at", type: "timestamp" },
      { name: "account_lock_reason", type: "varchar(200)" }
    ];
    
    for (const column of userColumnsToAdd) {
      try {
        let alterStatement = `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type}`;
        if (column.default) {
          alterStatement += ` DEFAULT ${column.default}`;
        }
        
        await db.execute(sql.raw(alterStatement));
        console.log(`✅ Added user column: ${column.name}`);
      } catch (error) {
        console.log(`⚠️  User column ${column.name} warning: ${error.message}`);
      }
    }
    
    console.log("\n✅ All missing columns added!");
    
    // Test that the columns exist now
    console.log("\n🧪 Testing column accessibility...");
    
    try {
      const testQuery = await db.execute(sql`
        SELECT id, title, title_image, view_count, like_count, nda_count 
        FROM pitches 
        LIMIT 1
      `);
      console.log("✅ All pitch columns accessible");
    } catch (error) {
      console.log(`❌ Pitch columns test failed: ${error.message}`);
    }
    
    try {
      const testUserQuery = await db.execute(sql`
        SELECT id, username, first_name, last_name, company_name, user_type 
        FROM users 
        LIMIT 1
      `);
      console.log("✅ All user columns accessible");
    } catch (error) {
      console.log(`❌ User columns test failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error("❌ Failed to add missing columns:", error);
    throw error;
  }
}

if (import.meta.main) {
  await addMissingPitchColumns();
}