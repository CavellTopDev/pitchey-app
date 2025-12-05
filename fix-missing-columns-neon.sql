-- Add missing columns to the pitches table for production database

-- Add is_featured column if it doesn't exist
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Add like_count column if it doesn't exist
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Add view_count column if it doesn't exist
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add status column if it doesn't exist (though this likely exists)
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Set some pitches as featured for testing
UPDATE pitches 
SET is_featured = true 
WHERE id IN (
  SELECT id 
  FROM pitches 
  WHERE status = 'active' 
  ORDER BY created_at DESC 
  LIMIT 3
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pitches_is_featured ON pitches(is_featured);
CREATE INDEX IF NOT EXISTS idx_pitches_status ON pitches(status);
CREATE INDEX IF NOT EXISTS idx_pitches_view_count ON pitches(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_created_at ON pitches(created_at DESC);

-- Check if investments table has proper columns
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

ALTER TABLE investments
ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE investments
ADD COLUMN IF NOT EXISTS investor_id INTEGER;

-- Add index for investments
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);