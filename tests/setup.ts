import { assertEquals, assertExists } from "$std/testing/asserts.ts";
import { db } from "@/db/client.ts";
import { sql } from "drizzle-orm";

export async function setupTestDB() {
  // Run migrations
  await import("@/db/migrate.ts");
  
  // Clear existing data
  await db.execute(sql`TRUNCATE users, pitches, ndas, sessions CASCADE`);
  
  // Run seeds
  await import("@/db/seed.ts");
}

export { assertEquals, assertExists };