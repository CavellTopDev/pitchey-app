-- Automated Database Maintenance and Alerting
-- For Pitchey Platform PostgreSQL Database

-- ================================
-- MAINTENANCE AUTOMATION
-- ================================

-- Create maintenance log table
CREATE TABLE IF NOT EXISTS maintenance_log (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- success, failure, running
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    details JSONB,
    rows_affected INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for maintenance log queries
CREATE INDEX IF NOT EXISTS idx_maintenance_log_task_date ON maintenance_log(task_name, created_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_status ON maintenance_log(status);

-- ================================
-- AUTOMATED CLEANUP PROCEDURES
-- ================================

-- Function to log maintenance tasks
CREATE OR REPLACE FUNCTION log_maintenance_task(
    p_task_name VARCHAR(100),
    p_status VARCHAR(20),
    p_details JSONB DEFAULT NULL,
    p_rows_affected INTEGER DEFAULT NULL,
    p_execution_time_ms INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    log_id INTEGER;
BEGIN
    INSERT INTO maintenance_log (
        task_name, status, end_time, details, rows_affected, execution_time_ms
    ) VALUES (
        p_task_name, p_status, NOW(), p_details, p_rows_affected, p_execution_time_ms
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- CLEANUP EXPIRED SESSIONS
-- ================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
    start_time TIMESTAMP;
    rows_deleted INTEGER;
    execution_time INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Delete expired sessions
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'cleanup_expired_sessions',
        'success',
        jsonb_build_object('threshold', NOW()::text),
        rows_deleted,
        execution_time
    );
    
    RETURN rows_deleted;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'cleanup_expired_sessions',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- CLEANUP OLD SECURITY EVENTS
-- ================================
CREATE OR REPLACE FUNCTION cleanup_old_security_events() RETURNS INTEGER AS $$
DECLARE
    start_time TIMESTAMP;
    rows_deleted INTEGER;
    execution_time INTEGER;
    cutoff_date TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    cutoff_date := NOW() - INTERVAL '1 year';
    
    -- Delete old security events (keep 1 year)
    DELETE FROM security_events WHERE created_at < cutoff_date;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'cleanup_old_security_events',
        'success',
        jsonb_build_object('cutoff_date', cutoff_date::text),
        rows_deleted,
        execution_time
    );
    
    RETURN rows_deleted;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'cleanup_old_security_events',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- CLEANUP OLD ANALYTICS EVENTS
-- ================================
CREATE OR REPLACE FUNCTION cleanup_old_analytics_events() RETURNS INTEGER AS $$
DECLARE
    start_time TIMESTAMP;
    rows_deleted INTEGER;
    execution_time INTEGER;
    cutoff_date TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    cutoff_date := NOW() - INTERVAL '6 months';
    
    -- Delete old analytics events (keep 6 months)
    DELETE FROM analytics_events WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'cleanup_old_analytics_events',
        'success',
        jsonb_build_object('cutoff_date', cutoff_date::text),
        rows_deleted,
        execution_time
    );
    
    RETURN rows_deleted;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'cleanup_old_analytics_events',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- UPDATE TABLE STATISTICS
-- ================================
CREATE OR REPLACE FUNCTION update_table_statistics() RETURNS TEXT AS $$
DECLARE
    start_time TIMESTAMP;
    execution_time INTEGER;
    table_name TEXT;
    tables_processed INTEGER := 0;
BEGIN
    start_time := clock_timestamp();
    
    -- Update statistics for all user tables
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(table_name);
        tables_processed := tables_processed + 1;
    END LOOP;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'update_table_statistics',
        'success',
        jsonb_build_object('tables_processed', tables_processed),
        tables_processed,
        execution_time
    );
    
    RETURN format('Analyzed %s tables in %s ms', tables_processed, execution_time);
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'update_table_statistics',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- VACUUM CRITICAL TABLES
-- ================================
CREATE OR REPLACE FUNCTION vacuum_critical_tables() RETURNS TEXT AS $$
DECLARE
    start_time TIMESTAMP;
    execution_time INTEGER;
    table_name TEXT;
    critical_tables TEXT[] := ARRAY['users', 'pitches', 'security_events', 'sessions', 'messages', 'analytics_events'];
    tables_processed INTEGER := 0;
BEGIN
    start_time := clock_timestamp();
    
    -- Vacuum critical tables
    FOREACH table_name IN ARRAY critical_tables
    LOOP
        EXECUTE 'VACUUM ANALYZE ' || quote_ident(table_name);
        tables_processed := tables_processed + 1;
    END LOOP;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'vacuum_critical_tables',
        'success',
        jsonb_build_object('tables_processed', tables_processed, 'tables', critical_tables),
        tables_processed,
        execution_time
    );
    
    RETURN format('Vacuumed %s critical tables in %s ms', tables_processed, execution_time);
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'vacuum_critical_tables',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- RESET FAILED LOGIN ATTEMPTS
-- ================================
CREATE OR REPLACE FUNCTION reset_failed_login_attempts() RETURNS INTEGER AS $$
DECLARE
    start_time TIMESTAMP;
    rows_updated INTEGER;
    execution_time INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Reset failed login attempts for users who have successfully logged in recently
    UPDATE users 
    SET failed_login_attempts = 0 
    WHERE failed_login_attempts > 0 
      AND last_login_at > NOW() - INTERVAL '24 hours'
      AND account_locked_at IS NULL;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'reset_failed_login_attempts',
        'success',
        jsonb_build_object('threshold_hours', 24),
        rows_updated,
        execution_time
    );
    
    RETURN rows_updated;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'reset_failed_login_attempts',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- COMPREHENSIVE MAINTENANCE FUNCTION
