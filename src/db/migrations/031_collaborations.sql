-- Collaborations table for creator collaboration requests
CREATE TABLE IF NOT EXISTS collaborations (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collaborator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
  role VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, collaborator_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborations_requester ON collaborations(requester_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_collaborator ON collaborations(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_pitch ON collaborations(pitch_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_status ON collaborations(status);
