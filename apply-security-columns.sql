-- Simple SQL script to add missing security columns directly
-- Run this with psql

-- Add missing security and account management columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_lock_reason VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_history JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT false;

-- Show the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name IN (
  'failed_login_attempts',
  'last_failed_login', 
  'account_locked_until',
  'account_locked_at',
  'account_lock_reason',
  'last_password_change_at',
  'password_history',
  'require_password_change'
)
ORDER BY column_name;