-- Performance Optimization Indexes for Pitchey Platform
-- These indexes address the most common query patterns and performance bottlenecks

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

-- Investment seeking filtering
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

-- 3. PITCH_VIEWS TABLE INDEXES
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

-- 4. NDAS TABLE INDEXES
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

-- 5. FOLLOWS TABLE INDEXES  
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

-- 6. MESSAGES TABLE INDEXES
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

-- 7. NOTIFICATIONS TABLE INDEXES
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

-- 8. ANALYTICS_EVENTS TABLE INDEXES
-- Primary query patterns: event tracking, analytics queries

-- Event type and date for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date 
ON analytics_events (event_type, created_at DESC);

-- User activity analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_date 
ON analytics_events (user_id, created_at DESC);

-- Pitch-related events
CREATE INDEX IF NOT EXISTS idx_analytics_events_pitch_date 
ON analytics_events (pitch_id, created_at DESC);

-- Session-based analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_session 
ON analytics_events (session_id, created_at DESC);

-- 9. SEARCH_ANALYTICS TABLE INDEXES
-- Primary query patterns: search performance analytics

-- Search query analysis
CREATE INDEX IF NOT EXISTS idx_search_analytics_query_date 
ON search_analytics (search_query, created_at DESC);

-- User search history
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_date 
ON search_analytics (user_id, created_at DESC);

-- Results count analysis
CREATE INDEX IF NOT EXISTS idx_search_analytics_results 
ON search_analytics (results_count, created_at DESC);

-- 10. SESSIONS TABLE INDEXES
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

-- 11. INVESTMENTS TABLE INDEXES (if using investment features)
-- Primary query patterns: investor portfolios, pitch investments

CREATE INDEX IF NOT EXISTS idx_investments_investor_date 
ON investments (investor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_investments_pitch_date 
ON investments (pitch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_investments_status_amount 
ON investments (status, amount DESC);

-- 12. PORTFOLIO TABLE INDEXES
-- Primary query patterns: investment tracking

CREATE INDEX IF NOT EXISTS idx_portfolio_investor_status 
ON portfolio (investor_id, status);

CREATE INDEX IF NOT EXISTS idx_portfolio_pitch_value 
ON portfolio (pitch_id, current_value DESC);

-- 13. COMPOSITE INDEXES FOR COMPLEX QUERIES

-- Dashboard queries (trending pitches for specific user types)
CREATE INDEX IF NOT EXISTS idx_trending_dashboard 
ON pitches (status, published_at DESC, like_count DESC, view_count DESC) 
WHERE status = 'published' AND published_at >= (NOW() - INTERVAL '30 days');

-- Search with filters
CREATE INDEX IF NOT EXISTS idx_search_filtered 
ON pitches (status, genre, format, published_at DESC) 
WHERE status = 'published';

-- User engagement metrics
CREATE INDEX IF NOT EXISTS idx_user_engagement 
ON pitch_views (viewer_id, pitch_id, viewed_at DESC);

-- ANALYZE TABLES to update statistics after creating indexes
ANALYZE pitches;
ANALYZE users;
ANALYZE pitch_views;
ANALYZE ndas;
ANALYZE follows;
ANALYZE messages;
ANALYZE notifications;
ANALYZE analytics_events;
ANALYZE search_analytics;
ANALYZE sessions;

-- Performance monitoring: Create a view for slow query monitoring
CREATE OR REPLACE VIEW slow_queries_summary AS
SELECT 
    schemaname,
    tablename,
    attname AS column_name,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('pitches', 'users', 'pitch_views', 'ndas', 'follows')
ORDER BY tablename, attname;

-- Index usage monitoring view
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexrelname AS index_name,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Table statistics view for monitoring
CREATE OR REPLACE VIEW table_stats AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;