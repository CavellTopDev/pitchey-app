-- Fix view deduplication: add unique constraint and ip_address column
-- This ensures the ON CONFLICT (user_id, pitch_id) in views.ts actually works

-- Add ip_address column if missing (some schema versions have it, some don't)
ALTER TABLE views ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Add viewed_at column if missing (some schema versions use created_at instead)
ALTER TABLE views ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Deduplicate existing rows for logged-in users before adding constraint:
-- Keep the most recent view per (user_id, pitch_id) pair
DELETE FROM views a
USING views b
WHERE a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.pitch_id = b.pitch_id
  AND a.id < b.id;

-- Now add the unique index for logged-in user dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_user_pitch_unique
  ON views (user_id, pitch_id)
  WHERE user_id IS NOT NULL;

-- Add index for IP-based dedup (anonymous users)
CREATE INDEX IF NOT EXISTS idx_views_ip_pitch
  ON views (ip_address, pitch_id, viewed_at)
  WHERE ip_address IS NOT NULL;

-- Recount view_count on pitches to fix any inflated numbers
UPDATE pitches p
SET view_count = sub.cnt
FROM (
  SELECT pitch_id, COUNT(*)::int AS cnt FROM views GROUP BY pitch_id
) sub
WHERE p.id = sub.pitch_id
  AND p.view_count IS DISTINCT FROM sub.cnt;
