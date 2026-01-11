-- Additional tables for Intelligent Notification System
-- These tables support smart batching, user profiling, and advanced analytics

-- User notification profiles for behavioral analysis
CREATE TABLE user_notification_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Behavioral metrics
    engagement_score INTEGER DEFAULT 50 CHECK (engagement_score >= 0 AND engagement_score <= 100),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    average_response_time INTEGER DEFAULT 120, -- minutes
    total_notifications_sent INTEGER DEFAULT 0,
    total_notifications_opened INTEGER DEFAULT 0,
    total_notifications_clicked INTEGER DEFAULT 0,
    
    -- User preferences
    frequency_preference VARCHAR(20) DEFAULT 'batched', -- 'immediate', 'batched', 'digest'
    channel_preference VARCHAR(20) DEFAULT 'in_app', -- 'email', 'push', 'in_app', 'sms'
    preferred_times TEXT[] DEFAULT ARRAY['09:00', '14:00', '18:00'],
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Category-specific data (JSON)
    category_data JSONB DEFAULT '{}', -- engagement and frequency per category
    
    -- Machine learning features
    ml_features JSONB DEFAULT '{}', -- Features for ML models
    last_ml_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Smart notification batches
CREATE TABLE notification_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Batch metadata
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    batch_size INTEGER DEFAULT 1,
    
    -- Batch content
    title VARCHAR(255),
    summary TEXT,
    combined_actions JSONB DEFAULT '[]', -- Array of actions from batched notifications
    
    -- Delivery tracking
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    
    -- Analytics
    estimated_engagement DECIMAL(3,2) DEFAULT 0.5,
    actual_engagement DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Map notifications to batches
CREATE TABLE notification_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES notification_batches(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, -- Order within batch
    weight DECIMAL(3,2) DEFAULT 1.0, -- Importance weight
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(batch_id, notification_id)
);

-- Push notification analytics (separate from main analytics for performance)
CREATE TABLE push_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    
    -- Event data
    event VARCHAR(20) NOT NULL, -- 'sent', 'delivered', 'clicked', 'dismissed', 'failed'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Device/browser information
    user_agent TEXT,
    device_type VARCHAR(20), -- 'desktop', 'mobile', 'tablet'
    browser VARCHAR(50),
    os VARCHAR(50),
    
    -- Error information
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Geolocation (if available)
    country VARCHAR(2),
    city VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification rules for intelligent processing
CREATE TABLE notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Rule configuration
    condition_type VARCHAR(50) NOT NULL, -- 'user_behavior', 'time_based', 'frequency', 'content', 'engagement'
    condition_operator VARCHAR(20) NOT NULL, -- 'equals', 'contains', 'greater_than', etc.
    condition_field VARCHAR(50) NOT NULL,
    condition_value JSONB NOT NULL,
    time_window INTEGER, -- minutes for time-based conditions
    
    -- Action configuration
    action_type VARCHAR(20) NOT NULL, -- 'send', 'delay', 'batch', 'upgrade_priority', 'suppress'
    action_config JSONB DEFAULT '{}', -- Additional action parameters
    
    -- Rule metadata
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    applies_to_categories TEXT[] DEFAULT ARRAY[]::TEXT[], -- Empty = all categories
    applies_to_user_types TEXT[] DEFAULT ARRAY[]::TEXT[], -- Empty = all user types
    
    -- Statistics
    times_triggered INTEGER DEFAULT 0,
    times_effective INTEGER DEFAULT 0, -- When rule actually changed behavior
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- A/B test assignments (for tracking which users get which variant)
CREATE TABLE notification_ab_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES notification_ab_tests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant VARCHAR(10) NOT NULL, -- 'A' or 'B'
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(test_id, user_id)
);

-- Notification delivery attempts (for retry logic)
CREATE TABLE notification_delivery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    attempt_number INTEGER NOT NULL,
    
    -- Attempt details
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'retry'
    error_code VARCHAR(50),
    error_message TEXT,
    provider_response JSONB,
    
    -- Retry configuration
    next_retry_at TIMESTAMP WITH TIME ZONE,
    retry_delay_minutes INTEGER,
    
    -- Performance metrics
    processing_time_ms INTEGER,
    queue_wait_time_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification performance metrics (aggregated data)
