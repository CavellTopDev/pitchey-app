-- Migration 043: Fix pitch visibility — set column default and backfill published pitches
-- Root cause: pitchPublishHandler only set status='published' but never touched visibility,
-- so pitches created via createPitch (which omitted visibility from INSERT) landed with
-- NULL visibility and were invisible to marketplace queries that require visibility='public'.

-- 1. Ensure the column has a safe default going forward for any path that omits it
ALTER TABLE pitches
  ALTER COLUMN visibility SET DEFAULT 'private';

-- 2. Backfill: any pitch already published but with NULL or 'private' visibility
--    should be visible on the marketplace
UPDATE pitches
SET visibility = 'public'
WHERE status = 'published'
  AND (visibility IS NULL OR visibility = 'private');

-- 3. Ensure draft pitches with NULL visibility get a safe value
UPDATE pitches
SET visibility = 'private'
WHERE status = 'draft'
  AND visibility IS NULL;
