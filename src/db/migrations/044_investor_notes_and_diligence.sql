-- Migration 044: Investor Notes & Due Diligence
-- Persists investor notes and diligence checklists per pitch that were previously stored in localStorage
-- These are per-pitch, per-investor records

-- Investor notes (strength, concern, question, general)
CREATE TABLE IF NOT EXISTS investor_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category VARCHAR(20) NOT NULL DEFAULT 'general'
    CHECK (category IN ('strength', 'concern', 'question', 'general')),
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_notes_user_pitch ON investor_notes(user_id, pitch_id);

-- Investor due diligence checklist (per pitch, per user)
CREATE TABLE IF NOT EXISTS investor_diligence_checklists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pitch_id)
);
