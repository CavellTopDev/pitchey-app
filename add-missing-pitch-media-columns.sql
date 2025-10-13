-- Add missing media-related columns to pitches table for Drizzle compatibility

BEGIN;

-- Add missing pitch media columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'video_url'
    ) THEN
        ALTER TABLE pitches ADD COLUMN video_url VARCHAR(500);
        RAISE NOTICE 'Added video_url column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'poster_url'
    ) THEN
        ALTER TABLE pitches ADD COLUMN poster_url VARCHAR(500);
        RAISE NOTICE 'Added poster_url column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'pitch_deck_url'
    ) THEN
        ALTER TABLE pitches ADD COLUMN pitch_deck_url VARCHAR(500);
        RAISE NOTICE 'Added pitch_deck_url column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'additional_materials'
    ) THEN
        ALTER TABLE pitches ADD COLUMN additional_materials JSONB;
        RAISE NOTICE 'Added additional_materials column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE pitches ADD COLUMN visibility VARCHAR(50) DEFAULT 'public';
        RAISE NOTICE 'Added visibility column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'view_count'
    ) THEN
        ALTER TABLE pitches ADD COLUMN view_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added view_count column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'like_count'
    ) THEN
        ALTER TABLE pitches ADD COLUMN like_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added like_count column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'comment_count'
    ) THEN
        ALTER TABLE pitches ADD COLUMN comment_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added comment_count column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'nda_count'
    ) THEN
        ALTER TABLE pitches ADD COLUMN nda_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added nda_count column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'title_image'
    ) THEN
        ALTER TABLE pitches ADD COLUMN title_image TEXT;
        RAISE NOTICE 'Added title_image column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'lookbook_url'
    ) THEN
        ALTER TABLE pitches ADD COLUMN lookbook_url TEXT;
        RAISE NOTICE 'Added lookbook_url column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'script_url'
    ) THEN
        ALTER TABLE pitches ADD COLUMN script_url TEXT;
        RAISE NOTICE 'Added script_url column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'trailer_url'
    ) THEN
        ALTER TABLE pitches ADD COLUMN trailer_url TEXT;
        RAISE NOTICE 'Added trailer_url column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'require_nda'
    ) THEN
        ALTER TABLE pitches ADD COLUMN require_nda BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added require_nda column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'published_at'
    ) THEN
        ALTER TABLE pitches ADD COLUMN published_at TIMESTAMP;
        RAISE NOTICE 'Added published_at column to pitches table';
    END IF;
END $$;

COMMIT;

SELECT 'Pitch media columns migration completed successfully!' as status;