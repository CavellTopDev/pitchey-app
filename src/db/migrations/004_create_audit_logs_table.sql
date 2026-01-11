-- Migration: Create audit_logs table for comprehensive audit trail
-- Date: 2025-01-10
-- Description: Creates audit logging table for NDA activities and security events

-- Create enum for risk levels
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  
  -- User and session tracking
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(100),
  
  -- Event identification
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL, -- 'nda', 'security', 'auth', 'admin', 'data'
  risk_level risk_level NOT NULL DEFAULT 'low',
  
  -- Event details
  description TEXT NOT NULL,
  entity_type VARCHAR(50), -- 'nda', 'user', 'pitch', 'template'
  entity_id INTEGER,
  
  -- Technical context
  ip_address VARCHAR(45), -- IPv6 support
  user_agent TEXT,
  location JSONB, -- Store location data as JSON
  
  -- Change tracking
  changes JSONB, -- Array of change objects
  
  -- Additional metadata
  metadata JSONB, -- Flexible metadata storage
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_event_category ON audit_logs(event_category);
CREATE INDEX idx_audit_logs_risk_level ON audit_logs(risk_level);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id);

-- Create composite index for common queries
CREATE INDEX idx_audit_logs_user_category_timestamp ON audit_logs(user_id, event_category, timestamp DESC);
CREATE INDEX idx_audit_logs_risk_timestamp ON audit_logs(risk_level, timestamp DESC);

-- Create partial index for high-risk events (for faster queries on critical events)
CREATE INDEX idx_audit_logs_high_risk ON audit_logs(timestamp DESC) 
WHERE risk_level IN ('high', 'critical');

-- Create partial index for NDA events
CREATE INDEX idx_audit_logs_nda_events ON audit_logs(entity_id, timestamp DESC)
WHERE event_category = 'nda';

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system activities, especially NDA-related actions and security events';
COMMENT ON COLUMN audit_logs.event_type IS 'Specific type of event (e.g., nda_signed, nda_approved, unauthorized_access)';
COMMENT ON COLUMN audit_logs.event_category IS 'High-level category for grouping events';
COMMENT ON COLUMN audit_logs.risk_level IS 'Risk level of the event for security monitoring';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity the event relates to';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID of the specific entity affected';
COMMENT ON COLUMN audit_logs.changes IS 'JSON array of field changes with old and new values';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional event-specific data stored as JSON';
COMMENT ON COLUMN audit_logs.location IS 'Geographic location data (country, city, region)';

-- Grant appropriate permissions
-- Note: Adjust these based on your user roles
GRANT SELECT, INSERT ON audit_logs TO pitchey_app;
GRANT USAGE ON SEQUENCE audit_logs_id_seq TO pitchey_app;

-- Optional: Create a view for common audit queries
CREATE VIEW audit_logs_summary AS
SELECT 
  al.id,
  al.user_id,
  u.username,
  u.email,
  al.event_type,
  al.event_category,
  al.risk_level,
  al.description,
  al.entity_type,
  al.entity_id,
  al.ip_address,
  al.timestamp
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.timestamp DESC;

COMMENT ON VIEW audit_logs_summary IS 'Simplified view of audit logs with user information for easier querying';

-- Create a function to automatically clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs 
  WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '1 day' * retention_days;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Function to clean up audit logs older than specified retention period';

-- Example usage:
-- SELECT cleanup_old_audit_logs(365); -- Delete logs older than 1 year
-- SELECT cleanup_old_audit_logs(90);  -- Delete logs older than 3 months