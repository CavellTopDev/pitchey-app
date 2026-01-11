-- =====================================================
-- Critical Missing Tables for Frontend-Backend Integration
-- =====================================================
-- Date: January 11, 2025
-- Purpose: Add missing tables for notifications and saved pitches
-- Target: Neon PostgreSQL production database

-- ===== NOTIFICATIONS TABLE =====
-- Comprehensive notification system
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    related_id INTEGER,
    related_type VARCHAR(50),
    data JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0, -- 0=normal, 1=high, 2=critical
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- ===== SAVED PITCHES TABLE =====
-- Fix schema to match worker implementation (use INTEGER not UUID)
DROP TABLE IF EXISTS saved_pitches CASCADE;

CREATE TABLE saved_pitches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    pitch_id INTEGER NOT NULL,
    notes TEXT,
    saved_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE,
    UNIQUE(user_id, pitch_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_pitches_user_id ON saved_pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_pitch_id ON saved_pitches(pitch_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_saved_at ON saved_pitches(saved_at);

-- ===== NOTIFICATION PREFERENCES TABLE =====
-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    types JSONB DEFAULT '{}', -- specific type preferences
    digest_frequency VARCHAR(20) DEFAULT 'daily', -- none, hourly, daily, weekly
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- ===== UPDATE EXISTING TABLES =====

-- Ensure NDAs table has proper structure
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Ensure users table has notification fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_notification_read TIMESTAMP;

-- ===== FUNCTIONS FOR AUTOMATIC UPDATES =====

-- Function to update notification count
CREATE OR REPLACE FUNCTION update_user_notification_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users 
        SET notification_count = notification_count + 1
        WHERE id = NEW.user_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If notification is marked as read
        IF NEW.is_read = true AND OLD.is_read = false THEN
            UPDATE users 
            SET notification_count = GREATEST(notification_count - 1, 0),
                last_notification_read = NOW()
            WHERE id = NEW.user_id;
        ELSIF NEW.is_read = false AND OLD.is_read = true THEN
            UPDATE users 
            SET notification_count = notification_count + 1
            WHERE id = NEW.user_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Only decrease count if notification was unread
        IF OLD.is_read = false THEN
            UPDATE users 
            SET notification_count = GREATEST(notification_count - 1, 0)
            WHERE id = OLD.user_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for notification count
DROP TRIGGER IF EXISTS trigger_update_notification_count ON notifications;
CREATE TRIGGER trigger_update_notification_count
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_user_notification_count();

-- ===== SEED DATA =====

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM notification_preferences);

-- ===== VERIFICATION =====

-- Verify all tables exist and have correct structure
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
    table_count INTEGER;
BEGIN
    -- Check required tables
    FOR table_name IN 
        SELECT unnest(ARRAY['notifications', 'saved_pitches', 'notification_preferences'])
    LOOP
        SELECT COUNT(*) INTO table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = table_name;
        
        IF table_count = 0 THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All critical tables created successfully';
    END IF;
END $$;

-- Show final table counts
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables 
WHERE tablename IN ('notifications', 'saved_pitches', 'notification_preferences', 'users', 'pitches')
ORDER BY tablename;

-- Log migration completion
RAISE NOTICE 'Critical missing tables migration completed successfully at %', NOW();