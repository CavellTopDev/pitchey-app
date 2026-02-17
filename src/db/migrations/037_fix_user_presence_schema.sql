-- Fix user_presence table for real-time fallback infrastructure
-- 1. Add 'dnd' to allowed status values (frontend sends it)
-- 2. Add 'activity' column (frontend sends activity field)

ALTER TABLE user_presence DROP CONSTRAINT IF EXISTS user_presence_status_check;
ALTER TABLE user_presence ADD CONSTRAINT user_presence_status_check
  CHECK (status IN ('online', 'away', 'busy', 'offline', 'dnd'));

ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS activity TEXT;
