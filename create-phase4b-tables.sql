-- Phase 4B: Advanced Platform Features Database Tables

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('card', 'bank', 'paypal', 'crypto')),
    provider TEXT NOT NULL, -- 'stripe', 'paypal', etc.
    provider_id TEXT UNIQUE NOT NULL, -- external ID
    last_four TEXT,
    brand TEXT,
    expires_at DATE,
    is_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
    related_entity_type TEXT, -- 'pitch', 'subscription', 'investment', etc.
    related_entity_id INTEGER,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    payment_intent_id TEXT UNIQUE,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    fees DECIMAL(10,2) DEFAULT 0.00,
    net_amount DECIMAL(12,2),
    processed_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
    plan_id TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid', 'incomplete')),
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    amount_due DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
    due_date TIMESTAMP,
    paid_at TIMESTAMP,
    invoice_pdf_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Media files table (enhanced)
CREATE TABLE IF NOT EXISTS media_files (
    id SERIAL PRIMARY KEY,
    uploader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT UNIQUE NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_provider TEXT DEFAULT 'local' CHECK (storage_provider IN ('local', 'r2', 's3', 'cdn')),
    storage_path TEXT NOT NULL,
    public_url TEXT,
    cdn_url TEXT,
    thumbnail_url TEXT,
    preview_url TEXT,
    duration INTEGER, -- for video/audio files
    dimensions JSONB, -- width, height for images/videos
    transcoding_status TEXT DEFAULT 'pending' CHECK (transcoding_status IN ('pending', 'processing', 'completed', 'failed')),
    transcoded_urls JSONB DEFAULT '{}', -- different quality versions
    subtitle_files JSONB DEFAULT '[]',
    watermark_applied BOOLEAN DEFAULT FALSE,
    compression_level TEXT DEFAULT 'medium' CHECK (compression_level IN ('low', 'medium', 'high')),
    is_processed BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Media streaming analytics
CREATE TABLE IF NOT EXISTS media_analytics (
    id SERIAL PRIMARY KEY,
    media_file_id INTEGER REFERENCES media_files(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'play', 'pause', 'seek', 'complete', 'download')),
    timestamp_seconds INTEGER, -- position in media when event occurred
    duration_seconds INTEGER, -- how long they watched/listened
    quality TEXT, -- video quality chosen
    device_info JSONB DEFAULT '{}',
    location JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- CDN cache control
CREATE TABLE IF NOT EXISTS cdn_cache (
    id SERIAL PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    content_type TEXT NOT NULL,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_hit TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Business analytics tables
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    event_name TEXT NOT NULL,
    event_category TEXT,
    event_properties JSONB DEFAULT '{}',
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    location JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- User engagement metrics
CREATE TABLE IF NOT EXISTS user_engagement (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    session_count INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    actions_taken INTEGER DEFAULT 0,
    pitches_viewed INTEGER DEFAULT 0,
    pitches_created INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    logins INTEGER DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Conversion funnels
CREATE TABLE IF NOT EXISTS conversion_funnels (
    id SERIAL PRIMARY KEY,
    funnel_name TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    step_name TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    step_data JSONB DEFAULT '{}',
    completed_at TIMESTAMP DEFAULT NOW()
);

-- Revenue analytics
CREATE TABLE IF NOT EXISTS revenue_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    revenue_type TEXT NOT NULL CHECK (revenue_type IN ('subscription', 'transaction', 'commission', 'fee')),
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    user_count INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    average_transaction DECIMAL(10,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(date, revenue_type)
);

-- Geographic analytics
CREATE TABLE IF NOT EXISTS geographic_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    country_code TEXT NOT NULL,
    country_name TEXT,
    region TEXT,
    city TEXT,
    user_count INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(date, country_code, region, city)
);

-- Cohort analysis
CREATE TABLE IF NOT EXISTS cohort_data (
    id SERIAL PRIMARY KEY,
    cohort_date DATE NOT NULL, -- when users signed up
    period_number INTEGER NOT NULL, -- 1st week, 2nd week, etc.
    period_type TEXT DEFAULT 'week' CHECK (period_type IN ('day', 'week', 'month')),
    users_count INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    retention_rate DECIMAL(5,2) DEFAULT 0.00,
    revenue DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(cohort_date, period_number, period_type)
);

-- Performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit TEXT, -- 'ms', 'bytes', 'count', etc.
    endpoint TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    server_region TEXT,
    response_time DECIMAL(10,3),
    memory_usage BIGINT,
    cpu_usage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced users table for analytics
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_visit TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP,
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_page_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_time_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_source TEXT,
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS browser TEXT,
ADD COLUMN IF NOT EXISTS os TEXT,
ADD COLUMN IF NOT EXISTS location_data JSONB DEFAULT '{}';

-- Enhanced pitches table for media and payments
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS access_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS media_file_ids INTEGER[],
ADD COLUMN IF NOT EXISTS streaming_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS watermark_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS view_analytics JSONB DEFAULT '{}';

-- Create indexes for performance
-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period ON subscriptions(current_period_end);

-- Media indexes
CREATE INDEX IF NOT EXISTS idx_media_files_uploader ON media_files(uploader_id);
CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(file_type);
CREATE INDEX IF NOT EXISTS idx_media_files_status ON media_files(transcoding_status);
CREATE INDEX IF NOT EXISTS idx_media_analytics_file ON media_analytics(media_file_id);
CREATE INDEX IF NOT EXISTS idx_media_analytics_user ON media_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_media_analytics_created ON media_analytics(created_at DESC);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_engagement_user ON user_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_date ON user_engagement(date DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_funnels_user ON conversion_funnels(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_funnels_session ON conversion_funnels(session_id);
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_date ON revenue_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_geographic_analytics_date ON geographic_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_cohort_data_cohort ON cohort_data(cohort_date);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created ON performance_metrics(created_at DESC);

-- CDN cache indexes
CREATE INDEX IF NOT EXISTS idx_cdn_cache_expires ON cdn_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cdn_cache_hit_count ON cdn_cache(hit_count DESC);

-- Insert sample data
INSERT INTO payment_methods (user_id, type, provider, provider_id, last_four, brand, is_default)
VALUES 
    (1, 'card', 'stripe', 'card_1234567890', '4242', 'visa', true),
    (2, 'card', 'stripe', 'card_0987654321', '0000', 'mastercard', true)
ON CONFLICT (provider_id) DO NOTHING;

INSERT INTO analytics_events (user_id, event_name, event_category, event_properties)
VALUES 
    (1, 'page_view', 'navigation', '{"page": "/dashboard", "load_time": 1.2}'),
    (1, 'pitch_created', 'content', '{"pitch_id": 1, "genre": "action"}'),
    (2, 'pitch_viewed', 'engagement', '{"pitch_id": 1, "view_duration": 45}'),
    (2, 'message_sent', 'communication', '{"recipient_id": 1, "message_length": 120}')
ON CONFLICT DO NOTHING;

INSERT INTO user_engagement (user_id, date, session_count, page_views, time_spent_seconds)
VALUES 
    (1, CURRENT_DATE, 3, 15, 1800),
    (1, CURRENT_DATE - INTERVAL '1 day', 2, 8, 900),
    (2, CURRENT_DATE, 1, 12, 1200),
    (2, CURRENT_DATE - INTERVAL '1 day', 4, 20, 2400)
ON CONFLICT (user_id, date) DO UPDATE SET
    session_count = EXCLUDED.session_count,
    page_views = EXCLUDED.page_views,
    time_spent_seconds = EXCLUDED.time_spent_seconds;

INSERT INTO revenue_analytics (date, revenue_type, amount, user_count, transaction_count, average_transaction)
VALUES 
    (CURRENT_DATE, 'subscription', 1500.00, 25, 25, 60.00),
    (CURRENT_DATE, 'transaction', 850.00, 12, 17, 50.00),
    (CURRENT_DATE - INTERVAL '1 day', 'subscription', 1200.00, 20, 20, 60.00),
    (CURRENT_DATE - INTERVAL '1 day', 'transaction', 750.00, 15, 18, 41.67)
ON CONFLICT (date, revenue_type) DO UPDATE SET
    amount = EXCLUDED.amount,
    user_count = EXCLUDED.user_count,
    transaction_count = EXCLUDED.transaction_count,
    average_transaction = EXCLUDED.average_transaction;