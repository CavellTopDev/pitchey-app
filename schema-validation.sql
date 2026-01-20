-- ============================================================================
-- DATABASE SCHEMA VALIDATION AND MONITORING
-- Pitchey Platform - Ongoing Health Checks
-- ============================================================================
-- Purpose: Regular validation queries for database health monitoring
-- Frequency: Run daily or after schema changes
-- ============================================================================

-- ============================================================================
-- 1. ORPHANED RECORDS CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION check_orphaned_records()
RETURNS TABLE(
  check_name TEXT,
  table_name TEXT,
  orphan_count BIGINT,
  severity TEXT,
  fix_query TEXT
) AS $$
BEGIN
  RETURN QUERY

  -- Messages without valid conversation
  SELECT
    'Messages without conversation'::TEXT,
    'messages'::TEXT,
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'CRITICAL' ELSE 'OK' END::TEXT,
    'DELETE FROM messages WHERE conversation_id IS NOT NULL AND conversation_id NOT IN (SELECT id FROM conversations);'::TEXT
  FROM messages m
  LEFT JOIN conversations c ON m.conversation_id = c.id
  WHERE m.conversation_id IS NOT NULL AND c.id IS NULL

  UNION ALL

  -- Conversation participants without conversation
  SELECT
    'Participants without conversation',
    'conversation_participants',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'CRITICAL' ELSE 'OK' END,
    'DELETE FROM conversation_participants WHERE conversation_id NOT IN (SELECT id FROM conversations);'
  FROM conversation_participants cp
  LEFT JOIN conversations c ON cp.conversation_id = c.id
  WHERE c.id IS NULL

  UNION ALL

  -- Notifications with deleted users
  SELECT
    'Notifications with deleted users',
    'notifications',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'HIGH' ELSE 'OK' END,
    'DELETE FROM notifications WHERE user_id NOT IN (SELECT id FROM users);'
  FROM notifications n
  LEFT JOIN users u ON n.user_id = u.id
  WHERE u.id IS NULL

  UNION ALL

  -- Investments without pitch
  SELECT
    'Investments without pitch',
    'investments',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'CRITICAL' ELSE 'OK' END,
    'DELETE FROM investments WHERE pitch_id IS NOT NULL AND pitch_id NOT IN (SELECT id FROM pitches);'
  FROM investments i
  LEFT JOIN pitches p ON i.pitch_id = p.id
  WHERE i.pitch_id IS NOT NULL AND p.id IS NULL

  UNION ALL

  -- Investments without investor
  SELECT
    'Investments without investor',
    'investments',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'CRITICAL' ELSE 'OK' END,
    'DELETE FROM investments WHERE investor_id IS NOT NULL AND investor_id NOT IN (SELECT id FROM users);'
  FROM investments i
  LEFT JOIN users u ON i.investor_id = u.id
  WHERE i.investor_id IS NOT NULL AND u.id IS NULL

  UNION ALL

  -- NDAs without pitch
  SELECT
    'NDAs without pitch',
    'ndas',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'CRITICAL' ELSE 'OK' END,
    'DELETE FROM ndas WHERE pitch_id NOT IN (SELECT id FROM pitches);'
  FROM ndas n
  LEFT JOIN pitches p ON n.pitch_id = p.id
  WHERE p.id IS NULL

  UNION ALL

  -- NDAs without signer
  SELECT
    'NDAs without signer',
    'ndas',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'CRITICAL' ELSE 'OK' END,
    'DELETE FROM ndas WHERE signer_id NOT IN (SELECT id FROM users);'
  FROM ndas n
  LEFT JOIN users u ON n.signer_id = u.id
  WHERE u.id IS NULL

  UNION ALL

  -- Pitch views without pitch
  SELECT
    'Pitch views without pitch',
    'pitch_views',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'MEDIUM' ELSE 'OK' END,
    'DELETE FROM pitch_views WHERE pitch_id NOT IN (SELECT id FROM pitches);'
  FROM pitch_views pv
  LEFT JOIN pitches p ON pv.pitch_id = p.id
  WHERE p.id IS NULL

  UNION ALL

  -- Follows without pitch or creator
  SELECT
    'Follows without target',
    'follows',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'MEDIUM' ELSE 'OK' END,
    'DELETE FROM follows WHERE (pitch_id IS NULL AND creator_id IS NULL);'
  FROM follows f
  WHERE f.pitch_id IS NULL AND f.creator_id IS NULL;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_orphaned_records() IS 'Daily health check for orphaned records';

