-- Add missing columns to pitches table

-- Add media-related columns
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS title_image TEXT,
ADD COLUMN IF NOT EXISTS lookbook_url TEXT,
ADD COLUMN IF NOT EXISTS pitch_deck_url TEXT,
ADD COLUMN IF NOT EXISTS script_url TEXT,
ADD COLUMN IF NOT EXISTS trailer_url TEXT,
ADD COLUMN IF NOT EXISTS additional_media JSONB,
ADD COLUMN IF NOT EXISTS production_timeline TEXT;

-- Add NDA requirement column
ALTER TABLE pitches
ADD COLUMN IF NOT EXISTS require_nda BOOLEAN DEFAULT false;

-- Add published_at column for tracking when pitches go live
ALTER TABLE pitches
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pitches_require_nda ON pitches(require_nda);
CREATE INDEX IF NOT EXISTS idx_pitches_published_at ON pitches(published_at);