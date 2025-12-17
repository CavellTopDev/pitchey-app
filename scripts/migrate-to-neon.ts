#!/usr/bin/env -S deno run --allow-all

/**
 * Complete Migration Script for Pitchey Platform
 * Migrates from Drizzle ORM to Neon Serverless with raw SQL
 */

import { createNeonConnection, DatabaseError } from '../src/db/neon-connection.js';

// Database schema creation SQL
const SCHEMA_SQL = `
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('creator', 'investor', 'production')),
    profile_picture TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT false,
    company VARCHAR(255),
    location VARCHAR(255),
    website TEXT
);

-- Pitches table
CREATE TABLE IF NOT EXISTS pitches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    logline TEXT NOT NULL,
    synopsis TEXT,
    genre VARCHAR(100) NOT NULL,
    themes TEXT,
    target_audience VARCHAR(100) NOT NULL,
    budget_range VARCHAR(50) NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'public', 'private', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    cover_image TEXT,
    pitch_deck_url TEXT,
    world_description TEXT,
    characters JSONB,
    treatment TEXT,
    market_analysis TEXT,
    financial_projections TEXT,
    production_timeline TEXT
);

-- Follows table (user relationships)
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Pitch views table (analytics)
CREATE TABLE IF NOT EXISTS pitch_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration INTEGER, -- seconds spent viewing
    UNIQUE(pitch_id, user_id, DATE(viewed_at))
);

-- Pitch likes table
CREATE TABLE IF NOT EXISTS pitch_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pitch_id, user_id)
);

-- NDA requests table
CREATE TABLE IF NOT EXISTS nda_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'signed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signed_at TIMESTAMP WITH TIME ZONE,
    document_url TEXT,
    notes TEXT,
    UNIQUE(pitch_id, requester_id)
);

-- Conversations table (messaging system)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participants UUID[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT false,
    metadata JSONB
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_by UUID[] DEFAULT '{}',
    attachments JSONB,
    is_deleted BOOLEAN DEFAULT false
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT
);

-- Investments table
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'committed', 'completed', 'withdrawn')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    terms JSONB,
    notes TEXT,
    due_diligence_data JSONB
);

-- Watchlist table (saved pitches)
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    UNIQUE(user_id, pitch_id)
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- File uploads table
CREATE TABLE IF NOT EXISTS file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_url TEXT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Comments table (for pitch feedback)
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    like_count INTEGER DEFAULT 0
);

-- Reviews table (professional pitch reviews)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    criteria_scores JSONB, -- {story: 4, marketability: 3, production: 5}
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pitch_id, reviewer_id)
);

-- Tags table (for categorization)
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pitch tags junction table
CREATE TABLE IF NOT EXISTS pitch_tags (
    pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (pitch_id, tag_id)
);
`;

