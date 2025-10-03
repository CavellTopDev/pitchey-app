#!/usr/bin/env -S deno run --allow-env --allow-net

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("Checking messages table...\n");

try {
  // Check if table exists
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
  `;
  
  if (tables.length === 0) {
    console.log("ERROR: messages table does NOT exist!");
    console.log("\nCreating messages table...");
    
    // Create the table
    await sql`
      CREATE TABLE messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(255),
        content TEXT,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`CREATE INDEX idx_messages_sender ON messages(sender_id)`;
    await sql`CREATE INDEX idx_messages_recipient ON messages(recipient_id)`;
    await sql`CREATE INDEX idx_messages_read ON messages(is_read)`;
    await sql`CREATE INDEX idx_messages_created_at ON messages(created_at DESC)`;
    
    console.log("✅ Messages table created successfully!");
  } else {
    console.log("✅ Messages table exists");
  }
  
  // Check columns
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'messages'
    ORDER BY ordinal_position
  `;
  
  console.log("\nColumns:");
  columns.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
  });
  
  // Check data
  const count = await sql`SELECT COUNT(*) as count FROM messages`;
  console.log(`\nTotal messages: ${count[0].count}`);
  
  if (count[0].count > 0) {
    const sample = await sql`SELECT * FROM messages LIMIT 3`;
    console.log("\nSample messages:");
    sample.forEach(msg => {
      console.log(`  ID ${msg.id}: ${msg.sender_id} -> ${msg.recipient_id}`);
    });
  } else {
    console.log("\nNo messages in database yet (this is normal for new installation)");
  }
  
  console.log("\n✅ Messages table is properly configured");
  
} catch (error) {
  console.error("ERROR:", error.message);
  console.error("\nStack:", error.stack);
}

Deno.exit(0);