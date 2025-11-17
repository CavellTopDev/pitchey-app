-- Add missing columns to support investor dashboard functionality

-- Add credits_balance to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 100;

-- Add subscription_expires_at to users table  
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;

-- Add roi_percentage to investments table
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS roi_percentage NUMERIC(5,2) DEFAULT 0;

-- Update existing users with default subscription expiry (30 days from now)
UPDATE users 
SET subscription_expires_at = NOW() + INTERVAL '30 days'
WHERE subscription_expires_at IS NULL;

-- Give demo users some initial credits
UPDATE users 
SET credits_balance = 500
WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com');

-- Add some sample investments for testing
INSERT INTO investments (investor_id, pitch_id, amount, status, roi_percentage, created_at)
SELECT 
    2 as investor_id,  -- Sarah investor
    1 as pitch_id,     -- The Last Sunset
    50000 as amount,
    'active' as status,
    15.5 as roi_percentage,
    NOW() - INTERVAL '30 days' as created_at
WHERE NOT EXISTS (
    SELECT 1 FROM investments 
    WHERE investor_id = 2 AND pitch_id = 1
);

INSERT INTO investments (investor_id, pitch_id, amount, status, roi_percentage, created_at)
SELECT 
    2 as investor_id,  -- Sarah investor
    2 as pitch_id,     -- Quantum Dreams
    75000 as amount,
    'active' as status,
    22.3 as roi_percentage,
    NOW() - INTERVAL '15 days' as created_at
WHERE NOT EXISTS (
    SELECT 1 FROM investments 
    WHERE investor_id = 2 AND pitch_id = 2
);