const INDEXES_SQL = `
-- Performance indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Performance indexes for pitches
CREATE INDEX IF NOT EXISTS idx_pitches_creator_id ON pitches(creator_id);
CREATE INDEX IF NOT EXISTS idx_pitches_status ON pitches(status);
CREATE INDEX IF NOT EXISTS idx_pitches_genre ON pitches(genre);
CREATE INDEX IF NOT EXISTS idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_published_at ON pitches(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_view_count ON pitches(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_like_count ON pitches(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_featured ON pitches(is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_trending ON pitches(status, created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_pitches_title_gin ON pitches USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pitches_logline_gin ON pitches USING gin(logline gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pitches_synopsis_gin ON pitches USING gin(synopsis gin_trgm_ops);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pitches_status_genre ON pitches(status, genre);
CREATE INDEX IF NOT EXISTS idx_pitches_status_created ON pitches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_creator_status ON pitches(creator_id, status, created_at DESC);

-- Indexes for follows
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- Indexes for pitch views
CREATE INDEX IF NOT EXISTS idx_pitch_views_pitch_id ON pitch_views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_views_user_id ON pitch_views(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_views_viewed_at ON pitch_views(viewed_at DESC);

-- Indexes for pitch likes
CREATE INDEX IF NOT EXISTS idx_pitch_likes_pitch_id ON pitch_likes(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_likes_user_id ON pitch_likes(user_id);

-- Indexes for NDA requests
CREATE INDEX IF NOT EXISTS idx_nda_requests_pitch_id ON nda_requests(pitch_id);
CREATE INDEX IF NOT EXISTS idx_nda_requests_requester_id ON nda_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_nda_requests_status ON nda_requests(status);

-- Indexes for conversations and messages
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING gin(participants);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, created_at DESC);

-- Indexes for investments
CREATE INDEX IF NOT EXISTS idx_investments_pitch_id ON investments(pitch_id);
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);

-- Indexes for watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_pitch_id ON watchlist(pitch_id);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);

-- Indexes for file uploads
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(upload_status);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_pitch_id ON comments(pitch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- Indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_pitch_id ON reviews(pitch_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_public ON reviews(is_public, created_at DESC);

-- Indexes for tags
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_pitch_tags_pitch_id ON pitch_tags(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_tags_tag_id ON pitch_tags(tag_id);
`;

const TRIGGERS_SQL = `
-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_pitches_updated_at 
    BEFORE UPDATE ON pitches 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_nda_requests_updated_at 
    BEFORE UPDATE ON nda_requests 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_investments_updated_at 
    BEFORE UPDATE ON investments 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON comments 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at 
    BEFORE UPDATE ON reviews 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at, updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE PROCEDURE update_conversation_last_message();
`;

