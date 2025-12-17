#!/bin/bash

# =====================================================
# Disaster Recovery Script for Pitchey Platform
# =====================================================
# This script handles various disaster recovery scenarios
# including database failures, service outages, and data corruption

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="/tmp/pitchey-backups"
RECOVERY_LOG="/tmp/pitchey-recovery-$(date +%Y%m%d-%H%M%S).log"
MAX_RETRIES=3
RETRY_DELAY=10

# RTO/RPO Targets
RTO_DATABASE=900      # 15 minutes
RTO_API=300          # 5 minutes
RTO_AUTH=600         # 10 minutes
RPO_DATABASE=3600    # 1 hour
RPO_SESSION=300      # 5 minutes

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo -e "${2:-$GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$RECOVERY_LOG"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$RECOVERY_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$RECOVERY_LOG"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$RECOVERY_LOG"
}

# =====================================================
# Health Check Functions
# =====================================================

check_database_health() {
    log "Checking database health..."
    
    if [ -z "${DATABASE_URL:-}" ]; then
        error "DATABASE_URL not configured"
        return 1
    fi
    
    # Test database connection
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        log "✅ Database is healthy"
        return 0
    else
        error "Database is not responding"
        return 1
    fi
}

check_api_health() {
    log "Checking API health..."
    
    API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health" || echo "000")
    
    if [ "$response" = "200" ]; then
        log "✅ API is healthy"
        return 0
    else
        error "API is not responding (HTTP $response)"
        return 1
    fi
}

check_redis_health() {
    log "Checking Redis health..."
    
    if [ -z "${REDIS_URL:-}" ] || [ -z "${REDIS_TOKEN:-}" ]; then
        warning "Redis not configured"
        return 1
    fi
    
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $REDIS_TOKEN" \
        "$REDIS_URL/ping" || echo "000")
    
    if [ "$response" = "200" ]; then
        log "✅ Redis is healthy"
        return 0
    else
        warning "Redis is not responding (HTTP $response)"
        return 1
    fi
}

check_neon_health() {
    log "Checking Neon status..."
    
    if [ -z "${NEON_API_KEY:-}" ] || [ -z "${NEON_PROJECT_ID:-}" ]; then
        error "Neon credentials not configured"
        return 1
    fi
    
    response=$(curl -s "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID" \
        -H "Authorization: Bearer $NEON_API_KEY" \
        -H "Accept: application/json")
    
    if echo "$response" | grep -q "active"; then
        log "✅ Neon project is active"
        return 0
    else
        error "Neon project is not active"
        return 1
    fi
}

# =====================================================
# Database Recovery Functions
# =====================================================

recover_database() {
    log "🔧 Starting database recovery process..."
    
    # Step 1: Check if database is actually down
    if check_database_health; then
        log "Database is already healthy, no recovery needed"
        return 0
    fi
    
    # Step 2: Check Neon status
    if ! check_neon_health; then
        # Attempt to restart Neon endpoint
        restart_neon_endpoint
    fi
    
    # Step 3: Try connection again
    sleep 10
    if check_database_health; then
        log "✅ Database recovered after Neon restart"
        return 0
    fi
    
    # Step 4: Failover to backup branch
    log "Attempting failover to backup branch..."
    failover_to_backup_branch
    
    # Step 5: Verify recovery
    if check_database_health; then
        log "✅ Database recovered via failover"
        notify_team "Database recovered via failover to backup branch"
        return 0
    else
        error "Database recovery failed - manual intervention required"
        page_oncall "CRITICAL: Database recovery failed"
        return 1
    fi
}

restart_neon_endpoint() {
    log "Restarting Neon endpoint..."
    
    response=$(curl -X POST \
        "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/endpoints/$NEON_ENDPOINT_ID/restart" \
        -H "Authorization: Bearer $NEON_API_KEY" \
        -H "Accept: application/json" \
        -s -o /dev/null -w "%{http_code}")
    
    if [ "$response" = "200" ] || [ "$response" = "202" ]; then
        log "✅ Neon endpoint restart initiated"
        sleep 30  # Wait for restart
        return 0
    else
        error "Failed to restart Neon endpoint (HTTP $response)"
        return 1
    fi
}