-- Run the check
SELECT * FROM check_orphaned_records()
ORDER BY
  CASE severity
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    ELSE 4
  END,
  orphan_count DESC;

-- ============================================================================
-- 2. CONSTRAINT VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_constraints()
RETURNS TABLE(
  check_name TEXT,
  table_name TEXT,
  violation_count BIGINT,
  severity TEXT,
  sample_ids TEXT
) AS $$
BEGIN
  RETURN QUERY

  -- Check for NULL in NOT NULL columns
  SELECT
    'NULL investor_id in investments'::TEXT,
    'investments'::TEXT,
    COUNT(*),
    'CRITICAL'::TEXT,
    STRING_AGG(id::TEXT, ', ') FILTER (WHERE id IS NOT NULL)
  FROM investments
  WHERE investor_id IS NULL

  UNION ALL

  SELECT
    'NULL pitch_id in investments',
    'investments',
    COUNT(*),
    'CRITICAL',
    STRING_AGG(id::TEXT, ', ')
  FROM investments
  WHERE pitch_id IS NULL

  UNION ALL

  SELECT
    'NULL conversation_id in messages',
    'messages',
    COUNT(*),
    'CRITICAL',
    STRING_AGG(id::TEXT, ', ')
  FROM messages
  WHERE conversation_id IS NULL

  UNION ALL

  SELECT
    'NULL user_id in pitches',
    'pitches',
    COUNT(*),
    'CRITICAL',
    STRING_AGG(id::TEXT, ', ')
  FROM pitches
  WHERE user_id IS NULL

  UNION ALL

  -- Check for negative counts
  SELECT
    'Negative view_count in pitches',
    'pitches',
    COUNT(*),
    'HIGH',
    STRING_AGG(id::TEXT, ', ')
  FROM pitches
  WHERE view_count < 0

  UNION ALL

  SELECT
    'Negative like_count in pitches',
    'pitches',
    COUNT(*),
    'HIGH',
    STRING_AGG(id::TEXT, ', ')
  FROM pitches
  WHERE like_count < 0

  UNION ALL

  -- Check for invalid investment amounts
  SELECT
    'Zero or negative investment amounts',
    'investments',
    COUNT(*),
    'CRITICAL',
    STRING_AGG(id::TEXT, ', ')
  FROM investments
  WHERE amount <= 0

  UNION ALL

  -- Check for future created_at timestamps
  SELECT
    'Future created_at in pitches',
    'pitches',
    COUNT(*),
    'MEDIUM',
    STRING_AGG(id::TEXT, ', ')
  FROM pitches
  WHERE created_at > NOW() + INTERVAL '1 hour'

  UNION ALL

  -- Check for expired sessions still marked active
  SELECT
    'Expired sessions',
    'sessions',
    COUNT(*),
    'LOW',
    LEFT(STRING_AGG(id::TEXT, ', '), 100)
  FROM sessions
  WHERE expires_at < NOW();

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_constraints() IS 'Validate data integrity constraints';

-- Run constraint validation
SELECT * FROM validate_constraints()
WHERE violation_count > 0
ORDER BY
  CASE severity
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    ELSE 4
  END,
  violation_count DESC;

-- ============================================================================
-- 3. SCHEMA DRIFT DETECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION check_schema_drift()
RETURNS TABLE(
  issue_type TEXT,
  table_name TEXT,
  column_name TEXT,
  expected_value TEXT,
  actual_value TEXT,
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY

  -- Check for missing NOT NULL constraints
  SELECT
    'Missing NOT NULL constraint'::TEXT,
    c.table_name::TEXT,
    c.column_name::TEXT,
    'NOT NULL'::TEXT,
    c.is_nullable::TEXT,
    'HIGH'::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.is_nullable = 'YES'
    AND (
      (c.table_name = 'investments' AND c.column_name IN ('investor_id', 'pitch_id'))
      OR (c.table_name = 'messages' AND c.column_name = 'conversation_id')
      OR (c.table_name = 'pitches' AND c.column_name = 'user_id')
      OR (c.table_name = 'ndas' AND c.column_name IN ('pitch_id', 'signer_id'))
    )

  UNION ALL

  -- Check for missing foreign keys
  SELECT
    'Missing foreign key',
    'portfolio',
    'user_id',
    'FOREIGN KEY to users(id)',
    'NONE',
    'HIGH'
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'portfolio'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%user_id%'
  )

  UNION ALL

  SELECT
    'Missing foreign key',
    'documents',
    'owner_id',
    'FOREIGN KEY to users(id)',
    'NONE',
    'HIGH'
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'documents'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%owner_id%'
  );

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_schema_drift() IS 'Detect deviations from expected schema';

