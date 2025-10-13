-- Fix Neon database schema to match current backend expectations

-- Add missing columns to pitches table
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS estimated_budget TEXT;

-- Add missing columns to users table  
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Check if we need other missing columns
-- Let's also ensure we have all the basic required columns

-- Ensure pitches table has all required columns
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS genre TEXT,
ADD COLUMN IF NOT EXISTS format TEXT,
ADD COLUMN IF NOT EXISTS budget_range TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Ensure users table has user types
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'creator';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_pitches_status ON pitches(status);
CREATE INDEX IF NOT EXISTS idx_pitches_genre ON pitches(genre);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);