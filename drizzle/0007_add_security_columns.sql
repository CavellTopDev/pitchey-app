-- Add missing security and account management columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_lock_reason VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_history JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_account_locked_until ON users(account_locked_until) WHERE account_locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_failed_login_attempts ON users(failed_login_attempts) WHERE failed_login_attempts > 0;