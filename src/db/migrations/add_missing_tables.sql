-- =====================================================
-- Pitchey Production Database Schema Migration
-- Add Missing Tables for Full Functionality
-- =====================================================

-- Date: January 5, 2026
-- Purpose: Fix missing tables identified in production logs
-- Target: Neon PostgreSQL production database

-- ===== LIKES TABLE =====
-- For pitch like/dislike functionality
CREATE TABLE IF NOT EXISTS likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    pitch_id INTEGER NOT NULL,
    like_type VARCHAR(10) DEFAULT 'like' CHECK (like_type IN ('like', 'dislike')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE,
    UNIQUE(user_id, pitch_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_pitch_id ON likes(pitch_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at);

-- ===== REQUEST_LOGS TABLE =====
-- For API request monitoring and performance tracking
CREATE TABLE IF NOT EXISTS request_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_time INTEGER NOT NULL, -- in milliseconds
    status_code INTEGER NOT NULL,
    ip_address VARCHAR(45), -- IPv6 compatible
    user_agent TEXT,
    referer VARCHAR(255),
    query_params JSONB,
    request_size INTEGER DEFAULT 0,
    response_size INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance and monitoring
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_code ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_response_time ON request_logs(response_time);

-- ===== ERROR_LOGS TABLE =====
-- For comprehensive error tracking and debugging
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    error_type VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    request_id VARCHAR(36), -- UUID for request correlation
    session_id VARCHAR(64),
    environment VARCHAR(20) DEFAULT 'production',
    severity VARCHAR(10) DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warn', 'error', 'fatal')),
    metadata JSONB, -- Additional context data
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for error analysis and monitoring
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_status_code ON error_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved_at) WHERE resolved_at IS NULL;

-- ===== VIEWS TABLE =====
-- For pitch view tracking and analytics
CREATE TABLE IF NOT EXISTS views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    pitch_id INTEGER NOT NULL,
    view_type VARCHAR(20) DEFAULT 'page_view' CHECK (view_type IN ('page_view', 'video_view', 'document_view')),
    duration_seconds INTEGER DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referer VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_views_user_id ON views(user_id);
CREATE INDEX IF NOT EXISTS idx_views_pitch_id ON views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_views_created_at ON views(created_at);
CREATE INDEX IF NOT EXISTS idx_views_view_type ON views(view_type);

-- ===== SESSIONS TABLE =====
-- Enhanced sessions table for Better Auth compatibility
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for session management
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ===== ACCOUNTS TABLE =====
-- For Better Auth social login and OAuth
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, account_id)
);

-- Index for account lookups
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider);

-- ===== UPDATE EXISTING TABLES =====
-- Add missing columns to existing tables if they don't exist

-- Users table enhancements
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Pitches table enhancements  
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

-- ===== UPDATE FUNCTIONS =====
-- Function to update pitch counters automatically
CREATE OR REPLACE FUNCTION update_pitch_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'likes' THEN
            IF NEW.like_type = 'like' THEN
                UPDATE pitches SET like_count = like_count + 1 WHERE id = NEW.pitch_id;
            ELSE
                UPDATE pitches SET dislike_count = dislike_count + 1 WHERE id = NEW.pitch_id;
            END IF;
        ELSIF TG_TABLE_NAME = 'views' THEN
            UPDATE pitches SET view_count = view_count + 1 WHERE id = NEW.pitch_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'likes' THEN
            IF OLD.like_type = 'like' THEN
                UPDATE pitches SET like_count = like_count - 1 WHERE id = OLD.pitch_id;
            ELSE
                UPDATE pitches SET dislike_count = dislike_count - 1 WHERE id = OLD.pitch_id;
            END IF;
        ELSIF TG_TABLE_NAME = 'views' THEN
            UPDATE pitches SET view_count = view_count - 1 WHERE id = OLD.pitch_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic counter updates
DROP TRIGGER IF EXISTS trigger_update_pitch_likes ON likes;
CREATE TRIGGER trigger_update_pitch_likes
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_pitch_counters();

DROP TRIGGER IF EXISTS trigger_update_pitch_views ON views;
CREATE TRIGGER trigger_update_pitch_views
    AFTER INSERT OR DELETE ON views
    FOR EACH ROW EXECUTE FUNCTION update_pitch_counters();

-- ===== VERIFICATION =====
-- Verify all tables exist
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
BEGIN
    -- Check required tables
    FOR table_name IN 
        SELECT unnest(ARRAY['likes', 'request_logs', 'error_logs', 'views', 'sessions', 'accounts'])
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = table_name
        ) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All required tables created successfully';
    END IF;
END $$;

-- ===== COMPLETION =====
-- Log migration completion
INSERT INTO request_logs (user_id, endpoint, method, response_time, status_code, ip_address) 
VALUES (NULL, '/migration/add_missing_tables', 'MIGRATE', 0, 200, '127.0.0.1')
ON CONFLICT DO NOTHING;

-- Show table counts for verification
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows
FROM pg_stat_user_tables 
WHERE tablename IN ('likes', 'request_logs', 'error_logs', 'views', 'sessions', 'accounts', 'users', 'pitches')
ORDER BY tablename;