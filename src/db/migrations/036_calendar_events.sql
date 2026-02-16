-- Calendar events: add missing columns to existing table
-- Table already exists with start_date/end_date/attendees(jsonb) schema
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS color VARCHAR(10) DEFAULT '#8b5cf6';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_cal_events_user_start ON calendar_events(user_id, start_date);
