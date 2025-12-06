-- Create comprehensive access control and permissions tables

-- Team management table
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Team members with roles
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, editor, viewer
  permissions JSONB DEFAULT '{}',
  invited_by INTEGER REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Pitch collaborators (for team collaboration on pitches)
CREATE TABLE IF NOT EXISTS pitch_collaborators (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer', -- owner, editor, commenter, viewer
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_share BOOLEAN DEFAULT false,
  can_manage_nda BOOLEAN DEFAULT false,
  invited_by INTEGER REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pitch_id, user_id),
  CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

-- Access logs for audit trail
CREATE TABLE IF NOT EXISTS access_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resource_type VARCHAR(50) NOT NULL, -- pitch, document, nda, etc.
  resource_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL, -- view, edit, delete, share, download, etc.
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permission templates for different roles
CREATE TABLE IF NOT EXISTS permission_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  user_type VARCHAR(50) NOT NULL, -- creator, investor, production
  permissions JSONB NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User custom permissions (overrides)
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER,
  permissions JSONB NOT NULL,
  granted_by INTEGER REFERENCES users(id),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_type, resource_id)
);

-- Invitation system for team/pitch collaboration
CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- team, pitch_collaboration
  inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email VARCHAR(255) NOT NULL,
  invitee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER NOT NULL,
  role VARCHAR(50),
  permissions JSONB DEFAULT '{}',
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_pitch_collaborators_pitch_id ON pitch_collaborators(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_collaborators_user_id ON pitch_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_collaborators_team_id ON pitch_collaborators(team_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_resource ON access_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_email ON invitations(invitee_email);

-- Insert default permission templates
INSERT INTO permission_templates (name, user_type, permissions, is_system) VALUES
('Creator Full Access', 'creator', '{
  "pitches": ["create", "read", "update", "delete", "share", "manage_nda"],
  "characters": ["create", "read", "update", "delete", "reorder"],
  "documents": ["upload", "read", "rename", "delete"],
  "collaborators": ["invite", "remove", "manage_permissions"],
  "analytics": ["view_own", "export"],
  "messages": ["send", "receive", "delete_own"]
}', true),

('Investor Standard', 'investor', '{
  "pitches": ["read", "save", "rate"],
  "nda": ["request", "sign", "view_signed"],
  "investments": ["create", "read_own", "update_own"],
  "documents": ["read_with_nda"],
  "messages": ["send", "receive"],
  "analytics": ["view_investment_metrics"]
}', true),

('Production Company Standard', 'production', '{
  "pitches": ["read", "save", "review", "rate"],
  "nda": ["request", "sign", "view_signed"],
  "projects": ["create", "manage"],
  "documents": ["read_with_nda", "request_additional"],
  "messages": ["send", "receive"],
  "analytics": ["view_production_metrics"],
  "contracts": ["initiate", "negotiate"]
}', true),

('Team Admin', 'creator', '{
  "team": ["manage_members", "manage_settings", "delete"],
  "pitches": ["create", "read", "update", "delete", "share"],
  "collaborators": ["invite", "remove", "manage_permissions"],
  "documents": ["upload", "read", "rename", "delete"],
  "billing": ["view", "manage"]
}', true),

('Team Editor', 'creator', '{
  "pitches": ["read", "update", "comment"],
  "characters": ["read", "update", "reorder"],
  "documents": ["upload", "read"],
  "messages": ["send", "receive"]
}', true),

('Team Viewer', 'creator', '{
  "pitches": ["read", "comment"],
  "documents": ["read"],
  "messages": ["receive"]
}', true)
ON CONFLICT (name) DO NOTHING;