-- ============================================================================
-- PERFORMANCE INDEXES - Pitchey Platform
-- ============================================================================
-- Purpose: Add critical performance indexes identified in schema analysis
-- Priority: HIGH - Implement within 1 week
-- Estimated Impact: 10-20 minutes to create all indexes
-- No downtime: PostgreSQL supports CREATE INDEX CONCURRENTLY
-- ============================================================================

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

-- Set maintenance_work_mem higher for faster index creation
-- Adjust based on available memory
SET maintenance_work_mem = '1GB';

-- ============================================================================
-- PRIORITY 1: CRITICAL INDEXES (Immediate Impact)
-- ============================================================================

-- Notifications: User unread feed (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread_created
  ON notifications(user_id, created_at DESC)
  WHERE is_read = false;
COMMENT ON INDEX idx_notifications_user_unread_created IS 'Optimizes unread notification queries for user feed';

-- Notifications: User type filtering with read status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_type_read
  ON notifications(user_id, type, is_read, created_at DESC);
COMMENT ON INDEX idx_notifications_user_type_read IS 'Supports filtered notification queries by type';

-- Messages: Conversation timeline (ordered by creation time)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC)
  WHERE is_deleted = false;
COMMENT ON INDEX idx_messages_conversation_created IS 'Optimizes message timeline queries excluding deleted messages';

-- Messages: Unread messages for recipient
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recipient_unread
  ON messages(recipient_id, is_read, created_at DESC)
  WHERE is_read = false AND is_deleted = false;
COMMENT ON INDEX idx_messages_recipient_unread IS 'Fast lookup of unread messages for users';

-- Pitch Views: Analytics dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitch_views_pitch_date
  ON pitch_views(pitch_id, viewed_at DESC);
COMMENT ON INDEX idx_pitch_views_pitch_date IS 'Optimizes pitch analytics and view history queries';

-- ============================================================================
-- PRIORITY 2: HIGH PRIORITY INDEXES (Within 1 Week)
-- ============================================================================

-- Analytics Events: Pitch performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_pitch_created
  ON analytics_events(pitch_id, created_at DESC);
COMMENT ON INDEX idx_analytics_events_pitch_created IS 'Pitch analytics timeline queries';

-- Analytics Events: User activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_user_event_created
  ON analytics_events(user_id, event_type, created_at DESC)
  WHERE user_id IS NOT NULL;
COMMENT ON INDEX idx_analytics_events_user_event_created IS 'User activity queries by event type';

-- Investments: Investor portfolio queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_investor_status_created
  ON investments(investor_id, status, created_at DESC);
COMMENT ON INDEX idx_investments_investor_status_created IS 'Investor portfolio dashboard queries';

-- Investments: Pitch investment tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_pitch_status
  ON investments(pitch_id, status, created_at DESC);
COMMENT ON INDEX idx_investments_pitch_status IS 'Track all investments for a pitch';

-- NDAs: Pitch NDA verification
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_pitch_signer_signed
  ON ndas(pitch_id, signer_id, signed_at DESC);
COMMENT ON INDEX idx_ndas_pitch_signer_signed IS 'Verify NDA status for pitch access';

-- NDAs: User signed NDAs lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_signer_pitch
  ON ndas(signer_id, pitch_id, signed_at DESC);
COMMENT ON INDEX idx_ndas_signer_pitch IS 'User NDA history queries';

-- ============================================================================
-- PRIORITY 3: MEDIUM PRIORITY INDEXES (Within 1 Month)
-- ============================================================================

-- Users: Email verification lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified
  ON users(email, email_verified)
  WHERE email_verified = true;
COMMENT ON INDEX idx_users_email_verified IS 'Fast lookup of verified email addresses';

-- Users: Active user queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_type
  ON users(is_active, user_type, created_at DESC)
  WHERE is_active = true;
COMMENT ON INDEX idx_users_active_type IS 'Active user queries by type';

-- Pitches: Browse and discovery queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_status_published_genre
  ON pitches(status, published_at DESC, genre)
  WHERE status = 'published';
COMMENT ON INDEX idx_pitches_status_published_genre IS 'Browse pitches by genre with publication date sorting';

-- Pitches: Format filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_status_format_published
  ON pitches(status, format, published_at DESC)
  WHERE status = 'published';
COMMENT ON INDEX idx_pitches_status_format_published IS 'Browse pitches by format';

-- Follows: User activity feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_created
  ON follows(follower_id, followed_at DESC);
COMMENT ON INDEX idx_follows_follower_created IS 'User following activity timeline';

