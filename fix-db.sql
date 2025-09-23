-- Add missing columns to sessions table
ALTER TABLE sessions 
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
  ADD COLUMN IF NOT EXISTS user_agent TEXT;