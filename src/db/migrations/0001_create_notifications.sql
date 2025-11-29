-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
  'pitch_viewed',
  'pitch_liked',
  'pitch_saved',
  'pitch_commented',
  'pitch_status_changed',
  'nda_requested',
  'nda_approved',
  'nda_rejected',
  'nda_signed',
  'nda_expiring',
  'investment_received',
  'investment_milestone',
  'investment_withdrawn',
  'message_received',
  'message_read',
  'new_follower',
  'creator_posted',
  'system_announcement',
  'system_maintenance',
  'account_verified',
  'password_changed',
  'collaboration_invite',
  'collaboration_accepted',
  'collaboration_rejected',
  'milestone_reached',
  'weekly_report',
  'monthly_summary'
);

-- Create priority enum
CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create channel enum
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'sms', 'push', 'webhook');

-- Main notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  priority notification_priority DEFAULT 'medium' NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Related entities
  related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  related_pitch_id INTEGER,
  related_nda_id INTEGER,
  related_investment_id INTEGER,
  
  -- Actions
  action_url TEXT,
  action_text VARCHAR(100),
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  read_at TIMESTAMP,
  delivered BOOLEAN DEFAULT FALSE NOT NULL,
  delivered_at TIMESTAMP,
  delivery_channel notification_channel DEFAULT 'in_app',
  delivery_error TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP,
  
  -- Grouping
  group_id VARCHAR(100),
  group_count INTEGER DEFAULT 1
);

-- Create indexes for performance
CREATE INDEX notifications_user_id_idx ON notifications(user_id);
CREATE INDEX notifications_type_idx ON notifications(type);
CREATE INDEX notifications_is_read_idx ON notifications(is_read);
CREATE INDEX notifications_created_at_idx ON notifications(created_at);
CREATE INDEX notifications_group_id_idx ON notifications(group_id);
CREATE INDEX notifications_related_pitch_idx ON notifications(related_pitch_id);
CREATE INDEX notifications_related_user_idx ON notifications(related_user_id);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Channel preferences
  email_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  push_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  sms_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  in_app_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  
  -- Type-specific preferences
  type_preferences JSONB DEFAULT '{}',
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start VARCHAR(5), -- HH:MM format
  quiet_hours_end VARCHAR(5), -- HH:MM format
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Frequency settings
  email_digest VARCHAR(20) DEFAULT 'immediate', -- immediate, daily, weekly, never
  max_daily_emails INTEGER DEFAULT 20,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Ensure one preference per user
  UNIQUE(user_id)
);

CREATE INDEX notification_preferences_user_id_idx ON notification_preferences(user_id);

-- Notification queue for async delivery
CREATE TABLE IF NOT EXISTS notification_queue (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  
  -- Scheduling
  scheduled_for TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  max_attempts INTEGER DEFAULT 3 NOT NULL,
  
  -- Error tracking
  last_error TEXT,
  last_attempt_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP,
  
  -- Priority
  priority notification_priority DEFAULT 'medium' NOT NULL
);

CREATE INDEX notification_queue_status_idx ON notification_queue(status);
CREATE INDEX notification_queue_scheduled_for_idx ON notification_queue(scheduled_for);
CREATE INDEX notification_queue_priority_idx ON notification_queue(priority);

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id SERIAL PRIMARY KEY,
  type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  locale VARCHAR(10) DEFAULT 'en' NOT NULL,
  
  -- Template content
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  -- Variables and metadata
  variables JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Unique template per type, channel, and locale
  UNIQUE(type, channel, locale)
);

CREATE INDEX notification_templates_type_channel_idx ON notification_templates(type, channel);

-- Insert default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM notification_preferences WHERE user_id = users.id
);

-- Insert default notification templates
INSERT INTO notification_templates (type, channel, title_template, body_template, variables) VALUES
  ('pitch_viewed', 'in_app', 'Your pitch was viewed', '{{viewerName}} viewed your pitch "{{pitchTitle}}"', '["viewerName", "pitchTitle"]'),
  ('pitch_liked', 'in_app', 'Your pitch was liked', '{{userName}} liked your pitch "{{pitchTitle}}"', '["userName", "pitchTitle"]'),
  ('nda_requested', 'in_app', 'New NDA Request', '{{requesterName}} requested an NDA for "{{pitchTitle}}"', '["requesterName", "pitchTitle"]'),
  ('nda_approved', 'in_app', 'NDA Approved', 'Your NDA request for "{{pitchTitle}}" was approved', '["pitchTitle"]'),
  ('nda_rejected', 'in_app', 'NDA Rejected', 'Your NDA request for "{{pitchTitle}}" was rejected', '["pitchTitle"]'),
  ('investment_received', 'in_app', 'New Investment!', 'You received a {{amount}} investment in "{{pitchTitle}}"', '["amount", "pitchTitle"]'),
  ('message_received', 'in_app', 'New Message', '{{senderName}} sent you a message', '["senderName"]'),
  ('new_follower', 'in_app', 'New Follower', '{{followerName}} started following you', '["followerName"]'),
  ('system_announcement', 'in_app', '{{title}}', '{{message}}', '["title", "message"]')
ON CONFLICT (type, channel, locale) DO NOTHING;