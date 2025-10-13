-- Add test data for API endpoint validation
-- This script populates the database with test data to validate all endpoints

-- First, let's check and create some test users if they don't exist
INSERT INTO users (id, email, username, password_hash, first_name, last_name, user_type, created_at)
VALUES 
  (1, 'alex.creator@demo.com', 'alexcreator', '$2a$10$rBImV5KhaXSH7XBhh3s3XuwRVsXpjSW9U21n5i7V8tJQhMkHc3fPe', 'Alex', 'Creator', 'creator', NOW()),
  (2, 'sarah.investor@demo.com', 'sarahinvestor', '$2a$10$rBImV5KhaXSH7XBhh3s3XuwRVsXpjSW9U21n5i7V8tJQhMkHc3fPe', 'Sarah', 'Investor', 'investor', NOW()),
  (3, 'stellar.production@demo.com', 'stellarprod', '$2a$10$rBImV5KhaXSH7XBhh3s3XuwRVsXpjSW9U21n5i7V8tJQhMkHc3fPe', 'Stellar', 'Productions', 'production', NOW()),
  (4, 'john.creator@demo.com', 'johncreator', '$2a$10$rBImV5KhaXSH7XBhh3s3XuwRVsXpjSW9U21n5i7V8tJQhMkHc3fPe', 'John', 'Creator', 'creator', NOW()),
  (5, 'jane.creator@demo.com', 'janecreator', '$2a$10$rBImV5KhaXSH7XBhh3s3XuwRVsXpjSW9U21n5i7V8tJQhMkHc3fPe', 'Jane', 'Creator', 'creator', NOW())
