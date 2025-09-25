import { migrate as migratePostgres } from "npm:drizzle-orm/postgres-js/migrator";
import { migrate as migrateNeon } from "npm:drizzle-orm/neon-http/migrator";
import { db, migrationClient } from "./client.ts";

console.log("Running migrations...");

// Check if we're using local postgres or Neon based on DATABASE_URL
const connectionString = Deno.env.get("DATABASE_URL") || "";
const isLocalDb = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

// Use appropriate migrator with proper typing
if (isLocalDb) {
  await migratePostgres(db as any, { migrationsFolder: "./drizzle" });
} else {
  await migrateNeon(db as any, { migrationsFolder: "./drizzle" });
}

// Only call end if it exists (for local postgres connections)
if (migrationClient && typeof migrationClient.end === 'function') {
  await migrationClient.end();
}

console.log("Migrations completed!");