-- Add missing tables for critical endpoints

-- 1. Reviews table (for production pitch reviews)
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) CHECK (status IN ('approved', 'rejected', 'pending', 'needs_revision')),
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pitch_id, reviewer_id)
);

-- 2. Calendar Events table (for production calendar)
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  type VARCHAR(50) CHECK (type IN ('meeting', 'deadline', 'screening', 'production', 'review', 'other')),
  related_pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
  location VARCHAR(255),
  attendees JSONB DEFAULT '[]',
  reminder_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Saved Pitches table (for creators and investors)
CREATE TABLE IF NOT EXISTS saved_pitches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pitch_id)
);

-- 4. Investment Documents table
CREATE TABLE IF NOT EXISTS investment_documents (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER REFERENCES investments(id) ON DELETE CASCADE,
  document_name VARCHAR(255) NOT NULL,
  document_url TEXT,
  document_type VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- 5. Investment Timeline Events
CREATE TABLE IF NOT EXISTS investment_timeline (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER REFERENCES investments(id) ON DELETE CASCADE,
  event_type VARCHAR(50),
  event_description TEXT,
  event_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_pitch_id ON reviews(pitch_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_user_id ON saved_pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_pitch_id ON saved_pitches(pitch_id);

-- Add missing columns to existing tables if they don't exist
ALTER TABLE investments ADD COLUMN IF NOT EXISTS current_value DECIMAL(10,2);
ALTER TABLE investments ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Grant permissions
GRANT ALL ON reviews TO postgres;
GRANT ALL ON calendar_events TO postgres;
GRANT ALL ON saved_pitches TO postgres;
GRANT ALL ON investment_documents TO postgres;
GRANT ALL ON investment_timeline TO postgres;