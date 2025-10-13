-- Fix Neon PostgreSQL schema mismatches with Drizzle schema
-- This adds missing columns and tables to match the current Drizzle schema

BEGIN;

-- Add missing phone column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'phone'
    ) THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
        RAISE NOTICE 'Added phone column to users table';
    ELSE
        RAISE NOTICE 'Phone column already exists in users table';
    END IF;
END $$;

-- Add missing opener column to pitches table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'opener'
    ) THEN
        ALTER TABLE pitches ADD COLUMN opener TEXT;
        RAISE NOTICE 'Added opener column to pitches table';
    ELSE
        RAISE NOTICE 'Opener column already exists in pitches table';
    END IF;
END $$;

-- Create follows table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'follows'
    ) THEN
        CREATE TABLE follows (
            id SERIAL PRIMARY KEY,
            follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
            creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            followed_at TIMESTAMP DEFAULT NOW()
        );
        RAISE NOTICE 'Created follows table';
    ELSE
        RAISE NOTICE 'Follows table already exists';
    END IF;
END $$;

-- Add missing columns to users table that might be referenced elsewhere
DO $$ 
BEGIN
    -- Add any other missing user columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'location'
    ) THEN
        ALTER TABLE users ADD COLUMN location VARCHAR(200);
        RAISE NOTICE 'Added location column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'bio'
    ) THEN
        ALTER TABLE users ADD COLUMN bio TEXT;
        RAISE NOTICE 'Added bio column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'profile_image_url'
    ) THEN
        ALTER TABLE users ADD COLUMN profile_image_url TEXT;
        RAISE NOTICE 'Added profile_image_url column to users table';
    END IF;
END $$;

-- Add missing columns to pitches table that might be needed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'premise'
    ) THEN
        ALTER TABLE pitches ADD COLUMN premise TEXT;
        RAISE NOTICE 'Added premise column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'target_audience'
    ) THEN
        ALTER TABLE pitches ADD COLUMN target_audience TEXT;
        RAISE NOTICE 'Added target_audience column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'characters'
    ) THEN
        ALTER TABLE pitches ADD COLUMN characters TEXT;
        RAISE NOTICE 'Added characters column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'themes'
    ) THEN
        ALTER TABLE pitches ADD COLUMN themes TEXT;
        RAISE NOTICE 'Added themes column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'episode_breakdown'
    ) THEN
        ALTER TABLE pitches ADD COLUMN episode_breakdown TEXT;
        RAISE NOTICE 'Added episode_breakdown column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'budget_bracket'
    ) THEN
        ALTER TABLE pitches ADD COLUMN budget_bracket VARCHAR(100);
        RAISE NOTICE 'Added budget_bracket column to pitches table';
    END IF;
END $$;

-- Add indexes for performance on the new follows table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows') THEN
        -- Index for finding who follows a creator
        CREATE INDEX IF NOT EXISTS idx_follows_creator_id ON follows(creator_id);
        
        -- Index for finding what a user follows
        CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
        
        -- Index for finding follows of a specific pitch
        CREATE INDEX IF NOT EXISTS idx_follows_pitch_id ON follows(pitch_id);
        
        -- Unique constraint to prevent duplicate follows
        CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique 
        ON follows(follower_id, pitch_id, creator_id);
        
        RAISE NOTICE 'Added indexes to follows table';
    END IF;
END $$;

COMMIT;

-- Summary
SELECT 'Schema migration completed successfully!' as status;