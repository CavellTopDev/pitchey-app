-- Authentication Sessions table for security tracking
-- Renamed to avoid conflict with existing user_sessions analytics table

-- Auth sessions log table for security tracking
CREATE TABLE IF NOT EXISTS auth_sessions (
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

-- Indexes for auth sessions
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_created ON auth_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_last_activity ON auth_sessions(last_activity DESC);

-- Grant permissions
GRANT ALL ON auth_sessions TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;