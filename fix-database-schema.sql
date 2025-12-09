-- Database Schema Fix for Quick Actions API Endpoints
-- Run this against your Neon PostgreSQL database

-- 1. Add missing columns to users table for billing/subscription
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;

-- 2. Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  thread_id INTEGER,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- 3. Add deadline column to pitches table for calendar functionality
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS deadline TIMESTAMP;

-- 4. Ensure NDA requests table has all required columns
CREATE TABLE IF NOT EXISTS nda_requests (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id),
  expiry_date TIMESTAMP,
  document_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_nda_status ON nda_requests(status);
CREATE INDEX IF NOT EXISTS idx_nda_pitch ON nda_requests(pitch_id);
CREATE INDEX IF NOT EXISTS idx_nda_user ON nda_requests(user_id);

-- 5. Create pitch_views table if it doesn't exist
CREATE TABLE IF NOT EXISTS pitch_views (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_views_pitch ON pitch_views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_views_user ON pitch_views(user_id);
CREATE INDEX IF NOT EXISTS idx_views_date ON pitch_views(viewed_at);

-- 6. Create investment_interests table if it doesn't exist
CREATE TABLE IF NOT EXISTS investment_interests (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2),
  status VARCHAR(50) DEFAULT 'active',
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interests_pitch ON investment_interests(pitch_id);
CREATE INDEX IF NOT EXISTS idx_interests_investor ON investment_interests(investor_id);

-- 7. Add missing columns to pitches table
ALTER TABLE pitches
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS downloads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0;

-- 8. Create follows table if it doesn't exist
CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- 9. Update some test data for demo accounts
UPDATE users 
SET credits = 100, 
    subscription_tier = 'pro', 
    subscription_status = 'active',
    subscription_end_date = CURRENT_TIMESTAMP + INTERVAL '30 days'
WHERE email = 'alex.creator@demo.com';

-- 10. Add some sample messages for testing
INSERT INTO messages (sender_id, receiver_id, subject, content) 
SELECT 
  (SELECT id FROM users WHERE email = 'sarah.investor@demo.com'),
  (SELECT id FROM users WHERE email = 'alex.creator@demo.com'),
  'Interest in Cosmic Odyssey',
  'Hi Alex, I am very interested in your Cosmic Odyssey pitch. Can we schedule a call?'
WHERE NOT EXISTS (
  SELECT 1 FROM messages WHERE subject = 'Interest in Cosmic Odyssey'
);

-- 11. Add sample NDA requests
INSERT INTO nda_requests (pitch_id, user_id, status, requested_at)
SELECT 
  p.id,
  (SELECT id FROM users WHERE email = 'sarah.investor@demo.com'),
  'pending',
  CURRENT_TIMESTAMP
FROM pitches p
WHERE p.title = 'Cosmic Odyssey'
  AND NOT EXISTS (
    SELECT 1 FROM nda_requests n 
    WHERE n.pitch_id = p.id 
    AND n.user_id = (SELECT id FROM users WHERE email = 'sarah.investor@demo.com')
  );

-- 12. Update pitch statistics
UPDATE pitches p
SET 
  views = COALESCE((SELECT COUNT(*) FROM pitch_views WHERE pitch_id = p.id), 0) + FLOOR(RANDOM() * 100),
  likes = FLOOR(RANDOM() * 50) + 10,
  comments = FLOOR(RANDOM() * 20) + 5,
  rating = 3.5 + (RANDOM() * 1.5)
WHERE p.status = 'published';

-- Display summary
SELECT 
  'Database schema updated successfully!' as status;
