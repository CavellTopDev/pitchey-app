-- Add missing columns to sessions table for Better Auth compatibility
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Update sessions table structure
ALTER TABLE sessions ALTER COLUMN user_id TYPE VARCHAR(255);

-- Check if name column needs to be added to users table (alias for username)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'name') THEN
    -- Add name column as a generated column from username
    ALTER TABLE users ADD COLUMN name VARCHAR(255) GENERATED ALWAYS AS (COALESCE(username, email)) STORED;
  END IF;
END $$;

-- Verify changes
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'sessions'
ORDER BY ordinal_position;