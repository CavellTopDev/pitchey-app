-- Note: budget_breakdown_url and production_timeline_url columns already exist
-- Skipping column additions to prevent duplicate column errors

-- Update the additional_media column to support enhanced type system
-- Note: This won't change the column type but documents the expected structure
COMMENT ON COLUMN pitches.additional_media IS 'JSON array of media objects with type (lookbook|script|trailer|pitch_deck|budget_breakdown|production_timeline|other), url, title, description, and uploadedAt fields';