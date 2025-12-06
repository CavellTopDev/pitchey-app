-- Create saved_pitches table if it doesn't exist
CREATE TABLE IF NOT EXISTS saved_pitches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pitch_id)
);

-- Create pitch_views table if it doesn't exist
CREATE TABLE IF NOT EXISTS pitch_views (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(50),
  session_id VARCHAR(100)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_pitches_user_id ON saved_pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_pitch_id ON saved_pitches(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_views_pitch_id ON pitch_views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_views_viewed_at ON pitch_views(viewed_at);