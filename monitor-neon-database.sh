#!/bin/bash

# Neon PostgreSQL Database Monitoring Script
# Monitors database health, performance, and provides alerts
# Usage: ./monitor-neon-database.sh [--mode=report|check|continuous]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
REPORTS_DIR="${SCRIPT_DIR}/reports"
DATE=$(date '+%Y%m%d_%H%M%S')

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Database connection
NEON_CONNECTION="${DATABASE_URL:-postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require}"

# Thresholds for alerts
MAX_CONNECTIONS=90
MAX_ACTIVE_QUERIES=50
MAX_QUERY_TIME_MS=5000
MAX_TABLE_SIZE_MB=1000
MAX_DB_SIZE_MB=5000
MIN_CACHE_HIT_RATIO=0.95
MAX_LOCK_WAIT_TIME_MS=1000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories
mkdir -p "${LOG_DIR}" "${REPORTS_DIR}"

# Logging function
log() {
    local level=$1
    shift
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "${LOG_DIR}/monitor_${DATE}.log"
}

# JSON output helper
json_output() {
    local key=$1
    local value=$2
    echo "\"$key\": $value"
}

# Execute SQL query
execute_sql() {
    local query=$1
    local format=${2:-"csv"}
    
    if [ "$format" = "json" ]; then
        psql "${NEON_CONNECTION}" -t -A -F',' --no-password -c "$query" 2>/dev/null | \
        awk 'BEGIN{print "["} {if(NR>1) print ","; print "\"" $0 "\""} END{print "]"}'
    else
        psql "${NEON_CONNECTION}" -t -A -F',' --no-password -c "$query" 2>/dev/null
    fi
}

# Check if database is accessible
check_connectivity() {
    log "INFO" "Testing database connectivity..."
    
    local start_time=$(date +%s%N)
    if execute_sql "SELECT 1;" > /dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local latency_ms=$(( (end_time - start_time) / 1000000 ))
        log "INFO" "${GREEN}Database connection successful${NC} (latency: ${latency_ms}ms)"
        echo "$latency_ms"
        return 0
    else
        log "ERROR" "${RED}Database connection failed${NC}"
        return 1
    fi
}

