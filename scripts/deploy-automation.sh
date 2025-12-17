#!/bin/bash

# Comprehensive Deployment Automation Script
# Handles complete deployment pipeline with validation and rollback

set -e

# Configuration
ENVIRONMENT="${1:-production}"
SKIP_TESTS="${2:-false}"
DRY_RUN="${3:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Deployment tracking
DEPLOYMENT_ID=$(date +%Y%m%d%H%M%S)
DEPLOYMENT_LOG="deployment-${DEPLOYMENT_ID}.log"

# Functions
log() {
    echo -e "${2:-$NC}$1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

log_section() {
    echo "" | tee -a "$DEPLOYMENT_LOG"
    echo "========================================" | tee -a "$DEPLOYMENT_LOG"
    log "$1" "$BLUE"
    echo "========================================" | tee -a "$DEPLOYMENT_LOG"
}

check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check required tools
    local tools=("node" "npm" "deno" "wrangler" "git")
    for tool in "${tools[@]}"; do
        if command -v "$tool" &> /dev/null; then
            log "✓ $tool installed" "$GREEN"
        else
            log "✗ $tool not found" "$RED"
            exit 1
        fi
    done
    
    # Check environment variables
    local required_vars=("CLOUDFLARE_API_TOKEN" "CLOUDFLARE_ACCOUNT_ID" "DATABASE_URL")
    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            log "✓ $var configured" "$GREEN"
        else
            log "✗ $var not set" "$RED"
            exit 1
        fi
    done
    
    # Check git status
    if [ -z "$(git status --porcelain)" ]; then
        log "✓ Working directory clean" "$GREEN"
    else
        log "⚠ Uncommitted changes detected" "$YELLOW"
        read -p "Continue with uncommitted changes? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log "⏭ Skipping tests (SKIP_TESTS=true)" "$YELLOW"
        return
    fi
    
    log_section "Running Tests"
    
    # Unit tests
    log "Running unit tests..."
    if npm run test:unit > /dev/null 2>&1; then
        log "✓ Unit tests passed" "$GREEN"
    else
        log "✗ Unit tests failed" "$RED"
        exit 1
    fi
    
    # Integration tests
    log "Running integration tests..."
    if npm run test:integration > /dev/null 2>&1; then
        log "✓ Integration tests passed" "$GREEN"
    else
        log "✗ Integration tests failed" "$RED"
        exit 1
    fi
    
    # API tests
    log "Running API tests..."
    if npm run test:api > /dev/null 2>&1; then
        log "✓ API tests passed" "$GREEN"
    else
        log "✗ API tests failed" "$RED"
        exit 1
    fi
}

build_application() {
    log_section "Building Application"
    
    # Build frontend
    log "Building frontend..."
    cd frontend
    if npm run build > /dev/null 2>&1; then
        log "✓ Frontend build successful" "$GREEN"
        FRONTEND_SIZE=$(du -sh dist | cut -f1)
        log "  Size: $FRONTEND_SIZE" "$NC"
    else
        log "✗ Frontend build failed" "$RED"
        exit 1
    fi
    cd ..
    
    # Build worker
    log "Building worker..."
    if npm run build:worker > /dev/null 2>&1; then
        log "✓ Worker build successful" "$GREEN"
        WORKER_SIZE=$(du -sh dist/worker.js | cut -f1)
        log "  Size: $WORKER_SIZE" "$NC"
    else
        log "✗ Worker build failed" "$RED"
        exit 1
    fi
}

create_backup() {
    log_section "Creating Backup"
    
    # Backup current deployment
    log "Backing up current deployment..."
    wrangler deployments list --env "$ENVIRONMENT" | head -n 2 > "backup-${DEPLOYMENT_ID}.txt"
    
    # Database backup
    log "Creating database backup..."
    pg_dump "$DATABASE_URL" | gzip > "backup-db-${DEPLOYMENT_ID}.sql.gz"
    
    # Upload to R2
    log "Uploading backup to R2..."
    wrangler r2 object put pitchey-backups/deployments/${DEPLOYMENT_ID}/db.sql.gz \
        --file "backup-db-${DEPLOYMENT_ID}.sql.gz"
    
    log "✓ Backup created: ${DEPLOYMENT_ID}" "$GREEN"
}

