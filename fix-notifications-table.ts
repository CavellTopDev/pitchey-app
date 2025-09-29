// Fix notifications table
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

const client = postgres(DATABASE_URL);
const db = drizzle(client);

await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`);
await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false`).catch(() => {});

// Ensure the column name matches schema
try {
  await db.execute(sql`ALTER TABLE notifications RENAME COLUMN read TO is_read`);
} catch {
  // Column might already be renamed
}

await client.end();
console.log("✅ Notifications table fixed");