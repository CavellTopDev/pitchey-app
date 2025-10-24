-- Add production_stage column to pitches table
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS production_stage VARCHAR(100) DEFAULT 'concept';

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_pitches_production_stage ON pitches(production_stage);

-- Update existing records with reasonable defaults based on other fields
UPDATE pitches 
SET production_stage = CASE 
    WHEN status = 'draft' THEN 'concept'
    WHEN production_timeline IS NOT NULL AND production_timeline != '' THEN 'pre-production'
    WHEN script_url IS NOT NULL THEN 'script development'
    WHEN estimated_budget::numeric > 1000000 THEN 'financing'
    ELSE 'concept'
END
WHERE production_stage IS NULL OR production_stage = '';

-- Common production stages:
-- 'concept', 'script development', 'pre-production', 'financing', 'production', 'post-production', 'distribution'