#!/bin/bash

# =====================================================
# Automated Incident Response Script for Pitchey
# =====================================================
# This script provides automated incident detection, response,
# and coordination for production incidents

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INCIDENT_DIR="/tmp/pitchey-incidents"
INCIDENT_ID=""
INCIDENT_LOG=""
INCIDENT_START=""
INCIDENT_SEVERITY=""

# API endpoints
API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"

# Create incident directory
mkdir -p "$INCIDENT_DIR"

# =====================================================
# Logging Functions
# =====================================================

log() {
    local message=$1
    local color=${2:-$GREEN}
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] $message${NC}" | tee -a "${INCIDENT_LOG:-/dev/stdout}"
}

error() {
    log "ERROR: $1" "$RED"
}

warning() {
    log "WARNING: $1" "$YELLOW"
}

info() {
    log "INFO: $1" "$BLUE"
}

critical() {
    log "CRITICAL: $1" "$PURPLE"
}

# =====================================================
# Incident Detection Functions
# =====================================================

detect_high_error_rate() {
    info "Checking error rate..."
    
    # Query recent errors from Worker logs (via wrangler tail or API)
    if command -v wrangler &> /dev/null; then
        ERROR_COUNT=$(wrangler tail --format json --env production 2>/dev/null | \
            grep -c '"outcome":"exception"' || echo "0")
        
        if [ "$ERROR_COUNT" -gt 100 ]; then
            return 0  # High error rate detected
        fi
    fi
    
    return 1
}

detect_database_issues() {
    info "Checking database health..."
    
    if [ -z "${DATABASE_URL:-}" ]; then
        warning "DATABASE_URL not configured"
        return 1
    fi
    
    # Check connection
    if ! timeout 5 psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        return 0  # Database issue detected
    fi
    
    # Check slow queries
    SLOW_QUERIES=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) FROM pg_stat_activity 
        WHERE state = 'active' 
        AND now() - query_start > interval '10 seconds'
    " 2>/dev/null || echo "0")
    
    if [ "$SLOW_QUERIES" -gt 5 ]; then
        return 0  # Database performance issue
    fi
    
    return 1
}

detect_api_outage() {
    info "Checking API health..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        "$API_URL/api/health" || echo "000")
    
    if [ "$response" != "200" ]; then
        return 0  # API issue detected
    fi
    
    # Check response time
    response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 \
        "$API_URL/api/health" || echo "999")
    
    if (( $(echo "$response_time > 5" | bc -l) )); then
        return 0  # High latency detected
    fi
    
    return 1
}

detect_cache_issues() {
    info "Checking cache health..."
    
    if [ -z "${REDIS_URL:-}" ] || [ -z "${REDIS_TOKEN:-}" ]; then
        return 1  # Cache not configured
    fi
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
        -H "Authorization: Bearer $REDIS_TOKEN" \
        "$REDIS_URL/ping" || echo "000")
    
    if [ "$response" != "200" ]; then
        return 0  # Cache issue detected
    fi
    
    return 1
}

# =====================================================
# Incident Management Functions
# =====================================================

declare_incident() {
    local severity=$1
    local title=$2
    local description=$3
    
    INCIDENT_ID="INC-$(date +%s)"
    INCIDENT_START=$(date +%s)
    INCIDENT_SEVERITY="$severity"
    INCIDENT_LOG="$INCIDENT_DIR/$INCIDENT_ID.log"
    
    critical "==================== INCIDENT DECLARED ===================="
    critical "Incident ID: $INCIDENT_ID"
    critical "Severity: $severity"
    critical "Title: $title"
    critical "Description: $description"
    critical "==========================================================="
    
    # Create incident record
    cat > "$INCIDENT_DIR/$INCIDENT_ID.json" << EOF
{
    "id": "$INCIDENT_ID",
    "severity": "$severity",
    "title": "$title",
    "description": "$description",
    "declared_at": "$(date -Iseconds)",
    "status": "investigating"
}
EOF
    
    # Send notifications
    send_incident_notification "$severity" "$title" "$description"
    
    # Page on-call for P0/P1
    if [ "$severity" = "P0" ] || [ "$severity" = "P1" ]; then
        page_oncall "$title"
    fi
    
    # Update status page
    update_status_page "investigating" "$title"
    
    # Start recording
    start_incident_recording
}

