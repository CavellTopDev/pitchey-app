-- Fix for remaining production issues
-- December 6, 2024

-- 1. Check if pitch_views table exists (for analytics endpoint)
-- If not, create it:
CREATE TABLE IF NOT EXISTS pitch_views (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
  viewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pitch_views_pitch ON pitch_views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_views_viewer ON pitch_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_pitch_views_date ON pitch_views(viewed_at);

-- 2. Verify investments table has correct column
-- Already confirmed: roi_percentage exists as NUMERIC(5,2)

-- 3. Add some test data for demo users if needed
-- Insert test investment for Sarah (investor demo user)
INSERT INTO investments (investor_id, pitch_id, amount, status, roi_percentage, created_at)
SELECT 
  2, -- Sarah's ID
  1, -- First pitch
  50000.00,
  'active',
  15.50,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM investments WHERE investor_id = 2
);

-- 4. Add test views for analytics
INSERT INTO pitch_views (pitch_id, viewer_id, viewed_at)
SELECT 
  p.id,
  FLOOR(RANDOM() * 10 + 1)::int,
  NOW() - INTERVAL '1 day' * FLOOR(RANDOM() * 30)
FROM pitches p
CROSS JOIN generate_series(1, 5) -- 5 views per pitch
WHERE NOT EXISTS (
  SELECT 1 FROM pitch_views WHERE pitch_id = p.id
);