deploy_worker() {
    log_section "Deploying Worker"
    
    if [ "$DRY_RUN" = "true" ]; then
        log "🔍 DRY RUN - Would deploy worker to $ENVIRONMENT" "$YELLOW"
        wrangler deploy --env "$ENVIRONMENT" --dry-run
    else
        log "Deploying worker to $ENVIRONMENT..."
        if wrangler deploy --env "$ENVIRONMENT"; then
            log "✓ Worker deployed successfully" "$GREEN"
            WORKER_URL=$(wrangler deployments list --env "$ENVIRONMENT" | grep -oP 'https://[^\s]+' | head -1)
            log "  URL: $WORKER_URL" "$NC"
        else
            log "✗ Worker deployment failed" "$RED"
            exit 1
        fi
    fi
}

deploy_frontend() {
    log_section "Deploying Frontend"
    
    if [ "$DRY_RUN" = "true" ]; then
        log "🔍 DRY RUN - Would deploy frontend" "$YELLOW"
    else
        log "Deploying frontend to Pages..."
        cd frontend
        if npx wrangler pages deploy dist --project-name=pitchey --branch="$ENVIRONMENT"; then
            log "✓ Frontend deployed successfully" "$GREEN"
            FRONTEND_URL=$(wrangler pages deployments list --project-name=pitchey | grep -oP 'https://[^\s]+' | head -1)
            log "  URL: $FRONTEND_URL" "$NC"
        else
            log "✗ Frontend deployment failed" "$RED"
            exit 1
        fi
        cd ..
    fi
}

run_migrations() {
    log_section "Running Migrations"
    
    if [ "$DRY_RUN" = "true" ]; then
        log "🔍 DRY RUN - Would run migrations" "$YELLOW"
        deno run --allow-all src/db/migrate.ts status
    else
        log "Checking migration status..."
        deno run --allow-all src/db/migrate.ts status
        
        log "Running pending migrations..."
        if deno run --allow-all src/db/migrate.ts; then
            log "✓ Migrations completed successfully" "$GREEN"
        else
            log "✗ Migration failed" "$RED"
            exit 1
        fi
    fi
}