start_incident_recording() {
    info "Starting incident recording..."
    
    # Capture system state every 30 seconds
    (
        while [ -f "$INCIDENT_DIR/$INCIDENT_ID.json" ]; do
            capture_system_state >> "$INCIDENT_LOG" 2>&1
            sleep 30
        done
    ) &
    
    echo $! > "$INCIDENT_DIR/$INCIDENT_ID.pid"
}

capture_system_state() {
    echo "=== System State at $(date) ==="
    
    # Database metrics
    if [ -n "${DATABASE_URL:-}" ]; then
        echo "Database connections:"
        psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity" 2>/dev/null || echo "N/A"
    fi
    
    # API health
    echo "API status:"
    curl -s "$API_URL/api/health" 2>/dev/null | jq -c '.' || echo "N/A"
    
    # Worker metrics (if available)
    if command -v wrangler &> /dev/null; then
        echo "Recent errors:"
        wrangler tail --format json --env production 2>/dev/null | \
            grep '"outcome":"exception"' | tail -5 || echo "N/A"
    fi
    
    echo "========================"
}

# =====================================================
# Mitigation Functions
# =====================================================

mitigate_high_error_rate() {
    warning "Mitigating high error rate..."
    
    # Enable circuit breaker
    info "Enabling circuit breaker..."
    update_worker_env "CIRCUIT_BREAKER_ENABLED" "true"
    
    # Increase rate limiting
    info "Tightening rate limits..."
    update_worker_env "RATE_LIMIT_REQUESTS" "10"
    
    # Check if recent deployment
    if check_recent_deployment; then
        warning "Recent deployment detected - considering rollback"
        
        if confirm_action "Rollback last deployment?"; then
            rollback_deployment
        fi
    fi
    
    sleep 30
    
    # Check if mitigation worked
    if ! detect_high_error_rate; then
        log "✅ Error rate normalized"
        return 0
    else
        error "Mitigation failed - error rate still high"
        return 1
    fi
}

mitigate_database_issues() {
    warning "Mitigating database issues..."
    
    # Kill long-running queries
    info "Killing long-running queries..."
    psql "$DATABASE_URL" -c "
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE state = 'active'
        AND now() - query_start > interval '30 seconds'
        AND query NOT ILIKE '%autovacuum%'
    " 2>/dev/null || true
    
    # Clear idle connections
    info "Clearing idle connections..."
    psql "$DATABASE_URL" -c "
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE state = 'idle'
        AND now() - state_change > interval '10 minutes'
    " 2>/dev/null || true
    
    # Enable read-only mode if critical
    if [ "$INCIDENT_SEVERITY" = "P0" ]; then
        warning "Enabling read-only mode..."
        update_worker_env "READ_ONLY_MODE" "true"
    fi
    
    sleep 20
    
    # Check if mitigation worked
    if ! detect_database_issues; then
        log "✅ Database issues resolved"
        return 0
    else
        error "Database issues persist"
        return 1
    fi
}

mitigate_api_outage() {
    warning "Mitigating API outage..."
    
    # Restart Worker
    info "Redeploying Worker..."
    if command -v wrangler &> /dev/null; then
        wrangler deploy --env production
    fi
    
    sleep 20
    
    # Check if mitigation worked
    if ! detect_api_outage; then
        log "✅ API recovered"
        return 0
    else
        # Try rollback
        warning "API still down - attempting rollback..."
        rollback_deployment
        
        sleep 20
        
        if ! detect_api_outage; then
            log "✅ API recovered after rollback"
            return 0
        else
            error "API recovery failed"
            return 1
        fi
    fi
}

mitigate_cache_issues() {
    warning "Mitigating cache issues..."
    
    # Clear cache
    info "Clearing cache..."
    if [ -n "${REDIS_URL:-}" ] && [ -n "${REDIS_TOKEN:-}" ]; then
        curl -X DELETE "$REDIS_URL/*" \
            -H "Authorization: Bearer $REDIS_TOKEN" \
            -s -o /dev/null || true
    fi
    
    # Enable cache bypass
    info "Enabling cache bypass..."
    update_worker_env "CACHE_BYPASS" "true"
    
    sleep 10
    
    log "✅ Cache mitigation applied"
    return 0
}

