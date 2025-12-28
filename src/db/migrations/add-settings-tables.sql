-- User Settings Tables for Settings Management
-- This migration adds support for user preferences and settings

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification settings
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  pitch_views BOOLEAN DEFAULT true,
  new_messages BOOLEAN DEFAULT true,
  project_updates BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT false,
  marketing_emails BOOLEAN DEFAULT false,
  
  -- Privacy settings
  profile_visibility VARCHAR(50) DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'network')),
  show_email BOOLEAN DEFAULT false,
  show_phone BOOLEAN DEFAULT false,
  allow_direct_messages BOOLEAN DEFAULT true,
  allow_pitch_requests BOOLEAN DEFAULT true,
  
  -- Security settings
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  session_timeout INTEGER DEFAULT 30,
  login_notifications BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Session log table for security tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(50),
  user_agent TEXT,
  device_type VARCHAR(50),
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW(),
  expired_at TIMESTAMP
);

-- Account actions log
CREATE TABLE IF NOT EXISTS account_actions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created ON user_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_actions_user ON account_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_actions_created ON account_actions(created_at DESC);

-- Helper function to update updated_at
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating updated_at
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- Grant permissions
GRANT ALL ON user_settings TO PUBLIC;
GRANT ALL ON user_sessions TO PUBLIC;
GRANT ALL ON account_actions TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;