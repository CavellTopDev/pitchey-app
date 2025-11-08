// Create missing tables before adding columns
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'npm:drizzle-orm@0.35.3';

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

async function createMissingTables() {
  console.log("🚀 Creating missing tables...");
  
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    // Create conversations table if it doesn't exist
    console.log("📋 Creating CONVERSATIONS table if missing...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER,
        created_by_id INTEGER,
        title VARCHAR(200),
        is_group BOOLEAN DEFAULT false,
        last_message_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create conversation_participants table if it doesn't exist
    console.log("👥 Creating CONVERSATION_PARTICIPANTS table if missing...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        joined_at TIMESTAMP DEFAULT NOW(),
        left_at TIMESTAMP,
        mute_notifications BOOLEAN DEFAULT false,
        last_read_at TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      )
    `);

    // Create messages table if it doesn't exist (with updated schema)
    console.log("✉️ Creating/updating MESSAGES table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER,
        pitch_id INTEGER,
        parent_message_id INTEGER,
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        attachments JSONB,
        is_edited BOOLEAN DEFAULT false,
        is_deleted BOOLEAN DEFAULT false,
        off_platform_requested BOOLEAN DEFAULT false,
        off_platform_approved BOOLEAN DEFAULT false,
        read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        edited_at TIMESTAMP,
        deleted_at TIMESTAMP,
        sent_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create notifications table if it doesn't exist
    console.log("🔔 Creating NOTIFICATIONS table if missing...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200),
        message TEXT,
        related_pitch_id INTEGER,
        related_user_id INTEGER,
        related_nda_request_id INTEGER,
        action_url TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create transactions table if it doesn't exist
    console.log("💰 Creating TRANSACTIONS table if missing...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'EUR',
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        stripe_payment_intent_id TEXT,
        stripe_invoice_id TEXT,
        description TEXT,
        metadata JSONB,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create follows table if it doesn't exist
    console.log("➕ Creating FOLLOWS table if missing...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL,
        followed_id INTEGER NOT NULL,
        pitch_id INTEGER,
        creator_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(follower_id, followed_id)
      )
    `);

    // Create pitch_views table if it doesn't exist
    console.log("👁️ Creating PITCH_VIEWS table if missing...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pitch_views (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL,
        viewer_id INTEGER,
        view_type VARCHAR(20),
        ip_address VARCHAR(45),
        user_agent TEXT,
        referrer TEXT,
        session_id VARCHAR(100),
        view_duration INTEGER,
        scroll_depth INTEGER,
        clicked_watch_this BOOLEAN DEFAULT false,
        viewed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add foreign key constraints
    console.log("🔗 Adding foreign key constraints...");
    
    // Conversations foreign keys
    await db.execute(sql`
      ALTER TABLE conversations 
      ADD CONSTRAINT fk_conversations_pitch_id 
      FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE
    `).catch(() => console.log("FK conversations_pitch_id already exists or skipped"));

    await db.execute(sql`
      ALTER TABLE conversations 
      ADD CONSTRAINT fk_conversations_created_by 
      FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
    `).catch(() => console.log("FK conversations_created_by already exists or skipped"));

    // Conversation participants foreign keys
    await db.execute(sql`
      ALTER TABLE conversation_participants 
      ADD CONSTRAINT fk_participants_conversation 
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    `).catch(() => console.log("FK participants_conversation already exists or skipped"));

    await db.execute(sql`
      ALTER TABLE conversation_participants 
      ADD CONSTRAINT fk_participants_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `).catch(() => console.log("FK participants_user already exists or skipped"));

    // Messages foreign keys
    await db.execute(sql`
      ALTER TABLE messages 
      ADD CONSTRAINT fk_messages_conversation 
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    `).catch(() => console.log("FK messages_conversation already exists or skipped"));

    await db.execute(sql`
      ALTER TABLE messages 
      ADD CONSTRAINT fk_messages_sender 
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    `).catch(() => console.log("FK messages_sender already exists or skipped"));

    await db.execute(sql`
      ALTER TABLE messages 
      ADD CONSTRAINT fk_messages_receiver 
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
    `).catch(() => console.log("FK messages_receiver already exists or skipped"));

    await db.execute(sql`
      ALTER TABLE messages 
      ADD CONSTRAINT fk_messages_pitch 
      FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE
    `).catch(() => console.log("FK messages_pitch already exists or skipped"));

    // Notifications foreign keys
    await db.execute(sql`
      ALTER TABLE notifications 
      ADD CONSTRAINT fk_notifications_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `).catch(() => console.log("FK notifications_user already exists or skipped"));

    // Transactions foreign keys
    await db.execute(sql`
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `).catch(() => console.log("FK transactions_user already exists or skipped"));

    // Follows foreign keys
    await db.execute(sql`
      ALTER TABLE follows 
      ADD CONSTRAINT fk_follows_follower 
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE
    `).catch(() => console.log("FK follows_follower already exists or skipped"));

    await db.execute(sql`
      ALTER TABLE follows 
      ADD CONSTRAINT fk_follows_followed 
      FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
    `).catch(() => console.log("FK follows_followed already exists or skipped"));

    // Pitch views foreign keys
    await db.execute(sql`
      ALTER TABLE pitch_views 
      ADD CONSTRAINT fk_pitch_views_pitch 
      FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE
    `).catch(() => console.log("FK pitch_views_pitch already exists or skipped"));

    await db.execute(sql`
      ALTER TABLE pitch_views 
      ADD CONSTRAINT fk_pitch_views_viewer 
      FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE SET NULL
    `).catch(() => console.log("FK pitch_views_viewer already exists or skipped"));

    console.log("✅ All missing tables created successfully!");
    
  } catch (error) {
    console.error("❌ Error creating tables:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
if (import.meta.main) {
  await createMissingTables();
}