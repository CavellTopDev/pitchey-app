-- Drop and recreate sessions table with correct schema for Better Auth
DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_token ON sessions(token) WHERE token IS NOT NULL;

-- Check for name column in users table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'name') THEN
    -- Add name column as a regular column
    ALTER TABLE users ADD COLUMN name VARCHAR(255);
    -- Update existing rows to use username or email as name
    UPDATE users SET name = COALESCE(username, email);
  END IF;
END $$;

-- Verify structure
SELECT 'Sessions table recreated successfully' AS status;