CREATE TABLE notification_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Grouping dimensions
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    category VARCHAR(50),
    channel VARCHAR(20),
    user_type VARCHAR(20),
    priority VARCHAR(20),
    
    -- Metrics
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    
    -- Calculated rates (stored for performance)
    delivery_rate DECIMAL(5,2) DEFAULT 0,
    open_rate DECIMAL(5,2) DEFAULT 0,
    click_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Timing metrics
    avg_delivery_time_ms INTEGER DEFAULT 0,
    avg_open_time_hours DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(date, hour, category, channel, user_type, priority)
);

-- User notification frequency tracking
CREATE TABLE user_notification_frequency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    
    -- Time windows
    last_notification_at TIMESTAMP WITH TIME ZONE,
    notifications_last_hour INTEGER DEFAULT 0,
    notifications_last_day INTEGER DEFAULT 0,
    notifications_last_week INTEGER DEFAULT 0,
    notifications_last_month INTEGER DEFAULT 0,
    
    -- Frequency limits (user-specific overrides)
    max_per_hour INTEGER DEFAULT 10,
    max_per_day INTEGER DEFAULT 50,
    max_per_week INTEGER DEFAULT 200,
    
    -- Reset timestamps
    hour_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    day_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    week_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    month_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, category)
);

-- Indexes for performance
CREATE INDEX idx_user_notification_profiles_user_id ON user_notification_profiles(user_id);
CREATE INDEX idx_user_notification_profiles_engagement ON user_notification_profiles(engagement_score);
CREATE INDEX idx_user_notification_profiles_last_active ON user_notification_profiles(last_active_at);

CREATE INDEX idx_notification_batches_user_id ON notification_batches(user_id);
CREATE INDEX idx_notification_batches_scheduled_time ON notification_batches(scheduled_time);
CREATE INDEX idx_notification_batches_status ON notification_batches(status);

CREATE INDEX idx_push_analytics_subscription_id ON push_analytics(subscription_id);
CREATE INDEX idx_push_analytics_timestamp ON push_analytics(timestamp);
CREATE INDEX idx_push_analytics_event ON push_analytics(event);

CREATE INDEX idx_notification_rules_active ON notification_rules(is_active);
CREATE INDEX idx_notification_rules_priority ON notification_rules(priority);
CREATE INDEX idx_notification_rules_condition_type ON notification_rules(condition_type);

CREATE INDEX idx_notification_ab_assignments_test_user ON notification_ab_assignments(test_id, user_id);
CREATE INDEX idx_notification_ab_assignments_variant ON notification_ab_assignments(variant);

CREATE INDEX idx_notification_delivery_attempts_notification_id ON notification_delivery_attempts(notification_id);
CREATE INDEX idx_notification_delivery_attempts_status ON notification_delivery_attempts(status);
CREATE INDEX idx_notification_delivery_attempts_next_retry ON notification_delivery_attempts(next_retry_at);

CREATE INDEX idx_notification_performance_date_hour ON notification_performance_metrics(date, hour);
CREATE INDEX idx_notification_performance_category ON notification_performance_metrics(category);
CREATE INDEX idx_notification_performance_channel ON notification_performance_metrics(channel);

CREATE INDEX idx_user_notification_frequency_user_category ON user_notification_frequency(user_id, category);
CREATE INDEX idx_user_notification_frequency_last_notification ON user_notification_frequency(last_notification_at);

-- Functions for automatic metric updates
CREATE OR REPLACE FUNCTION update_user_notification_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user profile stats when notification is read/clicked
    IF TG_OP = 'UPDATE' AND OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
        UPDATE user_notification_profiles
        SET 
            total_notifications_opened = total_notifications_opened + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.user_id;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.clicked_at IS NULL AND NEW.clicked_at IS NOT NULL THEN
        UPDATE user_notification_profiles
        SET 
            total_notifications_clicked = total_notifications_clicked + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_user_stats
    AFTER UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_user_notification_stats();

