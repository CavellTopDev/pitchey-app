-- Drop existing tables if they were created incorrectly
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS account CASCADE;
DROP TABLE IF EXISTS verification CASCADE;

-- Create Better Auth session table with integer user_id to match users table
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMP NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for efficient session lookups
CREATE INDEX IF NOT EXISTS session_user_id_idx ON session(user_id);
CREATE INDEX IF NOT EXISTS session_token_idx ON session(token);

-- Create Better Auth account table for OAuth providers
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  expires_at TIMESTAMP,
  password TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for account lookups
CREATE INDEX IF NOT EXISTS account_user_id_idx ON account(user_id);
CREATE INDEX IF NOT EXISTS account_provider_id_idx ON account(provider_id);

-- Create verification table for email verification tokens
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for verification lookups
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

-- Add password hash column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Update the updated_at trigger for session table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_updated_at BEFORE UPDATE ON session
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_updated_at BEFORE UPDATE ON account
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verification_updated_at BEFORE UPDATE ON verification
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();