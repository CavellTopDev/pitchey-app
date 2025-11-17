-- Phase 4A: Essential Missing Features Database Tables

-- Security events table for audit logging
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    event_details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    success BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pitch versions table for version control
CREATE TABLE IF NOT EXISTS pitch_versions (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    changes_summary TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pitch_id, version_number)
);

-- Pitch templates table
CREATE TABLE IF NOT EXISTS pitch_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_content JSONB NOT NULL,
    category TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    device_info JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Two-factor authentication table
CREATE TABLE IF NOT EXISTS user_2fa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    secret_key TEXT NOT NULL,
    backup_codes JSONB DEFAULT '[]',
    is_enabled BOOLEAN DEFAULT FALSE,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced users table columns (add missing fields)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP;

-- Enhanced pitches table columns
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES pitch_templates(id),
ADD COLUMN IF NOT EXISTS publish_scheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS social_media_image TEXT;

-- NDA request workflow table (enhance existing nda_requests)
CREATE TABLE IF NOT EXISTS nda_request_workflow (
    id SERIAL PRIMARY KEY,
    nda_request_id INTEGER REFERENCES nda_requests(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMP,
    auto_approved BOOLEAN DEFAULT FALSE,
    expiry_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Legal compliance tracking
CREATE TABLE IF NOT EXISTS legal_compliance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    compliance_type TEXT NOT NULL CHECK (compliance_type IN ('gdpr', 'ccpa', 'coppa', 'terms', 'privacy')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'compliant', 'non_compliant', 'reviewing')),
    last_check TIMESTAMP,
    next_check TIMESTAMP,
    compliance_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Terms and privacy acceptance tracking
CREATE TABLE IF NOT EXISTS legal_acceptances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('terms_of_service', 'privacy_policy', 'cookie_policy')),
    document_version TEXT NOT NULL,
    accepted_at TIMESTAMP DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- Password history for security
CREATE TABLE IF NOT EXISTS password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pitch_versions_pitch ON pitch_versions(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_versions_created ON pitch_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pitch_templates_category ON pitch_templates(category);
CREATE INDEX IF NOT EXISTS idx_pitch_templates_public ON pitch_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_pitch_templates_usage ON pitch_templates(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_users_email_verification ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

CREATE INDEX IF NOT EXISTS idx_nda_request_workflow_request ON nda_request_workflow(nda_request_id);
CREATE INDEX IF NOT EXISTS idx_nda_request_workflow_status ON nda_request_workflow(status);
CREATE INDEX IF NOT EXISTS idx_nda_request_workflow_reviewer ON nda_request_workflow(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_legal_compliance_user ON legal_compliance(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_compliance_type ON legal_compliance(compliance_type);
CREATE INDEX IF NOT EXISTS idx_legal_compliance_status ON legal_compliance(status);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_type ON legal_acceptances(document_type);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created ON password_history(created_at DESC);

-- Insert sample pitch templates
INSERT INTO pitch_templates (name, description, template_content, category, is_public, created_by)
VALUES 
    (
        'Feature Film Template', 
        'Standard template for feature film pitches',
        '{
            "title": "",
            "logline": "",
            "genre": "",
            "format": "feature",
            "shortSynopsis": "",
            "targetAudience": "",
            "estimatedBudget": null,
            "characters": {},
            "themes": {},
            "structure": {
                "act1": "",
                "act2": "",
                "act3": ""
            }
        }',
        'film',
        true,
        1
    ),
    (
        'TV Series Template',
        'Template for television series pitches', 
        '{
            "title": "",
            "logline": "",
            "genre": "",
            "format": "series",
            "shortSynopsis": "",
            "targetAudience": "",
            "episodeBreakdown": "",
            "characters": {},
            "themes": {},
            "seasonArc": "",
            "episodeStructure": ""
        }',
        'television',
        true,
        1
    ),
    (
        'Documentary Template',
        'Template for documentary pitches',
        '{
            "title": "",
            "logline": "",
            "genre": "documentary",
            "format": "feature",
            "shortSynopsis": "",
            "targetAudience": "",
            "approach": "",
            "subjects": {},
            "themes": {},
            "visualStyle": "",
            "distribution": ""
        }',
        'documentary', 
        true,
        1
    )
ON CONFLICT DO NOTHING;

-- Insert sample security events
INSERT INTO security_events (user_id, event_type, event_details, ip_address)
VALUES 
    (1, 'login_success', '{"user_agent": "Mozilla/5.0", "location": "US"}', '192.168.1.1'),
    (1, 'password_changed', '{"strength": "strong"}', '192.168.1.1'),
    (2, 'login_success', '{"user_agent": "Chrome/91.0", "location": "UK"}', '10.0.0.1'),
    (2, '2fa_enabled', '{}', '10.0.0.1')
ON CONFLICT DO NOTHING;

-- Insert sample legal acceptances
INSERT INTO legal_acceptances (user_id, document_type, document_version, ip_address)
VALUES 
    (1, 'terms_of_service', 'v2.1', '192.168.1.1'),
    (1, 'privacy_policy', 'v1.5', '192.168.1.1'),
    (2, 'terms_of_service', 'v2.1', '10.0.0.1'),
    (2, 'privacy_policy', 'v1.5', '10.0.0.1')
ON CONFLICT DO NOTHING;