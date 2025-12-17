-- Missing Database Tables for Pitchey Platform
-- Run this migration to add all missing tables and relationships

-- =====================================================
-- USER SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'auto',
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  currency VARCHAR(3) DEFAULT 'USD',
  notification_settings JSONB DEFAULT '{"email": true, "sms": false, "push": true, "inApp": true}'::jsonb,
  privacy_settings JSONB DEFAULT '{"profileVisibility": "public", "showEmail": false, "showPhone": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- =====================================================
-- INVESTMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  investment_type VARCHAR(50) DEFAULT 'equity',
  equity_percentage DECIMAL(5, 2),
  terms JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  contract_url TEXT,
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(investor_id, pitch_id)
);

CREATE INDEX idx_investments_investor ON investments(investor_id);
CREATE INDEX idx_investments_pitch ON investments(pitch_id);
CREATE INDEX idx_investments_status ON investments(status);
CREATE INDEX idx_investments_created ON investments(created_at DESC);

-- =====================================================
-- SAVED PITCHES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  tags TEXT[],
  UNIQUE(user_id, pitch_id)
);

CREATE INDEX idx_saved_pitches_user ON saved_pitches(user_id);
CREATE INDEX idx_saved_pitches_pitch ON saved_pitches(pitch_id);

-- =====================================================
-- VIEWS TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  session_id VARCHAR(255),
  duration_seconds INTEGER,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  country VARCHAR(2),
  city VARCHAR(100),
  device_type VARCHAR(50)
);

CREATE INDEX idx_views_pitch ON views(pitch_id);
CREATE INDEX idx_views_viewer ON views(viewer_id);
CREATE INDEX idx_views_date ON views(viewed_at DESC);
CREATE INDEX idx_views_session ON views(session_id);

-- =====================================================
-- FOLLOWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- =====================================================
-- NDAS TABLE (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS ndas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'signed', 'expired', 'revoked')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_data JSONB,
  document_url TEXT,
  custom_terms TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(requester_id, pitch_id)
);

CREATE INDEX idx_ndas_requester ON ndas(requester_id);
CREATE INDEX idx_ndas_pitch ON ndas(pitch_id);
CREATE INDEX idx_ndas_status ON ndas(status);
CREATE INDEX idx_ndas_created ON ndas(created_at DESC);

-- =====================================================
-- FILE UPLOADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  file_key VARCHAR(500) NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  category VARCHAR(50) CHECK (category IN ('document', 'media', 'pitch', 'nda', 'profile', 'other')),
  file_url TEXT,
  thumbnail_url TEXT,
  checksum VARCHAR(64),
  metadata JSONB DEFAULT '{}'::jsonb,
  virus_scan_status VARCHAR(50) DEFAULT 'pending',
  virus_scan_result JSONB,
  is_public BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_uploads_pitch ON file_uploads(pitch_id);
CREATE INDEX idx_uploads_category ON file_uploads(category);
CREATE INDEX idx_uploads_key ON file_uploads(file_key);
CREATE INDEX idx_uploads_uploaded ON file_uploads(uploaded_at DESC);

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  thread_id UUID,
  subject VARCHAR(255),
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'direct',
  attachments JSONB DEFAULT '[]'::jsonb,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  deleted_by_sender BOOLEAN DEFAULT false,
  deleted_by_recipient BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_pitch ON messages(pitch_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_unread ON messages(recipient_id, is_read) WHERE is_read = false;

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  related_id UUID,
  related_type VARCHAR(50),
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT false,
  priority VARCHAR(20) DEFAULT 'normal',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- PITCH CHARACTERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pitch_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(100),
  description TEXT,
  age_range VARCHAR(50),
  gender VARCHAR(50),
  ethnicity VARCHAR(100),
  personality_traits TEXT[],
  backstory TEXT,
  arc TEXT,
  importance VARCHAR(50) DEFAULT 'supporting',
  actor_suggestions TEXT[],
  image_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_characters_pitch ON pitch_characters(pitch_id);
CREATE INDEX idx_characters_order ON pitch_characters(pitch_id, order_index);

-- =====================================================
-- PITCH MEDIA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pitch_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  media_type VARCHAR(50) CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  media_category VARCHAR(50) CHECK (media_category IN ('poster', 'trailer', 'gallery', 'script', 'treatment', 'other')),
  title VARCHAR(255),
  description TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  duration_seconds INTEGER,
  mime_type VARCHAR(100),
  is_primary BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_media_pitch ON pitch_media(pitch_id);
CREATE INDEX idx_media_type ON pitch_media(media_type);
CREATE INDEX idx_media_category ON pitch_media(media_category);
CREATE INDEX idx_media_order ON pitch_media(pitch_id, order_index);

-- =====================================================
-- INVESTMENT INTERESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS investment_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  genres TEXT[],
  formats TEXT[],
  budget_ranges TEXT[],
  themes TEXT[],
  target_audiences TEXT[],
  investment_range_min DECIMAL(15, 2),
  investment_range_max DECIMAL(15, 2),
  preferred_roi DECIMAL(5, 2),
  risk_tolerance VARCHAR(50),
  investment_timeline VARCHAR(100),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(investor_id)
);

CREATE INDEX idx_interests_investor ON investment_interests(investor_id);
CREATE INDEX idx_interests_active ON investment_interests(is_active);

-- =====================================================
-- PAYMENT METHODS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) CHECK (type IN ('card', 'bank', 'paypal', 'wire', 'crypto')),
  provider VARCHAR(50),
  last_four VARCHAR(4),
  brand VARCHAR(50),
  bank_name VARCHAR(100),
  account_holder_name VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  verification_date TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = true;

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- =====================================================
-- WEBSOCKET SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS websocket_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  disconnected_at TIMESTAMP WITH TIME ZONE,
  last_ping_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ws_sessions_user ON websocket_sessions(user_id);
CREATE INDEX idx_ws_sessions_room ON websocket_sessions(room_id);
CREATE INDEX idx_ws_sessions_active ON websocket_sessions(disconnected_at) WHERE disconnected_at IS NULL;

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at 
            BEFORE UPDATE ON %I 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column()',
            t, t
        );
    END LOOP;
END $$;

-- Function to calculate user engagement score
CREATE OR REPLACE FUNCTION calculate_user_engagement_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Calculate based on various activities
    SELECT INTO score
        COALESCE(
            (SELECT COUNT(*) * 10 FROM pitches WHERE creator_id = p_user_id AND status = 'published') +
            (SELECT COUNT(*) * 5 FROM investments WHERE investor_id = p_user_id) +
            (SELECT COUNT(*) * 2 FROM views WHERE viewer_id = p_user_id) +
            (SELECT COUNT(*) * 3 FROM follows WHERE follower_id = p_user_id) +
            (SELECT COUNT(*) * 1 FROM saved_pitches WHERE user_id = p_user_id),
            0
        );
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Add engagement score index
CREATE INDEX idx_user_engagement ON users(id);

-- =====================================================
-- GRANT PERMISSIONS (adjust based on your database users)
-- =====================================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;