-- Run schema drift check
SELECT * FROM check_schema_drift()
ORDER BY severity, table_name;

-- ============================================================================
-- 4. INDEX HEALTH CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION check_index_health()
RETURNS TABLE(
  index_name TEXT,
  table_name TEXT,
  index_size TEXT,
  index_scans BIGINT,
  rows_read BIGINT,
  rows_fetched BIGINT,
  usage_ratio NUMERIC,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.indexname::TEXT,
    s.tablename::TEXT,
    pg_size_pretty(pg_relation_size(s.indexrelid)),
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    CASE
      WHEN s.idx_scan > 0 THEN
        ROUND((s.idx_tup_fetch::NUMERIC / s.idx_scan), 2)
      ELSE 0
    END as usage_ratio,
    CASE
      WHEN s.idx_scan = 0 AND pg_relation_size(s.indexrelid) > 1024*1024 THEN
        'CONSIDER DROPPING - Unused and large'
      WHEN s.idx_scan < 100 AND pg_relation_size(s.indexrelid) > 10*1024*1024 THEN
        'LOW USAGE - Review if needed'
      WHEN s.idx_tup_fetch::NUMERIC / NULLIF(s.idx_scan, 0) < 1 THEN
        'LOW EFFICIENCY - Review index definition'
      ELSE
        'OK'
    END::TEXT
  FROM pg_stat_user_indexes s
  WHERE s.schemaname = 'public'
    AND s.indexname NOT LIKE 'pg_%'
  ORDER BY
    CASE
      WHEN s.idx_scan = 0 THEN 1
      WHEN s.idx_scan < 100 THEN 2
      ELSE 3
    END,
    pg_relation_size(s.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_index_health() IS 'Analyze index usage and efficiency';

-- Run index health check
SELECT * FROM check_index_health()
WHERE recommendation != 'OK'
LIMIT 20;

-- ============================================================================
-- 5. TABLE STATISTICS AND BLOAT
-- ============================================================================

CREATE OR REPLACE FUNCTION check_table_health()
RETURNS TABLE(
  table_name TEXT,
  row_count BIGINT,
  table_size TEXT,
  indexes_size TEXT,
  total_size TEXT,
  dead_tuples BIGINT,
  live_tuples BIGINT,
  bloat_ratio NUMERIC,
  last_vacuum TIMESTAMP,
  last_analyze TIMESTAMP,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.relname::TEXT,
    s.n_live_tup,
    pg_size_pretty(pg_relation_size(s.relid)),
    pg_size_pretty(pg_indexes_size(s.relid)),
    pg_size_pretty(pg_total_relation_size(s.relid)),
    s.n_dead_tup,
    s.n_live_tup,
    CASE
      WHEN s.n_live_tup > 0 THEN
        ROUND((s.n_dead_tup::NUMERIC / s.n_live_tup) * 100, 2)
      ELSE 0
    END as bloat_ratio,
    s.last_vacuum,
    s.last_autovacuum,
    CASE
      WHEN s.n_dead_tup::NUMERIC / NULLIF(s.n_live_tup, 0) > 0.2 THEN
        'VACUUM RECOMMENDED - High dead tuple ratio'
      WHEN s.last_vacuum IS NULL AND s.last_autovacuum IS NULL THEN
        'VACUUM NEEDED - Never vacuumed'
      WHEN COALESCE(s.last_vacuum, s.last_autovacuum) < NOW() - INTERVAL '7 days' THEN
        'VACUUM RECOMMENDED - Last vacuum >7 days ago'
      WHEN s.last_analyze IS NULL AND s.last_autoanalyze IS NULL THEN
        'ANALYZE NEEDED - Never analyzed'
      WHEN COALESCE(s.last_analyze, s.last_autoanalyze) < NOW() - INTERVAL '7 days' THEN
        'ANALYZE RECOMMENDED - Last analyze >7 days ago'
      ELSE
        'OK'
    END::TEXT
  FROM pg_stat_user_tables s
  WHERE s.schemaname = 'public'
  ORDER BY pg_total_relation_size(s.relid) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_table_health() IS 'Monitor table health, bloat, and maintenance status';

-- Run table health check
SELECT * FROM check_table_health()
WHERE recommendation != 'OK'
   OR bloat_ratio > 20;

-- ============================================================================
-- 6. CONNECTION AND PERFORMANCE MONITORING
-- ============================================================================

CREATE OR REPLACE FUNCTION check_database_performance()
RETURNS TABLE(
  metric_name TEXT,
  metric_value TEXT,
  threshold TEXT,
  status TEXT,
  recommendation TEXT
) AS $$
DECLARE
  active_connections INTEGER;
  max_connections INTEGER;
  cache_hit_ratio NUMERIC;
  avg_query_time NUMERIC;
BEGIN

  -- Get connection stats
  SELECT COUNT(*) INTO active_connections
  FROM pg_stat_activity
  WHERE state = 'active';

  SELECT setting::INTEGER INTO max_connections
  FROM pg_settings
  WHERE name = 'max_connections';

  -- Get cache hit ratio
  SELECT
    ROUND(
      SUM(blks_hit) * 100.0 / NULLIF(SUM(blks_hit + blks_read), 0),
      2
    ) INTO cache_hit_ratio
  FROM pg_stat_database
  WHERE datname = current_database();

  -- Get average query time (if pg_stat_statements is available)
  BEGIN
    SELECT AVG(mean_exec_time) INTO avg_query_time
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database());
  EXCEPTION
    WHEN undefined_table THEN
      avg_query_time := NULL;
  END;

  RETURN QUERY

  -- Active connections
  SELECT
    'Active Connections'::TEXT,
    active_connections::TEXT,
    (max_connections * 0.8)::TEXT || ' (80% of max)',
    CASE
      WHEN active_connections::NUMERIC / max_connections > 0.8 THEN 'WARNING'
      WHEN active_connections::NUMERIC / max_connections > 0.9 THEN 'CRITICAL'
      ELSE 'OK'
    END::TEXT,
    CASE
      WHEN active_connections::NUMERIC / max_connections > 0.8 THEN
        'High connection usage - Consider connection pooling or increasing max_connections'
      ELSE
        'Connection usage healthy'
    END::TEXT

  UNION ALL

  -- Cache hit ratio
  SELECT
    'Cache Hit Ratio (%)',
    COALESCE(cache_hit_ratio::TEXT, 'N/A'),
    '99.0',
    CASE
      WHEN cache_hit_ratio IS NULL THEN 'UNKNOWN'
      WHEN cache_hit_ratio < 95 THEN 'CRITICAL'
      WHEN cache_hit_ratio < 99 THEN 'WARNING'
      ELSE 'OK'
    END,
    CASE
      WHEN cache_hit_ratio IS NULL THEN 'Unable to calculate'
      WHEN cache_hit_ratio < 95 THEN
        'Low cache hit ratio - Consider increasing shared_buffers'
      WHEN cache_hit_ratio < 99 THEN
        'Cache hit ratio below optimal - Monitor and tune'
      ELSE
        'Cache performance healthy'
    END

  UNION ALL

  -- Average query time
  SELECT
    'Avg Query Time (ms)',
    COALESCE(ROUND(avg_query_time, 2)::TEXT, 'N/A'),
    '100.0',
    CASE
      WHEN avg_query_time IS NULL THEN 'UNKNOWN'
      WHEN avg_query_time > 500 THEN 'CRITICAL'
      WHEN avg_query_time > 100 THEN 'WARNING'
      ELSE 'OK'
    END,
    CASE
      WHEN avg_query_time IS NULL THEN
        'Install pg_stat_statements extension to track query performance'
      WHEN avg_query_time > 500 THEN
        'High average query time - Review slow queries'
      WHEN avg_query_time > 100 THEN
        'Query performance could be improved'
      ELSE
        'Query performance healthy'
    END;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_database_performance() IS 'Monitor key database performance metrics';

-- Run performance check
SELECT * FROM check_database_performance();

-- ============================================================================
-- 7. SLOW QUERY IDENTIFICATION
-- ============================================================================

-- Get slow queries (requires pg_stat_statements extension)
-- Uncomment if pg_stat_statements is installed:

/*
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT
  LEFT(query, 100) as query_preview,
  calls,
  ROUND(mean_exec_time::NUMERIC, 2) as avg_time_ms,
  ROUND(total_exec_time::NUMERIC, 2) as total_time_ms,
  ROUND((100 * total_exec_time / SUM(total_exec_time) OVER ())::NUMERIC, 2) as pct_total_time
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;
*/

-- ============================================================================
-- 8. COMPREHENSIVE HEALTH REPORT
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_health_report()
RETURNS VOID AS $$
BEGIN
  RAISE NOTICE '=== PITCHEY DATABASE HEALTH REPORT ===';
  RAISE NOTICE 'Generated: %', NOW();
  RAISE NOTICE '';

  RAISE NOTICE '--- 1. ORPHANED RECORDS CHECK ---';
  PERFORM * FROM check_orphaned_records() WHERE orphan_count > 0;

  RAISE NOTICE '';
  RAISE NOTICE '--- 2. CONSTRAINT VIOLATIONS ---';
  PERFORM * FROM validate_constraints() WHERE violation_count > 0;

  RAISE NOTICE '';
  RAISE NOTICE '--- 3. SCHEMA DRIFT ---';
  PERFORM * FROM check_schema_drift();

  RAISE NOTICE '';
  RAISE NOTICE '--- 4. UNUSED INDEXES ---';
  PERFORM * FROM check_index_health() WHERE recommendation != 'OK';

  RAISE NOTICE '';
  RAISE NOTICE '--- 5. TABLE MAINTENANCE NEEDED ---';
  PERFORM * FROM check_table_health()
  WHERE recommendation != 'OK' OR bloat_ratio > 20;

  RAISE NOTICE '';
  RAISE NOTICE '--- 6. PERFORMANCE METRICS ---';
  PERFORM * FROM check_database_performance();

  RAISE NOTICE '';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Report complete. Review notices above for issues.';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_health_report() IS 'Generate comprehensive database health report';

-- Run full health report
SELECT generate_health_report();

-- ============================================================================
-- 9. SCHEDULED MAINTENANCE RECOMMENDATIONS
-- ============================================================================

-- Create a maintenance log table
CREATE TABLE IF NOT EXISTS maintenance_log (
  id SERIAL PRIMARY KEY,
  maintenance_type VARCHAR(50) NOT NULL,
  table_name TEXT,
  status VARCHAR(20) NOT NULL,
  duration_ms INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE maintenance_log IS 'Track database maintenance operations';

-- Function to log maintenance operations
CREATE OR REPLACE FUNCTION log_maintenance(
  p_maintenance_type VARCHAR(50),
  p_table_name TEXT,
  p_status VARCHAR(20),
  p_duration_ms INTEGER DEFAULT NULL,
  p_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO maintenance_log (
    maintenance_type,
    table_name,
    status,
    duration_ms,
    details
  ) VALUES (
    p_maintenance_type,
    p_table_name,
    p_status,
    p_duration_ms,
    p_details
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. CLEANUP AND OPTIMIZATION SCRIPTS
-- ============================================================================

-- Cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sessions
  WHERE expires_at < NOW()
  RETURNING * INTO deleted_count;

  PERFORM log_maintenance(
    'cleanup_sessions',
    'sessions',
    'completed',
    NULL,
    jsonb_build_object('deleted_count', deleted_count)
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Vacuum and analyze all tables
CREATE OR REPLACE FUNCTION maintenance_vacuum_analyze()
RETURNS VOID AS $$
DECLARE
  table_record RECORD;
  start_time TIMESTAMP;
  duration_ms INTEGER;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    start_time := clock_timestamp();

    EXECUTE 'VACUUM ANALYZE ' || quote_ident(table_record.tablename);

    duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;

    PERFORM log_maintenance(
      'vacuum_analyze',
      table_record.tablename,
      'completed',
      duration_ms,
      NULL
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF VALIDATION SCRIPT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== SCHEMA VALIDATION SCRIPT LOADED ===';
  RAISE NOTICE 'Available functions:';
  RAISE NOTICE '  - check_orphaned_records()';
  RAISE NOTICE '  - validate_constraints()';
  RAISE NOTICE '  - check_schema_drift()';
  RAISE NOTICE '  - check_index_health()';
  RAISE NOTICE '  - check_table_health()';
  RAISE NOTICE '  - check_database_performance()';
  RAISE NOTICE '  - generate_health_report()';
  RAISE NOTICE '  - cleanup_expired_sessions()';
  RAISE NOTICE '  - maintenance_vacuum_analyze()';
  RAISE NOTICE '========================================';
END $$;
