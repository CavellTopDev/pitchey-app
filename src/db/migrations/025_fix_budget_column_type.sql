-- Migration: Fix budget column type from VARCHAR to DECIMAL
-- This allows proper SUM/AVG aggregations on the budget field

-- First, add a temporary column with the correct type
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS budget_decimal DECIMAL(12, 2);

-- Copy data, converting valid numbers and setting NULL for invalid ones
UPDATE pitches
SET budget_decimal = CASE
  WHEN budget IS NOT NULL AND budget ~ '^[0-9]+(\.[0-9]+)?$'
  THEN CAST(budget AS DECIMAL(12, 2))
  ELSE NULL
END
WHERE budget IS NOT NULL;

-- Drop the old column and rename the new one
ALTER TABLE pitches DROP COLUMN IF EXISTS budget;
ALTER TABLE pitches RENAME COLUMN budget_decimal TO budget;

-- Add the invested_at column to investments if it doesn't exist
ALTER TABLE investments ADD COLUMN IF NOT EXISTS invested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set invested_at from created_at for existing records that don't have it
UPDATE investments SET invested_at = created_at WHERE invested_at IS NULL;

-- Add index for budget queries
CREATE INDEX IF NOT EXISTS idx_pitches_budget ON pitches(budget) WHERE budget IS NOT NULL;

-- Verify the change
COMMENT ON COLUMN pitches.budget IS 'Project budget in USD (DECIMAL type for aggregations)';
