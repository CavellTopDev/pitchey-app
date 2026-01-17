-- =====================================================
-- CONSOLIDATED DATABASE SCHEMA FOR PITCHEY PLATFORM
-- =====================================================
-- Date: January 2026
-- Purpose: Ensure all required tables exist in production
-- Target: Neon PostgreSQL
-- Note: All statements use IF NOT EXISTS for idempotency
-- =====================================================

-- ===== ENABLE EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table (should already exist via Better Auth)
-- Adding missing columns if needed
DO $$
BEGIN
    -- Add missing columns to users if they exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_count INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_notification_read TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_type VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
    END IF;
END $$;

-- ===== FOLLOWS TABLE =====
CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created ON follows(created_at DESC);

-- ===== NOTIFICATIONS TABLE =====
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    related_id INTEGER,
    related_type VARCHAR(50),
    action_url TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ===== NOTIFICATION PREFERENCES TABLE =====
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    types JSONB DEFAULT '{}',
    digest_frequency VARCHAR(20) DEFAULT 'daily',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ===== SAVED PITCHES TABLE =====
CREATE TABLE IF NOT EXISTS saved_pitches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    pitch_id INTEGER NOT NULL,
    notes TEXT,
    tags TEXT[],
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_pitches_user ON saved_pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_pitch ON saved_pitches(pitch_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_saved ON saved_pitches(saved_at DESC);

-- ===== LIKES TABLE =====
CREATE TABLE IF NOT EXISTS likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    pitch_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_pitch ON likes(pitch_id);
CREATE INDEX IF NOT EXISTS idx_likes_created ON likes(created_at DESC);

-- ===== VIEWS TABLE =====
CREATE TABLE IF NOT EXISTS views (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL,
    viewer_id INTEGER,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    session_id VARCHAR(255),
    duration_seconds INTEGER,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    country VARCHAR(2),
    city VARCHAR(100),
    device_type VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_views_pitch ON views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_views_viewer ON views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_views_date ON views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_views_session ON views(session_id);

-- ===== ANALYTICS EVENTS TABLE =====
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50),
    event_action VARCHAR(100),
    event_label VARCHAR(255),
    event_value INTEGER,
    properties JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    page_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_category ON analytics_events(event_category);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);