# =====================================================
# Recovery Functions
# =====================================================

rollback_deployment() {
    warning "Rolling back deployment..."
    
    if command -v wrangler &> /dev/null; then
        wrangler rollback --env production
        log "✅ Deployment rolled back"
    else
        error "wrangler not available for rollback"
    fi
}

update_worker_env() {
    local key=$1
    local value=$2
    
    info "Updating Worker environment: $key=$value"
    
    if command -v wrangler &> /dev/null; then
        echo "$value" | wrangler secret put "$key" --env production
    fi
}

check_recent_deployment() {
    # Check if there was a deployment in the last hour
    LAST_DEPLOY=$(git log --since="1 hour ago" --grep="deploy" --oneline | head -1)
    
    if [ -n "$LAST_DEPLOY" ]; then
        info "Recent deployment found: $LAST_DEPLOY"
        return 0
    fi
    
    return 1
}

# =====================================================
# Communication Functions
# =====================================================

send_incident_notification() {
    local severity=$1
    local title=$2
    local description=$3
    
    # Slack notification
    if [ -n "${SLACK_WEBHOOK:-}" ]; then
        local color="danger"
        [ "$severity" = "P2" ] && color="warning"
        [ "$severity" = "P3" ] && color="good"
        
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{
                \"text\": \"🚨 Incident Declared: $INCIDENT_ID\",
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"[$severity] $title\",
                    \"text\": \"$description\",
                    \"fields\": [
                        {\"title\": \"Incident ID\", \"value\": \"$INCIDENT_ID\", \"short\": true},
                        {\"title\": \"Severity\", \"value\": \"$severity\", \"short\": true}
                    ],
                    \"footer\": \"Incident Response System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            -s -o /dev/null
    fi
}

page_oncall() {
    local message=$1
    
    critical "📟 PAGING ON-CALL: $message"
    
    # PagerDuty
    if [ -n "${PAGERDUTY_ROUTING_KEY:-}" ]; then
        curl -X POST "https://events.pagerduty.com/v2/enqueue" \
            -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_ROUTING_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"[$INCIDENT_SEVERITY] $message\",
                    \"severity\": \"critical\",
                    \"source\": \"incident-response\",
                    \"custom_details\": {
                        \"incident_id\": \"$INCIDENT_ID\"
                    }
                }
            }" \
            -s -o /dev/null
    fi
}

update_status_page() {
    local status=$1
    local message=$2
    
    info "Updating status page: $status"
    
    # StatusPage.io integration
    if [ -n "${STATUSPAGE_API_KEY:-}" ] && [ -n "${STATUSPAGE_PAGE_ID:-}" ]; then
        local impact="minor"
        [ "$INCIDENT_SEVERITY" = "P0" ] && impact="critical"
        [ "$INCIDENT_SEVERITY" = "P1" ] && impact="major"
        
        curl -X POST "https://api.statuspage.io/v1/pages/$STATUSPAGE_PAGE_ID/incidents" \
            -H "Authorization: OAuth $STATUSPAGE_API_KEY" \
            -H 'Content-Type: application/json' \
            -d "{
                \"incident\": {
                    \"name\": \"$message\",
                    \"status\": \"$status\",
                    \"impact_override\": \"$impact\",
                    \"metadata\": {
                        \"incident_id\": \"$INCIDENT_ID\"
                    }
                }
            }" \
            -s -o /dev/null
    fi
}

# =====================================================
# Resolution Functions
# =====================================================

