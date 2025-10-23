-- Migration: Add seeking_investment column to pitches table
-- Created: 2025-10-23
-- Purpose: Support filtering by investment-seeking status

-- Add seeking_investment column to pitches table
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS seeking_investment BOOLEAN DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_pitches_seeking_investment 
ON pitches(seeking_investment);

-- Update some existing pitches to have varied data for testing
-- This is optional and can be removed in production
UPDATE pitches 
SET seeking_investment = true 
WHERE status = 'published' 
  AND estimated_budget > 1000000 
  AND id % 2 = 0;  -- Set every other high-budget pitch as seeking investment

-- Add comment for documentation
COMMENT ON COLUMN pitches.seeking_investment IS 'Indicates if the pitch creator is actively seeking investment for this project';