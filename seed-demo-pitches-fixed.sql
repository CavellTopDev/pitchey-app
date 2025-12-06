-- First, ensure demo users exist
INSERT INTO users (email, username, password, first_name, last_name, user_type, company_name, created_at, is_verified, email_verified)
VALUES 
  ('alex.creator@demo.com', 'alexcreator', '$2a$10$X4kv7j5ZcQrZ2gHLmJV0je7DiD6KwNMN0mBfEZBPVfGLbANJ2vDiG', 'Alex', 'Creator', 'creator', 'Creative Studios', NOW(), true, true),
  ('sarah.investor@demo.com', 'sarahinvestor', '$2a$10$X4kv7j5ZcQrZ2gHLmJV0je7DiD6KwNMN0mBfEZBPVfGLbANJ2vDiG', 'Sarah', 'Investor', 'investor', 'Venture Capital Inc', NOW(), true, true),
  ('stellar.production@demo.com', 'stellarproduction', '$2a$10$X4kv7j5ZcQrZ2gHLmJV0je7DiD6KwNMN0mBfEZBPVfGLbANJ2vDiG', 'Stellar', 'Production', 'production', 'Stellar Productions', NOW(), true, true)
ON CONFLICT (email) DO NOTHING;

-- Get creator user ID and insert pitches
INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis, 
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT 
  (SELECT id FROM users WHERE email = 'alex.creator@demo.com' LIMIT 1),
  'The Quantum Heist',
  'A brilliant physicist uses quantum mechanics to pull off the impossible heist',
  'Science Fiction (Sci-Fi)',
  'Film',
  'When Dr. Elena Vasquez discovers she can access parallel universes, she assembles a team to steal quantum research from a mega-corporation across multiple realities.',
  'Identity, parallel realities, corporate power',
  'A near-future world where quantum computing has revolutionized technology',
  'High',
  15000000,
  'published',
  true,
  true,
  125,
  18,
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'alex.creator@demo.com');

INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis,
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT
  (SELECT id FROM users WHERE email = 'alex.creator@demo.com' LIMIT 1),
  'Digital Dreams',
  'In a world where memories can be digitized, a memory thief discovers a conspiracy',
  'Thriller',
  'Television - Scripted',
  'Maya Chen works as a memory extractor for the government, helping solve crimes by extracting memories from witnesses.',
  'Memory, identity, privacy, technology impact',
  'A cyberpunk future where memories can be extracted and stored',
  'Medium',
  8000000,
  'published',
  true,
  false,
  89,
  12,
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'alex.creator@demo.com');

INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis,
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT
  (SELECT id FROM users WHERE email = 'alex.creator@demo.com' LIMIT 1),
  'The Last Echo',
  'A sound engineer discovers frequencies that can access memories from the past',
  'Mystery Thriller',
  'Film',
  'Dr. Zoe Pierce discovers that specific sound frequencies can reveal echoes of past events.',
  'History repeating, industrial corruption, sound power',
  'Modern-day setting with flashbacks to the 1950s',
  'Medium',
  5000000,
  'published',
  true,
  true,
  234,
  31,
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'alex.creator@demo.com');

-- Verify the data
SELECT COUNT(*) AS pitch_count FROM pitches WHERE status = 'published';
