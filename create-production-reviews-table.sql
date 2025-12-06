-- Create production_reviews table if it doesn't exist
CREATE TABLE IF NOT EXISTS production_reviews (
  id SERIAL PRIMARY KEY,
  production_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'Reviewing',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  meeting_requested BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(production_id, pitch_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_production_reviews_production_id ON production_reviews(production_id);
CREATE INDEX IF NOT EXISTS idx_production_reviews_pitch_id ON production_reviews(pitch_id);
CREATE INDEX IF NOT EXISTS idx_production_reviews_status ON production_reviews(status);