-- Follows: Creator follower list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_creator_created
  ON follows(creator_id, followed_at DESC)
  WHERE creator_id IS NOT NULL;
COMMENT ON INDEX idx_follows_creator_created IS 'List followers of a creator';

-- Pitch Views: Viewer history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitch_views_viewer_date
  ON pitch_views(viewer_id, viewed_at DESC)
  WHERE viewer_id IS NOT NULL;
COMMENT ON INDEX idx_pitch_views_viewer_date IS 'User viewing history';

-- Conversations: User conversation list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_last_message
  ON conversations(last_message_at DESC)
  WHERE archived = false;
COMMENT ON INDEX idx_conversations_last_message IS 'Active conversations sorted by recent activity';

-- Conversation Participants: User conversation membership
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_participants_user_active
  ON conversation_participants(user_id, is_active, last_read_at)
  WHERE is_active = true;
COMMENT ON INDEX idx_conversation_participants_user_active IS 'User active conversations with read status';

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Pitch search with multiple filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_search_filters
  ON pitches(status, genre, format, published_at DESC)
  WHERE status = 'published';
COMMENT ON INDEX idx_pitches_search_filters IS 'Multi-filter pitch search queries';

-- User engagement metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_engagement
  ON analytics_events(user_id, event_type, created_at DESC)
  WHERE event_type IN ('view', 'click', 'nda_request', 'message_sent');
COMMENT ON INDEX idx_analytics_events_engagement IS 'Track user engagement metrics';

-- Investment analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_analytics
  ON investments(investor_id, pitch_id, status, created_at)
  WHERE status IN ('completed', 'active', 'pending');
COMMENT ON INDEX idx_investments_analytics IS 'Investment analytics and reporting';

-- ============================================================================
-- FULL-TEXT SEARCH INDEXES (if pg_trgm extension is available)
-- ============================================================================

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Pitch title and logline search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_title_trgm
  ON pitches USING gin (title gin_trgm_ops);
COMMENT ON INDEX idx_pitches_title_trgm IS 'Fuzzy search on pitch titles';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_logline_trgm
  ON pitches USING gin (logline gin_trgm_ops);
COMMENT ON INDEX idx_pitches_logline_trgm IS 'Fuzzy search on pitch loglines';

-- User search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_trgm
  ON users USING gin (username gin_trgm_ops);
COMMENT ON INDEX idx_users_username_trgm IS 'Fuzzy search on usernames';

-- ============================================================================
-- PARTIAL INDEXES FOR SPECIFIC QUERIES
-- ============================================================================

-- Active sessions only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active
  ON sessions(user_id, expires_at)
  WHERE expires_at > NOW();
COMMENT ON INDEX idx_sessions_active IS 'Active sessions only (expires in future)';

