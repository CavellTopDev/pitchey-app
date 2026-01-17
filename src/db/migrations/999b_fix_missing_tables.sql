-- =====================================================
-- FIX MISSING TABLES AND COLUMNS
-- =====================================================
-- Date: January 2026
-- Purpose: Create missing tables that weren't created
-- =====================================================

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

-- ===== ADD MISSING COLUMNS TO VIEWS TABLE =====
ALTER TABLE views ADD COLUMN IF NOT EXISTS viewer_id INTEGER;
ALTER TABLE views ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_views_viewer ON views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_views_session ON views(session_id);

-- ===== ADD MISSING COLUMNS TO NDA_REQUESTS TABLE =====
ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS pitch_owner_id INTEGER;

-- ===== ADD MISSING COLUMNS TO MESSAGES TABLE =====
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ===== ADD MISSING COLUMNS TO REQUEST_LOGS TABLE =====
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS path TEXT;

-- ===== ADD MISSING COLUMNS TO ERROR_LOGS TABLE =====
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false;

-- ===== CREATE FUNCTIONS =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

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

-- Create notification count trigger
DROP TRIGGER IF EXISTS trigger_update_notification_count ON notifications;
CREATE TRIGGER trigger_update_notification_count
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_user_notification_count();

-- ===== VERIFICATION =====
DO $$
DECLARE
    table_name TEXT;
    table_count INTEGER;
    required_tables TEXT[] := ARRAY[
        'portfolio', 'file_uploads', 'audit_logs', 'websocket_sessions'
    ];
BEGIN
    FOREACH table_name IN ARRAY required_tables
    LOOP
        SELECT COUNT(*) INTO table_count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND information_schema.tables.table_name = table_name;

        IF table_count = 0 THEN
            RAISE WARNING 'Table % is still missing!', table_name;
        ELSE
            RAISE NOTICE '✓ Table % exists', table_name;
        END IF;
    END LOOP;
END $$;
