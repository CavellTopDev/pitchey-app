-- Add test data using existing users and IDs
-- This script populates missing relationships for API testing

-- 1. Create follow relationships for /api/creator/followers
-- Using existing user IDs: 1001 (alex creator), 1002 (sarah investor), 1003 (stellar production), 4 (alice)
INSERT INTO follows (follower_id, creator_id, followed_at)
VALUES 
  (1002, 1001, NOW() - INTERVAL '30 days'), -- Sarah follows Alex
  (1003, 1001, NOW() - INTERVAL '20 days'), -- Stellar follows Alex  
  (4, 1001, NOW() - INTERVAL '10 days'),    -- Alice follows Alex
  (1001, 4, NOW() - INTERVAL '15 days')     -- Alex follows Alice
ON CONFLICT (follower_id, creator_id) DO NOTHING;

-- 2. Create saved pitches for /api/creator/saved-pitches
-- Using existing pitches: 7, 8, 9, 10, 11, 12
INSERT INTO saved_pitches (user_id, pitch_id, created_at)
VALUES 
  (1001, 10, NOW() - INTERVAL '7 days'),  -- Alex saved pitch 10
  (1001, 11, NOW() - INTERVAL '3 days'),  -- Alex saved pitch 11
  (1002, 7, NOW() - INTERVAL '10 days'),  -- Sarah saved pitch 7
  (1002, 8, NOW() - INTERVAL '5 days'),   -- Sarah saved pitch 8
  (1003, 9, NOW() - INTERVAL '2 days')    -- Stellar saved pitch 9
ON CONFLICT (user_id, pitch_id) DO NOTHING;

-- 3. Create investments for /api/investments endpoints
INSERT INTO investments (investor_id, pitch_id, amount, status, terms, created_at, updated_at)
VALUES 
  (1002, 7, 50000.00, 'active', 'Standard investment terms with 20% equity', NOW() - INTERVAL '15 days', NOW()),
  (1002, 8, 25000.00, 'pending', 'Seed investment for development', NOW() - INTERVAL '10 days', NOW()),
  (1002, 9, 100000.00, 'active', 'Production investment with profit sharing', NOW() - INTERVAL '5 days', NOW())
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
)
LIMIT 3;

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
)
LIMIT 3;

-- 6. Create NDAs for production access
INSERT INTO ndas (pitch_id, user_id, status, created_at, signed_at)
VALUES 
  (7, 1003, 'signed', NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days'),
  (8, 1003, 'signed', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
  (9, 1003, 'pending', NOW() - INTERVAL '5 days', NULL),
  (10, 1003, 'signed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
  (11, 1003, 'signed', NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days')
ON CONFLICT DO NOTHING;

-- 7. Create calendar events for production user
INSERT INTO calendar_events (user_id, title, description, start_date, end_date, type, related_pitch_id, location)
VALUES 
  (1003, 'Pitch Review Meeting', 'Review The Last Frontier pitch', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '1 hour', 'meeting', 7, 'Conference Room A'),
  (1003, 'Production Planning', 'Plan production schedule', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', 'production', 9, 'Studio 1'),
  (1003, 'Investor Presentation', 'Present quarterly results', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '90 minutes', 'meeting', NULL, 'Board Room'),
  (1003, 'Script Deadline', 'Final script submission deadline', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days', 'deadline', 8, NULL),
  (1003, 'Screening Event', 'Private screening for investors', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days' + INTERVAL '3 hours', 'screening', 11, 'Theater 1')
ON CONFLICT DO NOTHING;

-- 8. Create reviews for production pitch review endpoint
INSERT INTO reviews (pitch_id, reviewer_id, status, feedback, rating, created_at, updated_at)
VALUES 
  (7, 1003, 'approved', 'Excellent concept with strong commercial potential', 5, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  (8, 1003, 'pending', 'Interesting premise but needs script development', 3, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (9, 1003, 'approved', 'Great story with unique angle', 4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
ON CONFLICT (pitch_id, reviewer_id) DO UPDATE
SET status = EXCLUDED.status,
    feedback = EXCLUDED.feedback,
    rating = EXCLUDED.rating,
    updated_at = NOW();

-- Summary of test data created:
SELECT 'Test Data Summary:' as info
UNION ALL
SELECT 'Users available: ' || COUNT(*)::text FROM users
UNION ALL
SELECT 'Pitches available: ' || COUNT(*)::text FROM pitches
UNION ALL
SELECT 'Follows created: ' || COUNT(*)::text FROM follows
UNION ALL
SELECT 'Saved Pitches created: ' || COUNT(*)::text FROM saved_pitches
UNION ALL
SELECT 'Investments created: ' || COUNT(*)::text FROM investments
UNION ALL
SELECT 'NDAs created: ' || COUNT(*)::text FROM ndas
UNION ALL
SELECT 'Calendar Events created: ' || COUNT(*)::text FROM calendar_events
UNION ALL
SELECT 'Reviews created: ' || COUNT(*)::text FROM reviews;