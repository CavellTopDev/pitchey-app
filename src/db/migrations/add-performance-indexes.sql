-- Performance Optimization Indexes for Pitchey Database
-- Run this migration to improve query performance

-- ============================================
-- User Authentication Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Session management
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_reset_token UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ============================================
-- Pitch Performance Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pitches_creator_id ON pitches(creator_id);
CREATE INDEX IF NOT EXISTS idx_pitches_status ON pitches(status);
CREATE INDEX IF NOT EXISTS idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_genre ON pitches(genre);
CREATE INDEX IF NOT EXISTS idx_pitches_visibility ON pitches(visibility);
CREATE INDEX IF NOT EXISTS idx_pitches_status_created ON pitches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_genre_status ON pitches(genre, status);

-- Full text search on pitch content
CREATE INDEX IF NOT EXISTS idx_pitches_title_gin ON pitches USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_pitches_logline_gin ON pitches USING gin(to_tsvector('english', logline));

-- ============================================
-- NDA Management Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ndas_user_id ON ndas(user_id);
CREATE INDEX IF NOT EXISTS idx_ndas_pitch_id ON ndas(pitch_id);
CREATE INDEX IF NOT EXISTS idx_ndas_status ON ndas(status);
CREATE INDEX IF NOT EXISTS idx_ndas_created_at ON ndas(created_at DESC);
-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_ndas_user_pitch_status ON ndas(user_id, pitch_id, status);

-- ============================================
-- Investment Tracking Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_pitch_id ON investments(pitch_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_created_at ON investments(created_at DESC);
-- Composite for dashboard queries
CREATE INDEX IF NOT EXISTS idx_investments_investor_status ON investments(investor_id, status);

-- ============================================
-- Follow Relationships
-- ============================================
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at DESC);
-- Ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique_pair ON follows(follower_id, following_id);

-- ============================================
-- Team Management
-- ============================================
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON teams(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
-- Composite for permission checks
CREATE INDEX IF NOT EXISTS idx_team_members_team_user ON team_members(team_id, user_id);

-- ============================================
-- Invitations
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);
-- Composite for lookup
CREATE INDEX IF NOT EXISTS idx_invitations_email_status ON invitations(email, status);

-- ============================================
-- Notifications
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
-- Composite for unread notifications query
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, read, created_at DESC);

-- ============================================
-- Analytics and Events
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
-- Composite for user activity queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_type_created ON analytics_events(user_id, event_type, created_at DESC);

-- ============================================
-- Error Logging
-- ============================================
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint ON error_logs(endpoint);

-- ============================================
-- Request Performance Logging
-- ============================================
CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_time INTEGER, -- in milliseconds
    status_code INTEGER,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_response_time ON request_logs(response_time);
-- Composite for performance analysis
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint_created ON request_logs(endpoint, created_at DESC);

-- ============================================
-- Message/Chat Indexes (if applicable)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);
-- Composite for conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at DESC);

-- ============================================
-- Clean up old data (maintenance)
-- ============================================
-- Delete expired password reset tokens
DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '7 days';

-- Delete old error logs (keep 30 days)
DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days';

-- Delete old request logs (keep 7 days)
DELETE FROM request_logs WHERE created_at < NOW() - INTERVAL '7 days';

-- ============================================
-- Analyze tables for query planner
-- ============================================
ANALYZE users;
ANALYZE pitches;
ANALYZE ndas;
ANALYZE investments;
ANALYZE follows;
ANALYZE teams;
ANALYZE team_members;
ANALYZE invitations;
ANALYZE notifications;
ANALYZE sessions;