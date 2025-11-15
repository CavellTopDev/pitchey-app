-- Create demo accounts for testing with correct schema and bcrypt hash
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
  password_hash,
  username, 
  user_type,
  first_name,
  last_name,
  company_name,
  bio,
  company_website,
  created_at,
  updated_at,
  is_verified,
  is_active,
  two_factor_enabled,
  email_verified
) VALUES (
  'alex.creator@demo.com',
  '$2a$10$phjHRw2RSHsrPyNHE.YezuvPaTXrKci4PpoXBmsIg5i7YYpTKfPGe', -- Demo123!
  '$2a$10$phjHRw2RSHsrPyNHE.YezuvPaTXrKci4PpoXBmsIg5i7YYpTKfPGe', -- Demo123!
  'alexcreator',
  'creator',
  'Alex',
  'Creator',
  'Independent Films',
  'Passionate filmmaker with 10+ years of experience in independent cinema.',
  'https://alexcreatorfilms.com',
  NOW(),
  NOW(),
  true,
  true,
  false,
  true
);

-- Insert demo investor account  
INSERT INTO users (
  email,
  password,
  password_hash,
  username,
  user_type,
  first_name,
  last_name,
  company_name,
  bio,
  company_website,
  created_at,
  updated_at,
  is_verified,
  is_active,
  two_factor_enabled,
  email_verified
) VALUES (
  'sarah.investor@demo.com',
  '$2a$10$phjHRw2RSHsrPyNHE.YezuvPaTXrKci4PpoXBmsIg5i7YYpTKfPGe', -- Demo123!
  '$2a$10$phjHRw2RSHsrPyNHE.YezuvPaTXrKci4PpoXBmsIg5i7YYpTKfPGe', -- Demo123!
  'sarahinvestor',
  'investor',
  'Sarah',
  'Investor',
  'Capital Ventures',
  'Angel investor focused on entertainment and media startups.',
  'https://capitalventures.com',
  NOW(),
  NOW(),
  true,
  true,
  false,
  true
);

-- Insert demo production account
INSERT INTO users (
  email,
  password,
  password_hash,
  username,
  user_type,
  first_name,
  last_name,
  company_name,
  bio,
  company_website,
  created_at,
  updated_at,
  is_verified,
  is_active,
  two_factor_enabled,
  email_verified
) VALUES (
  'stellar.production@demo.com',
  '$2a$10$phjHRw2RSHsrPyNHE.YezuvPaTXrKci4PpoXBmsIg5i7YYpTKfPGe', -- Demo123!
  '$2a$10$phjHRw2RSHsrPyNHE.YezuvPaTXrKci4PpoXBmsIg5i7YYpTKfPGe', -- Demo123!
  'stellarproduction',
  'production',
  'Stellar',
  'Production',
  'Stellar Productions Inc',
  'Full-service production company specializing in feature films and series.',
  'https://stellarproductions.com',
  NOW(),
  NOW(),
  true,
  true,
  false,
  true
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
  is_active,
  email_verified
FROM users 
WHERE email IN (
  'alex.creator@demo.com',
  'sarah.investor@demo.com', 
  'stellar.production@demo.com'
)
ORDER BY user_type;