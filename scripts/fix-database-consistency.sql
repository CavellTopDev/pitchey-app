-- Database Consistency Fix Script for Pitchey Platform
-- Run this script to clean up orphaned records and ensure data integrity

-- 1. Fix orphaned pitch records (pitches where creator_id doesn't exist in users)
-- First, let's see what we're dealing with
SELECT 'Orphaned pitches to be fixed:' as info;
SELECT p.id, p.title, p.creator_id, p.created_at
FROM pitches p
LEFT JOIN users u ON p.creator_id = u.id
WHERE u.id IS NULL;

-- Option A: Delete orphaned pitches (recommended for cleanup)
DELETE FROM pitches
WHERE creator_id NOT IN (SELECT id FROM users);

-- 2. Fix orphaned NDA request records
SELECT 'Orphaned NDA requests to be fixed:' as info;
SELECT nr.id, nr.requester_id, nr.pitch_owner_id, nr.created_at
FROM nda_requests nr
LEFT JOIN users u1 ON nr.requester_id = u1.id
LEFT JOIN users u2 ON nr.pitch_owner_id = u2.id
WHERE u1.id IS NULL OR u2.id IS NULL;

-- Delete orphaned NDA requests
DELETE FROM nda_requests
WHERE requester_id NOT IN (SELECT id FROM users)
   OR pitch_owner_id NOT IN (SELECT id FROM users);

-- 3. Verify the fixes
SELECT 'Verification - Orphaned pitches remaining:' as info;
SELECT COUNT(*) as orphaned_pitches
FROM pitches p
LEFT JOIN users u ON p.creator_id = u.id
WHERE u.id IS NULL;

SELECT 'Verification - Orphaned NDA requests remaining:' as info;
SELECT COUNT(*) as orphaned_ndas
FROM nda_requests nr
LEFT JOIN users u1 ON nr.requester_id = u1.id
LEFT JOIN users u2 ON nr.pitch_owner_id = u2.id
WHERE u1.id IS NULL OR u2.id IS NULL;

-- 4. Add foreign key constraints with ON DELETE CASCADE to prevent future orphans
-- Note: Only run these if the constraints don't already exist

-- Check existing constraints
SELECT 'Current foreign key constraints on pitches:' as info;
SELECT tc.constraint_name, kcu.column_name, ccu.table_name as foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'pitches'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Add constraint if not exists (for pitches)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pitches_creator_id_fkey'
    AND table_name = 'pitches'
  ) THEN
    ALTER TABLE pitches
    ADD CONSTRAINT pitches_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add constraint if not exists (for nda_requests requester)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'nda_requests_requester_id_fkey'
    AND table_name = 'nda_requests'
  ) THEN
    ALTER TABLE nda_requests
    ADD CONSTRAINT nda_requests_requester_id_fkey
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add constraint if not exists (for nda_requests pitch_owner)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'nda_requests_pitch_owner_id_fkey'
    AND table_name = 'nda_requests'
  ) THEN
    ALTER TABLE nda_requests
    ADD CONSTRAINT nda_requests_pitch_owner_id_fkey
    FOREIGN KEY (pitch_owner_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

SELECT 'Database consistency fixes completed!' as info;
