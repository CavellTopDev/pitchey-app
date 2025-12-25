-- Enhanced Demo Pitches Seed Script
-- Creates pitches from both creators and production companies

-- First, ensure demo users exist
INSERT INTO users (email, username, password, first_name, last_name, user_type, company_name, created_at)
VALUES 
  ('alex.creator@demo.com', 'alex.creator', '$2a$10$X4kv7j5ZcQrZ2gHLmJV0je7DiD6KwNMN0mBfEZBPVfGLbANJ2vDiG', 'Alex', 'Creator', 'creator', 'Creative Studios', NOW()),
  ('sarah.investor@demo.com', 'sarah.investor', '$2a$10$X4kv7j5ZcQrZ2gHLmJV0je7DiD6KwNMN0mBfEZBPVfGLbANJ2vDiG', 'Sarah', 'Investor', 'investor', 'Venture Capital Inc', NOW()),
  ('stellar.production@demo.com', 'stellar.production', '$2a$10$X4kv7j5ZcQrZ2gHLmJV0je7DiD6KwNMN0mBfEZBPVfGLbANJ2vDiG', 'Stellar', 'Production', 'production', 'Stellar Productions', NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert sample pitches from CREATOR
INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis, 
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT 
  u.id,
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
FROM users u 
WHERE u.email = 'alex.creator@demo.com';

INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis,
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT
  u.id,
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
FROM users u 
WHERE u.email = 'alex.creator@demo.com';

INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis,
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT
  u.id,
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
FROM users u 
WHERE u.email = 'alex.creator@demo.com';

-- Insert sample pitches from PRODUCTION COMPANY
INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis,
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT
  u.id,
  'Stellar Horizons',
  'A space exploration epic following humanity first interstellar colony mission',
  'Science Fiction (Sci-Fi)',
  'Film',
  'In 2157, Captain Maria Santos leads the first human colony ship to Proxima Centauri. When they arrive, they discover the planet holds ancient secrets that challenge everything we know about life in the universe.',
  'Exploration, discovery, humanity future, alien contact',
  'A realistic vision of interstellar travel and colonization',
  'High',
  45000000,
  'published',
  false,
  true,
  312,
  45,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
FROM users u 
WHERE u.email = 'stellar.production@demo.com';

INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis,
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT
  u.id,
  'Ocean Deep',
  'Marine biologists discover an underwater civilization that has been watching humanity',
  'Adventure',
  'Film',
  'Dr. Sarah Kim team discovers bio-luminescent structures in the Mariana Trench that turn out to be an ancient underwater city. The inhabitants have been monitoring surface dwellers for millennia.',
  'Environmental protection, first contact, ocean exploration',
  'Present day Earth with focus on deep ocean environments',
  'Medium',
  18000000,
  'published',
  false,
  false,
  156,
  23,
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
FROM users u 
WHERE u.email = 'stellar.production@demo.com';

INSERT INTO pitches (
  user_id, title, logline, genre, format, short_synopsis,
  themes, world_description, budget_bracket, estimated_budget,
  status, seeking_investment, require_nda, view_count, like_count,
  created_at, updated_at
)
SELECT
  u.id,
  'The Art of War',
  'A historical drama about female spies during World War II',
  'Drama',
  'Television - Scripted',
  'Based on true events, this series follows three women from different countries who become instrumental in gathering intelligence during WWII, changing the course of major battles.',
  'Women empowerment, historical sacrifice, espionage',
  '1940s Europe during World War II',
  'Medium',
  12000000,
  'published',
  true,
  true,
  267,
  38,
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days'
FROM users u 
WHERE u.email = 'stellar.production@demo.com';

-- Verify pitches were inserted
DO $$
BEGIN
    RAISE NOTICE 'Demo pitches seeding completed!';
    RAISE NOTICE 'Total pitches: %', (SELECT COUNT(*) FROM pitches);
    RAISE NOTICE 'Creator pitches: %', (SELECT COUNT(*) FROM pitches p JOIN users u ON p.user_id = u.id WHERE u.user_type = 'creator');
    RAISE NOTICE 'Production pitches: %', (SELECT COUNT(*) FROM pitches p JOIN users u ON p.user_id = u.id WHERE u.user_type = 'production');
END $$;
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
