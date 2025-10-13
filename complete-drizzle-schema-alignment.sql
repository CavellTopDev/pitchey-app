-- Complete Drizzle schema alignment - add all remaining missing columns

BEGIN;

-- Add all remaining missing pitch columns
DO $$ 
BEGIN
    -- Add advanced pitch columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'visibility_settings'
    ) THEN
        ALTER TABLE pitches ADD COLUMN visibility_settings JSONB DEFAULT '{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}';
        RAISE NOTICE 'Added visibility_settings column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'ai_used'
    ) THEN
        ALTER TABLE pitches ADD COLUMN ai_used BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added ai_used column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'ai_tools'
    ) THEN
        ALTER TABLE pitches ADD COLUMN ai_tools VARCHAR(100)[] DEFAULT '{}';
        RAISE NOTICE 'Added ai_tools column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'ai_disclosure'
    ) THEN
        ALTER TABLE pitches ADD COLUMN ai_disclosure TEXT;
        RAISE NOTICE 'Added ai_disclosure column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'share_count'
    ) THEN
        ALTER TABLE pitches ADD COLUMN share_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added share_count column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'feedback'
    ) THEN
        ALTER TABLE pitches ADD COLUMN feedback JSONB DEFAULT '[]';
        RAISE NOTICE 'Added feedback column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'tags'
    ) THEN
        ALTER TABLE pitches ADD COLUMN tags VARCHAR(50)[] DEFAULT '{}';
        RAISE NOTICE 'Added tags column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'archived'
    ) THEN
        ALTER TABLE pitches ADD COLUMN archived BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added archived column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'archived_at'
    ) THEN
        ALTER TABLE pitches ADD COLUMN archived_at TIMESTAMP;
        RAISE NOTICE 'Added archived_at column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE pitches ADD COLUMN metadata JSONB DEFAULT '{}';
        RAISE NOTICE 'Added metadata column to pitches table';
    END IF;

    -- Add timestamp columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE pitches ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added created_at column to pitches table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pitches' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE pitches ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to pitches table';
    END IF;
END $$;

-- Add remaining user columns 
DO $$ 
BEGIN
    -- User metadata columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
        RAISE NOTICE 'Added first_name column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
        RAISE NOTICE 'Added last_name column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        -- Rename password to password_hash if needed
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'password'
        ) THEN
            ALTER TABLE users RENAME COLUMN password TO password_hash;
            RAISE NOTICE 'Renamed password column to password_hash in users table';
        ELSE
            ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
            RAISE NOTICE 'Added password_hash column to users table';
        END IF;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'user_type'
    ) THEN
        -- Rename userType to user_type if needed
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'userType'
        ) THEN
            ALTER TABLE users RENAME COLUMN "userType" TO user_type;
            RAISE NOTICE 'Renamed userType column to user_type in users table';
        ELSE
            ALTER TABLE users ADD COLUMN user_type VARCHAR(50) NOT NULL DEFAULT 'viewer';
            RAISE NOTICE 'Added user_type column to users table';
        END IF;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'company_name'
    ) THEN
        -- Rename companyName to company_name if needed
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'companyName'
        ) THEN
            ALTER TABLE users RENAME COLUMN "companyName" TO company_name;
            RAISE NOTICE 'Renamed companyName column to company_name in users table';
        ELSE
            ALTER TABLE users ADD COLUMN company_name TEXT;
            RAISE NOTICE 'Added company_name column to users table';
        END IF;
    END IF;
END $$;

COMMIT;

SELECT 'Complete Drizzle schema alignment finished successfully!' as status;