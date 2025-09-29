#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

console.log("🔧 Adding conversation_participants table...");

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS conversation_participants (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
    left_at TIMESTAMP,
    mute_notifications BOOLEAN DEFAULT FALSE
  )
`);

await db.execute(sql`
  CREATE INDEX IF NOT EXISTS conversation_participants_conversation_id_idx ON conversation_participants(conversation_id)
`);

await db.execute(sql`
  CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx ON conversation_participants(user_id)
`);

console.log("✅ conversation_participants table created successfully!");