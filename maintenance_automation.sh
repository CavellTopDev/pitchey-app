#!/bin/bash

# Automated Database Maintenance Script for Pitchey
# Performs routine maintenance tasks to ensure optimal performance

set -e

# Configuration
DB_NAME="pitchey"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
LOG_FILE="/var/log/pitchey_maintenance.log"
BACKUP_DIR="/home/supremeisbeing/pitcheymovie/pitchey_v0.2/backups"

# Database connection
export PGPASSWORD="password"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting database maintenance..."

# 1. ANALYZE TABLES FOR QUERY OPTIMIZER
log "Updating table statistics..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
ANALYZE pitches;
ANALYZE users;
ANALYZE ndas;
ANALYZE pitch_views;
ANALYZE analytics_events;
"

# 2. REINDEX ANALYTICS COLUMNS
log "Reindexing analytics columns..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
REINDEX INDEX idx_pitches_nda_count;
REINDEX INDEX idx_pitches_user_id;
REINDEX INDEX idx_pitches_status;
"

# 3. CLEAN UP OLD ANALYTICS DATA
log "Cleaning up old analytics data..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
-- Remove analytics events older than 2 years
DELETE FROM analytics_events 
WHERE timestamp < NOW() - INTERVAL '2 years';

-- Remove old user sessions
DELETE FROM user_sessions 
WHERE start_time < NOW() - INTERVAL '1 year';

-- Clean up old search history
DELETE FROM search_history 
WHERE searched_at < NOW() - INTERVAL '6 months';
"

# 4. UPDATE ANALYTICS COUNTS FROM SOURCE DATA
log "Refreshing analytics counts..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
-- Update view counts from pitch_views table
UPDATE pitches SET view_count = (
    SELECT COUNT(*) FROM pitch_views WHERE pitch_id = pitches.id
) WHERE EXISTS (SELECT 1 FROM pitch_views WHERE pitch_id = pitches.id);

-- Update NDA counts from ndas table
UPDATE pitches SET nda_count = (
    SELECT COUNT(*) FROM ndas WHERE pitch_id = pitches.id
) WHERE EXISTS (SELECT 1 FROM ndas WHERE pitch_id = pitches.id);

-- Update like counts if you have a likes table
-- UPDATE pitches SET like_count = (
--     SELECT COUNT(*) FROM pitch_likes WHERE pitch_id = pitches.id
-- ) WHERE EXISTS (SELECT 1 FROM pitch_likes WHERE pitch_id = pitches.id);
"

# 5. CHECK FOR DATA INTEGRITY ISSUES
log "Checking data integrity..."
INTEGRITY_ISSUES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT COUNT(*) FROM pitches 
WHERE view_count IS NULL OR view_count < 0 
   OR like_count IS NULL OR like_count < 0
   OR comment_count IS NULL OR comment_count < 0
   OR nda_count IS NULL OR nda_count < 0;
")

if [ "$INTEGRITY_ISSUES" -gt 0 ]; then
    log "WARNING: Found $INTEGRITY_ISSUES records with integrity issues"
    # Fix NULL values
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    UPDATE pitches SET 
        view_count = COALESCE(view_count, 0),
        like_count = COALESCE(like_count, 0),
        comment_count = COALESCE(comment_count, 0),
        nda_count = COALESCE(nda_count, 0)
    WHERE view_count IS NULL OR like_count IS NULL OR comment_count IS NULL OR nda_count IS NULL;
    "
    log "Fixed NULL values in analytics columns"
fi

# 6. VACUUM AND ANALYZE
log "Running VACUUM ANALYZE..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
VACUUM (ANALYZE, VERBOSE) pitches;
VACUUM (ANALYZE, VERBOSE) pitch_views;
VACUUM (ANALYZE, VERBOSE) analytics_events;
"

# 7. UPDATE TABLE STATISTICS
log "Updating extended statistics..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
-- Create extended statistics if not exists
CREATE STATISTICS IF NOT EXISTS pitches_analytics_stats 
ON view_count, like_count, comment_count, nda_count 
FROM pitches;

ANALYZE pitches;
"

# 8. CONNECTION POOL MAINTENANCE
log "Checking connection pool status..."
if pgrep pgbouncer > /dev/null; then
    psql -h localhost -p 6432 -U postgres -d pgbouncer -c "
    SHOW pools;
    SHOW clients;
    " >> "$LOG_FILE"
else
    log "WARNING: pgbouncer is not running"
fi

# 9. GENERATE HEALTH REPORT
log "Generating health report..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f \
    /home/supremeisbeing/pitcheymovie/pitchey_v0.2/database_monitoring.sql >> "$LOG_FILE"

# 10. BACKUP VERIFICATION
log "Verifying latest backup..."
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "pitchey_full_backup_*.dump" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
if [ -n "$LATEST_BACKUP" ]; then
    if pg_restore --list "$LATEST_BACKUP" > /dev/null 2>&1; then
        log "Backup verification successful: $LATEST_BACKUP"
    else
        log "ERROR: Backup verification failed for $LATEST_BACKUP"
        exit 1
    fi
else
    log "ERROR: No backup files found in $BACKUP_DIR"
    exit 1
fi

# 11. DISK SPACE CHECK
log "Checking disk space..."
DISK_USAGE=$(df /var/lib/postgresql | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    log "WARNING: Disk usage is at ${DISK_USAGE}%"
fi

# 12. PERFORMANCE METRICS COLLECTION
log "Collecting performance metrics..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO analytics_aggregates (
    period, 
    period_start, 
    period_end, 
    event_count, 
    unique_users,
    calculated_at
) 
SELECT 
    'daily',
    DATE_TRUNC('day', NOW() - INTERVAL '1 day'),
    DATE_TRUNC('day', NOW()),
    COUNT(*),
    COUNT(DISTINCT user_id),
    NOW()
FROM analytics_events 
WHERE timestamp >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
  AND timestamp < DATE_TRUNC('day', NOW())
ON CONFLICT DO NOTHING;
"

# 13. ALERT CHECK
log "Checking for alert conditions..."
ALERTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
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
            WHEN pg_database_size('pitchey') > 5368709120 THEN 'DATABASE SIZE > 5GB'
            ELSE NULL 
        END as alert
)
SELECT string_agg(alert, ', ') FROM alerts WHERE alert IS NOT NULL;
")

if [ -n "$ALERTS" ] && [ "$ALERTS" != "" ]; then
    log "ALERTS: $ALERTS"
    # Send notification (implement your notification system here)
    # echo "Database alerts: $ALERTS" | mail -s "Pitchey DB Alerts" admin@example.com
fi

log "Database maintenance completed successfully"

# Clean up
unset PGPASSWORD

# Rotate log file if it gets too large
if [ -f "$LOG_FILE" ] && [ $(stat --format=%s "$LOG_FILE") -gt 10485760 ]; then  # 10MB
    mv "$LOG_FILE" "$LOG_FILE.old"
    touch "$LOG_FILE"
    log "Log file rotated"
fi

exit 0