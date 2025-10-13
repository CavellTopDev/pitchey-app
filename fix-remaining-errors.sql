-- SQL Script to verify and fix database column names
-- Run this against your Neon database to check actual column names

-- 1. Check messages table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('recipient_id', 'recipientId', 'is_read', 'isRead');

-- 2. Check ndas table columns  
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ndas'
AND column_name IN ('user_id', 'userId', 'pitch_id', 'pitchId', 'signed_at', 'signedAt');

-- 3. Check nda_requests table columns
SELECT column_name, data_type
FROM information_schema.columns  
WHERE table_name = 'nda_requests'
AND column_name IN ('requester_id', 'requesterId', 'pitch_id', 'pitchId');

-- If columns are snake_case, you have two options:

-- OPTION A: Add column aliases (safer, no data loss)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "recipientId" integer;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "isRead" boolean DEFAULT false;
UPDATE messages SET "recipientId" = recipient_id WHERE "recipientId" IS NULL;
UPDATE messages SET "isRead" = is_read WHERE "isRead" IS NULL;

ALTER TABLE ndas ADD COLUMN IF NOT EXISTS "userId" integer;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS "pitchId" integer;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS "signedAt" timestamp;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS "expiresAt" timestamp;
UPDATE ndas SET "userId" = user_id WHERE "userId" IS NULL;
UPDATE ndas SET "pitchId" = pitch_id WHERE "pitchId" IS NULL;

ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS "requesterId" integer;
ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS "pitchId" integer;
ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS "requestedAt" timestamp;
UPDATE nda_requests SET "requesterId" = requester_id WHERE "requesterId" IS NULL;
UPDATE nda_requests SET "pitchId" = pitch_id WHERE "pitchId" IS NULL;

-- OPTION B: Rename columns (requires downtime)
-- ALTER TABLE messages RENAME COLUMN recipient_id TO "recipientId";
-- ALTER TABLE messages RENAME COLUMN is_read TO "isRead";
-- etc...