-- Seed Demo Users with RBAC Roles
-- This script ensures demo users exist and have proper roles assigned

-- First, ensure demo users exist (upsert)
INSERT INTO users (email, password_hash, user_type, name, created_at, updated_at)
VALUES 
  ('alex.creator@demo.com', '$2a$10$YGQJhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JH', 'creator', 'Alex Creator', NOW(), NOW()),
  ('sarah.investor@demo.com', '$2a$10$YGQJhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JH', 'investor', 'Sarah Investor', NOW(), NOW()),
  ('stellar.production@demo.com', '$2a$10$YGQJhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JH', 'production', 'Stellar Productions', NOW(), NOW()),
  ('admin@pitchey.com', '$2a$10$YGQJhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JHhGH1C5JH', 'creator', 'Admin User', NOW(), NOW())
ON CONFLICT (email) 
DO UPDATE SET 
  user_type = EXCLUDED.user_type,
  updated_at = NOW();

-- Assign roles to demo users based on their user_type
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT u.id, r.id, NOW()
FROM users u
JOIN roles r ON LOWER(u.user_type) = r.name
WHERE u.email IN (
  'alex.creator@demo.com',
  'sarah.investor@demo.com', 
  'stellar.production@demo.com'
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Grant admin role to admin@pitchey.com
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT u.id, r.id, NOW()
FROM users u, roles r
WHERE u.email = 'admin@pitchey.com'
  AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Create some sample pitches for testing
INSERT INTO pitches (user_id, title, genre, logline, synopsis, status, created_at, updated_at)
SELECT 
  u.id,
  'Sample Pitch ' || generate_series,
  CASE 
    WHEN generate_series % 5 = 0 THEN 'Action'
    WHEN generate_series % 5 = 1 THEN 'Comedy'
    WHEN generate_series % 5 = 2 THEN 'Drama'
    WHEN generate_series % 5 = 3 THEN 'Thriller'
    ELSE 'Sci-Fi'
  END,
  'This is a compelling logline for pitch ' || generate_series,
  'A detailed synopsis that captures the essence of the story...',
  'published',
  NOW() - (generate_series || ' days')::interval,
  NOW()
FROM users u, generate_series(1, 5)
WHERE u.email = 'alex.creator@demo.com'
ON CONFLICT DO NOTHING;

-- Grant content access to creator for their own pitches
INSERT INTO content_access (user_id, content_type, content_id, access_level, granted_via, granted_at)
SELECT p.user_id, 'pitch', p.id, 'admin', 'ownership', NOW()
FROM pitches p
WHERE p.user_id IN (SELECT id FROM users WHERE email = 'alex.creator@demo.com')
ON CONFLICT (user_id, content_type, content_id) DO NOTHING;

-- Create sample NDA requests
INSERT INTO ndas (pitch_id, user_id, status, created_at)
SELECT 
  p.id,
  u.id,
  'pending',
  NOW()
FROM pitches p, users u
WHERE p.user_id = (SELECT id FROM users WHERE email = 'alex.creator@demo.com')
  AND u.email = 'sarah.investor@demo.com'
  AND p.id IN (SELECT id FROM pitches ORDER BY created_at DESC LIMIT 2)
ON CONFLICT DO NOTHING;

-- Output summary
SELECT 'Demo Users Created/Updated:' as status;
SELECT u.id, u.email, u.user_type, r.name as role_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.email IN (
  'alex.creator@demo.com',
  'sarah.investor@demo.com',
  'stellar.production@demo.com',
  'admin@pitchey.com'
);

SELECT '';
SELECT 'Permissions Summary by Role:' as status;
SELECT r.name as role, COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name
ORDER BY r.name;

SELECT '';
SELECT 'Content Access Granted:' as status;
SELECT COUNT(*) as access_records FROM content_access;

SELECT '';
SELECT 'Sample Pitches Created:' as status;
SELECT COUNT(*) as pitch_count FROM pitches WHERE user_id = (SELECT id FROM users WHERE email = 'alex.creator@demo.com');