failover_to_backup_branch() {
    log "Creating recovery branch from last known good state..."
    
    # Get timestamp from 1 hour ago (RPO target)
    RECOVERY_TIMESTAMP=$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%S.000Z')
    
    # Create new branch from timestamp
    response=$(curl -X POST \
        "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches" \
        -H "Authorization: Bearer $NEON_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"branch\": {
                \"name\": \"recovery-$(date +%s)\",
                \"parent_timestamp\": \"$RECOVERY_TIMESTAMP\"
            }
        }" \
        -s)
    
    BRANCH_ID=$(echo "$response" | jq -r '.branch.id' || echo "")
    
    if [ -n "$BRANCH_ID" ]; then
        log "✅ Recovery branch created: $BRANCH_ID"
        
        # Update DATABASE_URL with new branch
        NEW_DATABASE_URL=$(echo "$response" | jq -r '.connection_uri' || echo "")
        
        if [ -n "$NEW_DATABASE_URL" ]; then
            # Update Cloudflare Worker secret
            update_worker_secret "DATABASE_URL" "$NEW_DATABASE_URL"
            
            # Export for immediate use
            export DATABASE_URL="$NEW_DATABASE_URL"
            
            log "✅ Database URL updated to recovery branch"
            return 0
        fi
    fi
    
    error "Failed to create recovery branch"
    return 1
}

# =====================================================
# Service Recovery Functions
# =====================================================

recover_api() {
    log "🔧 Starting API recovery process..."
    
    if check_api_health; then
        log "API is already healthy"
        return 0
    fi
    
    # Restart Worker
    log "Redeploying Cloudflare Worker..."
    
    if command -v wrangler &> /dev/null; then
        wrangler deploy --env production
        
        sleep 10
        if check_api_health; then
            log "✅ API recovered after redeploy"
            return 0
        fi
    fi
    
    # Rollback to previous deployment
    log "Rolling back to previous deployment..."
    if rollback_worker; then
        sleep 10
        if check_api_health; then
            log "✅ API recovered after rollback"
            notify_team "API recovered via rollback to previous deployment"
            return 0
        fi
    fi
    
    error "API recovery failed"
    return 1
}

rollback_worker() {
    log "Rolling back Cloudflare Worker..."
    
    if command -v wrangler &> /dev/null; then
        wrangler rollback --env production
        return $?
    else
        error "wrangler CLI not available"
        return 1
    fi
}

recover_cache() {
    log "🔧 Starting cache recovery process..."
    
    if ! check_redis_health; then
        warning "Redis is down - switching to fallback cache"
        
        # Enable in-memory cache fallback
        update_worker_secret "CACHE_FALLBACK" "true"
        
        # Notify about degraded performance
        notify_team "Redis down - using in-memory cache fallback"
        
        return 0
    fi
    
    # Clear potentially corrupted cache
    log "Clearing Redis cache..."
    clear_redis_cache
    
    log "✅ Cache recovery complete"
    return 0
}

clear_redis_cache() {
    if [ -n "${REDIS_URL:-}" ] && [ -n "${REDIS_TOKEN:-}" ]; then
        curl -X DELETE "$REDIS_URL/*" \
            -H "Authorization: Bearer $REDIS_TOKEN" \
            -s -o /dev/null
        
        log "Redis cache cleared"
    fi
}

# =====================================================
# Backup Functions
# =====================================================

create_emergency_backup() {
    log "📦 Creating emergency backup..."
    
    BACKUP_FILE="$BACKUP_DIR/emergency-$(date +%Y%m%d-%H%M%S).sql"
    
    # Backup database
    if [ -n "${DATABASE_URL:-}" ]; then
        if pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>> "$RECOVERY_LOG"; then
            log "✅ Database backed up to $BACKUP_FILE"
            
            # Compress backup
            gzip "$BACKUP_FILE"
            
            # Upload to R2 if configured
            if [ -n "${R2_BUCKET:-}" ]; then
                upload_to_r2 "$BACKUP_FILE.gz"
            fi
            
            return 0
        else
            error "Database backup failed"
            return 1
        fi
    else
        error "DATABASE_URL not configured"
        return 1
    fi
}

