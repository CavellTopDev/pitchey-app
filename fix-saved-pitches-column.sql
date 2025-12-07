-- Fix for saved_pitches table - add missing saved_at column
ALTER TABLE saved_pitches 
ADD COLUMN IF NOT EXISTS saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update any existing rows to have a saved_at timestamp if NULL
UPDATE saved_pitches 
SET saved_at = CURRENT_TIMESTAMP 
WHERE saved_at IS NULL;