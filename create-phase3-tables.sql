-- Create additional tables needed for Phase 3 endpoints

-- Pitch comments table
CREATE TABLE IF NOT EXISTS pitch_comments (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id INTEGER REFERENCES pitch_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pitch likes table
CREATE TABLE IF NOT EXISTS pitch_likes (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pitch_id, user_id)
);

-- Pitch shares table
CREATE TABLE IF NOT EXISTS pitch_shares (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Media files table
CREATE TABLE IF NOT EXISTS media_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_provider TEXT DEFAULT 'r2',
    metadata JSONB DEFAULT '{}',
    upload_status TEXT DEFAULT 'completed' CHECK (upload_status IN ('uploading', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Content reports table
CREATE TABLE IF NOT EXISTS content_reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('pitch', 'comment', 'message', 'user')),
    content_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    moderator_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    search_query JSONB NOT NULL,
    search_filters JSONB DEFAULT '{}',
    notification_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Conversation participants table (enhance existing)
CREATE TABLE IF NOT EXISTS conversation_members (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    UNIQUE(conversation_id, user_id)
);

-- Blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Data exports table
CREATE TABLE IF NOT EXISTS data_exports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    export_type TEXT NOT NULL CHECK (export_type IN ('user_data', 'analytics', 'conversations', 'investments')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_path TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Pitch collaborators table
CREATE TABLE IF NOT EXISTS pitch_collaborators (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'collaborator' CHECK (role IN ('owner', 'editor', 'collaborator', 'viewer')),
    permissions JSONB DEFAULT '{"edit": true, "comment": true, "share": false}',
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    UNIQUE(pitch_id, user_id)
);

-- NDA templates table
CREATE TABLE IF NOT EXISTS nda_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Notification preferences table (enhance user_preferences)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    weekly_digest BOOLEAN DEFAULT TRUE,
    investment_alerts BOOLEAN DEFAULT TRUE,
    comment_notifications BOOLEAN DEFAULT TRUE,
    like_notifications BOOLEAN DEFAULT TRUE,
    follow_notifications BOOLEAN DEFAULT TRUE,
    message_notifications BOOLEAN DEFAULT TRUE,
    system_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    search_query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    filters_used JSONB DEFAULT '{}',
    clicked_result_id INTEGER,
    clicked_result_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- File access logs table
CREATE TABLE IF NOT EXISTS file_access_logs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES media_files(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    access_type TEXT CHECK (access_type IN ('view', 'download', 'upload', 'delete')),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pitch_comments_pitch ON pitch_comments(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_comments_user ON pitch_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_comments_parent ON pitch_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_pitch_likes_pitch ON pitch_likes(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_likes_user ON pitch_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_pitch_shares_pitch ON pitch_shares(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_shares_user ON pitch_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_shares_platform ON pitch_shares(platform);

CREATE INDEX IF NOT EXISTS idx_media_files_user ON media_files(user_id);
CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(file_type);
CREATE INDEX IF NOT EXISTS idx_media_files_status ON media_files(upload_status);

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_type ON content_reports(content_type);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_notification ON saved_searches(notification_enabled);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

CREATE INDEX IF NOT EXISTS idx_data_exports_user ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status);
CREATE INDEX IF NOT EXISTS idx_data_exports_type ON data_exports(export_type);

CREATE INDEX IF NOT EXISTS idx_pitch_collaborators_pitch ON pitch_collaborators(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_collaborators_user ON pitch_collaborators(user_id);

CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(search_query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_access_logs_file ON file_access_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_user ON file_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_created ON file_access_logs(created_at DESC);

-- Add some sample data for testing

-- Sample pitch comments
INSERT INTO pitch_comments (pitch_id, user_id, content)
VALUES 
    (1, 2, 'This is a fantastic thriller concept! Really compelling premise.'),
    (2, 2, 'The sci-fi elements are really interesting. How will you handle the special effects?'),
    (1, 3, 'Great character development in the synopsis. Looking forward to seeing more.')
ON CONFLICT DO NOTHING;

-- Sample pitch likes
INSERT INTO pitch_likes (pitch_id, user_id)
VALUES 
    (1, 2),
    (1, 3),
    (2, 2)
ON CONFLICT (pitch_id, user_id) DO NOTHING;

-- Sample media files
INSERT INTO media_files (user_id, filename, original_name, file_type, file_size, storage_path)
VALUES 
    (1, 'pitch_deck_1_20241117.pdf', 'The Last Sunset - Pitch Deck.pdf', 'application/pdf', 2048576, '/files/pitch_decks/1/pitch_deck_1_20241117.pdf'),
    (1, 'script_sample_1.pdf', 'The Last Sunset - Script Sample.pdf', 'application/pdf', 1024576, '/files/scripts/1/script_sample_1.pdf'),
    (2, 'treatment_2.docx', 'Quantum Dreams Treatment.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 512000, '/files/treatments/2/treatment_2.docx')
ON CONFLICT DO NOTHING;

-- Sample saved searches
INSERT INTO saved_searches (user_id, name, search_query, search_filters)
VALUES 
    (2, 'Thriller Features', '{"query": "thriller"}', '{"genre": ["thriller"], "format": ["feature"]}'),
    (2, 'Sci-Fi Projects', '{"query": "science fiction"}', '{"genre": ["scifi"], "budget_range": [1000000, 10000000]}'),
    (3, 'New Pitches', '{"query": "*"}', '{"status": ["active"], "sort": "newest"}')
ON CONFLICT DO NOTHING;

-- Sample NDA templates
INSERT INTO nda_templates (name, description, template_content, is_default, created_by)
VALUES 
    ('Standard Pitch NDA', 'Standard non-disclosure agreement for pitch viewing', 'This Non-Disclosure Agreement governs the disclosure of confidential information...', true, 1),
    ('Investment NDA', 'NDA specifically for investment discussions', 'This Investment Non-Disclosure Agreement...', false, 1),
    ('Production Partnership NDA', 'NDA for production company partnerships', 'This Production Partnership Non-Disclosure Agreement...', false, 1)
ON CONFLICT DO NOTHING;

-- Sample notification preferences
INSERT INTO notification_preferences (user_id, email_notifications, push_notifications, investment_alerts)
VALUES 
    (1, true, true, true),
    (2, true, false, true),
    (3, false, true, false)
ON CONFLICT (user_id) DO NOTHING;