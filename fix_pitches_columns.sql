-- Migration script to fix pitches table columns
-- Add missing columns and rename existing ones to match schema

BEGIN;

-- Add the missing nda_count column
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS nda_count INTEGER DEFAULT 0;

-- Rename existing columns to match the schema
ALTER TABLE pitches 
RENAME COLUMN views TO view_count;

ALTER TABLE pitches 
RENAME COLUMN likes TO like_count;

-- Rename shares to comment_count (assuming shares was meant to be comments)
ALTER TABLE pitches 
RENAME COLUMN shares TO comment_count;

-- Verify the changes
\d pitches;

COMMIT;