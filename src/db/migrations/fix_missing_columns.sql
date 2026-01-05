-- Fix Missing Columns - January 2026 Critical Fixes
-- Add missing columns to existing tables

-- Add view_type column to views table if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'views' AND column_name = 'view_type') THEN
        ALTER TABLE views ADD COLUMN view_type VARCHAR(50) DEFAULT 'page_view';
        COMMENT ON COLUMN views.view_type IS 'Type of view: page_view, preview, full_content';
    END IF;
END $$;

-- Add missing columns to users table if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_tier') THEN
        ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'basic';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add missing columns to pitches table if needed  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pitches' AND column_name = 'view_count') THEN
        ALTER TABLE pitches ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pitches' AND column_name = 'like_count') THEN
        ALTER TABLE pitches ADD COLUMN like_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_views_view_type ON views(view_type);
CREATE INDEX IF NOT EXISTS idx_pitches_view_count ON pitches(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_like_count ON pitches(like_count DESC);

-- Update any existing views to have proper view_type
UPDATE views SET view_type = 'page_view' WHERE view_type IS NULL;

COMMIT;