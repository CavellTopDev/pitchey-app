#!/bin/bash

# Neon PostgreSQL Database Integrity Testing Script
# Verifies database schema, constraints, data integrity, and performance
# Usage: ./test-database-integrity.sh [--mode=full|quick|schema|data|performance]

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

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

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
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "${LOG_DIR}/integrity_test_${DATE}.log"
}

# Test execution wrapper
run_test() {
    local test_name=$1
    local test_function=$2
    local is_critical=${3:-true}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "INFO" "Running test: $test_name"
    
    if $test_function; then
        log "PASS" "${GREEN}✓ $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        if [ "$is_critical" = true ]; then
            log "FAIL" "${RED}✗ $test_name${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        else
            log "WARN" "${YELLOW}⚠ $test_name${NC}"
            WARNINGS=$((WARNINGS + 1))
            return 0
        fi
    fi
}

# Execute SQL query
execute_sql() {
    local query=$1
    local suppress_errors=${2:-false}
    
    if [ "$suppress_errors" = true ]; then
        psql "${NEON_CONNECTION}" -t -A -F',' --no-password -c "$query" 2>/dev/null || true
    else
        psql "${NEON_CONNECTION}" -t -A -F',' --no-password -c "$query" 2>/dev/null
    fi
}

# Test database connectivity
test_connectivity() {
    if execute_sql "SELECT 1;" > /dev/null 2>&1; then
        return 0
    else
        log "ERROR" "Cannot connect to database"
        return 1
    fi
}

