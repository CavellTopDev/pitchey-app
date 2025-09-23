#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

import { drizzle } from "npm:drizzle-orm/postgres-js";
import postgres from "npm:postgres";
import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

config({ export: true });

const connectionString = Deno.env.get("DATABASE_URL") || "postgresql://postgres:password@localhost:5432/pitchey";
const sql = postgres(connectionString);
const db = drizzle(sql);

async function setupDatabase() {
  try {
    console.log("Setting up database schema...");
    
    // Create enums
    await sql`
      DO $$ BEGIN
        CREATE TYPE user_type AS ENUM ('creator', 'production', 'investor');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE pitch_status AS ENUM ('draft', 'published', 'archived', 'hidden');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE genre AS ENUM ('drama', 'comedy', 'thriller', 'horror', 'scifi', 'fantasy', 'documentary', 'animation', 'action', 'romance', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE format AS ENUM ('feature', 'tv', 'short', 'webseries', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE notification_type AS ENUM ('nda_request', 'nda_approved', 'nda_rejected', 'nda_revoked', 'pitch_view', 'pitch_like', 'message_received', 'follow', 'comment');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE nda_type AS ENUM ('basic', 'enhanced');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE nda_request_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE media_type AS ENUM ('lookbook', 'script', 'trailer', 'pitch_deck', 'budget_breakdown', 'production_timeline', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        user_type user_type NOT NULL,
        
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(30),
        location VARCHAR(200),
        bio TEXT,
        profile_image_url TEXT,
        
        company_name VARCHAR(200),
        company_number VARCHAR(100),
        company_website TEXT,
        company_address TEXT,
        company_verified BOOLEAN DEFAULT FALSE,
        
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        subscription_tier subscription_tier DEFAULT 'free',
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_login_at TIMESTAMP
      );
    `;
    
    // Create indexes for users
    await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);`;
    await sql`CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);`;
    await sql`CREATE INDEX IF NOT EXISTS users_user_type_idx ON users(user_type);`;
    
    // Create sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token);`;
    await sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);`;
    
    // Create pitches table
    await sql`
      CREATE TABLE IF NOT EXISTS pitches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        title VARCHAR(200) NOT NULL,
        logline TEXT NOT NULL,
        genre genre NOT NULL,
        format format NOT NULL,
        status pitch_status DEFAULT 'draft' NOT NULL,
        
        short_synopsis TEXT,
        long_synopsis TEXT,
        themes JSONB,
        characters JSONB,
        
        budget_bracket VARCHAR(100),
        estimated_budget INTEGER,
        production_timeline TEXT,
        
        title_image TEXT,
        lookbook_url TEXT,
        pitch_deck_url TEXT,
        script_url TEXT,
        trailer_url TEXT,
        budget_breakdown_url TEXT,
        production_timeline_url TEXT,
        additional_media JSONB,
        
        view_count INTEGER DEFAULT 0 NOT NULL,
        like_count INTEGER DEFAULT 0 NOT NULL,
        nda_count INTEGER DEFAULT 0 NOT NULL,
        
        ai_used BOOLEAN DEFAULT FALSE,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    
    // Create indexes for pitches
    await sql`CREATE INDEX IF NOT EXISTS pitches_user_idx ON pitches(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS pitches_status_idx ON pitches(status);`;
    await sql`CREATE INDEX IF NOT EXISTS pitches_genre_idx ON pitches(genre);`;
    await sql`CREATE INDEX IF NOT EXISTS pitches_format_idx ON pitches(format);`;
    await sql`CREATE INDEX IF NOT EXISTS pitches_published_at_idx ON pitches(published_at);`;
    
    // Create NDAs table
    await sql`
      CREATE TABLE IF NOT EXISTS ndas (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        signer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nda_type nda_type DEFAULT 'basic' NOT NULL,
        access_granted BOOLEAN DEFAULT TRUE NOT NULL,
        access_revoked_at TIMESTAMP,
        expires_at TIMESTAMP,
        signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ndas_pitch_signer_idx ON ndas(pitch_id, signer_id);`;
    await sql`CREATE INDEX IF NOT EXISTS ndas_pitch_idx ON ndas(pitch_id);`;
    await sql`CREATE INDEX IF NOT EXISTS ndas_signer_idx ON ndas(signer_id);`;
    
    // Create NDA requests table
    await sql`
      CREATE TABLE IF NOT EXISTS nda_requests (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nda_type nda_type DEFAULT 'basic' NOT NULL,
        status nda_request_status DEFAULT 'pending' NOT NULL,
        request_message TEXT,
        rejection_reason TEXT,
        company_info JSONB,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        responded_at TIMESTAMP,
        expires_at TIMESTAMP
      );
    `;
    
    await sql`CREATE INDEX IF NOT EXISTS nda_requests_pitch_requester_idx ON nda_requests(pitch_id, requester_id);`;
    await sql`CREATE INDEX IF NOT EXISTS nda_requests_owner_idx ON nda_requests(owner_id);`;
    await sql`CREATE INDEX IF NOT EXISTS nda_requests_status_idx ON nda_requests(status);`;
    
    // Create pitch views table
    await sql`
      CREATE TABLE IF NOT EXISTS pitch_views (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        view_type VARCHAR(50) DEFAULT 'full',
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    
    await sql`CREATE INDEX IF NOT EXISTS pitch_views_pitch_viewer_idx ON pitch_views(pitch_id, viewer_id);`;
    await sql`CREATE INDEX IF NOT EXISTS pitch_views_viewed_at_idx ON pitch_views(viewed_at);`;
    
    // Create follows table
    await sql`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS follows_follower_pitch_idx ON follows(follower_id, pitch_id);`;
    await sql`CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows(follower_id);`;
    await sql`CREATE INDEX IF NOT EXISTS follows_pitch_idx ON follows(pitch_id);`;
    
    // Create notifications table
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type notification_type NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE NOT NULL,
        related_pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
        related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        related_nda_request_id INTEGER REFERENCES nda_requests(id) ON DELETE SET NULL,
        action_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    
    await sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);`;
    await sql`CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);`;
    
    console.log("✅ Database schema created successfully!");
    
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the setup
await setupDatabase();