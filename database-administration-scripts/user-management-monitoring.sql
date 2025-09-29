-- User Management and Access Control Monitoring
-- For Pitchey Platform PostgreSQL Database

-- ================================
-- USER PERMISSION MATRIX ANALYSIS
-- ================================

-- Check current database roles and permissions
SELECT 
    r.rolname as role_name,
    r.rolsuper as is_superuser,
    r.rolcreaterole as can_create_roles,
    r.rolcreatedb as can_create_databases,
    r.rolcanlogin as can_login,
    r.rolconnlimit as connection_limit,
    r.rolvaliduntil as password_expiry
FROM pg_roles r
WHERE r.rolname NOT LIKE 'pg_%'
ORDER BY r.rolname;

-- ================================
-- SECURITY MONITORING QUERIES
-- ================================

-- 1. Recent Security Events Summary
SELECT 
    event_type,
    event_status,
    COUNT(*) as event_count,
    COUNT(DISTINCT ip_address) as unique_ips,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence
FROM security_events 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type, event_status
ORDER BY event_count DESC;

-- 2. Rate Limiting Analysis
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as rate_limit_violations,
    COUNT(DISTINCT ip_address) as unique_violating_ips,
    string_agg(DISTINCT (metadata->>'endpoint'), ', ') as affected_endpoints
FROM security_events 
WHERE event_type = 'rate_limit_exceeded'
    AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- 3. Suspicious IP Activity
SELECT 
    ip_address,
    COUNT(*) as total_events,
    COUNT(DISTINCT event_type) as event_types,
    string_agg(DISTINCT event_type, ', ') as events,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen,
    COUNT(CASE WHEN event_status = 'failure' THEN 1 END) as failed_attempts
FROM security_events 
WHERE created_at >= NOW() - INTERVAL '7 days'
    AND ip_address IS NOT NULL
GROUP BY ip_address
HAVING COUNT(*) > 10 OR COUNT(CASE WHEN event_status = 'failure' THEN 1 END) > 5
ORDER BY failed_attempts DESC, total_events DESC;

-- 4. User Account Security Status
SELECT 
    u.id,
    u.username,
    u.email,
    u.user_type,
    u.email_verified,
    u.company_verified,
    u.is_active,
    u.failed_login_attempts,
    u.account_locked_at,
    u.account_lock_reason,
    u.last_login_at,
    u.two_factor_enabled,
    CASE 
        WHEN u.account_locked_at IS NOT NULL THEN 'LOCKED'
        WHEN u.failed_login_attempts >= 5 THEN 'AT_RISK'
        WHEN u.last_login_at < NOW() - INTERVAL '90 days' THEN 'INACTIVE'
        WHEN NOT u.email_verified THEN 'UNVERIFIED'
        ELSE 'NORMAL'
    END as security_status
FROM users u
WHERE u.is_active = true
ORDER BY 
    CASE 
        WHEN u.account_locked_at IS NOT NULL THEN 1
        WHEN u.failed_login_attempts >= 5 THEN 2
        WHEN u.last_login_at < NOW() - INTERVAL '90 days' THEN 3
        WHEN NOT u.email_verified THEN 4
        ELSE 5
    END,
    u.failed_login_attempts DESC;

-- ================================
-- PERFORMANCE MONITORING QUERIES
-- ================================

-- 5. Database Connection Analysis
SELECT 
    datname as database,
    state,
    COUNT(*) as connection_count,
    COUNT(DISTINCT client_addr) as unique_clients
FROM pg_stat_activity 
WHERE datname IS NOT NULL
GROUP BY datname, state
ORDER BY connection_count DESC;

-- 6. Active Sessions Analysis
SELECT 
    s.user_id,
    u.username,
    u.user_type,
    COUNT(*) as active_sessions,
    MIN(s.created_at) as oldest_session,
    MAX(s.last_activity) as most_recent_activity,
    COUNT(DISTINCT s.ip_address) as unique_ips
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.expires_at > NOW()
GROUP BY s.user_id, u.username, u.user_type
ORDER BY active_sessions DESC;

-- 7. Table Size and Growth Monitoring
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as data_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = schemaname AND table_name = tablename) as row_estimate
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- 8. Index Usage Statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE WHEN idx_scan = 0 THEN 'UNUSED' ELSE 'ACTIVE' END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ================================
-- DATA INTEGRITY CHECKS
-- ================================

-- 9. Orphaned Records Check
SELECT 'users_without_email_preferences' as check_name, COUNT(*) as orphaned_count
FROM users u 
LEFT JOIN email_preferences ep ON u.id = ep.user_id 
WHERE ep.user_id IS NULL AND u.is_active = true

UNION ALL

SELECT 'sessions_with_invalid_users', COUNT(*)
FROM sessions s 
LEFT JOIN users u ON s.user_id = u.id 
WHERE u.id IS NULL

UNION ALL

SELECT 'messages_with_invalid_senders', COUNT(*)
FROM messages m 
LEFT JOIN users u ON m.sender_id = u.id 
WHERE u.id IS NULL

UNION ALL

SELECT 'pitches_with_invalid_users', COUNT(*)
FROM pitches p 
LEFT JOIN users u ON p.user_id = u.id 
WHERE u.id IS NULL;