-- ================================
CREATE OR REPLACE FUNCTION run_daily_maintenance() RETURNS TEXT AS $$
DECLARE
    results TEXT := '';
    cleanup_result INTEGER;
    maintenance_result TEXT;
BEGIN
    results := 'Daily Maintenance Report - ' || NOW()::text || E'\n';
    results := results || '================================' || E'\n';
    
    -- Cleanup expired sessions
    cleanup_result := cleanup_expired_sessions();
    results := results || format('Expired sessions cleaned: %s', cleanup_result) || E'\n';
    
    -- Cleanup old security events
    cleanup_result := cleanup_old_security_events();
    results := results || format('Old security events cleaned: %s', cleanup_result) || E'\n';
    
    -- Cleanup old analytics events
    cleanup_result := cleanup_old_analytics_events();
    results := results || format('Old analytics events cleaned: %s', cleanup_result) || E'\n';
    
    -- Reset failed login attempts
    cleanup_result := reset_failed_login_attempts();
    results := results || format('Failed login attempts reset: %s', cleanup_result) || E'\n';
    
    -- Update table statistics
    maintenance_result := update_table_statistics();
    results := results || maintenance_result || E'\n';
    
    -- Vacuum critical tables
    maintenance_result := vacuum_critical_tables();
    results := results || maintenance_result || E'\n';
    
    results := results || '================================' || E'\n';
    results := results || 'Daily maintenance completed successfully';
    
    RETURN results;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'run_daily_maintenance',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- ALERTING AND MONITORING FUNCTIONS
-- ================================

-- Create alerts table
CREATE TABLE IF NOT EXISTS database_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- critical, warning, info
    message TEXT NOT NULL,
    threshold_value NUMERIC,
    current_value NUMERIC,
    metadata JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for alerts