-- Function to update frequency tracking
CREATE OR REPLACE FUNCTION update_notification_frequency()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_notification_frequency (user_id, category, last_notification_at, notifications_last_hour, notifications_last_day, notifications_last_week, notifications_last_month)
    VALUES (NEW.user_id, NEW.category, NEW.created_at, 1, 1, 1, 1)
    ON CONFLICT (user_id, category) DO UPDATE SET
        last_notification_at = NEW.created_at,
        notifications_last_hour = CASE 
            WHEN EXTRACT(EPOCH FROM (NEW.created_at - user_notification_frequency.hour_reset_at)) > 3600 
            THEN 1 
            ELSE user_notification_frequency.notifications_last_hour + 1 
        END,
        notifications_last_day = CASE 
            WHEN EXTRACT(EPOCH FROM (NEW.created_at - user_notification_frequency.day_reset_at)) > 86400 
            THEN 1 
            ELSE user_notification_frequency.notifications_last_day + 1 
        END,
        notifications_last_week = CASE 
            WHEN EXTRACT(EPOCH FROM (NEW.created_at - user_notification_frequency.week_reset_at)) > 604800 
            THEN 1 
            ELSE user_notification_frequency.notifications_last_week + 1 
        END,
        notifications_last_month = CASE 
            WHEN EXTRACT(EPOCH FROM (NEW.created_at - user_notification_frequency.month_reset_at)) > 2592000 
            THEN 1 
            ELSE user_notification_frequency.notifications_last_month + 1 
        END,
        hour_reset_at = CASE 
            WHEN EXTRACT(EPOCH FROM (NEW.created_at - user_notification_frequency.hour_reset_at)) > 3600 
            THEN NEW.created_at 
            ELSE user_notification_frequency.hour_reset_at 
        END,
        day_reset_at = CASE 
            WHEN EXTRACT(EPOCH FROM (NEW.created_at - user_notification_frequency.day_reset_at)) > 86400 
            THEN NEW.created_at 
            ELSE user_notification_frequency.day_reset_at 
        END,
        week_reset_at = CASE 
            WHEN EXTRACT(EPOCH FROM (NEW.created_at - user_notification_frequency.week_reset_at)) > 604800 
            THEN NEW.created_at 
            ELSE user_notification_frequency.week_reset_at 
        END,
        month_reset_at = CASE 
            WHEN EXTRACT(EPOCH FROM (NEW.created_at - user_notification_frequency.month_reset_at)) > 2592000 
            THEN NEW.created_at 
            ELSE user_notification_frequency.month_reset_at 
        END,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_frequency_tracking
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_frequency();

-- Insert some default notification rules
INSERT INTO notification_rules (name, description, condition_type, condition_operator, condition_field, condition_value, action_type, action_config, priority, applies_to_categories) VALUES
(
    'Night Hours Suppression',
    'Suppress non-critical notifications during night hours (10 PM - 7 AM)',
    'time_based',
    'between',
    'hour',
    '[22, 7]',
    'delay',
    '{"delay_hours": 8, "target_hour": 9}',
    100,
    ARRAY['project', 'analytics', 'market']
),
(
    'High Engagement User Priority',
    'Upgrade priority for users with high engagement scores',
    'engagement',
    'greater_than',
    'engagement_score',
    '80',
    'upgrade_priority',
    '{"new_priority": "high"}',
    200,
    ARRAY['investment', 'project']
),
(
    'Low Engagement Batching',
    'Batch notifications for users with low engagement',
    'engagement',
    'less_than',
    'engagement_score',
    '30',
    'batch',
    '{"batch_size": 5, "max_delay_hours": 6}',
    300,
    ARRAY['analytics', 'market', 'system']
),
(
    'Frequency Limiting',
    'Delay notifications if user has received too many recently',
    'frequency',
    'greater_than',
    'notifications_last_hour',
    '5',
    'delay',
    '{"delay_minutes": 60}',
    50,
    ARRAY[]
);

-- Create default notification preferences for existing users (if any)
INSERT INTO user_notification_profiles (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_notification_profiles);

-- Triggers for updating updated_at timestamps
CREATE TRIGGER update_user_notification_profiles_updated_at BEFORE UPDATE ON user_notification_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_batches_updated_at BEFORE UPDATE ON notification_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON notification_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_performance_metrics_updated_at BEFORE UPDATE ON notification_performance_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_notification_frequency_updated_at BEFORE UPDATE ON user_notification_frequency FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();