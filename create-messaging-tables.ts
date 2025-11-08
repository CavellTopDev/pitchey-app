// Create all messaging tables with Drizzle
import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

async function createMessagingTables() {
  try {
    console.log("Creating messaging tables...");
    
    // Create conversations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        title TEXT,
        type TEXT DEFAULT 'direct',
        creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ conversations table created");
    
    // Create messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        attachments JSONB,
        edited BOOLEAN DEFAULT false,
        edited_at TIMESTAMP,
        deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ messages table created");
    
    // Create conversation_participants table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_read_at TIMESTAMP,
        muted BOOLEAN DEFAULT false,
        UNIQUE(conversation_id, user_id)
      )
    `);
    console.log("✓ conversation_participants table created");
    
    // Create message_read_receipts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS message_read_receipts (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      )
    `);
    console.log("✓ message_read_receipts table created");
    
    // Create typing_indicators table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS typing_indicators (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        is_typing BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      )
    `);
    console.log("✓ typing_indicators table created");
    
    // Create indexes for performance
    console.log("Creating indexes...");
    
    // Conversations indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conversations_creator_id ON conversations(creator_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at)`);
    
    // Messages indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)`);
    
    // Participants indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_participants_conversation_id ON conversation_participants(conversation_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_participants_user_id ON conversation_participants(user_id)`);
    
    // Read receipts indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_receipts_message_id ON message_read_receipts(message_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON message_read_receipts(user_id)`);
    
    console.log("✓ All indexes created");
    
    console.log("\n✅ All messaging tables created successfully!");
    
  } catch (error) {
    console.error("Error creating messaging tables:", error);
    throw error;
  }
}

// Run migration
await createMessagingTables();
Deno.exit(0);