# Test all expected tables exist
test_tables_exist() {
    local expected_tables=(
        "users" "pitches" "follows" "ndas" "messages" "pitch_views" 
        "notifications" "portfolio" "watchlist" "sessions" "analytics_events"
        "analytics_aggregates" "user_sessions" "search_analytics" "search_suggestions"
        "saved_searches" "conversations" "conversation_participants" "message_read_receipts"
        "typing_indicators" "analytics" "nda_requests" "pitch_likes" "pitch_saves"
        "user_credits" "credit_transactions" "payments" "transactions" "email_preferences"
        "email_queue" "email_events" "email_suppression" "unsubscribe_tokens"
        "digest_history" "security_events" "content_types" "content_items"
        "feature_flags" "portal_configurations" "translation_keys" "translations"
        "navigation_menus" "content_approvals" "subscription_history" "payment_methods"
        "investments" "reviews" "calendar_events" "saved_pitches" "investment_documents"
        "investment_timeline" "info_requests" "info_request_attachments" "pitch_documents"
        "saved_filters" "email_alerts" "alert_sent_pitches"
    )
    
    local missing_tables=()
    for table in "${expected_tables[@]}"; do
        local exists=$(execute_sql "
            SELECT count(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '$table';
        ")
        
        if [ "$exists" = "0" ]; then
            missing_tables+=("$table")
        fi
    done
    
    if [ ${#missing_tables[@]} -eq 0 ]; then
        log "INFO" "All ${#expected_tables[@]} expected tables exist"
        return 0
    else
        log "ERROR" "Missing tables: ${missing_tables[*]}"
        return 1
    fi
}

# Test foreign key constraints
test_foreign_key_constraints() {
    local fk_violations=$(execute_sql "
        SELECT 
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
    " | wc -l)
    
    log "INFO" "Found $fk_violations foreign key constraints"
    
    # Check for actual FK violations
    local violation_count=0
    
    # Test users -> pitches relationship
    local orphaned_pitches=$(execute_sql "
        SELECT count(*) 
        FROM pitches p 
        LEFT JOIN users u ON p.user_id = u.id 
        WHERE p.user_id IS NOT NULL AND u.id IS NULL;
    ")
    
    if [ "$orphaned_pitches" -gt 0 ]; then
        log "ERROR" "Found $orphaned_pitches orphaned pitches without valid users"
        violation_count=$((violation_count + 1))
    fi
    
    # Test pitch_views -> pitches relationship
    local orphaned_views=$(execute_sql "
        SELECT count(*) 
        FROM pitch_views pv 
        LEFT JOIN pitches p ON pv.pitch_id = p.id 
        WHERE pv.pitch_id IS NOT NULL AND p.id IS NULL;
    ")
    
    if [ "$orphaned_views" -gt 0 ]; then
        log "ERROR" "Found $orphaned_views orphaned pitch views"
        violation_count=$((violation_count + 1))
    fi
    
    # Test ndas -> pitches and users relationships
    local orphaned_ndas=$(execute_sql "
        SELECT count(*) 
        FROM ndas n 
        LEFT JOIN pitches p ON n.pitch_id = p.id 
        LEFT JOIN users u ON n.user_id = u.id 
        WHERE (n.pitch_id IS NOT NULL AND p.id IS NULL) 
        OR (n.user_id IS NOT NULL AND u.id IS NULL);
    ")
    
    if [ "$orphaned_ndas" -gt 0 ]; then
        log "ERROR" "Found $orphaned_ndas orphaned NDAs"
        violation_count=$((violation_count + 1))
    fi
    
    return $violation_count
}

# Test data integrity
test_data_integrity() {
    local integrity_issues=0
    
    # Test for negative IDs
    local negative_ids=$(execute_sql "
        SELECT 'users' as table_name, count(*) as negative_count FROM users WHERE id < 0
        UNION ALL
        SELECT 'pitches', count(*) FROM pitches WHERE id < 0
        UNION ALL
        SELECT 'messages', count(*) FROM messages WHERE id < 0;
    " | awk -F',' '$2 > 0 {print $1 ": " $2}')
    
    if [ ! -z "$negative_ids" ]; then
        log "ERROR" "Found negative IDs: $negative_ids"
        integrity_issues=$((integrity_issues + 1))
    fi
    
    # Test for invalid email formats
    local invalid_emails=$(execute_sql "
        SELECT count(*) 
        FROM users 
        WHERE email IS NOT NULL 
        AND email NOT LIKE '%@%.%'
        AND email != '';
    ")
    
    if [ "$invalid_emails" -gt 0 ]; then
        log "ERROR" "Found $invalid_emails users with invalid email formats"
        integrity_issues=$((integrity_issues + 1))
    fi
    
    # Test for users without usernames
    local users_without_usernames=$(execute_sql "
        SELECT count(*) 
        FROM users 
        WHERE username IS NULL 
        OR username = '' 
        OR LENGTH(trim(username)) = 0;
    ")
    
    if [ "$users_without_usernames" -gt 0 ]; then
        log "ERROR" "Found $users_without_usernames users without valid usernames"
        integrity_issues=$((integrity_issues + 1))
    fi
    
    # Test for pitches without titles
    local pitches_without_titles=$(execute_sql "
        SELECT count(*) 
        FROM pitches 
        WHERE title IS NULL 
        OR title = '' 
        OR LENGTH(trim(title)) = 0;
    ")
    
    if [ "$pitches_without_titles" -gt 0 ]; then
        log "ERROR" "Found $pitches_without_titles pitches without valid titles"
        integrity_issues=$((integrity_issues + 1))
    fi
    
    # Test for future timestamps
    local future_timestamps=$(execute_sql "
        SELECT 
            'users' as table_name, 
            count(*) as future_count 
        FROM users 
        WHERE created_at > now() + interval '1 hour'
        UNION ALL
        SELECT 'pitches', count(*) FROM pitches WHERE created_at > now() + interval '1 hour'
        UNION ALL
        SELECT 'messages', count(*) FROM messages WHERE sent_at > now() + interval '1 hour';
    " | awk -F',' '$2 > 0 {print $1 ": " $2}')
    
    if [ ! -z "$future_timestamps" ]; then
        log "WARN" "Found future timestamps: $future_timestamps"
        # This is a warning, not a critical error
    fi
    
    return $integrity_issues
}

# Test index usage and performance
test_index_usage() {
    # Check if important indexes exist
    local expected_indexes=(
        "users_email_idx"
        "users_username_idx" 
        "pitches_user_id_idx"
        "pitch_views_pitch_id_idx"
        "ndas_pitch_id_idx"
        "messages_sender_id_idx"
        "notifications_user_id_idx"
    )
    
    local missing_indexes=()
    for index in "${expected_indexes[@]}"; do
        local exists=$(execute_sql "
            SELECT count(*) 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = '$index';
        " true)  # suppress errors for missing indexes
        
        if [ "$exists" = "0" ] || [ -z "$exists" ]; then
            missing_indexes+=("$index")
        fi
    done
    
    # Check for unused indexes
    local unused_indexes=$(execute_sql "
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexname NOT LIKE '%pkey';
    ")
    
    if [ ! -z "$unused_indexes" ]; then
        log "WARN" "Found unused indexes (consider removing):"
        echo "$unused_indexes" | while IFS=',' read schema table index scans; do
            log "WARN" "  $schema.$table.$index (scans: $scans)"
        done
    fi
    
    if [ ${#missing_indexes[@]} -eq 0 ]; then
        return 0
    else
        log "WARN" "Missing recommended indexes: ${missing_indexes[*]}"
        return 1
    fi
}

# Test transaction rollback capability
test_transaction_rollback() {
    # Test that we can start and rollback a transaction
    local test_result=$(execute_sql "
        BEGIN;
        INSERT INTO users (email, username, password, password_hash, user_type) 
        VALUES ('test@rollback.com', 'rollback_test', 'dummy', 'dummy_hash', 'test');
        ROLLBACK;
        SELECT 'transaction_test_passed';
    ")
    
    # Verify the test user was not actually inserted
    local test_user_count=$(execute_sql "
        SELECT count(*) 
        FROM users 
        WHERE email = 'test@rollback.com';
    ")
    
    if [ "$test_user_count" = "0" ] && [[ "$test_result" == *"transaction_test_passed"* ]]; then
        return 0
    else
        log "ERROR" "Transaction rollback test failed"
        return 1
    fi
}

# Test user roles and permissions (if applicable)
test_permissions() {
    # Check current user's permissions
    local current_user=$(execute_sql "SELECT current_user;")
    local is_superuser=$(execute_sql "SELECT usesuper FROM pg_user WHERE usename = current_user;" true)
    
    log "INFO" "Connected as user: $current_user"
    log "INFO" "Superuser privileges: ${is_superuser:-false}"
    
    # Test basic CRUD operations on a safe table
    local can_select=$(execute_sql "SELECT count(*) FROM users LIMIT 1;" true | wc -l)
    local can_insert=0
    local can_update=0
    local can_delete=0
    
    # Test insert (then clean up)
    if execute_sql "INSERT INTO users (email, username, password, password_hash, user_type) VALUES ('test@permissions.com', 'perm_test', 'dummy', 'dummy_hash', 'test');" true > /dev/null 2>&1; then
        can_insert=1
        
        # Test update
        if execute_sql "UPDATE users SET bio = 'test' WHERE email = 'test@permissions.com';" true > /dev/null 2>&1; then
            can_update=1
        fi
        
        # Test delete (cleanup)
        if execute_sql "DELETE FROM users WHERE email = 'test@permissions.com';" true > /dev/null 2>&1; then
            can_delete=1
        fi
    fi
    
    log "INFO" "Permissions - SELECT: $can_select, INSERT: $can_insert, UPDATE: $can_update, DELETE: $can_delete"
    
    # We need at least SELECT permissions
    if [ "$can_select" -gt 0 ]; then
        return 0
    else
        return 1
    fi
}

# Test performance benchmarks
test_performance_benchmarks() {
    local performance_issues=0
    
    # Test simple SELECT query performance
    local start_time=$(date +%s%N)
    execute_sql "SELECT count(*) FROM users;" > /dev/null
    local end_time=$(date +%s%N)
    local select_duration_ms=$(( (end_time - start_time) / 1000000 ))
    
    log "INFO" "Simple SELECT query time: ${select_duration_ms}ms"
    
    if [ "$select_duration_ms" -gt 1000 ]; then
        log "WARN" "Slow SELECT query performance: ${select_duration_ms}ms"
        performance_issues=$((performance_issues + 1))
    fi
    
    # Test JOIN query performance
    start_time=$(date +%s%N)
    execute_sql "
        SELECT p.title, u.username 
        FROM pitches p 
        JOIN users u ON p.user_id = u.id 
        LIMIT 100;
    " > /dev/null
    end_time=$(date +%s%N)
    local join_duration_ms=$(( (end_time - start_time) / 1000000 ))
    
    log "INFO" "JOIN query time: ${join_duration_ms}ms"
    
    if [ "$join_duration_ms" -gt 2000 ]; then
        log "WARN" "Slow JOIN query performance: ${join_duration_ms}ms"
        performance_issues=$((performance_issues + 1))
    fi
    
    return $performance_issues
}

# Test database statistics are up to date
test_statistics_freshness() {
    local stale_stats=$(execute_sql "
        SELECT 
            schemaname,
            tablename,
            last_analyze,
            last_autoanalyze,
            EXTRACT(EPOCH FROM (now() - COALESCE(last_analyze, last_autoanalyze, '1970-01-01'::timestamp))) / 3600 as hours_since_analyze
        FROM pg_stat_user_tables 
        WHERE EXTRACT(EPOCH FROM (now() - COALESCE(last_analyze, last_autoanalyze, '1970-01-01'::timestamp))) / 3600 > 24
        ORDER BY hours_since_analyze DESC;
    ")
    
    if [ ! -z "$stale_stats" ]; then
        log "WARN" "Found tables with stale statistics (>24h old):"
        echo "$stale_stats" | while IFS=',' read schema table last_analyze last_auto hours; do
            log "WARN" "  $schema.$table (${hours}h old)"
        done
        return 1
    fi
    
    return 0
}

# Generate comprehensive test report
generate_test_report() {
    local report_file="${REPORTS_DIR}/integrity_test_report_${DATE}.json"
    local timestamp=$(date -Iseconds)
    
    log "INFO" "Generating test report: $report_file"
    
    cat > "$report_file" << EOF
{
    "timestamp": "$timestamp",
    "database": "neon_postgresql",
    "report_type": "integrity_test",
    "summary": {
        "total_tests": $TOTAL_TESTS,
        "passed_tests": $PASSED_TESTS,
        "failed_tests": $FAILED_TESTS,
        "warnings": $WARNINGS,
        "success_rate": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
    },
    "test_results": {
        "connectivity": $([ $FAILED_TESTS -eq 0 ] && echo "true" || echo "false"),
        "schema_integrity": "$([ $FAILED_TESTS -eq 0 ] && echo "passed" || echo "failed")",
        "data_integrity": "$([ $FAILED_TESTS -eq 0 ] && echo "passed" || echo "failed")",
        "performance": "$([ $WARNINGS -eq 0 ] && echo "good" || echo "needs_attention")"
    },
    "recommendations": [
$([ $FAILED_TESTS -gt 0 ] && echo '        "Address failed integrity tests immediately",' || true)
$([ $WARNINGS -gt 0 ] && echo '        "Review warning items for optimization opportunities",' || true)
        "Schedule regular integrity checks",
        "Monitor performance metrics continuously",
        "Keep database statistics up to date"
    ]
}
EOF

    log "INFO" "${GREEN}Test report generated successfully${NC}"
    echo "$report_file"
}

# Print test summary
print_summary() {
    echo ""
    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Total tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    
    local success_rate=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
    echo "Success rate: ${success_rate}%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}All critical tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}Some tests failed. Please review the logs.${NC}"
        return 1
    fi
}

# Main test execution
run_schema_tests() {
    log "INFO" "Running schema integrity tests..."
    run_test "Database connectivity" test_connectivity true
    run_test "Required tables exist" test_tables_exist true
    run_test "Foreign key constraints" test_foreign_key_constraints true
    run_test "Index usage analysis" test_index_usage false
}

run_data_tests() {
    log "INFO" "Running data integrity tests..."
    run_test "Data integrity checks" test_data_integrity true
    run_test "Transaction rollback capability" test_transaction_rollback true
    run_test "User permissions verification" test_permissions true
    run_test "Statistics freshness" test_statistics_freshness false
}

run_performance_tests() {
    log "INFO" "Running performance tests..."
    run_test "Query performance benchmarks" test_performance_benchmarks false
}

# Main execution
main() {
    local mode=${1:-"full"}
    
    echo -e "${BLUE}=== Neon PostgreSQL Database Integrity Tests ===${NC}"
    echo "Mode: $mode"
    echo "Timestamp: $(date)"
    echo "Database: ${NEON_CONNECTION%\?*}"  # Hide sensitive params
    echo ""
    
    case "$mode" in
        "--mode=full"|"full")
            run_schema_tests
            run_data_tests
            run_performance_tests
            ;;
        "--mode=quick"|"quick")
            run_test "Database connectivity" test_connectivity true
            run_test "Required tables exist" test_tables_exist true
            run_test "Data integrity checks" test_data_integrity true
            ;;
        "--mode=schema"|"schema")
            run_schema_tests
            ;;
        "--mode=data"|"data")
            run_data_tests
            ;;
        "--mode=performance"|"performance")
            run_performance_tests
            ;;
        *)
            echo "Usage: $0 [--mode=full|quick|schema|data|performance]"
            echo "  full        - Run all tests (default)"
            echo "  quick       - Run essential connectivity and basic integrity tests"
            echo "  schema      - Run schema and structure tests"
            echo "  data        - Run data integrity tests"
            echo "  performance - Run performance benchmark tests"
            exit 1
            ;;
    esac
    
    generate_test_report
    print_summary
}

# Handle script interruption
trap 'log "INFO" "Testing interrupted by user"; exit 1' INT TERM

# Execute main function
main "$@"