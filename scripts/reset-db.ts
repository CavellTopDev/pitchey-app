#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

import postgres from "npm:postgres";
import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

config({ export: true });

const connectionString = Deno.env.get("DATABASE_URL") || "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = postgres(connectionString);

async function resetDatabase() {
  try {
    console.log("🗑️  Dropping all tables...");
    
    // Drop tables in reverse order of dependencies
    await sql`DROP TABLE IF EXISTS notifications CASCADE;`;
    await sql`DROP TABLE IF EXISTS follows CASCADE;`;
    await sql`DROP TABLE IF EXISTS pitch_views CASCADE;`;
    await sql`DROP TABLE IF EXISTS nda_requests CASCADE;`;
    await sql`DROP TABLE IF EXISTS ndas CASCADE;`;
    await sql`DROP TABLE IF EXISTS pitches CASCADE;`;
    await sql`DROP TABLE IF EXISTS sessions CASCADE;`;
    await sql`DROP TABLE IF EXISTS users CASCADE;`;
    
    // Drop all enum types
    await sql`DROP TYPE IF EXISTS user_type CASCADE;`;
    await sql`DROP TYPE IF EXISTS pitch_status CASCADE;`;
    await sql`DROP TYPE IF EXISTS genre CASCADE;`;
    await sql`DROP TYPE IF EXISTS format CASCADE;`;
    await sql`DROP TYPE IF EXISTS notification_type CASCADE;`;
    await sql`DROP TYPE IF EXISTS nda_type CASCADE;`;
    await sql`DROP TYPE IF EXISTS nda_request_status CASCADE;`;
    await sql`DROP TYPE IF EXISTS subscription_tier CASCADE;`;
    await sql`DROP TYPE IF EXISTS media_type CASCADE;`;
    
    console.log("✅ All tables and types dropped successfully!");
    
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the reset
await resetDatabase();