const DEMO_DATA_SQL = `
-- Insert demo users (if not exists)
INSERT INTO users (id, email, name, user_type, bio, is_active, email_verified, created_at) VALUES 
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'alex.creator@demo.com', 'Alex Chen', 'creator', 'Passionate filmmaker with 10 years in indie cinema', true, true, NOW() - INTERVAL '30 days'),
('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'sarah.investor@demo.com', 'Sarah Johnson', 'investor', 'Investment partner at Horizon Capital focusing on entertainment', true, true, NOW() - INTERVAL '25 days'),
('c3d4e5f6-g7h8-9012-cdef-345678901234', 'stellar.production@demo.com', 'Stellar Studios', 'production', 'Independent production company specializing in dramatic features', true, true, NOW() - INTERVAL '20 days')
ON CONFLICT (email) DO NOTHING;

-- Insert demo tags
INSERT INTO tags (name, category, description) VALUES 
('Action', 'genre', 'High-energy action sequences'),
('Drama', 'genre', 'Character-driven dramatic stories'),
('Thriller', 'genre', 'Suspenseful and thrilling narratives'),
('Low Budget', 'budget', 'Productions under $1M'),
('Medium Budget', 'budget', 'Productions $1M-$10M'),
('High Budget', 'budget', 'Productions over $10M'),
('Young Adult', 'audience', 'Targeting 16-25 age group'),
('Family', 'audience', 'Suitable for all ages'),
('Adult', 'audience', 'Mature themes for 18+')
ON CONFLICT (name) DO NOTHING;

-- Insert demo pitches (if not exists)
INSERT INTO pitches (
    id, title, logline, synopsis, genre, themes, target_audience, 
    budget_range, creator_id, status, view_count, like_count, 
    is_featured, created_at, published_at
) VALUES 
(
    'd4e5f6g7-h8i9-0123-defg-456789012345',
    'The Last Signal',
    'When Earth''s last communication satellite fails, a rogue engineer must choose between personal safety and humanity''s connection to the cosmos.',
    'In a near-future Earth where climate change has forced most of humanity underground, communication satellites are the lifeline connecting scattered communities. Dr. Maya Patel, a brilliant but disgraced engineer, discovers that the failure of the last remaining satellite wasn''t accidental—it was sabotage. As corporate interests clash with humanitarian needs, Maya must navigate a dangerous web of politics and technology to restore humanity''s link to the stars, all while questioning whether reconnection is worth the cost.',
    'Science Fiction',
    'Technology, Isolation, Corporate Power',
    'Adults 25-45',
    '$2-5 million',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'public',
    156,
    23,
    true,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '14 days'
),
(
    'e5f6g7h8-i9j0-1234-efgh-567890123456',
    'Midnight in Prague',
    'A jazz pianist discovers her inherited Prague apartment holds secrets that could rewrite World War II history.',
    'When American jazz pianist Elena Rodriguez inherits her grandmother''s apartment in Prague, she expects to find dusty furniture and old photographs. Instead, she discovers a hidden room containing documents that suggest her grandmother was not the war refugee she claimed to be, but a resistance operative who helped orchestrate one of the war''s most daring escapes. As Elena digs deeper, she attracts the attention of both historians and modern-day extremists who will do anything to keep certain truths buried.',
    'Historical Drama',
    'Family Secrets, War, Music',
    'Adults 35+',
    '$1-3 million',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'public',
    89,
    17,
    false,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '7 days'
)
ON CONFLICT (id) DO NOTHING;

-- Insert demo pitch views
INSERT INTO pitch_views (pitch_id, user_id, viewed_at, duration) VALUES 
('d4e5f6g7-h8i9-0123-defg-456789012345', 'b2c3d4e5-f6g7-8901-bcde-f23456789012', NOW() - INTERVAL '2 days', 240),
('d4e5f6g7-h8i9-0123-defg-456789012345', 'c3d4e5f6-g7h8-9012-cdef-345678901234', NOW() - INTERVAL '1 day', 180),
('e5f6g7h8-i9j0-1234-efgh-567890123456', 'b2c3d4e5-f6g7-8901-bcde-f23456789012', NOW() - INTERVAL '3 days', 320)
ON CONFLICT (pitch_id, user_id, DATE(viewed_at)) DO NOTHING;

-- Insert demo pitch likes
INSERT INTO pitch_likes (pitch_id, user_id, created_at) VALUES 
('d4e5f6g7-h8i9-0123-defg-456789012345', 'b2c3d4e5-f6g7-8901-bcde-f23456789012', NOW() - INTERVAL '2 days'),
('d4e5f6g7-h8i9-0123-defg-456789012345', 'c3d4e5f6-g7h8-9012-cdef-345678901234', NOW() - INTERVAL '1 day'),
('e5f6g7h8-i9j0-1234-efgh-567890123456', 'c3d4e5f6-g7h8-9012-cdef-345678901234', NOW() - INTERVAL '3 days')
ON CONFLICT (pitch_id, user_id) DO NOTHING;
`;

// Migration configuration
interface MigrationConfig {
  DATABASE_URL?: string;
  NEON_DATABASE_URL?: string;
  includeDemo?: boolean;
  dropExisting?: boolean;
}

// Main migration function
async function runMigration(config: MigrationConfig): Promise<void> {
  console.log('🚀 Starting Pitchey Platform Migration to Neon...');
  
  try {
    // Create database connection
    const connectionString = config.NEON_DATABASE_URL || config.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL or NEON_DATABASE_URL must be provided');
    }

    console.log('📡 Connecting to Neon database...');
    const db = createNeonConnection({
      DATABASE_URL: connectionString,
    });

    // Test connection
    const health = await db.healthCheck();
    console.log(`✅ Database connection successful! Server time: ${health.timestamp}`);

    // Drop existing tables if requested
    if (config.dropExisting) {
      console.log('🗑️  Dropping existing tables...');
      await dropExistingTables(db);
    }

    // Create schema
    console.log('🏗️  Creating database schema...');
    await executeSQL(db, SCHEMA_SQL, 'Schema creation');

    // Create indexes
    console.log('📊 Creating performance indexes...');
    await executeSQL(db, INDEXES_SQL, 'Index creation');

    // Create triggers
    console.log('⚡ Setting up database triggers...');
    await executeSQL(db, TRIGGERS_SQL, 'Trigger setup');

    // Insert demo data if requested
    if (config.includeDemo) {
      console.log('🎭 Inserting demo data...');
      await executeSQL(db, DEMO_DATA_SQL, 'Demo data insertion');
    }

    // Verify migration
    console.log('🔍 Verifying migration...');
    await verifyMigration(db);

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your worker to use the new connection module');
    console.log('2. Test endpoints with the new query system');
    console.log('3. Monitor performance and optimize as needed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error instanceof DatabaseError) {
      console.error('Database Error Details:', error.toJSON());
    }
    throw error;
  }
}

