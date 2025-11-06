-- Core Performance Optimization Indexes for Pitchey Platform
-- Only includes indexes for tables that definitely exist

-- 1. PITCHES TABLE INDEXES
-- Primary query patterns: status filtering, user pitches, trending by metrics, search

-- Published pitches with ordering (Homepage/Browse)
CREATE INDEX IF NOT EXISTS idx_pitches_status_published_date 
ON pitches (status, published_at DESC NULLS LAST) 
WHERE status = 'published';

-- User's pitches with status filtering
CREATE INDEX IF NOT EXISTS idx_pitches_user_status_date 
ON pitches (user_id, status, updated_at DESC);

-- Trending pitches optimization
CREATE INDEX IF NOT EXISTS idx_pitches_trending_metrics 
ON pitches (status, like_count DESC, view_count DESC, published_at DESC) 
WHERE status = 'published';

-- Search optimization (title, logline, genre, format)
CREATE INDEX IF NOT EXISTS idx_pitches_search_text 
ON pitches USING gin(to_tsvector('english', title || ' ' || logline || ' ' || COALESCE(short_synopsis, '')));

-- Genre and format filtering
CREATE INDEX IF NOT EXISTS idx_pitches_genre_format_status 
ON pitches (genre, format, status) 
WHERE status = 'published';

-- NDA requirement filtering
CREATE INDEX IF NOT EXISTS idx_pitches_nda_status 
ON pitches (require_nda, status) 
WHERE status = 'published';

-- Investment seeking filtering (if column exists)
CREATE INDEX IF NOT EXISTS idx_pitches_seeking_investment 
ON pitches (seeking_investment, status) 
WHERE status = 'published' AND seeking_investment = true;

-- 2. USERS TABLE INDEXES
-- Primary query patterns: authentication, user lookup, user type filtering

-- Email lookup for authentication (unique constraint should handle this, but explicit index)
CREATE INDEX IF NOT EXISTS idx_users_email_active 
ON users (email) 
WHERE is_active = true;

-- Username lookup
CREATE INDEX IF NOT EXISTS idx_users_username_active 
ON users (username) 
WHERE is_active = true;

-- User type filtering with activity status
CREATE INDEX IF NOT EXISTS idx_users_type_active 
ON users (user_type, is_active);

-- Company verification status
CREATE INDEX IF NOT EXISTS idx_users_company_verified 
ON users (user_type, company_verified) 
WHERE company_verified = true;

-- 3. PITCH_VIEWS TABLE INDEXES (if table exists)
-- Primary query patterns: analytics, view counting, user activity

-- Pitch analytics (views by pitch)
CREATE INDEX IF NOT EXISTS idx_pitch_views_pitch_date 
ON pitch_views (pitch_id, viewed_at DESC);

-- User viewing history
CREATE INDEX IF NOT EXISTS idx_pitch_views_viewer_date 
ON pitch_views (viewer_id, viewed_at DESC);

-- Unique daily views for analytics
CREATE INDEX IF NOT EXISTS idx_pitch_views_unique_daily 
ON pitch_views (pitch_id, viewer_id, DATE(viewed_at));

-- 4. NDAS TABLE INDEXES (if table exists)
-- Primary query patterns: NDA status checking, user NDA history

-- Pitch NDA lookup
CREATE INDEX IF NOT EXISTS idx_ndas_pitch_signer 
ON ndas (pitch_id, signer_id, status);

-- User's signed NDAs
CREATE INDEX IF NOT EXISTS idx_ndas_signer_status_date 
ON ndas (signer_id, status, signed_at DESC);

-- NDA status and dates
CREATE INDEX IF NOT EXISTS idx_ndas_status_dates 
ON ndas (status, signed_at DESC, expires_at);

-- 5. FOLLOWS TABLE INDEXES (if table exists)
-- Primary query patterns: user follows, pitch followers

-- User's followed pitches
CREATE INDEX IF NOT EXISTS idx_follows_follower_date 
ON follows (follower_id, followed_at DESC);

-- Pitch followers count and list
CREATE INDEX IF NOT EXISTS idx_follows_pitch_date 
ON follows (pitch_id, followed_at DESC);

-- Creator's followers
CREATE INDEX IF NOT EXISTS idx_follows_creator_date 
ON follows (creator_id, followed_at DESC);

-- 6. MESSAGES TABLE INDEXES (if table exists)
-- Primary query patterns: user conversations, unread messages

-- Inbox/Sent messages
CREATE INDEX IF NOT EXISTS idx_messages_receiver_date 
ON messages (receiver_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_date 
ON messages (sender_id, sent_at DESC);

-- Unread messages
CREATE INDEX IF NOT EXISTS idx_messages_unread 
ON messages (receiver_id, is_read, sent_at DESC) 
WHERE is_read = false;

-- Pitch-related messages
CREATE INDEX IF NOT EXISTS idx_messages_pitch_date 
ON messages (pitch_id, sent_at DESC);

-- 7. NOTIFICATIONS TABLE INDEXES (if table exists)
-- Primary query patterns: user notifications, unread count

-- User notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_date 
ON notifications (user_id, created_at DESC);

-- Unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON notifications (user_id, is_read, created_at DESC) 
WHERE is_read = false;

-- Notification type filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type_date 
ON notifications (user_id, type, created_at DESC);

-- 8. SESSIONS TABLE INDEXES (if table exists)
-- Primary query patterns: session validation, cleanup

-- Session token lookup
CREATE INDEX IF NOT EXISTS idx_sessions_token 
ON sessions (token);

-- User sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry 
ON sessions (user_id, expires_at DESC);

-- Expired sessions cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_expired 
ON sessions (expires_at) 
WHERE expires_at < NOW();

-- ANALYZE TABLES to update statistics after creating indexes
ANALYZE pitches;
ANALYZE users;