-- ===== NDA REQUESTS TABLE =====
CREATE TABLE IF NOT EXISTS nda_requests (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL,
    pitch_id INTEGER NOT NULL,
    pitch_owner_id INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    message TEXT,
    response_message TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_nda_requests_requester ON nda_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_nda_requests_pitch ON nda_requests(pitch_id);
CREATE INDEX IF NOT EXISTS idx_nda_requests_owner ON nda_requests(pitch_owner_id);
CREATE INDEX IF NOT EXISTS idx_nda_requests_status ON nda_requests(status);
CREATE INDEX IF NOT EXISTS idx_nda_requests_created ON nda_requests(created_at DESC);

-- ===== PORTFOLIO TABLE =====
CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL,
    pitch_id INTEGER NOT NULL,
    investment_amount DECIMAL(15, 2),
    equity_percentage DECIMAL(5, 2),
    investment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    documents JSONB DEFAULT '[]',
    returns DECIMAL(15, 2),
    last_valuation DECIMAL(15, 2),
    last_valuation_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(investor_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_investor ON portfolio(investor_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_pitch ON portfolio(pitch_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_status ON portfolio(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_date ON portfolio(investment_date DESC);

-- ===== INVESTMENTS TABLE =====
CREATE TABLE IF NOT EXISTS investments (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL,
    pitch_id INTEGER NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    investment_type VARCHAR(50) DEFAULT 'equity',
    equity_percentage DECIMAL(5, 2),
    terms JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    contract_url TEXT,
    notes TEXT,
    approved_by INTEGER,
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(investor_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_investments_investor ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_pitch ON investments(pitch_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_created ON investments(created_at DESC);

-- ===== MESSAGES TABLE =====
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER,
    pitch_id INTEGER,
    thread_id INTEGER,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'direct',
    attachments JSONB DEFAULT '[]',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    deleted_by_sender BOOLEAN DEFAULT false,
    deleted_by_recipient BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_pitch ON messages(pitch_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, is_read) WHERE is_read = false;

-- ===== REQUEST LOGS TABLE =====
CREATE TABLE IF NOT EXISTS request_logs (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(100),
    method VARCHAR(10),
    path TEXT,
    status_code INTEGER,
    duration_ms INTEGER,
    user_id INTEGER,
    ip_address INET,
    user_agent TEXT,
    request_headers JSONB,
    response_size INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_logs_request_id ON request_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_user ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);
CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs(created_at DESC);

-- ===== ERROR LOGS TABLE =====
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,
    request_id VARCHAR(100),
    user_id INTEGER,
    path TEXT,
    method VARCHAR(10),
    request_body JSONB,
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'error',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_request ON error_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);

-- ===== FILE UPLOADS TABLE =====
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    pitch_id INTEGER,
    file_key VARCHAR(500) NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    file_url TEXT,
    thumbnail_url TEXT,
    checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    virus_scan_status VARCHAR(50) DEFAULT 'pending',
    is_public BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_user ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_pitch ON file_uploads(pitch_id);
CREATE INDEX IF NOT EXISTS idx_uploads_category ON file_uploads(category);
CREATE INDEX IF NOT EXISTS idx_uploads_key ON file_uploads(file_key);
CREATE INDEX IF NOT EXISTS idx_uploads_uploaded ON file_uploads(uploaded_at DESC);

-- ===== USER SETTINGS TABLE =====
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    theme VARCHAR(20) DEFAULT 'auto',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    notification_settings JSONB DEFAULT '{"email": true, "sms": false, "push": true, "inApp": true}',
    privacy_settings JSONB DEFAULT '{"profileVisibility": "public", "showEmail": false, "showPhone": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ===== AUDIT LOGS TABLE =====
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ===== WEBSOCKET SESSIONS TABLE =====
CREATE TABLE IF NOT EXISTS websocket_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    room_id VARCHAR(255) NOT NULL,
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE,
    last_ping_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ws_sessions_user ON websocket_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ws_sessions_room ON websocket_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_ws_sessions_active ON websocket_sessions(disconnected_at) WHERE disconnected_at IS NULL;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update notification count
CREATE OR REPLACE FUNCTION update_user_notification_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users
        SET notification_count = COALESCE(notification_count, 0) + 1
        WHERE id = NEW.user_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.is_read = true AND OLD.is_read = false THEN
            UPDATE users
            SET notification_count = GREATEST(COALESCE(notification_count, 0) - 1, 0),
                last_notification_read = NOW()
            WHERE id = NEW.user_id;
        ELSIF NEW.is_read = false AND OLD.is_read = true THEN
            UPDATE users
            SET notification_count = COALESCE(notification_count, 0) + 1
            WHERE id = NEW.user_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_read = false THEN
            UPDATE users
            SET notification_count = GREATEST(COALESCE(notification_count, 0) - 1, 0)
            WHERE id = OLD.user_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Create notification count trigger
DROP TRIGGER IF EXISTS trigger_update_notification_count ON notifications;
CREATE TRIGGER trigger_update_notification_count
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_user_notification_count();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
    table_name TEXT;
    table_count INTEGER;
    required_tables TEXT[] := ARRAY[
        'follows', 'notifications', 'notification_preferences',
        'saved_pitches', 'likes', 'views', 'analytics_events',
        'nda_requests', 'portfolio', 'investments', 'messages',
        'request_logs', 'error_logs', 'file_uploads',
        'user_settings', 'audit_logs', 'websocket_sessions'
    ];
    missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
    FOREACH table_name IN ARRAY required_tables
    LOOP
        SELECT COUNT(*) INTO table_count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND information_schema.tables.table_name = table_name;

        IF table_count = 0 THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE WARNING 'Some tables may not have been created: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✓ All required tables verified successfully!';
    END IF;
END $$;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'CONSOLIDATED SCHEMA MIGRATION COMPLETED';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE '=====================================================';
END $$;
