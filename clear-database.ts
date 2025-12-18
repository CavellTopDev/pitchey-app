#!/usr/bin/env -S deno run --allow-net --allow-env

// Clear the Neon database completely
import { neon } from "./deps.ts";

const connectionString = Deno.env.get("DATABASE_URL");
const sql = neon(connectionString);

console.log("🗑️ Clearing all tables...");

try {
  // Drop all tables to start fresh
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`GRANT ALL ON SCHEMA public TO public`;

  console.log("✅ Database cleared successfully!");
} catch (error) {
  console.error("❌ Error clearing database:", error);
}