-- Add format category fields to pitches table
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS format_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS format_subtype VARCHAR(100),
ADD COLUMN IF NOT EXISTS custom_format VARCHAR(255);

-- Add index for faster filtering by format category
CREATE INDEX IF NOT EXISTS idx_pitches_format_category ON pitches(format_category);
CREATE INDEX IF NOT EXISTS idx_pitches_format_subtype ON pitches(format_subtype);