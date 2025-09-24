-- Migration: Add analytics, investments, notifications, and production tables
-- Version: 003
-- Date: 2024

-- 1. Analytics Events Table (for tracking views, likes, shares)
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- 'view', 'like', 'share', 'comment'
  metadata JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics performance
CREATE INDEX idx_analytics_pitch_id ON analytics_events(pitch_id);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX idx_analytics_pitch_event ON analytics_events(pitch_id, event_type);

-- 2. Investments Table
CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  percentage DECIMAL(5,2) CHECK (percentage >= 0 AND percentage <= 100),
  investment_type VARCHAR(50) DEFAULT 'equity', -- 'equity', 'debt', 'revenue_share'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
  terms JSONB DEFAULT '{}',
  invested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(investor_id, pitch_id)
);

-- Indexes for investments
CREATE INDEX idx_investments_investor ON investments(investor_id);
CREATE INDEX idx_investments_pitch ON investments(pitch_id);
CREATE INDEX idx_investments_status ON investments(status);

-- 3. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'message', 'investment', 'follow', 'pitch_update', 'nda_request'
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  related_id INTEGER, -- Can reference pitch_id, user_id, etc based on type
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- 4. Productions Table
CREATE TABLE IF NOT EXISTS productions (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  producer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  budget DECIMAL(12,2) CHECK (budget >= 0),
  spent DECIMAL(12,2) DEFAULT 0 CHECK (spent >= 0),
  crew_size INTEGER DEFAULT 0 CHECK (crew_size >= 0),
  status VARCHAR(50) DEFAULT 'pre_production', -- 'pre_production', 'production', 'post_production', 'completed', 'cancelled'
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  location VARCHAR(255),
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for productions
CREATE INDEX idx_productions_pitch ON productions(pitch_id);
CREATE INDEX idx_productions_producer ON productions(producer_id);
CREATE INDEX idx_productions_status ON productions(status);

-- 5. Pitch Ratings Table
CREATE TABLE IF NOT EXISTS pitch_ratings (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pitch_id, user_id)
);

-- Indexes for ratings
CREATE INDEX idx_ratings_pitch ON pitch_ratings(pitch_id);
CREATE INDEX idx_ratings_user ON pitch_ratings(user_id);
CREATE INDEX idx_ratings_rating ON pitch_ratings(rating);

-- 6. Pitch Likes Table (separate from analytics for quick counts)
CREATE TABLE IF NOT EXISTS pitch_likes (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pitch_id, user_id)
);

-- Indexes for likes
CREATE INDEX idx_likes_pitch ON pitch_likes(pitch_id);
CREATE INDEX idx_likes_user ON pitch_likes(user_id);

-- 7. Update pitches table to add calculated fields
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_average DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS investment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS investment_total DECIMAL(12,2) DEFAULT 0;

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_productions_updated_at BEFORE UPDATE ON productions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pitch_ratings_updated_at BEFORE UPDATE ON pitch_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update pitch statistics
CREATE OR REPLACE FUNCTION update_pitch_stats(pitch_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE pitches SET
        view_count = (SELECT COUNT(*) FROM analytics_events WHERE pitch_id = pitch_id_param AND event_type = 'view'),
        like_count = (SELECT COUNT(*) FROM pitch_likes WHERE pitch_id = pitch_id_param),
        rating_average = COALESCE((SELECT AVG(rating) FROM pitch_ratings WHERE pitch_id = pitch_id_param), 0),
        rating_count = (SELECT COUNT(*) FROM pitch_ratings WHERE pitch_id = pitch_id_param),
        investment_count = (SELECT COUNT(*) FROM investments WHERE pitch_id = pitch_id_param AND status = 'active'),
        investment_total = COALESCE((SELECT SUM(amount) FROM investments WHERE pitch_id = pitch_id_param AND status = 'active'), 0)
    WHERE id = pitch_id_param;
END;
$$ LANGUAGE plpgsql;