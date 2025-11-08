import { migrate as migratePostgres } from "npm:drizzle-orm@0.33.0/postgres-js/migrator";
import { migrate as migrateNeon } from "npm:drizzle-orm@0.33.0/neon-http/migrator";
import { db, migrationClient } from "./client.ts";

console.log("Running migrations...");

// Check if we're using local postgres or Neon based on DATABASE_URL
const connectionString = Deno.env.get("DATABASE_URL") || "";
const isLocalDb = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

// Use appropriate migrator with proper typing
// Migrations folder path - resolve relative to project root where deno.json exists
import { dirname, join } from "https://deno.land/std@0.208.0/path/mod.ts";

// Find project root by looking for deno.json, starting from script location
let currentDir = dirname(new URL(import.meta.url).pathname);
while (currentDir !== "/") {
  try {
    const stat = Deno.statSync(join(currentDir, "deno.json"));
    if (stat.isFile) break;
  } catch {
    // deno.json not found, continue searching up
  }
  currentDir = dirname(currentDir);
}

const migrationsFolder = join(currentDir, "drizzle");

if (isLocalDb) {
  await migratePostgres(db as any, { migrationsFolder });
} else {
  await migrateNeon(db as any, { migrationsFolder });
}

// Only call end if it exists (for local postgres connections)
if (migrationClient && typeof migrationClient.end === 'function') {
  await migrationClient.end();
}

console.log("Migrations completed!");