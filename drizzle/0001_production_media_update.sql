-- Add new columns for production company media
ALTER TABLE pitches ADD COLUMN budget_breakdown_url TEXT;
ALTER TABLE pitches ADD COLUMN production_timeline_url TEXT;

-- Update the additional_media column to support enhanced type system
-- Note: This won't change the column type but documents the expected structure
COMMENT ON COLUMN pitches.additional_media IS 'JSON array of media objects with type (lookbook|script|trailer|pitch_deck|budget_breakdown|production_timeline|other), url, title, description, and uploadedAt fields';