warm_cache() {
    log_section "Warming Cache"
    
    if [ "$DRY_RUN" = "true" ]; then
        log "🔍 DRY RUN - Would warm cache" "$YELLOW"
    else
        log "Warming cache..."
        RESPONSE=$(curl -s -X POST "${WORKER_URL}/api/admin/cache/warm" \
            -H "Authorization: Bearer ${ADMIN_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{"priority": 3}')
        
        if echo "$RESPONSE" | grep -q "success"; then
            log "✓ Cache warmed successfully" "$GREEN"
        else
            log "⚠ Cache warming incomplete" "$YELLOW"
        fi
    fi
}

verify_deployment() {
    log_section "Verifying Deployment"
    
    if [ "$DRY_RUN" = "true" ]; then
        log "🔍 DRY RUN - Skipping verification" "$YELLOW"
        return
    fi
    
    # Run verification script
    ./scripts/verify-deployment.sh
    
    # Check critical endpoints
    local endpoints=(
        "/health"
        "/api/pitches/trending"
        "/api/genres"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log "Checking $endpoint..."
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${WORKER_URL}${endpoint}")
        if [ "$STATUS" = "200" ]; then
            log "  ✓ $endpoint responding (${STATUS})" "$GREEN"
        else
            log "  ✗ $endpoint failed (${STATUS})" "$RED"
            VERIFICATION_FAILED=true
        fi
    done
    
    if [ "$VERIFICATION_FAILED" = "true" ]; then
        log "✗ Deployment verification failed" "$RED"
        return 1
    else
        log "✓ Deployment verified successfully" "$GREEN"
    fi
}

monitor_deployment() {
    log_section "Monitoring Deployment"
    
    log "Monitoring for 5 minutes..."
    
    local start_time=$(date +%s)
    local error_count=0
    local check_count=0
    
    while [ $(($(date +%s) - start_time)) -lt 300 ]; do
        check_count=$((check_count + 1))
        
        # Check health
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${WORKER_URL}/health")
        if [ "$STATUS" != "200" ]; then
            error_count=$((error_count + 1))
            log "  ⚠ Health check failed (attempt $check_count)" "$YELLOW"
        fi
        
        # Check error rate
        ERROR_RATE=$(curl -s "${WORKER_URL}/metrics" | grep -oP 'error_rate{[^}]*}\s+\K[0-9.]+' || echo "0")
        if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            log "  ⚠ High error rate detected: ${ERROR_RATE}" "$YELLOW"
            error_count=$((error_count + 1))
        fi
        
        sleep 30
    done
    
    if [ $error_count -gt 3 ]; then
        log "✗ Deployment unstable (${error_count} errors detected)" "$RED"
        return 1
    else
        log "✓ Deployment stable" "$GREEN"
    fi
}

rollback_deployment() {
    log_section "Rolling Back Deployment"
    
    log "⚠ Initiating rollback..." "$YELLOW"
    
    # Rollback worker
    log "Rolling back worker..."
    wrangler rollback --env "$ENVIRONMENT"
    
    # Rollback database if migrations were run
    if [ "$MIGRATIONS_RUN" = "true" ]; then
        log "Rolling back database migrations..."
        deno run --allow-all src/db/migrate.ts rollback
    fi
    
    # Clear cache
    log "Clearing cache..."
    curl -X DELETE "${WORKER_URL}/api/admin/cache" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}"
    
    # Restore from backup if critical failure
    if [ "$CRITICAL_FAILURE" = "true" ]; then
        log "Restoring from backup..."
        wrangler r2 object get pitchey-backups/deployments/${DEPLOYMENT_ID}/db.sql.gz \
            --file restore.sql.gz
        gunzip restore.sql.gz
        psql "$DATABASE_URL" < restore.sql
    fi
    
    log "✓ Rollback completed" "$GREEN"
}

send_notification() {
    local status=$1
    local message=$2
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK" ]; then
        local color="good"
        [ "$status" = "failure" ] && color="danger"
        [ "$status" = "warning" ] && color="warning"
        
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Deployment ${status^}: $ENVIRONMENT\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Deployment ID\", \"value\": \"$DEPLOYMENT_ID\", \"short\": true},
                        {\"title\": \"Initiated by\", \"value\": \"$(whoami)\", \"short\": true},
                        {\"title\": \"Time\", \"value\": \"$(date)\", \"short\": true}
                    ]
                }]
            }"
    fi
}

cleanup() {
    log_section "Cleanup"
    
    # Remove temporary files
    rm -f backup-db-${DEPLOYMENT_ID}.sql.gz
    rm -f backup-${DEPLOYMENT_ID}.txt
    
    log "✓ Cleanup completed" "$GREEN"
}

# Main deployment flow
main() {
    log_section "🚀 Starting Deployment Pipeline"
    log "Environment: $ENVIRONMENT"
    log "Deployment ID: $DEPLOYMENT_ID"
    log "Dry Run: $DRY_RUN"
    
    # Pre-deployment
    check_prerequisites
    run_tests
    build_application
    create_backup
    
    # Deployment
    deploy_worker
    deploy_frontend
    run_migrations
    MIGRATIONS_RUN=true
    warm_cache
    
    # Post-deployment
    if verify_deployment; then
        if monitor_deployment; then
            log_section "✅ DEPLOYMENT SUCCESSFUL"
            send_notification "success" "Deployment completed successfully"
            cleanup
            exit 0
        else
            log "⚠ Deployment monitoring detected issues" "$YELLOW"
            send_notification "warning" "Deployment completed but monitoring detected issues"
        fi
    else
        log "✗ Deployment verification failed" "$RED"
        CRITICAL_FAILURE=true
        rollback_deployment
        send_notification "failure" "Deployment failed and was rolled back"
        exit 1
    fi
}

# Trap errors and rollback if needed
trap 'if [ $? -ne 0 ]; then rollback_deployment; fi' ERR

# Execute main function
main "$@"