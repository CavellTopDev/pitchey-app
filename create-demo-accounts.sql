-- Create demo accounts for testing
-- All passwords are: Demo123!

-- Check if demo users already exist and delete them first
DELETE FROM users WHERE email IN (
  'alex.creator@demo.com',
  'sarah.investor@demo.com', 
  'stellar.production@demo.com'
);

-- Insert demo creator account
INSERT INTO users (
  email, 
  password, 
  username, 
  user_type,
  first_name,
  last_name,
  company_name,
  bio,
  website,
  linkedin,
  twitter,
  created_at,
  updated_at,
  is_verified,
  is_active,
  terms_accepted,
  privacy_accepted,
  two_factor_enabled
) VALUES (
  'alex.creator@demo.com',
  '$2b$10$rQYX9O.dXTJ8vH9vH8vH8eeW6eW6eW6eW6eW6eW6eW6eW6eW6eW6e', -- Demo123!
  'alexcreator',
  'creator',
  'Alex',
  'Creator',
  'Independent Films',
  'Passionate filmmaker with 10+ years of experience in independent cinema.',
  'https://alexcreatorfilms.com',
  'https://linkedin.com/in/alexcreator',
  'https://twitter.com/alexcreator',
  NOW(),
  NOW(),
  true,
  true,
  true,
  true,
  false
);

-- Insert demo investor account  
INSERT INTO users (
  email,
  password,
  username,
  user_type,
  first_name,
  last_name,
  company_name,
  bio,
  website,
  linkedin,
  twitter,
  created_at,
  updated_at,
  is_verified,
  is_active,
  terms_accepted,
  privacy_accepted,
  two_factor_enabled
) VALUES (
  'sarah.investor@demo.com',
  '$2b$10$rQYX9O.dXTJ8vH9vH8vH8eeW6eW6eW6eW6eW6eW6eW6eW6eW6eW6e', -- Demo123!
  'sarahinvestor',
  'investor',
  'Sarah',
  'Investor',
  'Capital Ventures',
  'Angel investor focused on entertainment and media startups.',
  'https://capitalventures.com',
  'https://linkedin.com/in/sarahinvestor',
  'https://twitter.com/sarahinvestor',
  NOW(),
  NOW(),
  true,
  true,
  true,
  true,
  false
);

-- Insert demo production account
INSERT INTO users (
  email,
  password,
  username,
  user_type,
  first_name,
  last_name,
  company_name,
  bio,
  website,
  linkedin,
  twitter,
  created_at,
  updated_at,
  is_verified,
  is_active,
  terms_accepted,
  privacy_accepted,
  two_factor_enabled
) VALUES (
  'stellar.production@demo.com',
  '$2b$10$rQYX9O.dXTJ8vH9vH8vH8eeW6eW6eW6eW6eW6eW6eW6eW6eW6eW6e', -- Demo123!
  'stellarproduction',
  'production',
  'Stellar',
  'Production',
  'Stellar Productions Inc',
  'Full-service production company specializing in feature films and series.',
  'https://stellarproductions.com',
  'https://linkedin.com/in/stellarproduction',
  'https://twitter.com/stellarprod',
  NOW(),
  NOW(),
  true,
  true,
  true,
  true,
  false
);

-- Verify the accounts were created
SELECT 
  id,
  email,
  username,
  user_type,
  first_name,
  last_name,
  company_name,
  is_verified,
  is_active
FROM users 
WHERE email IN (
  'alex.creator@demo.com',
  'sarah.investor@demo.com', 
  'stellar.production@demo.com'
)
ORDER BY user_type;