# Get database basic info
get_database_info() {
    log "INFO" "Gathering database information..."
    
    local info=$(execute_sql "
        SELECT 
            current_database() as db_name,
            version(),
            current_timestamp,
            pg_database_size(current_database()) as db_size_bytes,
            (SELECT count(*) FROM pg_stat_activity) as total_connections,
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
    ")
    
    echo "$info"
}

# Monitor table sizes and row counts
monitor_table_sizes() {
    log "INFO" "Monitoring table sizes and row counts..."
    
    local query="
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
            (SELECT count(*) FROM information_schema.tables WHERE table_name = t.tablename) as exists,
            COALESCE(n_tup_ins, 0) as inserts,
            COALESCE(n_tup_upd, 0) as updates,
            COALESCE(n_tup_del, 0) as deletes,
            COALESCE(n_live_tup, 0) as live_tuples,
            COALESCE(n_dead_tup, 0) as dead_tuples
        FROM pg_tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    "
    
    execute_sql "$query"
}

# Monitor query performance
monitor_query_performance() {
    log "INFO" "Monitoring query performance..."
    
    local query="
        SELECT 
            query,
            calls,
            total_time,
            mean_time,
            max_time,
            min_time,
            rows,
            100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements 
        WHERE calls > 1
        ORDER BY total_time DESC 
        LIMIT 20;
    "
    
    # Check if pg_stat_statements is available
    if execute_sql "SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';" | grep -q "pg_stat_statements"; then
        execute_sql "$query"
    else
        log "WARN" "pg_stat_statements extension not available"
        echo "pg_stat_statements,not_available"
    fi
}

# Monitor active queries and locks
monitor_active_queries() {
    log "INFO" "Monitoring active queries and locks..."
    
    local query="
        SELECT 
            pid,
            usename,
            application_name,
            client_addr,
            state,
            query_start,
            state_change,
            EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as duration_ms,
            LEFT(query, 100) as query_preview
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY query_start ASC;
    "
    
    execute_sql "$query"
}

# Monitor locks
monitor_locks() {
    log "INFO" "Monitoring database locks..."
    
    local query="
        SELECT 
            l.locktype,
            l.database,
            l.relation::regclass,
            l.page,
            l.tuple,
            l.virtualxid,
            l.transactionid,
            l.mode,
            l.granted,
            a.usename,
            a.query_start,
            EXTRACT(EPOCH FROM (now() - a.query_start)) * 1000 as duration_ms,
            LEFT(a.query, 50) as query_preview
        FROM pg_locks l
        LEFT JOIN pg_stat_activity a ON l.pid = a.pid
        WHERE NOT l.granted
        ORDER BY a.query_start;
    "
    
    execute_sql "$query"
}

# Monitor connection pool
monitor_connections() {
    log "INFO" "Monitoring connection pool usage..."
    
    local query="
        SELECT 
            state,
            COUNT(*) as count,
            COUNT(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as percentage
        FROM pg_stat_activity 
        WHERE state IS NOT NULL
        GROUP BY state
        UNION ALL
        SELECT 
            'total' as state,
            COUNT(*) as count,
            COUNT(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as percentage
        FROM pg_stat_activity;
    "
    
    execute_sql "$query"
}

# Check for table bloat
check_table_bloat() {
    log "INFO" "Checking for table bloat..."
    
    local query="
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
            CASE 
                WHEN pg_total_relation_size(schemaname||'.'||tablename) > 0 
                THEN round((pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) * 100.0 / pg_total_relation_size(schemaname||'.'||tablename), 2)
                ELSE 0 
            END as bloat_percentage
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND pg_total_relation_size(schemaname||'.'||tablename) > 1024*1024  -- Only tables > 1MB
        ORDER BY bloat_percentage DESC;
    "
    
    execute_sql "$query"
}

# Monitor index usage
monitor_index_usage() {
    log "INFO" "Monitoring index usage..."
    
    local query="
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan as times_used,
            pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
            idx_tup_read as tuples_read,
            idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC;
    "
    
    execute_sql "$query"
}

# Check cache hit ratios
check_cache_hit_ratio() {
    log "INFO" "Checking cache hit ratios..."
    
    local query="
        SELECT 
            'table_cache' as cache_type,
            round(
                (sum(heap_blks_hit) * 100.0) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 
                2
            ) as hit_ratio_percentage
        FROM pg_statio_user_tables
        UNION ALL
        SELECT 
            'index_cache' as cache_type,
            round(
                (sum(idx_blks_hit) * 100.0) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0), 
                2
            ) as hit_ratio_percentage
        FROM pg_statio_user_indexes;
    "
    
    execute_sql "$query"
}

# Generate JSON report
generate_json_report() {
    local timestamp=$(date -Iseconds)
    local report_file="${REPORTS_DIR}/neon_db_report_${DATE}.json"
    
    log "INFO" "Generating JSON report: $report_file"
    
    local connectivity_latency=$(check_connectivity)
    local connectivity_status=$?
    
    cat > "$report_file" << EOF
{
    "timestamp": "$timestamp",
    "database": "neon_postgresql",
    "report_type": "comprehensive_monitoring",
    "connectivity": {
        "status": $([ $connectivity_status -eq 0 ] && echo "\"connected\"" || echo "\"failed\""),
        "latency_ms": $connectivity_latency
    },
    "database_info": $(get_database_info | awk -F',' '{print "{\"name\":\""$1"\", \"version\":\""$2"\", \"timestamp\":\""$3"\", \"size_bytes\":"$4", \"total_connections\":"$5", \"active_connections\":"$6"}"}'),
    "table_sizes": [
$(monitor_table_sizes | awk -F',' 'NR>0 {print "        {\"schema\":\""$1"\", \"table\":\""$2"\", \"size\":\""$3"\", \"size_bytes\":"$4", \"inserts\":"$6", \"updates\":"$7", \"deletes\":"$8", \"live_tuples\":"$9", \"dead_tuples\":"$10"}"}' | sed '$!s/$/,/')
    ],
    "performance": {
        "slow_queries": [
$(monitor_query_performance | head -10 | awk -F',' 'NR>0 && $1!="pg_stat_statements" {gsub(/"/, "\\\\"", $1); print "            {\"query\":\""substr($1,1,100)"\", \"calls\":"$2", \"total_time\":"$3", \"mean_time\":"$4", \"max_time\":"$5"}"}' | sed '$!s/$/,/')
        ],
        "active_queries": [
$(monitor_active_queries | awk -F',' 'NR>0 {print "            {\"pid\":"$1", \"user\":\""$2"\", \"state\":\""$5"\", \"duration_ms\":"$8"}"}' | sed '$!s/$/,/')
        ]
    },
    "connections": [
$(monitor_connections | awk -F',' 'NR>0 {print "        {\"state\":\""$1"\", \"count\":"$2", \"percentage\":"$3"}"}' | sed '$!s/$/,/')
    ],
    "cache_hit_ratios": [
$(check_cache_hit_ratio | awk -F',' 'NR>0 {print "        {\"type\":\""$1"\", \"hit_ratio\":"$2"}"}' | sed '$!s/$/,/')
    ]
}
EOF

    log "INFO" "${GREEN}JSON report generated successfully${NC}"
    echo "$report_file"
}

# Check for alerts
check_alerts() {
    log "INFO" "Checking for alerts..."
    local alerts=0
    
    # Check database connectivity
    if ! check_connectivity > /dev/null; then
        log "ALERT" "${RED}CRITICAL: Database connection failed${NC}"
        alerts=$((alerts + 1))
    fi
    
    # Check connection usage
    local total_connections=$(execute_sql "SELECT count(*) FROM pg_stat_activity;" | head -1)
    if [ "$total_connections" -gt $MAX_CONNECTIONS ]; then
        log "ALERT" "${RED}WARNING: High connection usage: $total_connections connections${NC}"
        alerts=$((alerts + 1))
    fi
    
    # Check for long-running queries
    local long_queries=$(execute_sql "
        SELECT count(*) 
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND EXTRACT(EPOCH FROM (now() - query_start)) * 1000 > $MAX_QUERY_TIME_MS
    " | head -1)
    
    if [ "$long_queries" -gt 0 ]; then
        log "ALERT" "${YELLOW}WARNING: $long_queries long-running queries detected${NC}"
        alerts=$((alerts + 1))
    fi
    
    # Check cache hit ratio
    local cache_hit=$(execute_sql "
        SELECT round(
            (sum(heap_blks_hit) * 100.0) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 
            4
        ) FROM pg_statio_user_tables
    " | head -1)
    
    if [ ! -z "$cache_hit" ] && [ "$(echo "$cache_hit < $(echo "$MIN_CACHE_HIT_RATIO * 100" | bc)" | bc)" -eq 1 ]; then
        log "ALERT" "${YELLOW}WARNING: Low cache hit ratio: ${cache_hit}%${NC}"
        alerts=$((alerts + 1))
    fi
    
    # Check for table bloat
    local bloated_tables=$(execute_sql "
        SELECT count(*) FROM (
            SELECT tablename
            FROM pg_tables 
            WHERE schemaname = 'public'
            AND pg_total_relation_size(schemaname||'.'||tablename) > 1024*1024*50  -- > 50MB
        ) t
    " | head -1)
    
    if [ "$bloated_tables" -gt 0 ]; then
        log "ALERT" "${YELLOW}INFO: $bloated_tables large tables detected (>50MB)${NC}"
    fi
    
    return $alerts
}

# Continuous monitoring mode
continuous_monitoring() {
    log "INFO" "Starting continuous monitoring mode (Ctrl+C to stop)"
    
    while true; do
        local start_time=$(date +%s)
        
        echo -e "\n${BLUE}=== Monitoring Cycle $(date) ===${NC}"
        check_alerts
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "INFO" "Monitoring cycle completed in ${duration}s, sleeping for 60s..."
        sleep 60
    done
}

# Main execution
main() {
    local mode=${1:-"check"}
    
    echo -e "${BLUE}=== Neon PostgreSQL Database Monitor ===${NC}"
    echo "Mode: $mode"
    echo "Timestamp: $(date)"
    echo "Database: ${NEON_CONNECTION%\?*}"  # Hide sensitive params
    echo ""
    
    case "$mode" in
        "--mode=report"|"report")
            generate_json_report
            ;;
        "--mode=check"|"check")
            check_alerts
            local exit_code=$?
            if [ $exit_code -eq 0 ]; then
                log "INFO" "${GREEN}All systems normal${NC}"
            else
                log "WARN" "${YELLOW}$exit_code alerts detected${NC}"
            fi
            exit $exit_code
            ;;
        "--mode=continuous"|"continuous")
            continuous_monitoring
            ;;
        *)
            echo "Usage: $0 [--mode=report|check|continuous]"
            echo "  report     - Generate comprehensive JSON report"
            echo "  check      - Run health checks and alerts (default)"
            echo "  continuous - Run continuous monitoring"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'log "INFO" "Monitoring stopped by user"; exit 0' INT TERM

# Execute main function
main "$@"