ON CONFLICT (email) DO UPDATE 
SET user_type = EXCLUDED.user_type,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- Create some test pitches if they don't exist
INSERT INTO pitches (id, title, logline, genre, format, status, visibility, user_id, created_at, view_count, production_company_id)
VALUES 
  (101, 'The Last Signal', 'A lone astronaut receives a mysterious signal from deep space', 'sci-fi', 'feature', 'active', 'public', 1, NOW(), 150, NULL),
  (102, 'Midnight Garden', 'A detective uncovers dark secrets in a botanical garden', 'thriller', 'feature', 'active', 'public', 1, NOW(), 89, NULL),
  (103, 'Code Warriors', 'Hackers fight to save the internet from AI takeover', 'action', 'series', 'active', 'public', 4, NOW(), 234, NULL),
  (104, 'Love in Binary', 'A romance between two programmers working on opposite sides', 'romance', 'feature', 'active', 'public', 5, NOW(), 67, NULL),
  (105, 'The Pitch', 'Meta comedy about making movies in Hollywood', 'comedy', 'feature', 'in_production', 'public', 1, NOW(), 445, 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    genre = EXCLUDED.genre,
    view_count = EXCLUDED.view_count;

-- 1. Create follow relationships for /api/creator/followers
-- Note: follows table uses creator_id, not following_id
INSERT INTO follows (follower_id, creator_id, followed_at)
VALUES 
  (2, 1, NOW() - INTERVAL '30 days'), -- Sarah follows Alex
  (3, 1, NOW() - INTERVAL '20 days'), -- Stellar follows Alex
  (4, 1, NOW() - INTERVAL '10 days'), -- John follows Alex
  (5, 1, NOW() - INTERVAL '5 days'),  -- Jane follows Alex
  (1, 4, NOW() - INTERVAL '15 days'), -- Alex follows John
  (1, 5, NOW() - INTERVAL '8 days')   -- Alex follows Jane
ON CONFLICT (follower_id, creator_id) DO NOTHING;

-- 2. Create saved pitches for /api/creator/saved-pitches
INSERT INTO saved_pitches (user_id, pitch_id, created_at)
VALUES 
  (1, 103, NOW() - INTERVAL '7 days'),  -- Alex saved Code Warriors
  (1, 104, NOW() - INTERVAL '3 days'),  -- Alex saved Love in Binary
  (2, 101, NOW() - INTERVAL '10 days'), -- Sarah saved The Last Signal
  (2, 102, NOW() - INTERVAL '5 days'),  -- Sarah saved Midnight Garden
  (3, 101, NOW() - INTERVAL '2 days')   -- Stellar saved The Last Signal
ON CONFLICT (user_id, pitch_id) DO NOTHING;

-- 3. Create investments for /api/investments endpoints
INSERT INTO investments (investor_id, pitch_id, amount, status, terms, created_at, updated_at)
VALUES 
  (2, 101, 50000.00, 'active', 'Standard investment terms with 20% equity', NOW() - INTERVAL '15 days', NOW()),
  (2, 102, 25000.00, 'pending', 'Seed investment for development', NOW() - INTERVAL '10 days', NOW()),
  (2, 105, 100000.00, 'active', 'Production investment with profit sharing', NOW() - INTERVAL '5 days', NOW())
ON CONFLICT DO NOTHING;

-- 4. Create investment documents
INSERT INTO investment_documents (investment_id, document_name, document_url, document_type, uploaded_at)
SELECT 
  i.id,
  'Investment Agreement ' || i.id || '.pdf',
  'https://example.com/docs/agreement-' || i.id || '.pdf',
  'agreement',
  NOW() - INTERVAL '1 day'
FROM investments i
WHERE NOT EXISTS (
  SELECT 1 FROM investment_documents d WHERE d.investment_id = i.id
);

-- 5. Create investment timeline events
INSERT INTO investment_timeline (investment_id, event_type, event_description, event_date, created_at)
SELECT 
  i.id,
  'investment_made',
  'Initial investment of $' || i.amount,
  i.created_at,
  i.created_at
FROM investments i
WHERE NOT EXISTS (
  SELECT 1 FROM investment_timeline t WHERE t.investment_id = i.id
);

-- 6. Create NDAs for production access (adjusted for schema)
INSERT INTO ndas (pitch_id, user_id, status, created_at, signed_at)
VALUES 
  (101, 3, 'signed', NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days'),
  (102, 3, 'signed', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
  (103, 3, 'pending', NOW() - INTERVAL '5 days', NULL),
  (104, 3, 'signed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
  (105, 3, 'signed', NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days')
ON CONFLICT DO NOTHING;

-- 7. Create calendar events for production
INSERT INTO calendar_events (user_id, title, description, start_date, end_date, type, related_pitch_id, location)
VALUES 
  (3, 'Pitch Review Meeting', 'Review The Last Signal pitch', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '1 hour', 'meeting', 101, 'Conference Room A'),
  (3, 'Production Planning', 'Plan production schedule for The Pitch', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', 'production', 105, 'Studio 1'),
  (3, 'Investor Presentation', 'Present quarterly results', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '90 minutes', 'meeting', NULL, 'Board Room'),
  (3, 'Script Deadline', 'Final script submission deadline', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days', 'deadline', 102, NULL),
  (3, 'Screening Event', 'Private screening for investors', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days' + INTERVAL '3 hours', 'screening', 105, 'Theater 1')
ON CONFLICT DO NOTHING;

-- 8. Create reviews for production pitch review endpoint
INSERT INTO reviews (pitch_id, reviewer_id, status, feedback, rating, created_at, updated_at)
VALUES 
  (101, 3, 'approved', 'Excellent concept with strong commercial potential', 5, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  (102, 3, 'pending', 'Interesting premise but needs script development', 3, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (104, 3, 'approved', 'Great romantic story with unique angle', 4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
ON CONFLICT (pitch_id, reviewer_id) DO UPDATE
SET status = EXCLUDED.status,
    feedback = EXCLUDED.feedback,
    rating = EXCLUDED.rating,
    updated_at = NOW();

-- Summary of test data created:
SELECT 'Test Data Summary:' as info
UNION ALL
SELECT 'Users: ' || COUNT(*)::text FROM users
UNION ALL
SELECT 'Pitches: ' || COUNT(*)::text FROM pitches
UNION ALL
SELECT 'Follows: ' || COUNT(*)::text FROM follows
UNION ALL
SELECT 'Saved Pitches: ' || COUNT(*)::text FROM saved_pitches
UNION ALL
SELECT 'Investments: ' || COUNT(*)::text FROM investments
UNION ALL
SELECT 'NDAs: ' || COUNT(*)::text FROM ndas
UNION ALL
SELECT 'Calendar Events: ' || COUNT(*)::text FROM calendar_events
UNION ALL
SELECT 'Reviews: ' || COUNT(*)::text FROM reviews;