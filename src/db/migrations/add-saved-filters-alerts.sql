-- Migration: Add saved filters and email alerts
-- Created: 2025-10-23

-- Table for saved filter presets
CREATE TABLE IF NOT EXISTS saved_filters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    filters JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_is_default ON saved_filters(is_default);

-- Table for email alert subscriptions
CREATE TABLE IF NOT EXISTS email_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}',
    frequency VARCHAR(50) NOT NULL DEFAULT 'daily', -- 'immediate', 'daily', 'weekly'
    is_active BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    matches_found INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups and job processing
CREATE INDEX IF NOT EXISTS idx_email_alerts_user_id ON email_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_alerts_is_active ON email_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_email_alerts_frequency ON email_alerts(frequency);
CREATE INDEX IF NOT EXISTS idx_email_alerts_last_sent ON email_alerts(last_sent_at);

-- Table to track which pitches have been sent in alerts
CREATE TABLE IF NOT EXISTS alert_sent_pitches (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES email_alerts(id) ON DELETE CASCADE,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alert_id, pitch_id)
);

-- Index for tracking
CREATE INDEX IF NOT EXISTS idx_alert_sent_alert_id ON alert_sent_pitches(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_sent_pitch_id ON alert_sent_pitches(pitch_id);

-- Add columns to track filter usage analytics
ALTER TABLE users ADD COLUMN IF NOT EXISTS filter_preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_preferences JSONB DEFAULT '{"email_alerts": true, "frequency": "daily"}';

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_saved_filters_updated_at ON saved_filters;
CREATE TRIGGER update_saved_filters_updated_at
    BEFORE UPDATE ON saved_filters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_alerts_updated_at ON email_alerts;
CREATE TRIGGER update_email_alerts_updated_at
    BEFORE UPDATE ON email_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();