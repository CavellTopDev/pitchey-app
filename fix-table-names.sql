-- Quick fix: Create missing tables or views to match schema

-- Check if saved_pitches exists, if not create it as a copy of pitch_saves
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pitch_saves') THEN
        -- If pitch_saves doesn't exist but saved_pitches does, create a view
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_pitches') THEN
            CREATE VIEW pitch_saves AS SELECT * FROM saved_pitches;
        END IF;
    END IF;
END $$;

-- Check if pitch_views exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pitch_views') THEN
        CREATE TABLE pitch_views (
            id SERIAL PRIMARY KEY,
            pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            viewed_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(pitch_id, user_id)
        );
    END IF;
END $$;