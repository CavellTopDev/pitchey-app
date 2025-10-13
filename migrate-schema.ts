#!/usr/bin/env deno run --allow-all

/**
 * Drizzle Migration Runner
 * 
 * This script ensures all future database changes go through Drizzle migrations.
 * 
 * Usage:
 *   deno run --allow-all migrate-schema.ts
 * 
 * Environment Variables:
 *   DATABASE_URL - PostgreSQL connection string
 */

import { migrate } from "npm:drizzle-orm/postgres-js/migrator";
import { db, migrationClient } from "./src/db/client.ts";

async function runMigrations() {
  console.log("🚀 Starting Drizzle migrations...");
  
  const DATABASE_URL = Deno.env.get("DATABASE_URL");
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    Deno.exit(1);
  }

  console.log(`📊 Database: ${DATABASE_URL.split('@')[1] || 'local'}`);
  
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    Deno.exit(1);
  } finally {
    // Clean up connection
    if (migrationClient && typeof migrationClient.end === 'function') {
      await migrationClient.end();
    }
  }
  
  console.log("🎉 Database is up to date with Drizzle schema");
}

async function generateMigration() {
  console.log("📝 Generating new migration...");
  console.log("Run: deno run --allow-all --allow-read --allow-write npm:drizzle-kit generate");
}

if (import.meta.main) {
  const command = Deno.args[0];
  
  if (command === "generate") {
    await generateMigration();
  } else {
    await runMigrations();
  }
}