-- 10. Business Logic Integrity
SELECT 
    'pitch_consistency' as check_name,
    COUNT(*) as issues_found,
    'Pitches with view_count but no pitch_views records' as description
FROM pitches p
WHERE p.view_count > 0 
    AND NOT EXISTS (SELECT 1 FROM pitch_views pv WHERE pv.pitch_id = p.id)

UNION ALL

SELECT 
    'user_credits_consistency',
    COUNT(*),
    'Users without user_credits records'
FROM users u
WHERE u.is_active = true 
    AND NOT EXISTS (SELECT 1 FROM user_credits uc WHERE uc.user_id = u.id)

UNION ALL

SELECT 
    'security_events_metadata',
    COUNT(*),
    'Security events without required metadata'
FROM security_events se
WHERE se.event_type = 'rate_limit_exceeded' 
    AND (se.metadata IS NULL OR NOT (se.metadata ? 'endpoint'));

-- ================================
-- AUTOMATED MAINTENANCE QUERIES
-- ================================

-- 11. Cleanup Expired Sessions
-- DELETE FROM sessions WHERE expires_at < NOW();

-- 12. Cleanup Old Security Events (older than 1 year)
-- DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '1 year';

-- 13. Reset Failed Login Attempts for Unlocked Accounts
-- UPDATE users 
-- SET failed_login_attempts = 0 
-- WHERE account_locked_at IS NULL 
--   AND failed_login_attempts > 0 
--   AND last_login_at > NOW() - INTERVAL '24 hours';

-- ================================
-- ALERTING THRESHOLDS
-- ================================

-- High Priority Alerts
SELECT 
    'HIGH_PRIORITY_ALERTS' as alert_level,
    'locked_accounts' as alert_type,
    COUNT(*) as count,
    'Users with locked accounts' as description
FROM users 
WHERE account_locked_at IS NOT NULL

UNION ALL

SELECT 
    'HIGH_PRIORITY_ALERTS',
    'rate_limit_spike',
    COUNT(*),
    'Rate limit violations in last hour'
FROM security_events 
WHERE event_type = 'rate_limit_exceeded' 
    AND created_at > NOW() - INTERVAL '1 hour'
HAVING COUNT(*) > 50

UNION ALL

SELECT 
    'HIGH_PRIORITY_ALERTS',
    'connection_limit_warning',
    COUNT(*),
    'Active database connections'
FROM pg_stat_activity 
WHERE datname = current_database()
HAVING COUNT(*) > (SELECT setting::int * 0.8 FROM pg_settings WHERE name = 'max_connections');

-- Medium Priority Alerts
SELECT 
    'MEDIUM_PRIORITY_ALERTS' as alert_level,
    'unverified_users' as alert_type,
    COUNT(*) as count,
    'Active users without email verification' as description
FROM users 
WHERE is_active = true 
    AND NOT email_verified 
    AND created_at < NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'MEDIUM_PRIORITY_ALERTS',
    'inactive_sessions',
    COUNT(*),
    'Sessions inactive for more than 7 days'
FROM sessions 
WHERE last_activity < NOW() - INTERVAL '7 days' 
    AND expires_at > NOW();

-- ================================
-- CAPACITY PLANNING METRICS
-- ================================

-- Growth Metrics
SELECT 
    'growth_metrics' as metric_type,
    'daily_user_registrations' as metric_name,
    COUNT(*) as value,
    DATE(created_at) as date
FROM users 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;

-- Storage Usage Trends
SELECT 
    'storage_trends' as metric_type,
    'database_size_mb' as metric_name,
    ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) as value_mb,
    NOW() as measured_at;

-- Performance Baselines
SELECT 
    'performance_baseline' as metric_type,
    'avg_query_time_ms' as metric_name,
    ROUND(AVG(mean_exec_time)::numeric, 2) as value_ms
FROM pg_stat_statements 
WHERE calls > 10;

-- ================================
-- DISASTER RECOVERY VERIFICATION
-- ================================

-- Critical Table Row Counts (for DR verification)
SELECT 
    'dr_verification' as check_type,
    'table_row_counts' as check_name,
    json_object_agg(table_name, row_count) as table_counts
FROM (
    SELECT 'users' as table_name, COUNT(*) as row_count FROM users
    UNION ALL
    SELECT 'pitches', COUNT(*) FROM pitches
    UNION ALL
    SELECT 'sessions', COUNT(*) FROM sessions
    UNION ALL
    SELECT 'security_events', COUNT(*) FROM security_events
    UNION ALL
    SELECT 'messages', COUNT(*) FROM messages
) table_counts;

-- Index Integrity Check
SELECT 
    'dr_verification' as check_type,
    'index_integrity' as check_name,
    COUNT(*) as total_indexes,
    COUNT(CASE WHEN idx_scan > 0 THEN 1 END) as used_indexes,
    COUNT(CASE WHEN idx_scan = 0 THEN 1 END) as unused_indexes
FROM pg_stat_user_indexes 
WHERE schemaname = 'public';

-- Foreign Key Constraint Verification
SELECT 
    'dr_verification' as check_type,
    'foreign_key_constraints' as check_name,
    COUNT(*) as total_constraints
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
    AND table_schema = 'public';