-- Recent pitch views (last 30 days for analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitch_views_recent
  ON pitch_views(pitch_id, viewed_at DESC)
  WHERE viewed_at > NOW() - INTERVAL '30 days';
COMMENT ON INDEX idx_pitch_views_recent IS 'Recent pitch views for analytics (30 days)';

-- Pending NDA requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nda_requests_pending
  ON nda_requests(requester_id, pitch_id, created_at DESC)
  WHERE status = 'pending';
COMMENT ON INDEX idx_nda_requests_pending IS 'Pending NDA requests requiring action';

-- ============================================================================
-- VERIFICATION AND MONITORING
-- ============================================================================

-- Create function to check index usage
CREATE OR REPLACE FUNCTION check_index_usage()
RETURNS TABLE(
  schemaname TEXT,
  tablename TEXT,
  indexname TEXT,
  idx_scan BIGINT,
  idx_tup_read BIGINT,
  idx_tup_fetch BIGINT,
  table_size TEXT,
  index_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.schemaname::TEXT,
    s.tablename::TEXT,
    s.indexname::TEXT,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    pg_size_pretty(pg_relation_size(s.schemaname||'.'||s.tablename)) as table_size,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
  FROM pg_stat_user_indexes s
  WHERE s.schemaname = 'public'
    AND s.indexname LIKE 'idx_%'
  ORDER BY s.idx_scan ASC, pg_relation_size(s.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_index_usage() IS 'Monitor index usage to identify unused indexes';

-- Check for missing indexes on foreign keys
CREATE OR REPLACE FUNCTION check_missing_fk_indexes()
RETURNS TABLE(
  table_name TEXT,
  column_name TEXT,
  constraint_name TEXT,
  has_index BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.table_name::TEXT,
    kcu.column_name::TEXT,
    tc.constraint_name::TEXT,
    EXISTS(
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = tc.table_name
        AND indexdef LIKE '%' || kcu.column_name || '%'
    ) as has_index
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  ORDER BY tc.table_name, kcu.column_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_missing_fk_indexes() IS 'Identify foreign keys without indexes (performance risk)';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- List all new indexes created by this script
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
  AND indexname NOT IN (
    -- Exclude pre-existing indexes
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
  )
ORDER BY tablename, indexname;

-- Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Check for duplicate indexes (same columns, different names)
SELECT
  a.tablename,
  a.indexname as index1,
  b.indexname as index2,
  a.indexdef as def1,
  b.indexdef as def2
FROM pg_indexes a
JOIN pg_indexes b
  ON a.tablename = b.tablename
  AND a.indexname < b.indexname
  AND a.indexdef = b.indexdef
WHERE a.schemaname = 'public'
  AND a.indexname LIKE 'idx_%'
  AND b.indexname LIKE 'idx_%';

-- ============================================================================
-- MAINTENANCE QUERIES
-- ============================================================================

-- Identify unused indexes (run after 1 week of production use)
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
  AND idx_scan = 0
  AND pg_relation_size(indexrelid) > 1024 * 1024 -- Larger than 1MB
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check index bloat (requires pgstattuple extension)
-- CREATE EXTENSION IF NOT EXISTS pgstattuple;
--
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
--   pg_size_pretty(
--     pg_relation_size(indexrelid) -
--     pg_relation_size(indexrelid, 'main')
--   ) as bloat_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- ROLLBACK PROCEDURE
-- ============================================================================

/*
-- Run this to remove all indexes created by this script

-- Priority 1 indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_user_unread_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_user_type_read;
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_conversation_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_recipient_unread;
DROP INDEX CONCURRENTLY IF EXISTS idx_pitch_views_pitch_date;

-- Priority 2 indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_analytics_events_pitch_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_analytics_events_user_event_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_investments_investor_status_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_investments_pitch_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_ndas_pitch_signer_signed;
DROP INDEX CONCURRENTLY IF EXISTS idx_ndas_signer_pitch;

-- Priority 3 indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email_verified;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_active_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_pitches_status_published_genre;
DROP INDEX CONCURRENTLY IF EXISTS idx_pitches_status_format_published;
DROP INDEX CONCURRENTLY IF EXISTS idx_follows_follower_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_follows_creator_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_pitch_views_viewer_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_last_message;
DROP INDEX CONCURRENTLY IF EXISTS idx_conversation_participants_user_active;

-- Composite indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_pitches_search_filters;
DROP INDEX CONCURRENTLY IF EXISTS idx_analytics_events_engagement;
DROP INDEX CONCURRENTLY IF EXISTS idx_investments_analytics;

-- Full-text search indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_pitches_title_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_pitches_logline_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_username_trgm;

-- Partial indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_sessions_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_pitch_views_recent;
DROP INDEX CONCURRENTLY IF EXISTS idx_nda_requests_pending;

-- Functions
DROP FUNCTION IF EXISTS check_index_usage();
DROP FUNCTION IF EXISTS check_missing_fk_indexes();
*/

-- ============================================================================
-- DEPLOYMENT CHECKLIST
-- ============================================================================

/*
PRE-DEPLOYMENT:
☐ Backup database
☐ Test in staging environment
☐ Verify sufficient disk space for indexes
☐ Schedule during low-traffic window
☐ Prepare monitoring queries

DEPLOYMENT:
☐ Run Priority 1 indexes first
☐ Monitor CREATE INDEX CONCURRENTLY progress
☐ Run verification queries
☐ Check application performance metrics
☐ Run Priority 2 and 3 indexes in batches

POST-DEPLOYMENT:
☐ Run check_index_usage() after 1 week
☐ Monitor query performance improvements
☐ Identify and drop unused indexes
☐ Update query patterns to utilize new indexes
☐ Document index maintenance schedule

ESTIMATED EXECUTION TIME: 10-20 minutes (all indexes)
ESTIMATED DOWNTIME: 0 minutes (CONCURRENT creates)
RISK LEVEL: LOW (can be rolled back without data loss)
*/

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '=== PERFORMANCE INDEXES SCRIPT COMPLETED ===';
  RAISE NOTICE 'Review index creation results above';
  RAISE NOTICE 'Monitor query performance improvements';
  RAISE NOTICE 'Run check_index_usage() after 1 week';
  RAISE NOTICE 'Script execution timestamp: %', NOW();
  RAISE NOTICE '============================================';
END $$;
