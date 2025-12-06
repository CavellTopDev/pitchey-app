-- Create investment_interests table for tracking investor interest in pitches
CREATE TABLE IF NOT EXISTS investment_interests (
  id SERIAL PRIMARY KEY,
  investor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
  interest_level VARCHAR(50) DEFAULT 'interested', -- 'interested', 'highly_interested', 'following'
  message TEXT,
  amount_range VARCHAR(50), -- e.g., '10K-50K', '50K-100K', '100K-500K', '500K+'
  investment_type VARCHAR(50), -- 'equity', 'debt', 'revenue_share', 'hybrid'
  timeline VARCHAR(50), -- 'immediate', '1-3_months', '3-6_months', '6-12_months'
  expressed_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(investor_id, pitch_id) -- Prevent duplicate interests
);

-- Create index for faster queries
CREATE INDEX idx_investment_interests_pitch ON investment_interests(pitch_id);
CREATE INDEX idx_investment_interests_investor ON investment_interests(investor_id);
CREATE INDEX idx_investment_interests_expressed ON investment_interests(expressed_at DESC);

-- Add the table to the schema exports
COMMENT ON TABLE investment_interests IS 'Tracks investor interest expressions for pitches before formal investment';