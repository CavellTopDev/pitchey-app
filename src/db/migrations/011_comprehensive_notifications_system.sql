-- Comprehensive Notifications System Migration
-- This creates all tables needed for the multi-channel notification system

-- Notification templates for reusable message formats
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- 'email', 'push', 'in_app', 'sms'
    category VARCHAR(50) NOT NULL, -- 'investment', 'project', 'system', 'analytics', 'market'
    subject_template TEXT,
    body_template TEXT NOT NULL,
    html_template TEXT, -- for email notifications
    variables JSONB DEFAULT '{}', -- expected template variables
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    
    -- Category-specific preferences
    investment_alerts JSONB DEFAULT '{"email": true, "push": true, "in_app": true, "sms": false}',
    project_updates JSONB DEFAULT '{"email": true, "push": true, "in_app": true, "sms": false}',
    system_alerts JSONB DEFAULT '{"email": true, "push": false, "in_app": true, "sms": false}',
    analytics_alerts JSONB DEFAULT '{"email": false, "push": false, "in_app": true, "sms": false}',
    market_intelligence JSONB DEFAULT '{"email": true, "push": false, "in_app": true, "sms": false}',
    
    -- Frequency preferences
    digest_frequency VARCHAR(20) DEFAULT 'daily', -- 'instant', 'daily', 'weekly', 'monthly'
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Push notification subscriptions (for browser/mobile push)
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);

-- Core notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES notification_templates(id),
    
    -- Notification content
    type VARCHAR(50) NOT NULL, -- 'email', 'push', 'in_app', 'sms'
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    html_content TEXT, -- for rich content
    
    -- Context and metadata
    context_type VARCHAR(50), -- 'pitch', 'nda', 'investment', 'user', 'system'
    context_id UUID, -- ID of related entity
    action_url TEXT, -- URL for notification action
    action_text VARCHAR(100), -- CTA button text
    
    -- Delivery tracking
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'read'
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Grouping and batching
    batch_id UUID, -- for grouping related notifications
    digest_id UUID, -- for digest notifications
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification digest tracking
CREATE TABLE notification_digests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    digest_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    notification_count INTEGER NOT NULL DEFAULT 0,
    html_content TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email unsubscribe tokens for one-click unsubscribe
CREATE TABLE email_unsubscribe_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50), -- specific category to unsubscribe from, NULL for all
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification analytics for tracking performance
CREATE TABLE notification_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Analytics events
    event_type VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed'
    event_data JSONB DEFAULT '{}',
    user_agent TEXT,
    ip_address INET,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- A/B testing for notification optimization
CREATE TABLE notification_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    template_a_id UUID NOT NULL REFERENCES notification_templates(id),
    template_b_id UUID NOT NULL REFERENCES notification_templates(id),
    traffic_split DECIMAL(3,2) DEFAULT 0.50, -- percentage for variant A
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'completed'
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_context ON notifications(context_type, context_id);
CREATE INDEX idx_notifications_batch_id ON notifications(batch_id);
CREATE INDEX idx_notifications_priority ON notifications(priority);

CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active);

CREATE INDEX idx_notification_analytics_notification_id ON notification_analytics(notification_id);
CREATE INDEX idx_notification_analytics_user_id ON notification_analytics(user_id);
CREATE INDEX idx_notification_analytics_event_type ON notification_analytics(event_type);
CREATE INDEX idx_notification_analytics_created_at ON notification_analytics(created_at);

CREATE INDEX idx_email_unsubscribe_tokens_token ON email_unsubscribe_tokens(token);
CREATE INDEX idx_email_unsubscribe_tokens_user_id ON email_unsubscribe_tokens(user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences);