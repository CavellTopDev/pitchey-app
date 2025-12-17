-- Seed Demo Users for Pitchey Platform
-- Password for all users: Demo123! (hashed using bcrypt)

-- Clear existing demo users to avoid duplicates
DELETE FROM users WHERE email IN (
  'alex.creator@demo.com',
  'sarah.investor@demo.com',
  'stellar.production@demo.com'
);

-- Insert demo users with bcrypt hashed password for 'Demo123!'
-- Note: This hash is for 'Demo123!' - you may need to regenerate if using different salt rounds
INSERT INTO users (
  email,
  username,
  password_hash,
  user_type,
  first_name,
  last_name,
  bio,
  profile_image_url,
  company_name,
  email_verified,
  is_active,
  subscription_tier,
  created_at,
  updated_at
) VALUES 
(
  'alex.creator@demo.com',
  'alexcreator',
  '$2a$10$xQX0eFo8ZJvKrMPzgD0oG.zvF8KfF3ysKgG6x8OIzT.FqUQHvYrWO', -- Demo123!
  'creator',
  'Alex',
  'Creator',
  'Award-winning screenwriter with 10 years of experience in film and television. Specializing in sci-fi and drama.',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
  NULL,
  true,
  true,
  'free',
  NOW(),
  NOW()
),
(
  'sarah.investor@demo.com',
  'sarahinvestor',
  '$2a$10$xQX0eFo8ZJvKrMPzgD0oG.zvF8KfF3ysKgG6x8OIzT.FqUQHvYrWO', -- Demo123!
  'investor',
  'Sarah',
  'Investor',
  'Managing Partner at Venture Films Capital, focusing on emerging filmmakers and innovative storytelling.',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
  'Venture Films Capital',
  true,
  true,
  'professional',
  NOW(),
  NOW()
),
(
  'stellar.production@demo.com',
  'stellarprod',
  '$2a$10$xQX0eFo8ZJvKrMPzgD0oG.zvF8KfF3ysKgG6x8OIzT.FqUQHvYrWO', -- Demo123!
  'production',
  'Stellar',
  'Productions',
  'Leading independent production company with 50+ films produced. We bring stories to life.',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=stellar',
  'Stellar Productions',
  true,
  true,
  'enterprise',
  NOW(),
  NOW()
);

-- Add some demo pitches for the creator
INSERT INTO pitches (
  user_id,
  title,
  logline,
  genre,
  format,
  status,
  view_count,
  like_count,
  created_at,
  updated_at
) 
SELECT 
  id,
  'The Last Signal',
  'When Earth receives its first alien message, a linguist must decode it before world governments trigger an interstellar war.',
  'scifi',
  'feature',
  'published',
  127,
  45,
  NOW() - INTERVAL '7 days',
  NOW()
FROM users WHERE email = 'alex.creator@demo.com'
UNION ALL
SELECT 
  id,
  'Echoes of Tomorrow',
  'A time traveler discovers that changing the past doesn''t alter the future—it creates parallel worlds that are slowly colliding.',
  'scifi',
  'tv',
  'published',
  89,
  32,
  NOW() - INTERVAL '14 days',
  NOW()
FROM users WHERE email = 'alex.creator@demo.com'
UNION ALL
SELECT 
  id,
  'Digital Ghosts',
  'After a global blackout, a programmer discovers that deleted data has gained consciousness and seeks revenge on humanity.',
  'thriller',
  'feature',
  'draft',
  45,
  18,
  NOW() - INTERVAL '3 days',
  NOW()
FROM users WHERE email = 'alex.creator@demo.com';

-- Output success message
SELECT 'Demo users and sample pitches created successfully!' as message;
SELECT email, username, user_type, subscription_tier FROM users WHERE email LIKE '%@demo.com';