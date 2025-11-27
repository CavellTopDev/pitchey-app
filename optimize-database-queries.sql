-- Database Query Optimization Script
-- Optimizes Pitchey database for better performance

-- =====================================================
-- 1. ANALYZE SLOW QUERIES
-- =====================================================

-- Enable query performance monitoring
ALTER SYSTEM SET log_min_duration_statement = 100; -- Log queries taking >100ms
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Create extension for query analysis
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- =====================================================
-- 2. CREATE OPTIMIZED INDEXES
-- =====================================================

-- Pitches table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_status_visibility 
    ON pitches(status, visibility) 
    WHERE status = 'published' AND visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_trending 
    ON pitches(
        (view_count * 0.3 + like_count * 0.5 + comment_count * 0.2) DESC,
        created_at DESC
    ) 
    WHERE status = 'published' AND visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_created_at 
    ON pitches(created_at DESC) 
    WHERE status = 'published' AND visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_user_id 
    ON pitches(user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_genre 
    ON pitches(genre) 
    WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_format 
    ON pitches(format) 
    WHERE status = 'published';

-- Text search indexes for faster searching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_title_trgm 
    ON pitches USING gin(title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_logline_trgm 
    ON pitches USING gin(logline gin_trgm_ops);

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
    ON users(LOWER(email));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username 
    ON users(LOWER(username));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_user_type 
    ON users(user_type);

-- Investments table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_investor_id 
    ON investments(investor_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_pitch_id 
    ON investments(pitch_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_created_at 
    ON investments(created_at DESC);

-- NDAs table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_requester_id 
    ON ndas(requester_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_pitch_id 
    ON ndas(pitch_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_owner_id 
    ON ndas(owner_id, status);

-- Follows table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_id 
    ON follows(follower_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following_id 
    ON follows(following_id);

-- Notifications table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id_read 
    ON notifications(user_id, is_read) 
    WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at 
    ON notifications(created_at DESC);

-- =====================================================
-- 3. CREATE MATERIALIZED VIEWS FOR EXPENSIVE QUERIES
-- =====================================================

-- Trending pitches materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trending_pitches AS
SELECT 
    p.id, p.title, p.logline, p.genre, p.format,
    p.poster_url, p.view_count, p.like_count,
    p.status, p.visibility, p.created_at, p.updated_at,
    u.username as creator_username, 
    u.first_name, u.last_name,
    u.profile_image_url as creator_profile_image,
    (p.view_count * 0.3 + p.like_count * 0.5 + p.comment_count * 0.2) as trending_score
FROM pitches p
LEFT JOIN users u ON p.user_id = u.id
WHERE p.status = 'published' AND p.visibility = 'public'
ORDER BY trending_score DESC, p.created_at DESC
LIMIT 100;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_trending_pitches_score 
    ON mv_trending_pitches(trending_score DESC);

-- Dashboard statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_stats AS
SELECT 
    u.id as user_id,
    u.user_type,
    (SELECT COUNT(*) FROM pitches WHERE user_id = u.id) as total_pitches,
    (SELECT COUNT(*) FROM pitches WHERE user_id = u.id AND status = 'published') as published_pitches,
    (SELECT SUM(view_count) FROM pitches WHERE user_id = u.id) as total_views,
    (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
    (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
    (SELECT COUNT(*) FROM investments WHERE investor_id = u.id AND status = 'active') as active_investments,
    (SELECT COUNT(*) FROM ndas WHERE requester_id = u.id AND status = 'approved') as approved_ndas
FROM users u;

CREATE INDEX IF NOT EXISTS idx_mv_dashboard_stats_user 
    ON mv_dashboard_stats(user_id);

-- =====================================================
-- 4. OPTIMIZE EXISTING QUERIES WITH CTEs
-- =====================================================

-- Create function for optimized trending pitches query
CREATE OR REPLACE FUNCTION get_trending_pitches(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    id INTEGER,
    title VARCHAR,
    logline TEXT,
    genre VARCHAR,
    format VARCHAR,
    poster_url TEXT,
    view_count INTEGER,
    like_count INTEGER,
    creator_username VARCHAR,
    creator_first_name VARCHAR,
    creator_last_name VARCHAR,
    creator_profile_image TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_pitches AS (
        SELECT 
            p.id, p.title, p.logline, p.genre, p.format,
            p.poster_url, p.view_count, p.like_count,
            p.user_id,
            (p.view_count * 0.3 + p.like_count * 0.5 + p.comment_count * 0.2) as score
        FROM pitches p
        WHERE p.status = 'published' AND p.visibility = 'public'
        ORDER BY score DESC, p.created_at DESC
        LIMIT p_limit
    )
    SELECT 
        rp.id, rp.title, rp.logline, rp.genre, rp.format,
        rp.poster_url, rp.view_count, rp.like_count,
        u.username, u.first_name, u.last_name, u.profile_image_url
    FROM ranked_pitches rp
    LEFT JOIN users u ON rp.user_id = u.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. PARTITION LARGE TABLES
-- =====================================================

-- Partition notifications by month (if table is large)
-- Note: Only run if notifications table has >1M rows
/*
CREATE TABLE notifications_partitioned (
    LIKE notifications INCLUDING ALL
) PARTITION BY RANGE (created_at);

CREATE TABLE notifications_y2024m11 PARTITION OF notifications_partitioned
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE notifications_y2024m12 PARTITION OF notifications_partitioned
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Migrate data
INSERT INTO notifications_partitioned SELECT * FROM notifications;
*/

-- =====================================================
-- 6. UPDATE TABLE STATISTICS
-- =====================================================

-- Update statistics for query planner
ANALYZE pitches;
ANALYZE users;
ANALYZE investments;
ANALYZE ndas;
ANALYZE follows;
ANALYZE notifications;

-- =====================================================
-- 7. CONFIGURE CONNECTION POOLING
-- =====================================================

-- Recommended settings for Neon/PostgreSQL
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;

-- =====================================================
-- 8. CREATE REFRESH SCHEDULE FOR MATERIALIZED VIEWS
-- =====================================================

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_pitches;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-mv', '*/5 * * * *', 'SELECT refresh_materialized_views()');

-- =====================================================
-- 9. QUERY PERFORMANCE VIEWS
-- =====================================================

-- View to identify slow queries
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- Queries averaging >100ms
ORDER BY mean_time DESC
LIMIT 20;

-- View to identify missing indexes
CREATE OR REPLACE VIEW v_missing_indexes AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
    AND n_distinct > 100
    AND correlation < 0.1
ORDER BY n_distinct DESC;

-- =====================================================
-- 10. CLEANUP AND MAINTENANCE
-- =====================================================

-- Vacuum and reindex for optimal performance
VACUUM ANALYZE pitches;
VACUUM ANALYZE users;
VACUUM ANALYZE investments;
VACUUM ANALYZE ndas;

-- Reindex critical tables
REINDEX TABLE CONCURRENTLY pitches;
REINDEX TABLE CONCURRENTLY users;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check cache hit ratio (should be >95%)
SELECT 
    sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) as cache_hit_ratio
FROM pg_statio_user_tables;