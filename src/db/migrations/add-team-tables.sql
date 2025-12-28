-- Team Management Tables for Creator Portal
-- This migration adds support for team collaboration features

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP,
  UNIQUE(team_id, user_id)
);

-- Team invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_email VARCHAR(255) NOT NULL,
  invited_by INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('editor', 'viewer')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  message TEXT,
  token VARCHAR(255) UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

-- Team-pitch associations (which pitches belong to which teams)
CREATE TABLE IF NOT EXISTS team_pitches (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  added_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, pitch_id)
);

-- Team activity log for audit trail
CREATE TABLE IF NOT EXISTS team_activity (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_pitches_team ON team_pitches(team_id);
CREATE INDEX IF NOT EXISTS idx_team_pitches_pitch ON team_pitches(pitch_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_team ON team_activity(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_user ON team_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_created ON team_activity(created_at DESC);

-- Helper functions
CREATE OR REPLACE FUNCTION update_team_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating updated_at
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_team_updated_at();

-- Function to check team membership
CREATE OR REPLACE FUNCTION is_team_member(p_user_id INTEGER, p_team_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members 
    WHERE user_id = p_user_id AND team_id = p_team_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check team ownership
CREATE OR REPLACE FUNCTION is_team_owner(p_user_id INTEGER, p_team_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams 
    WHERE id = p_team_id AND owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM team_members 
    WHERE user_id = p_user_id AND team_id = p_team_id AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust based on your database user)
GRANT ALL ON teams TO PUBLIC;
GRANT ALL ON team_members TO PUBLIC;
GRANT ALL ON team_invitations TO PUBLIC;
GRANT ALL ON team_pitches TO PUBLIC;
GRANT ALL ON team_activity TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;