// Comprehensive migration to add ALL missing columns to PostgreSQL database based on Drizzle schema
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";

async function runCompleteMigration() {
  console.log("🚀 Starting comprehensive database migration...");
  
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    // ============= PITCHES TABLE COLUMNS =============
    console.log("\n📋 Updating PITCHES table...");
    
    // Content columns
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS opener TEXT`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS premise TEXT`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS target_audience TEXT`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS long_synopsis TEXT`);
    
    // Structured data columns
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS episode_breakdown JSONB`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS budget_bracket VARCHAR(50)`);
    
    // Media columns
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS lookbook_url TEXT`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS pitch_deck_url TEXT`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS script_url TEXT`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS trailer_url TEXT`);
    
    // Visibility settings
    await db.execute(sql`
      ALTER TABLE pitches ADD COLUMN IF NOT EXISTS visibility_settings JSONB 
      DEFAULT '{"showShortSynopsis": true, "showCharacters": false, "showBudget": false, "showMedia": false}'::jsonb
    `);
    
    // Metrics
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS nda_count INTEGER DEFAULT 0`);
    
    // AI columns (already added in previous migration)
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS ai_used BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS ai_tools VARCHAR(100)[] DEFAULT '{}'::varchar[]`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS ai_disclosure TEXT`);
    
    // Additional columns
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS feedback JSONB DEFAULT '[]'::jsonb`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS tags VARCHAR(50)[] DEFAULT '{}'::varchar[]`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private'`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`);

    // ============= USERS TABLE COLUMNS =============
    console.log("\n👤 Updating USERS table...");
    
    // Profile Information
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(200)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT`);
    
    // Company Information
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_number VARCHAR(100)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_website TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_address TEXT`);
    
    // Verification & Status
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_verified BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    
    // Account Security
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_lock_reason VARCHAR(200)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_history JSONB DEFAULT '[]'::jsonb`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false`);
    
    // Subscription Information
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`);
    
    // Metadata
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);

    // ============= NDA_REQUESTS TABLE COLUMNS =============
    console.log("\n📝 Updating NDA_REQUESTS table...");
    
    await db.execute(sql`ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS owner_id INTEGER`);
    await db.execute(sql`ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS request_message TEXT`);
    await db.execute(sql`ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS company_info JSONB`);
    await db.execute(sql`ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await db.execute(sql`ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT NOW()`);
    await db.execute(sql`ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);

    // ============= NDAS TABLE COLUMNS =============
    console.log("\n📄 Updating NDAS table...");
    
    await db.execute(sql`ALTER TABLE ndas ADD COLUMN IF NOT EXISTS nda_version VARCHAR(20) DEFAULT '1.0'`);
    await db.execute(sql`ALTER TABLE ndas ADD COLUMN IF NOT EXISTS custom_nda_url TEXT`);
    await db.execute(sql`ALTER TABLE ndas ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)`);
    await db.execute(sql`ALTER TABLE ndas ADD COLUMN IF NOT EXISTS user_agent TEXT`);
    await db.execute(sql`ALTER TABLE ndas ADD COLUMN IF NOT EXISTS signature_data JSONB`);
    await db.execute(sql`ALTER TABLE ndas ADD COLUMN IF NOT EXISTS access_granted BOOLEAN DEFAULT true`);
    await db.execute(sql`ALTER TABLE ndas ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE ndas ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);

    // ============= PITCH_VIEWS TABLE COLUMNS =============
    console.log("\n👁️ Updating PITCH_VIEWS table...");
    
    await db.execute(sql`ALTER TABLE pitch_views ADD COLUMN IF NOT EXISTS view_type VARCHAR(20)`);
    await db.execute(sql`ALTER TABLE pitch_views ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)`);
    await db.execute(sql`ALTER TABLE pitch_views ADD COLUMN IF NOT EXISTS user_agent TEXT`);
    await db.execute(sql`ALTER TABLE pitch_views ADD COLUMN IF NOT EXISTS referrer TEXT`);
    await db.execute(sql`ALTER TABLE pitch_views ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)`);
    await db.execute(sql`ALTER TABLE pitch_views ADD COLUMN IF NOT EXISTS view_duration INTEGER`);
    await db.execute(sql`ALTER TABLE pitch_views ADD COLUMN IF NOT EXISTS scroll_depth INTEGER`);
    await db.execute(sql`ALTER TABLE pitch_views ADD COLUMN IF NOT EXISTS clicked_watch_this BOOLEAN DEFAULT false`);

    // ============= FOLLOWS TABLE COLUMNS =============
    console.log("\n➕ Updating FOLLOWS table...");
    
    await db.execute(sql`ALTER TABLE follows ADD COLUMN IF NOT EXISTS pitch_id INTEGER`);
    await db.execute(sql`ALTER TABLE follows ADD COLUMN IF NOT EXISTS creator_id INTEGER`);

    // ============= CONVERSATIONS TABLE COLUMNS =============
    console.log("\n💬 Updating CONVERSATIONS table...");
    
    await db.execute(sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pitch_id INTEGER`);
    await db.execute(sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by_id INTEGER`);
    await db.execute(sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title VARCHAR(200)`);
    await db.execute(sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP`);

    // ============= CONVERSATION_PARTICIPANTS TABLE COLUMNS =============
    console.log("\n👥 Updating CONVERSATION_PARTICIPANTS table...");
    
    await db.execute(sql`ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    await db.execute(sql`ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT NOW()`);
    await db.execute(sql`ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS left_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS mute_notifications BOOLEAN DEFAULT false`);

    // ============= MESSAGES TABLE COLUMNS =============
    console.log("\n✉️ Updating MESSAGES table...");
    
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id INTEGER`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text'`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS off_platform_requested BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS off_platform_approved BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);

    // ============= NOTIFICATIONS TABLE COLUMNS =============
    console.log("\n🔔 Updating NOTIFICATIONS table...");
    
    await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_pitch_id INTEGER`);
    await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_user_id INTEGER`);
    await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_nda_request_id INTEGER`);
    await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT`);

    // ============= TRANSACTIONS TABLE COLUMNS =============
    console.log("\n💰 Updating TRANSACTIONS table...");
    
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR'`);
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`);
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT`);
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT`);
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS metadata JSONB`);
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`);

    // ============= Create missing indexes =============
    console.log("\n🔍 Creating missing indexes...");
    
    // Users indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS users_username_idx ON users(username)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS users_user_type_idx ON users(user_type)`);
    
    // Pitches indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitches_user_id_idx ON pitches(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitches_status_idx ON pitches(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitches_genre_idx ON pitches(genre)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitches_format_idx ON pitches(format)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitches_title_search_idx ON pitches(title)`);
    
    // NDA indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS nda_requests_pitch_id_idx ON nda_requests(pitch_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS nda_requests_requester_id_idx ON nda_requests(requester_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS nda_requests_status_idx ON nda_requests(status)`);
    
    // Messages indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_pitch_id_idx ON messages(pitch_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_sent_at_idx ON messages(sent_at)`);

    console.log("\n✅ All database columns and indexes have been successfully updated!");
    console.log("📊 Database is now fully synchronized with Drizzle schema!");
    
  } catch (error) {
    console.error("❌ Migration error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
if (import.meta.main) {
  await runCompleteMigration();
}