resolve_incident() {
    local resolution=${1:-"Automated resolution"}
    
    if [ -z "$INCIDENT_ID" ]; then
        error "No active incident to resolve"
        return 1
    fi
    
    INCIDENT_END=$(date +%s)
    INCIDENT_DURATION=$((INCIDENT_END - INCIDENT_START))
    
    log "==================== INCIDENT RESOLVED ===================="
    log "Incident ID: $INCIDENT_ID"
    log "Duration: ${INCIDENT_DURATION} seconds"
    log "Resolution: $resolution"
    log "==========================================================="
    
    # Update incident record
    jq --arg resolution "$resolution" \
       --arg resolved_at "$(date -Iseconds)" \
       --arg duration "$INCIDENT_DURATION" \
       '.status = "resolved" | .resolution = $resolution | .resolved_at = $resolved_at | .duration_seconds = ($duration | tonumber)' \
       "$INCIDENT_DIR/$INCIDENT_ID.json" > "$INCIDENT_DIR/$INCIDENT_ID.json.tmp" && \
       mv "$INCIDENT_DIR/$INCIDENT_ID.json.tmp" "$INCIDENT_DIR/$INCIDENT_ID.json"
    
    # Stop recording
    if [ -f "$INCIDENT_DIR/$INCIDENT_ID.pid" ]; then
        kill $(cat "$INCIDENT_DIR/$INCIDENT_ID.pid") 2>/dev/null || true
        rm "$INCIDENT_DIR/$INCIDENT_ID.pid"
    fi
    
    # Send resolution notification
    send_resolution_notification "$resolution"
    
    # Update status page
    update_status_page "resolved" "All systems operational"
    
    # Generate incident report
    generate_incident_report
}

send_resolution_notification() {
    local resolution=$1
    
    if [ -n "${SLACK_WEBHOOK:-}" ]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{
                \"text\": \"✅ Incident Resolved: $INCIDENT_ID\",
                \"attachments\": [{
                    \"color\": \"good\",
                    \"title\": \"Incident Resolution\",
                    \"text\": \"$resolution\",
                    \"fields\": [
                        {\"title\": \"Duration\", \"value\": \"${INCIDENT_DURATION} seconds\", \"short\": true},
                        {\"title\": \"Severity\", \"value\": \"$INCIDENT_SEVERITY\", \"short\": true}
                    ],
                    \"footer\": \"Incident Response System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            -s -o /dev/null
    fi
}

generate_incident_report() {
    local report_file="$INCIDENT_DIR/${INCIDENT_ID}_report.md"
    
    cat > "$report_file" << EOF
# Incident Report: $INCIDENT_ID

## Summary
- **Severity**: $INCIDENT_SEVERITY
- **Duration**: ${INCIDENT_DURATION} seconds
- **Start Time**: $(date -d "@$INCIDENT_START" -Iseconds)
- **End Time**: $(date -d "@$INCIDENT_END" -Iseconds)

## Timeline
$(grep -E "(CRITICAL|ERROR|WARNING)" "$INCIDENT_LOG" | head -20)

## System State Snapshots
$(grep -A 10 "System State" "$INCIDENT_LOG" | tail -50)

## Resolution
Incident was resolved through automated response system.

## Follow-up Actions
- [ ] Conduct post-mortem review
- [ ] Update runbooks if needed
- [ ] Implement preventive measures

---
Generated: $(date)
EOF
    
    log "Incident report saved: $report_file"
}

# =====================================================
# Interactive Functions
# =====================================================

confirm_action() {
    local prompt=$1
    read -p "$prompt [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

show_menu() {
    echo ""
    echo "=== Pitchey Incident Response System ==="
    echo "1) Run automated detection"
    echo "2) Declare incident manually"
    echo "3) Check system health"
    echo "4) View active incidents"
    echo "5) Resolve active incident"
    echo "6) Run test (dry run)"
    echo "7) Exit"
    echo ""
    read -p "Select option: " choice
    
    case $choice in
        1) run_detection ;;
        2) manual_incident ;;
        3) check_health ;;
        4) list_incidents ;;
        5) resolve_active ;;
        6) run_test ;;
        7) exit 0 ;;
        *) echo "Invalid option" ;;
    esac
}

run_detection() {
    info "Running automated incident detection..."
    
    local issues_found=false
    
    if detect_high_error_rate; then
        declare_incident "P1" "High Error Rate" "Elevated error rate detected in production"
        mitigate_high_error_rate
        issues_found=true
    fi
    
    if detect_database_issues; then
        declare_incident "P1" "Database Performance Issues" "Database performance degradation detected"
        mitigate_database_issues
        issues_found=true
    fi
    
    if detect_api_outage; then
        declare_incident "P0" "API Outage" "API is not responding or experiencing high latency"
        mitigate_api_outage
        issues_found=true
    fi
    
    if detect_cache_issues; then
        declare_incident "P2" "Cache Issues" "Redis cache is not responding"
        mitigate_cache_issues
        issues_found=true
    fi
    
    if ! $issues_found; then
        log "✅ No issues detected - all systems healthy"
    else
        if [ -n "$INCIDENT_ID" ]; then
            resolve_incident "Automated mitigation successful"
        fi
    fi
}

