-- Migration: Add enhanced pitch fields per client specifications
-- Date: 2024-01-24
-- Description: Adds new fields for comprehensive pitch information

-- =====================================================
-- 1. ADD NEW COLUMNS TO PITCHES TABLE
-- =====================================================

-- Creative and Style Fields
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS tone_and_style TEXT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS comps TEXT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS story_breakdown TEXT;

-- Market and Production Fields  
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS why_now TEXT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS production_location TEXT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS development_stage VARCHAR(50);
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS development_stage_other VARCHAR(255);

-- Video Security
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS video_password VARCHAR(255);
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS video_platform VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN pitches.tone_and_style IS 'Tone & Style description (max 400 words / ~2400 chars)';
COMMENT ON COLUMN pitches.comps IS 'Comparable titles/references (max 400 words / ~2400 chars)';
COMMENT ON COLUMN pitches.story_breakdown IS 'Detailed story breakdown (max 2000 words / ~12000 chars)';
COMMENT ON COLUMN pitches.why_now IS 'Market timing justification (max 300 words / ~1800 chars)';
COMMENT ON COLUMN pitches.production_location IS 'Where project needs to be created (max 100 words / ~600 chars)';
COMMENT ON COLUMN pitches.development_stage IS 'Current development stage (pitch, treatment, script, etc.)';
COMMENT ON COLUMN pitches.development_stage_other IS 'Custom development stage if "other" selected';
COMMENT ON COLUMN pitches.video_password IS 'Optional password for protected video links';
COMMENT ON COLUMN pitches.video_platform IS 'Video platform: youtube, vimeo, other';

-- =====================================================
-- 2. CREATE CREATIVE ATTACHMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS pitch_creative_attachments (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    bio TEXT,
    imdb_link VARCHAR(500),
    website_link VARCHAR(500),
    profile_image_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_attachments_pitch_id ON pitch_creative_attachments(pitch_id);

COMMENT ON TABLE pitch_creative_attachments IS 'Creative team members attached to a pitch (directors, writers, producers, etc.)';

-- =====================================================
-- 3. UPDATE PITCH_CHARACTERS TABLE
-- =====================================================

ALTER TABLE pitch_characters ADD COLUMN IF NOT EXISTS age_bracket VARCHAR(50);
ALTER TABLE pitch_characters ADD COLUMN IF NOT EXISTS cast_attached VARCHAR(255);
ALTER TABLE pitch_characters ADD COLUMN IF NOT EXISTS cast_confirmed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN pitch_characters.age_bracket IS 'Age bracket: child, teen, young_adult, adult, middle_aged, senior';
COMMENT ON COLUMN pitch_characters.cast_attached IS 'Name of actor attached to role (if any)';
COMMENT ON COLUMN pitch_characters.cast_confirmed IS 'Whether cast attachment is confirmed';

-- =====================================================
-- 4. CREATE PITCH FORMATS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS pitch_formats (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    subtype VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(category, subtype)
);

-- Insert all format options from client spec
INSERT INTO pitch_formats (category, subtype, display_order) VALUES
-- TELEVISION – SCRIPTED
('Television - Scripted', 'Narrative Series (ongoing)', 1),
('Television - Scripted', 'Limited Series (closed-ended)', 2),
('Television - Scripted', 'One-off / TV Movie', 3),
('Television - Scripted', 'Soap / Continuing Drama', 4),
('Television - Scripted', 'Anthology Series', 5),
-- TELEVISION – UNSCRIPTED
('Television - Unscripted', 'Documentary One-off', 10),
('Television - Unscripted', 'Documentary Series', 11),
('Television - Unscripted', 'Docudrama / Hybrid', 12),
('Television - Unscripted', 'Reality Series', 13),
('Television - Unscripted', 'Game / Quiz Show', 14),
('Television - Unscripted', 'Talk / Variety / Sketch Show', 15),
('Television - Unscripted', 'Lifestyle / Factual Entertainment', 16),
-- FILM
('Film', 'Feature Narrative (live action)', 20),
('Film', 'Feature Documentary', 21),
('Film', 'Feature Animation', 22),
('Film', 'Anthology / Omnibus Film', 23),
('Film', 'Short Film / Short Documentary', 24),
-- ANIMATION (SERIES)
('Animation (Series)', 'Kids Series', 30),
('Animation (Series)', 'Adult Series', 31),
('Animation (Series)', 'Limited Series / Specials', 32),
-- AUDIO
('Audio', 'Podcast - Drama (scripted fiction)', 40),
('Audio', 'Podcast - Documentary (non-fiction)', 41),
('Audio', 'Podcast - Hybrid / Docudrama', 42),
-- DIGITAL / EMERGING
('Digital / Emerging', 'Web Series / Digital-First Series', 50),
('Digital / Emerging', 'Interactive / Immersive (VR/AR)', 51),
('Digital / Emerging', 'Stage-to-Screen', 52),
-- OTHER
('Other', 'Other (specify)', 60)
ON CONFLICT (category, subtype) DO NOTHING;

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pitches_development_stage ON pitches(development_stage);
CREATE INDEX IF NOT EXISTS idx_pitch_formats_category ON pitch_formats(category);
CREATE INDEX IF NOT EXISTS idx_pitches_video_platform ON pitches(video_platform);

-- =====================================================
-- 6. ADD DEFAULT VALUES FOR EXISTING RECORDS
-- =====================================================

-- Set default development stage for existing pitches based on their current stage
UPDATE pitches 
SET development_stage = CASE 
    WHEN production_stage = 'concept' THEN 'pitch'
    WHEN production_stage = 'development' THEN 'treatment'
    WHEN production_stage = 'pre-production' THEN 'script'
    WHEN production_stage = 'production' THEN 'semi_packaged'
    WHEN production_stage = 'post-production' THEN 'fully_packaged'
    ELSE 'pitch'
END
WHERE development_stage IS NULL;