CREATE INDEX IF NOT EXISTS idx_database_alerts_active ON database_alerts(is_active, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_database_alerts_type ON database_alerts(alert_type);

-- Function to create alerts
CREATE OR REPLACE FUNCTION create_alert(
    p_alert_type VARCHAR(50),
    p_severity VARCHAR(20),
    p_message TEXT,
    p_threshold_value NUMERIC DEFAULT NULL,
    p_current_value NUMERIC DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    alert_id INTEGER;
    existing_alert INTEGER;
BEGIN
    -- Check if similar active alert already exists
    SELECT id INTO existing_alert
    FROM database_alerts
    WHERE alert_type = p_alert_type
      AND is_active = true
      AND created_at > NOW() - INTERVAL '1 hour';
    
    -- Only create alert if no similar active alert exists
    IF existing_alert IS NULL THEN
        INSERT INTO database_alerts (
            alert_type, severity, message, threshold_value, current_value, metadata
        ) VALUES (
            p_alert_type, p_severity, p_message, p_threshold_value, p_current_value, p_metadata
        ) RETURNING id INTO alert_id;
        
        RETURN alert_id;
    ELSE
        RETURN existing_alert;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve alerts
CREATE OR REPLACE FUNCTION resolve_alert(p_alert_id INTEGER) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE database_alerts 
    SET is_active = false, resolved_at = NOW() 
    WHERE id = p_alert_id AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- MONITORING CHECKS
-- ================================

-- Check connection count
CREATE OR REPLACE FUNCTION check_connection_count() RETURNS VOID AS $$
DECLARE
    current_connections INTEGER;
    max_connections INTEGER;
    usage_percentage NUMERIC;
BEGIN
    SELECT COUNT(*) INTO current_connections
    FROM pg_stat_activity 
    WHERE datname = current_database();
    
    SELECT setting::INTEGER INTO max_connections
    FROM pg_settings 
    WHERE name = 'max_connections';
    
    usage_percentage := (current_connections::NUMERIC / max_connections::NUMERIC) * 100;
    
    -- Critical alert at 90%
    IF usage_percentage >= 90 THEN
        PERFORM create_alert(
            'connection_exhaustion',
            'critical',
            format('Database connection usage at %s%% (%s/%s)', 
                   ROUND(usage_percentage, 1), current_connections, max_connections),
            90,
            usage_percentage,
            jsonb_build_object('current_connections', current_connections, 'max_connections', max_connections)
        );
    -- Warning alert at 80%
    ELSIF usage_percentage >= 80 THEN
        PERFORM create_alert(
            'connection_warning',
            'warning',
            format('Database connection usage at %s%% (%s/%s)', 
                   ROUND(usage_percentage, 1), current_connections, max_connections),
            80,
            usage_percentage,
            jsonb_build_object('current_connections', current_connections, 'max_connections', max_connections)
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Check database size
CREATE OR REPLACE FUNCTION check_database_size() RETURNS VOID AS $$
DECLARE
    db_size_bytes BIGINT;
    db_size_gb NUMERIC;
    warning_threshold NUMERIC := 10; -- 10GB warning
    critical_threshold NUMERIC := 50; -- 50GB critical
BEGIN
    SELECT pg_database_size(current_database()) INTO db_size_bytes;
    db_size_gb := db_size_bytes / (1024.0 * 1024.0 * 1024.0);
    
    -- Critical alert
    IF db_size_gb >= critical_threshold THEN
        PERFORM create_alert(
            'database_size_critical',
            'critical',
            format('Database size is %s GB (threshold: %s GB)', 
                   ROUND(db_size_gb, 2), critical_threshold),
            critical_threshold,
            db_size_gb,
            jsonb_build_object('size_bytes', db_size_bytes, 'size_gb', db_size_gb)
        );
    -- Warning alert
    ELSIF db_size_gb >= warning_threshold THEN
        PERFORM create_alert(
            'database_size_warning',
            'warning',
            format('Database size is %s GB (threshold: %s GB)', 
                   ROUND(db_size_gb, 2), warning_threshold),
            warning_threshold,
            db_size_gb,
            jsonb_build_object('size_bytes', db_size_bytes, 'size_gb', db_size_gb)
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Check rate limit violations
CREATE OR REPLACE FUNCTION check_rate_limit_violations() RETURNS VOID AS $$
DECLARE
    violations_count INTEGER;
    threshold INTEGER := 50; -- 50 violations per hour
BEGIN
    SELECT COUNT(*) INTO violations_count
    FROM security_events
    WHERE event_type = 'rate_limit_exceeded'
      AND created_at > NOW() - INTERVAL '1 hour';
    
    -- Alert if too many violations
    IF violations_count >= threshold THEN
        PERFORM create_alert(
            'rate_limit_violations',
            'warning',
            format('%s rate limit violations in the last hour (threshold: %s)', 
                   violations_count, threshold),
            threshold,
            violations_count,
            jsonb_build_object('violations_count', violations_count, 'time_window', '1 hour')
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Check long-running queries
CREATE OR REPLACE FUNCTION check_long_running_queries() RETURNS VOID AS $$
DECLARE
    long_queries_count INTEGER;
    threshold INTEGER := 5; -- 5 minutes
BEGIN
    SELECT COUNT(*) INTO long_queries_count
    FROM pg_stat_activity
    WHERE state = 'active'
      AND now() - query_start > INTERVAL '5 minutes'
      AND query NOT LIKE '%pg_stat_activity%';
    
    -- Alert if long-running queries exist
    IF long_queries_count > 0 THEN
        PERFORM create_alert(
            'long_running_queries',
            'warning',
            format('%s queries running longer than %s minutes', 
                   long_queries_count, threshold),
            threshold,
            long_queries_count,
            jsonb_build_object('queries_count', long_queries_count, 'threshold_minutes', threshold)
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- COMPREHENSIVE MONITORING FUNCTION
-- ================================
CREATE OR REPLACE FUNCTION run_monitoring_checks() RETURNS TEXT AS $$
DECLARE
    results TEXT := '';
    alerts_created INTEGER := 0;
BEGIN
    results := 'Monitoring Check Report - ' || NOW()::text || E'\n';
    results := results || '================================' || E'\n';
    
    -- Run all monitoring checks
    PERFORM check_connection_count();
    PERFORM check_database_size();
    PERFORM check_rate_limit_violations();
    PERFORM check_long_running_queries();
    
    -- Count new alerts created in last 5 minutes
    SELECT COUNT(*) INTO alerts_created
    FROM database_alerts
    WHERE created_at > NOW() - INTERVAL '5 minutes';
    
    results := results || format('New alerts created: %s', alerts_created) || E'\n';
    results := results || '================================' || E'\n';
    results := results || 'Monitoring checks completed';
    
    RETURN results;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'run_monitoring_checks',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- USAGE EXAMPLES AND SCHEDULING
-- ================================

-- Example: Run daily maintenance
-- SELECT run_daily_maintenance();

-- Example: Run monitoring checks
-- SELECT run_monitoring_checks();

-- Example: Check recent maintenance logs
-- SELECT * FROM maintenance_log WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;

-- Example: Check active alerts
-- SELECT * FROM database_alerts WHERE is_active = true ORDER BY severity, created_at DESC;

-- Example: Resolve an alert
-- SELECT resolve_alert(1);

-- ================================
-- GRANT PERMISSIONS
-- ================================

-- Grant execute permissions to appropriate roles
-- GRANT EXECUTE ON FUNCTION run_daily_maintenance() TO postgres;
-- GRANT EXECUTE ON FUNCTION run_monitoring_checks() TO postgres;
-- GRANT SELECT ON maintenance_log TO monitoring_user;
-- GRANT SELECT ON database_alerts TO monitoring_user;