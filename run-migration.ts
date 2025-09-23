// Quick database migration script
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.log("No DATABASE_URL, skipping migration");
  Deno.exit(0);
}

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

try {
  console.log("Running migration to add missing columns...");
  await sql`
    ALTER TABLE sessions 
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
    ADD COLUMN IF NOT EXISTS user_agent TEXT
  `;
  console.log("Migration completed successfully");
} catch (error) {
  console.error("Migration error:", error);
} finally {
  await sql.end();
}