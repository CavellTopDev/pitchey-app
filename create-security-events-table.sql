-- Create security_events table for rate limiting and security tracking
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    path VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    user_agent TEXT,
    request_body TEXT,
    response_time INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_security_events_ip ON security_events(ip_address);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_created ON security_events(created_at);
CREATE INDEX idx_security_events_type ON security_events(event_type);

-- Add comment
COMMENT ON TABLE security_events IS 'Tracks security events including rate limiting, failed auth attempts, and suspicious activity';