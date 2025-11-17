-- Phase 4C: Enterprise & AI Features Database Tables

-- AI analysis results table
CREATE TABLE IF NOT EXISTS ai_analyses (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('pitch', 'user', 'message', 'document')),
    entity_id INTEGER NOT NULL,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('sentiment', 'risk', 'recommendation', 'fraud', 'content')),
    results JSONB NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    model_version TEXT DEFAULT 'v1.0',
    processing_time INTEGER, -- milliseconds
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Video call sessions
CREATE TABLE IF NOT EXISTS video_calls (
    id SERIAL PRIMARY KEY,
    call_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    host_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    room_url TEXT NOT NULL,
    join_token TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
    participants JSONB DEFAULT '[]',
    recording_enabled BOOLEAN DEFAULT FALSE,
    recording_url TEXT,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    max_participants INTEGER DEFAULT 10,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
    id SERIAL PRIMARY KEY,
    room_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    room_type TEXT DEFAULT 'private' CHECK (room_type IN ('private', 'public', 'group')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    participants JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    max_participants INTEGER DEFAULT 50,
    moderation_enabled BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Voice notes
CREATE TABLE IF NOT EXISTS voice_notes (
    id SERIAL PRIMARY KEY,
    note_id TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER,
    file_url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    transcription TEXT,
    file_size BIGINT NOT NULL,
    format TEXT DEFAULT 'mp3',
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Email campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    template_id INTEGER,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_audience JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    recipient_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    bounce_count INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- SMS notifications
CREATE TABLE IF NOT EXISTS sms_notifications (
    id SERIAL PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    message_content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    provider TEXT DEFAULT 'twilio',
    provider_message_id TEXT,
    cost_cents INTEGER,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Featured content management
CREATE TABLE IF NOT EXISTS featured_content (
    id SERIAL PRIMARY KEY,
    content_type TEXT NOT NULL CHECK (content_type IN ('pitch', 'user', 'article', 'video')),
    content_id INTEGER NOT NULL,
    featured_type TEXT DEFAULT 'homepage' CHECK (featured_type IN ('homepage', 'category', 'trending', 'editor_choice')),
    priority INTEGER DEFAULT 0,
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic categories
CREATE TABLE IF NOT EXISTS dynamic_categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_category_id INTEGER REFERENCES dynamic_categories(id) ON DELETE SET NULL,
    icon_url TEXT,
    banner_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Promotional campaigns
CREATE TABLE IF NOT EXISTS promotional_campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    campaign_type TEXT CHECK (campaign_type IN ('discount', 'featured', 'boost', 'premium')),
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(12,2),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    eligible_users JSONB DEFAULT '{}',
    conditions JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Auction system
CREATE TABLE IF NOT EXISTS auctions (
    id SERIAL PRIMARY KEY,
    auction_id TEXT UNIQUE NOT NULL,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    starting_price DECIMAL(12,2) NOT NULL,
    current_price DECIMAL(12,2),
    reserve_price DECIMAL(12,2),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'ended', 'cancelled')),
    winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    bid_count INTEGER DEFAULT 0,
    auction_type TEXT DEFAULT 'english' CHECK (auction_type IN ('english', 'dutch', 'sealed_bid')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Auction bids
CREATE TABLE IF NOT EXISTS auction_bids (
    id SERIAL PRIMARY KEY,
    auction_id INTEGER REFERENCES auctions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bid_amount DECIMAL(12,2) NOT NULL,
    bid_time TIMESTAMP DEFAULT NOW(),
    is_winning BOOLEAN DEFAULT FALSE,
    bid_type TEXT DEFAULT 'standard' CHECK (bid_type IN ('standard', 'auto', 'proxy')),
    max_bid_amount DECIMAL(12,2), -- for proxy bidding
    is_valid BOOLEAN DEFAULT TRUE
);

-- Enterprise SSO configurations
CREATE TABLE IF NOT EXISTS sso_configurations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    provider TEXT NOT NULL CHECK (provider IN ('saml', 'oauth2', 'ldap', 'azure_ad', 'google_workspace')),
    provider_settings JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    default_role TEXT DEFAULT 'user',
    attribute_mapping JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enterprise audit trails
CREATE TABLE IF NOT EXISTS audit_trails (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    organization_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Custom branding configurations
CREATE TABLE IF NOT EXISTS custom_branding (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    branding_name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    font_family TEXT DEFAULT 'Inter',
    custom_css TEXT,
    favicon_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- LDAP group mappings
CREATE TABLE IF NOT EXISTS ldap_groups (
    id SERIAL PRIMARY KEY,
    group_dn TEXT UNIQUE NOT NULL,
    group_name TEXT NOT NULL,
    mapped_role TEXT NOT NULL,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced users table for enterprise features
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS organization_id INTEGER,
ADD COLUMN IF NOT EXISTS sso_provider TEXT,
ADD COLUMN IF NOT EXISTS sso_user_id TEXT,
ADD COLUMN IF NOT EXISTS employee_id TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS compliance_flags JSONB DEFAULT '{}';

-- Enhanced pitches table for AI and enterprise features
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS ai_analysis_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_recommendations JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS risk_assessment JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS marketplace_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auction_eligible BOOLEAN DEFAULT FALSE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_analyses_entity ON ai_analyses(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_type ON ai_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_created ON ai_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_calls_host ON video_calls(host_user_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);
CREATE INDEX IF NOT EXISTS idx_video_calls_scheduled ON video_calls(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON chat_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_active ON chat_rooms(is_active);

CREATE INDEX IF NOT EXISTS idx_voice_notes_user ON voice_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_conversation ON voice_notes(conversation_id);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_by ON email_campaigns(created_by);

CREATE INDEX IF NOT EXISTS idx_sms_notifications_user ON sms_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_status ON sms_notifications(status);

CREATE INDEX IF NOT EXISTS idx_featured_content_type ON featured_content(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_featured_content_active ON featured_content(is_active);

CREATE INDEX IF NOT EXISTS idx_dynamic_categories_parent ON dynamic_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_categories_active ON dynamic_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_auctions_pitch ON auctions(pitch_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);

CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_user ON auction_bids(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_winning ON auction_bids(is_winning);

CREATE INDEX IF NOT EXISTS idx_sso_configurations_org ON sso_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_sso_configurations_active ON sso_configurations(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_trails_user ON audit_trails(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_action ON audit_trails(action);
CREATE INDEX IF NOT EXISTS idx_audit_trails_created ON audit_trails(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_branding_org ON custom_branding(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_branding_active ON custom_branding(is_active);

-- Insert sample data for Phase 4C features
INSERT INTO dynamic_categories (name, slug, description, is_active, sort_order)
VALUES 
    ('Artificial Intelligence', 'ai', 'AI and machine learning projects', true, 1),
    ('Blockchain & Crypto', 'blockchain', 'Cryptocurrency and blockchain ventures', true, 2),
    ('Healthcare Technology', 'healthtech', 'Medical and healthcare innovations', true, 3),
    ('Sustainable Technology', 'sustainability', 'Green and sustainable tech solutions', true, 4),
    ('Enterprise Software', 'enterprise', 'B2B and enterprise solutions', true, 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ai_analyses (entity_type, entity_id, analysis_type, results, confidence_score, model_version)
VALUES 
    ('pitch', 1, 'sentiment', '{"overall": "positive", "score": 0.84, "emotions": {"excitement": 0.72, "confidence": 0.68}}', 0.84, 'v2.1'),
    ('pitch', 2, 'risk', '{"overall_risk": "medium", "score": 6.2, "factors": {"market": 5.8, "team": 3.2, "financial": 7.8}}', 0.78, 'v2.1'),
    ('user', 1, 'recommendation', '{"recommended_pitches": [2, 3, 5], "match_scores": [0.92, 0.87, 0.81]}', 0.89, 'v2.1')
ON CONFLICT DO NOTHING;

INSERT INTO featured_content (content_type, content_id, featured_type, priority, start_date, end_date)
VALUES 
    ('pitch', 1, 'homepage', 1, NOW(), NOW() + INTERVAL '30 days'),
    ('pitch', 2, 'trending', 2, NOW(), NOW() + INTERVAL '7 days'),
    ('user', 1, 'editor_choice', 1, NOW(), NOW() + INTERVAL '14 days')
ON CONFLICT DO NOTHING;

INSERT INTO promotional_campaigns (name, campaign_type, discount_percentage, start_date, end_date, usage_limit)
VALUES 
    ('Early Bird Special', 'discount', 25.00, NOW(), NOW() + INTERVAL '30 days', 100),
    ('Holiday Promotion', 'featured', NULL, NOW(), NOW() + INTERVAL '14 days', 50)
ON CONFLICT DO NOTHING;