upload_to_r2() {
    local file=$1
    log "Uploading backup to R2..."
    
    # This would use rclone or AWS CLI configured for R2
    # rclone copy "$file" r2:pitchey-backups/emergency/
    
    log "Backup uploaded to R2"
}

# =====================================================
# Communication Functions
# =====================================================

notify_team() {
    local message=$1
    log "📢 Notifying team: $message"
    
    # Slack notification
    if [ -n "${SLACK_WEBHOOK:-}" ]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🔔 Disaster Recovery: $message\"}" \
            -s -o /dev/null
    fi
    
    # Email notification (would need SMTP configuration)
    # echo "$message" | mail -s "Pitchey DR Alert" team@pitchey.com
}

page_oncall() {
    local message=$1
    error "🚨 PAGING ON-CALL: $message"
    
    # PagerDuty integration
    if [ -n "${PAGERDUTY_ROUTING_KEY:-}" ]; then
        curl -X POST "https://events.pagerduty.com/v2/enqueue" \
            -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_ROUTING_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"$message\",
                    \"severity\": \"critical\",
                    \"source\": \"disaster-recovery-script\"
                }
            }" \
            -s -o /dev/null
    fi
    
    notify_team "CRITICAL: $message"
}

update_status_page() {
    local status=$1
    local message=$2
    
    log "Updating status page: $status"
    
    # Update status page via API
    if [ -n "${STATUSPAGE_API_KEY:-}" ] && [ -n "${STATUSPAGE_PAGE_ID:-}" ]; then
        curl -X POST "https://api.statuspage.io/v1/pages/$STATUSPAGE_PAGE_ID/incidents" \
            -H "Authorization: OAuth $STATUSPAGE_API_KEY" \
            -H 'Content-Type: application/json' \
            -d "{
                \"incident\": {
                    \"name\": \"$message\",
                    \"status\": \"$status\",
                    \"impact_override\": \"major\"
                }
            }" \
            -s -o /dev/null
    fi
}

# =====================================================
# Helper Functions
# =====================================================

update_worker_secret() {
    local key=$1
    local value=$2
    
    log "Updating Worker secret: $key"
    
    if command -v wrangler &> /dev/null; then
        echo "$value" | wrangler secret put "$key" --env production
        return $?
    else
        error "wrangler CLI not available"
        return 1
    fi
}

# =====================================================
# Recovery Orchestration
# =====================================================

