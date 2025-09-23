-- Comprehensive Database Monitoring Script for Pitchey
-- Monitor key metrics, performance, and health indicators

-- 1. CONNECTION MONITORING
SELECT 
    'Active Connections' as metric,
    COUNT(*) as value,
    'connections' as unit
FROM pg_stat_activity 
WHERE state = 'active' AND datname = 'pitchey'
UNION ALL
SELECT 
    'Idle Connections' as metric,
    COUNT(*) as value,
    'connections' as unit
FROM pg_stat_activity 
WHERE state = 'idle' AND datname = 'pitchey'
UNION ALL
SELECT 
    'Total Connections' as metric,
    COUNT(*) as value,
    'connections' as unit
FROM pg_stat_activity 
WHERE datname = 'pitchey';

-- 2. DATABASE SIZE AND GROWTH
SELECT 
    'Database Size' as metric,
    pg_size_pretty(pg_database_size('pitchey')) as value,
    'bytes' as unit;

-- 3. TABLE SIZES AND ROW COUNTS
SELECT 
    'Table: ' || schemaname || '.' || tablename as metric,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    n_tup_ins as total_inserts,
    n_tup_upd as total_updates,
    n_tup_del as total_deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. INDEX USAGE MONITORING
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    CASE 
        WHEN idx_tup_read = 0 THEN 0 
        ELSE round((idx_tup_fetch::numeric / idx_tup_read) * 100, 2) 
    END as index_efficiency_pct
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_tup_read DESC;

-- 5. ANALYTICS COLUMNS MONITORING
SELECT 
    'Analytics Health Check' as check_type,
    COUNT(*) as total_pitches,
    COUNT(CASE WHEN view_count IS NULL OR view_count < 0 THEN 1 END) as view_count_issues,
    COUNT(CASE WHEN like_count IS NULL OR like_count < 0 THEN 1 END) as like_count_issues,
    COUNT(CASE WHEN comment_count IS NULL OR comment_count < 0 THEN 1 END) as comment_count_issues,
    COUNT(CASE WHEN nda_count IS NULL OR nda_count < 0 THEN 1 END) as nda_count_issues,
    MAX(view_count) as max_views,
    MAX(like_count) as max_likes,
    MAX(comment_count) as max_comments,
    MAX(nda_count) as max_ndas
FROM pitches;

-- 6. REPLICATION LAG (if applicable)
-- SELECT 
--     application_name,
--     client_addr,
--     state,
--     pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) as send_lag,
--     pg_wal_lsn_diff(pg_current_wal_lsn(), write_lsn) as write_lag,
--     pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) as flush_lag,
--     pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) as replay_lag
-- FROM pg_stat_replication;

-- 7. PERFORMANCE METRICS
SELECT 
    'Query Performance' as metric_type,
    calls,
    total_time,
    mean_time,
    query
FROM pg_stat_statements 
WHERE query LIKE '%pitches%'
ORDER BY mean_time DESC 
LIMIT 10;

-- 8. LOCK MONITORING
SELECT 
    'Locks' as metric,
    mode,
    COUNT(*) as lock_count
FROM pg_locks l
JOIN pg_database d ON l.database = d.oid 
WHERE d.datname = 'pitchey'
GROUP BY mode
ORDER BY lock_count DESC;

-- 9. AUTOVACUUM MONITORING
SELECT 
    schemaname,
    tablename,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY last_autovacuum DESC NULLS LAST;

-- 10. ALERT CONDITIONS
WITH alerts AS (
    SELECT 
        CASE 
            WHEN COUNT(*) > 50 THEN 'HIGH CONNECTION COUNT: ' || COUNT(*)::text
            ELSE NULL 
        END as alert
    FROM pg_stat_activity 
    WHERE datname = 'pitchey'
    
    UNION ALL
    
    SELECT 
        CASE 
            WHEN pg_database_size('pitchey') > 5368709120 THEN 'DATABASE SIZE > 5GB: ' || pg_size_pretty(pg_database_size('pitchey'))
            ELSE NULL 
        END as alert
    
    UNION ALL
    
    SELECT 
        CASE 
            WHEN COUNT(*) > 0 THEN 'ANALYTICS INTEGRITY ISSUES: ' || COUNT(*)::text || ' records'
            ELSE NULL 
        END as alert
    FROM pitches 
    WHERE view_count IS NULL OR view_count < 0 
       OR like_count IS NULL OR like_count < 0
       OR comment_count IS NULL OR comment_count < 0
       OR nda_count IS NULL OR nda_count < 0
)
SELECT alert 
FROM alerts 
WHERE alert IS NOT NULL;