// Helper function to execute SQL with error handling
async function executeSQL(db: any, sql: string, operation: string): Promise<void> {
  try {
    await db.query(sql);
    console.log(`   ✓ ${operation} completed`);
  } catch (error) {
    console.error(`   ❌ ${operation} failed:`, error.message);
    throw new DatabaseError(`${operation} failed: ${error.message}`, error);
  }
}

// Drop existing tables function
async function dropExistingTables(db: any): Promise<void> {
  const dropSQL = `
    DROP TABLE IF EXISTS analytics_events CASCADE;
    DROP TABLE IF EXISTS pitch_tags CASCADE;
    DROP TABLE IF EXISTS tags CASCADE;
    DROP TABLE IF EXISTS reviews CASCADE;
    DROP TABLE IF EXISTS comments CASCADE;
    DROP TABLE IF EXISTS file_uploads CASCADE;
    DROP TABLE IF EXISTS watchlist CASCADE;
    DROP TABLE IF EXISTS investments CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS conversations CASCADE;
    DROP TABLE IF EXISTS nda_requests CASCADE;
    DROP TABLE IF EXISTS pitch_likes CASCADE;
    DROP TABLE IF EXISTS pitch_views CASCADE;
    DROP TABLE IF EXISTS follows CASCADE;
    DROP TABLE IF EXISTS pitches CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `;
  
  await executeSQL(db, dropSQL, 'Dropping existing tables');
}

// Verification function
async function verifyMigration(db: any): Promise<void> {
  const verificationQueries = [
    { name: 'Users table', query: 'SELECT COUNT(*) FROM users' },
    { name: 'Pitches table', query: 'SELECT COUNT(*) FROM pitches' },
    { name: 'Indexes', query: "SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('users', 'pitches')" },
    { name: 'Triggers', query: "SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE '%updated_at%'" },
  ];

  for (const { name, query } of verificationQueries) {
    try {
      const result = await db.queryFirst(query);
      console.log(`   ✓ ${name}: ${result?.count || 0} records/items`);
    } catch (error) {
      console.error(`   ❌ ${name} verification failed:`, error.message);
    }
  }
}

// Command line interface
if (import.meta.main) {
  const args = Deno.args;
  const config: MigrationConfig = {
    includeDemo: args.includes('--demo') || args.includes('-d'),
    dropExisting: args.includes('--drop') || args.includes('--force'),
  };

  // Get database URL from environment or command line
  config.DATABASE_URL = Deno.env.get('DATABASE_URL') || Deno.env.get('NEON_DATABASE_URL');
  
  if (!config.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL or NEON_DATABASE_URL environment variable required');
    console.log('\nUsage:');
    console.log('  DATABASE_URL=<connection-string> deno run --allow-all migrate-to-neon.ts [options]');
    console.log('\nOptions:');
    console.log('  --demo, -d     Include demo data');
    console.log('  --drop, --force Drop existing tables first');
    Deno.exit(1);
  }

  try {
    await runMigration(config);
  } catch (error) {
    console.error('\n💥 Migration failed with error:', error.message);
    Deno.exit(1);
  }
}

// Export for programmatic use
export { runMigration, type MigrationConfig };