manual_incident() {
    read -p "Severity (P0/P1/P2/P3): " severity
    read -p "Title: " title
    read -p "Description: " description
    
    declare_incident "$severity" "$title" "$description"
    
    echo "Incident $INCIDENT_ID declared"
    echo "What would you like to do?"
    echo "1) Apply automated mitigation"
    echo "2) Manual intervention"
    echo "3) Cancel"
    
    read -p "Select: " action
    
    case $action in
        1) run_detection ;;
        2) info "Manual intervention mode - incident remains open" ;;
        3) resolve_incident "Cancelled" ;;
    esac
}

check_health() {
    info "Checking system health..."
    
    echo ""
    echo -n "Database: "
    detect_database_issues && echo "❌ Issues detected" || echo "✅ Healthy"
    
    echo -n "API: "
    detect_api_outage && echo "❌ Issues detected" || echo "✅ Healthy"
    
    echo -n "Cache: "
    detect_cache_issues && echo "❌ Issues detected" || echo "✅ Healthy"
    
    echo -n "Error Rate: "
    detect_high_error_rate && echo "❌ High" || echo "✅ Normal"
    echo ""
}

list_incidents() {
    info "Active incidents:"
    
    for incident_file in "$INCIDENT_DIR"/*.json; do
        if [ -f "$incident_file" ]; then
            jq -r '"\(.id) | \(.severity) | \(.title) | \(.status)"' "$incident_file"
        fi
    done
}

resolve_active() {
    if [ -z "$INCIDENT_ID" ]; then
        # Find most recent unresolved incident
        for incident_file in $(ls -t "$INCIDENT_DIR"/*.json 2>/dev/null); do
            if [ -f "$incident_file" ]; then
                status=$(jq -r '.status' "$incident_file")
                if [ "$status" != "resolved" ]; then
                    INCIDENT_ID=$(jq -r '.id' "$incident_file")
                    INCIDENT_SEVERITY=$(jq -r '.severity' "$incident_file")
                    INCIDENT_START=$(date -d "$(jq -r '.declared_at' "$incident_file")" +%s)
                    break
                fi
            fi
        done
    fi
    
    if [ -n "$INCIDENT_ID" ]; then
        read -p "Resolution notes: " resolution
        resolve_incident "$resolution"
    else
        info "No active incidents to resolve"
    fi
}

run_test() {
    info "Running incident response test (dry run)..."
    
    # Temporarily set test mode
    export DRY_RUN=true
    
    info "Test 1: High error rate detection"
    detect_high_error_rate && echo "  Would trigger P1 incident" || echo "  No issue"
    
    info "Test 2: Database issue detection"
    detect_database_issues && echo "  Would trigger P1 incident" || echo "  No issue"
    
    info "Test 3: API outage detection"
    detect_api_outage && echo "  Would trigger P0 incident" || echo "  No issue"
    
    info "Test 4: Cache issue detection"
    detect_cache_issues && echo "  Would trigger P2 incident" || echo "  No issue"
    
    log "✅ Test complete - no actual changes made"
}

# =====================================================
# Main Execution
# =====================================================

main() {
    case "${1:-}" in
        start)
            shift
            severity=${1:-P2}
            title=${2:-"Manual Incident"}
            description=${3:-"Manually declared incident"}
            declare_incident "$severity" "$title" "$description"
            ;;
        
        detect)
            run_detection
            ;;
        
        resolve)
            resolve_active
            ;;
        
        check)
            check_health
            ;;
        
        test)
            run_test
            ;;
        
        menu)
            while true; do
                show_menu
            done
            ;;
        
        *)
            echo "Usage: $0 {start|detect|resolve|check|test|menu}"
            echo ""
            echo "Commands:"
            echo "  start [severity] [title] [description] - Declare an incident"
            echo "  detect                                  - Run automated detection"
            echo "  resolve                                 - Resolve active incident"
            echo "  check                                   - Check system health"
            echo "  test                                    - Run test (dry run)"
            echo "  menu                                    - Interactive menu"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"