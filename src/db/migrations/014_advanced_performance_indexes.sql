-- Advanced Performance Optimization Indexes for Pitchey Platform
-- Targeted at specific query patterns and performance bottlenecks

-- =====================================================
-- 1. COMPOSITE INDEXES FOR COMPLEX QUERIES
-- =====================================================

-- Dashboard queries optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_dashboard_metrics
ON pitches (user_id, status, published_at DESC, view_count DESC, like_count DESC)
WHERE status IN ('published', 'draft', 'review');

-- Investment tracking queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_investor_status
ON investments (investor_id, status, created_at DESC)
INCLUDE (amount, pitch_id);

-- Production company project queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_production_pipeline
ON pitches (production_company_id, production_stage, updated_at DESC)
WHERE production_company_id IS NOT NULL;

-- =====================================================
-- 2. PARTIAL INDEXES FOR FILTERED QUERIES
-- =====================================================

-- Active collaborations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collaborations_active
ON collaborations (pitch_id, user_id, status)
WHERE status = 'active' AND deleted_at IS NULL;

-- Pending NDAs requiring action
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_pending_action
ON ndas (recipient_id, status, created_at DESC)
WHERE status IN ('pending', 'review') AND deleted_at IS NULL;

-- Unread notifications optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread_priority
ON notifications (user_id, priority DESC, created_at DESC)
WHERE is_read = false AND deleted_at IS NULL;

-- =====================================================
-- 3. COVERING INDEXES TO AVOID TABLE LOOKUPS
-- =====================================================

-- User authentication and session management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_covering
ON users (email, id, user_type, is_active)
INCLUDE (username, first_name, last_name, profile_image);

-- Pitch browsing with all needed fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_browse_covering
ON pitches (status, published_at DESC)
INCLUDE (title, logline, genre, format, user_id, thumbnail_url, view_count, like_count)
WHERE status = 'published';

-- Message threads optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_thread_covering
ON messages (sender_id, receiver_id, created_at DESC)
INCLUDE (subject, content, is_read, thread_id);

-- =====================================================
-- 4. JSON/JSONB INDEXES FOR METADATA
-- =====================================================

-- Settings and preferences
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_preferences
ON user_settings USING gin(preferences jsonb_path_ops)
WHERE preferences IS NOT NULL;

-- Audit log metadata searching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_metadata
ON audit_logs USING gin(metadata jsonb_path_ops)
WHERE metadata IS NOT NULL;

-- Pitch metadata and tags
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_metadata
ON pitches USING gin(metadata jsonb_path_ops)
WHERE metadata IS NOT NULL;

-- =====================================================
-- 5. FULL-TEXT SEARCH OPTIMIZATION
-- =====================================================

-- Enhanced pitch search with weighted fields
DROP INDEX IF EXISTS idx_pitches_search_text;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_fts_weighted
ON pitches USING gin((
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(logline, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(short_synopsis, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(genre || ' ' || format, '')), 'D')
));

-- User search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_fts_search
ON users USING gin((
  to_tsvector('english', COALESCE(first_name || ' ' || last_name, '')) ||
  to_tsvector('english', COALESCE(company_name, '')) ||
  to_tsvector('english', COALESCE(bio, ''))
));

-- =====================================================
-- 6. TIME-BASED PARTITIONING INDEXES
-- =====================================================

-- Analytics time-series optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_time_series
ON analytics_events (event_type, created_at DESC, user_id)
WHERE created_at > CURRENT_DATE - INTERVAL '90 days';

-- Recent activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_recent
ON user_activity (user_id, activity_type, created_at DESC)
WHERE created_at > CURRENT_DATE - INTERVAL '30 days';

-- =====================================================
-- 7. RELATIONSHIP AND JOIN OPTIMIZATION
-- =====================================================

-- Team member lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_lookup
ON team_members (team_id, user_id, role)
INCLUDE (joined_at, is_active)
WHERE is_active = true;

-- Pitch documents relationship
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitch_documents_relation
ON pitch_documents (pitch_id, document_type, created_at DESC)
INCLUDE (file_url, file_size, is_nda_required);

-- Follow relationships bidirectional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_bidirectional
ON follows (followed_id, follower_id, created_at DESC)
WHERE unfollowed_at IS NULL;

-- =====================================================
-- 8. AGGREGATION AND REPORTING INDEXES
-- =====================================================

-- Revenue tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_revenue
ON transactions (user_id, type, status, created_at DESC)
INCLUDE (amount, currency)
WHERE status = 'completed';

-- Platform metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_metrics_daily
ON platform_metrics (metric_type, date DESC, value)
WHERE date > CURRENT_DATE - INTERVAL '365 days';

-- =====================================================
-- 9. WEBSOCKET AND REAL-TIME INDEXES
-- =====================================================

-- Active WebSocket connections
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_websocket_connections_active
ON websocket_connections (user_id, status, last_ping_at DESC)
WHERE status = 'active';

-- Real-time notification queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_queue_pending
ON notification_queue (user_id, priority DESC, created_at)
WHERE processed = false;

-- =====================================================
-- 10. CLEANUP AND MAINTENANCE INDEXES
-- =====================================================

-- Expired sessions cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_cleanup
ON sessions (expires_at)
WHERE expires_at < CURRENT_TIMESTAMP;

-- Soft-deleted records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_soft_deleted_cleanup
ON pitches (deleted_at)
WHERE deleted_at IS NOT NULL AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

-- =====================================================
-- 11. STATISTICS UPDATE
-- =====================================================

-- Update table statistics for query planner
ANALYZE pitches;
ANALYZE users;
ANALYZE investments;
ANALYZE ndas;
ANALYZE messages;
ANALYZE notifications;
ANALYZE follows;
ANALYZE collaborations;
ANALYZE transactions;
ANALYZE team_members;
ANALYZE pitch_documents;
ANALYZE websocket_connections;
ANALYZE sessions;

-- =====================================================
-- 12. PERFORMANCE MONITORING VIEWS
-- =====================================================

-- Create view for monitoring slow queries
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 50;

-- Create view for monitoring index usage
CREATE OR REPLACE VIEW v_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Create view for monitoring table bloat
CREATE OR REPLACE VIEW v_table_bloat AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size,
    ROUND(100 * pg_total_relation_size(schemaname||'.'||tablename) / 
        NULLIF(SUM(pg_total_relation_size(schemaname||'.'||tablename)) OVER (), 0), 2) AS percentage
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- 13. AUTOMATIC VACUUM CONFIGURATION
-- =====================================================

-- Configure aggressive autovacuum for high-traffic tables
ALTER TABLE pitches SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE pitch_views SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE notifications SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE websocket_connections SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE sessions SET (autovacuum_vacuum_scale_factor = 0.05);