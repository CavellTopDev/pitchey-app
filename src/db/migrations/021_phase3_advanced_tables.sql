-- Phase 3: Advanced Features Database Schema
-- Media access, search, and transactions tables

-- ======= MEDIA ACCESS TABLES =======

-- Media files table
CREATE TABLE IF NOT EXISTS media_files (
    id SERIAL PRIMARY KEY,
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'document', -- document, image, video, audio, other
    is_public BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP,
    metadata JSONB, -- {dimensions, duration, pages, etc}
    uploaded_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Media permissions
CREATE TABLE IF NOT EXISTS media_permissions (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    permission_type VARCHAR(50) DEFAULT 'view', -- view, download, edit, delete
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(media_id, user_id, permission_type),
    CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

-- Media access logs
CREATE TABLE IF NOT EXISTS media_access_logs (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- view, download, share
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT NOW()
);

-- ======= SEARCH AND FILTER TABLES =======

-- Search history
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    filters JSONB,
    result_count INTEGER DEFAULT 0,
    clicked_results JSONB, -- [{id, type, position}]
    search_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Saved searches
CREATE TABLE IF NOT EXISTS saved_searches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    query TEXT,
    filters JSONB,
    alert_enabled BOOLEAN DEFAULT FALSE,
    alert_frequency VARCHAR(50) DEFAULT 'daily', -- instant, daily, weekly
    last_alerted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Search alerts (for saved searches)
CREATE TABLE IF NOT EXISTS search_alerts (
    id SERIAL PRIMARY KEY,
    search_id INTEGER NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
    new_results INTEGER DEFAULT 0,
    results JSONB, -- Array of new matching items
    sent_at TIMESTAMP DEFAULT NOW()
);

-- Pitch views (for tracking popular content)
CREATE TABLE IF NOT EXISTS pitch_views (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    ip_address INET,
    referrer TEXT,
    duration_seconds INTEGER,
    viewed_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_pitch_views_pitch (pitch_id, viewed_at DESC),
    INDEX idx_pitch_views_user (user_id)
);

-- ======= TRANSACTION TABLES =======

-- Main transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- payment, refund, withdrawal, deposit, transfer
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled, refunded
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
    investment_id INTEGER REFERENCES investments(id) ON DELETE SET NULL,
    payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
    parent_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    processor VARCHAR(50), -- stripe, paypal, bank_transfer
    processor_transaction_id VARCHAR(255),
    processor_response JSONB,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    INDEX idx_transactions_user (user_id, created_at DESC),
    INDEX idx_transactions_status (status, created_at DESC),
    INDEX idx_transactions_investment (investment_id)
);

-- Payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- card, bank_account, paypal, crypto
    provider VARCHAR(50), -- stripe, paypal, plaid
    provider_method_id VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    card_brand VARCHAR(50), -- visa, mastercard, amex
    card_last4 VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    bank_name VARCHAR(255),
    bank_last4 VARCHAR(4),
    paypal_email VARCHAR(255),
    crypto_address TEXT,
    crypto_type VARCHAR(50), -- bitcoin, ethereum, usdc
    metadata JSONB,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_payment_methods_user (user_id)
);

-- Transaction fees
CREATE TABLE IF NOT EXISTS transaction_fees (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    fee_type VARCHAR(50) NOT NULL, -- platform, processor, tax
    amount DECIMAL(10, 2) NOT NULL,
    percentage DECIMAL(5, 2),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======= ADDITIONAL TABLES =======

-- Companies table (if not exists)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    website VARCHAR(255),
    logo_url TEXT,
    type VARCHAR(50), -- production, investment, distribution
    founded_year INTEGER,
    employee_count VARCHAR(50),
    headquarters VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Teams table (for collaboration)
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- User company association
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id);

-- Tags for pitches
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS budget DECIMAL(12, 2);

-- ======= INDEXES FOR PHASE 3 =======

-- Media indexes
CREATE INDEX IF NOT EXISTS idx_media_files_uploader ON media_files(uploaded_by, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_files_pitch ON media_files(pitch_id) WHERE pitch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_files_public ON media_files(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_media_permissions_media ON media_permissions(media_id);
CREATE INDEX IF NOT EXISTS idx_media_permissions_user ON media_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_media_access_logs_media ON media_access_logs(media_id, accessed_at DESC);

-- Search indexes
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_alerts ON saved_searches(alert_enabled) WHERE alert_enabled = TRUE;

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_processor ON transactions(processor, processor_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = TRUE;

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_pitches_fulltext ON pitches 
USING gin(to_tsvector('english', title || ' ' || COALESCE(logline, '')));

CREATE INDEX IF NOT EXISTS idx_users_fulltext ON users 
USING gin(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(email, '')));

-- ======= SAMPLE DATA =======

-- Insert sample media files
INSERT INTO media_files (uploaded_by, pitch_id, file_name, file_size, mime_type, storage_path, category, is_public)
VALUES 
    (1, 1, 'pitch_deck.pdf', 2048000, 'application/pdf', 'uploads/1/pitch_deck.pdf', 'document', FALSE),
    (1, 1, 'teaser_trailer.mp4', 50000000, 'video/mp4', 'uploads/1/teaser_trailer.mp4', 'video', TRUE),
    (2, 2, 'investment_terms.docx', 512000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'uploads/2/investment_terms.docx', 'document', FALSE)
ON CONFLICT DO NOTHING;

-- Insert sample transactions
INSERT INTO transactions (user_id, type, amount, currency, status, description)
VALUES 
    (2, 'payment', 10000.00, 'USD', 'completed', 'Investment in Echoes of Tomorrow'),
    (5, 'payment', 5000.00, 'USD', 'completed', 'Investment in Quantum Dreams'),
    (2, 'withdrawal', 2000.00, 'USD', 'pending', 'Profit withdrawal')
ON CONFLICT DO NOTHING;

-- Insert sample payment methods
INSERT INTO payment_methods (user_id, type, provider, card_brand, card_last4, is_default)
VALUES 
    (2, 'card', 'stripe', 'visa', '4242', TRUE),
    (5, 'card', 'stripe', 'mastercard', '5555', TRUE)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;