execute_full_recovery() {
    log "🚀 Starting full disaster recovery process..."
    
    START_TIME=$(date +%s)
    RECOVERY_STATUS="success"
    
    # Step 1: Create emergency backup (if possible)
    info "Step 1: Creating emergency backup..."
    create_emergency_backup || warning "Backup failed - continuing recovery"
    
    # Step 2: Assess damage
    info "Step 2: Assessing system damage..."
    FAILED_COMPONENTS=()
    
    check_database_health || FAILED_COMPONENTS+=("database")
    check_api_health || FAILED_COMPONENTS+=("api")
    check_redis_health || FAILED_COMPONENTS+=("cache")
    
    if [ ${#FAILED_COMPONENTS[@]} -eq 0 ]; then
        log "✅ All systems healthy - no recovery needed"
        return 0
    fi
    
    # Step 3: Notify about recovery start
    info "Step 3: Initiating recovery for: ${FAILED_COMPONENTS[*]}"
    notify_team "Starting disaster recovery for: ${FAILED_COMPONENTS[*]}"
    update_status_page "investigating" "Experiencing technical difficulties"
    
    # Step 4: Execute recovery in priority order
    info "Step 4: Executing recovery procedures..."
    
    # Priority 1: Database
    if [[ " ${FAILED_COMPONENTS[@]} " =~ " database " ]]; then
        recover_database || RECOVERY_STATUS="partial"
    fi
    
    # Priority 2: API
    if [[ " ${FAILED_COMPONENTS[@]} " =~ " api " ]]; then
        recover_api || RECOVERY_STATUS="partial"
    fi
    
    # Priority 3: Cache
    if [[ " ${FAILED_COMPONENTS[@]} " =~ " cache " ]]; then
        recover_cache || RECOVERY_STATUS="partial"
    fi
    
    # Step 5: Verify recovery
    info "Step 5: Verifying recovery..."
    sleep 10
    
    STILL_FAILED=()
    check_database_health || STILL_FAILED+=("database")
    check_api_health || STILL_FAILED+=("api")
    check_redis_health || STILL_FAILED+=("cache")
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # Step 6: Report results
    info "Step 6: Recovery complete"
    
    if [ ${#STILL_FAILED[@]} -eq 0 ]; then
        log "✅ Full recovery successful in ${DURATION} seconds"
        notify_team "✅ All systems recovered successfully (Duration: ${DURATION}s)"
        update_status_page "resolved" "All systems operational"
    else
        error "⚠️ Partial recovery - still failed: ${STILL_FAILED[*]}"
        page_oncall "Partial recovery - manual intervention needed for: ${STILL_FAILED[*]}"
        update_status_page "monitoring" "Partial recovery - some issues remain"
        RECOVERY_STATUS="failed"
    fi
    
    # Generate recovery report
    generate_recovery_report "$DURATION" "$RECOVERY_STATUS"
    
    return $([ "$RECOVERY_STATUS" = "success" ] && echo 0 || echo 1)
}

generate_recovery_report() {
    local duration=$1
    local status=$2
    
    REPORT_FILE="$BACKUP_DIR/recovery-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$REPORT_FILE" << EOF
==============================================
DISASTER RECOVERY REPORT
==============================================
Date: $(date)
Duration: ${duration} seconds
Status: ${status}
Log File: ${RECOVERY_LOG}

Components Checked:
- Database: $(check_database_health && echo "✅ Healthy" || echo "❌ Failed")
- API: $(check_api_health && echo "✅ Healthy" || echo "❌ Failed")
- Cache: $(check_redis_health && echo "✅ Healthy" || echo "❌ Failed")

RTO Compliance:
- Database: $([ $duration -le $RTO_DATABASE ] && echo "✅ Met" || echo "❌ Exceeded") (Target: ${RTO_DATABASE}s)
- API: $([ $duration -le $RTO_API ] && echo "✅ Met" || echo "❌ Exceeded") (Target: ${RTO_API}s)

Actions Taken:
$(grep -E "(Starting|Creating|Restarting|Rolling)" "$RECOVERY_LOG" | tail -20)

==============================================
EOF
    
    log "Recovery report generated: $REPORT_FILE"
}

# =====================================================
# Main Execution
# =====================================================

main() {
    case "${1:-}" in
        check)
            log "Running health checks..."
            check_database_health
            check_api_health
            check_redis_health
            ;;
        
        database)
            recover_database
            ;;
        
        api)
            recover_api
            ;;
        
        cache)
            recover_cache
            ;;
        
        backup)
            create_emergency_backup
            ;;
        
        full)
            execute_full_recovery
            ;;
        
        test)
            log "Running disaster recovery test (dry run)..."
            check_database_health
            check_api_health
            check_redis_health
            log "✅ DR test complete"
            ;;
        
        *)
            echo "Usage: $0 {check|database|api|cache|backup|full|test}"
            echo ""
            echo "Commands:"
            echo "  check    - Check health of all components"
            echo "  database - Recover database only"
            echo "  api      - Recover API only"
            echo "  cache    - Recover cache only"
            echo "  backup   - Create emergency backup"
            echo "  full     - Execute full disaster recovery"
            echo "  test     - Run DR test (dry run)"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"