-- Calendar events table for user scheduling
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'custom',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location VARCHAR(255),
  description TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing table (idempotent)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS color VARCHAR(10) DEFAULT '#8b5cf6';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_cal_events_user_start ON calendar_events(user_id, start_date);
