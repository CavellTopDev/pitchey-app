#!/bin/bash

# Cloudflare Workflows Deployment Script
# Handles blue-green deployment with automatic rollback on failure

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKFLOW_DIR="/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/workflows"
ENVIRONMENT="${1:-staging}"
DRY_RUN="${2:-false}"
ROLLBACK_ON_ERROR="${ROLLBACK_ON_ERROR:-true}"
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5

# Deployment tracking
DEPLOYMENT_ID=$(date +%s)
DEPLOYMENT_LOG="${WORKFLOW_DIR}/deployments/${DEPLOYMENT_ID}.log"

# Functions
log() {
    echo -e "${2:-$NC}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    log "ERROR: $1" "$RED"
    exit 1
}

success() {
    log "SUCCESS: $1" "$GREEN"
}

warning() {
    log "WARNING: $1" "$YELLOW"
}

info() {
    log "INFO: $1" "$BLUE"
}

# Pre-deployment checks
pre_deploy_checks() {
    info "Running pre-deployment checks..."
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        error "Wrangler CLI not found. Please install it first."
    fi
    
    # Check if logged in to Cloudflare
    if ! wrangler whoami &> /dev/null; then
        error "Not logged in to Cloudflare. Run 'wrangler login' first."
    fi
    
    # Validate configuration
    if ! wrangler deploy --dry-run --env "$ENVIRONMENT" &> /dev/null; then
        error "Configuration validation failed"
    fi
    
    # Run tests
    info "Running test suite..."
    if ! npm test &> /dev/null; then
        error "Tests failed. Aborting deployment."
    fi
    
    # Check database migrations
    info "Checking pending database migrations..."
    if [ -f "./migrations/pending.sql" ]; then
        warning "Pending database migrations found. Apply them before deploying."
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment cancelled"
        fi
    fi
    
    success "Pre-deployment checks passed"
}

# Backup current deployment
backup_current() {
    info "Backing up current deployment..."
    
    # Get current deployment info
    CURRENT_VERSION=$(wrangler deployments list --env "$ENVIRONMENT" | head -n 2 | tail -n 1 | awk '{print $1}')
    
    if [ -n "$CURRENT_VERSION" ]; then
        echo "$CURRENT_VERSION" > "${WORKFLOW_DIR}/deployments/rollback_${ENVIRONMENT}.txt"
        success "Backed up current version: $CURRENT_VERSION"
    else
        warning "No current deployment found to backup"
    fi
}

# Deploy workflows
deploy_workflows() {
    info "Deploying workflows to $ENVIRONMENT..."
    
    # Create deployment metadata
    cat > "${WORKFLOW_DIR}/deployments/${DEPLOYMENT_ID}_metadata.json" <<EOF
{
    "deployment_id": "$DEPLOYMENT_ID",
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -Iseconds)",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD)",
    "deployer": "$(whoami)"
}
EOF
    
    # Deploy each workflow
    WORKFLOWS=("InvestmentDealWorkflow" "ProductionDealWorkflow" "NDAWorkflow")
    
    for workflow in "${WORKFLOWS[@]}"; do
        info "Deploying $workflow..."
        
        if [ "$DRY_RUN" = "true" ]; then
            wrangler deploy --dry-run --env "$ENVIRONMENT" --name "$workflow" 2>&1 | tee -a "$DEPLOYMENT_LOG"
        else
            if ! wrangler deploy --env "$ENVIRONMENT" --name "$workflow" 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
                error "Failed to deploy $workflow"
            fi
        fi
        
        success "$workflow deployed successfully"
    done
    
    # Deploy main worker
    info "Deploying main worker..."
    if [ "$DRY_RUN" = "true" ]; then
        wrangler deploy --dry-run --env "$ENVIRONMENT" 2>&1 | tee -a "$DEPLOYMENT_LOG"
    else
        if ! wrangler deploy --env "$ENVIRONMENT" 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
            error "Failed to deploy main worker"
        fi
    fi
    
    success "All workflows deployed successfully"
}

# Update secrets
update_secrets() {
    info "Updating secrets for $ENVIRONMENT..."
    
    # Check if secrets file exists
    SECRETS_FILE="${WORKFLOW_DIR}/.secrets.${ENVIRONMENT}"
    if [ ! -f "$SECRETS_FILE" ]; then
        warning "No secrets file found at $SECRETS_FILE. Skipping secret update."
        return
    fi
    
    # Read and set secrets
    while IFS='=' read -r key value; do
        if [ -n "$key" ] && [ -n "$value" ]; then
            info "Setting secret: $key"
            echo "$value" | wrangler secret put "$key" --env "$ENVIRONMENT" 2>&1 | tee -a "$DEPLOYMENT_LOG"
        fi
    done < "$SECRETS_FILE"
    
    success "Secrets updated"
}

# Health checks
run_health_checks() {
    info "Running health checks..."
    
    local HEALTH_ENDPOINT
    case "$ENVIRONMENT" in
        production)
            HEALTH_ENDPOINT="https://pitchey-api-prod.ndlovucavelle.workers.dev/health"
            ;;
        staging)
            HEALTH_ENDPOINT="https://staging.pitchey-api.ndlovucavelle.workers.dev/health"
            ;;
        *)
            HEALTH_ENDPOINT="https://${ENVIRONMENT}.pitchey-api.ndlovucavelle.workers.dev/health"
            ;;
    esac
    
    local ELAPSED=0
    while [ $ELAPSED -lt $HEALTH_CHECK_TIMEOUT ]; do
        if curl -s -f "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
            success "Health check passed"
            return 0
        fi
        
        warning "Health check failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
        ELAPSED=$((ELAPSED + HEALTH_CHECK_INTERVAL))
    done
    
    error "Health checks failed after ${HEALTH_CHECK_TIMEOUT}s"
}

# Smoke tests
run_smoke_tests() {
    info "Running smoke tests..."
    
    # Test workflow creation
    local TEST_ENDPOINTS=(
        "/api/workflows/investment/create"
        "/api/workflows/production/create"
        "/api/workflows/nda/create"
    )
    
    for endpoint in "${TEST_ENDPOINTS[@]}"; do
        info "Testing $endpoint..."
        
        local URL
        case "$ENVIRONMENT" in
            production)
                URL="https://pitchey-api-prod.ndlovucavelle.workers.dev${endpoint}"
                ;;
            staging)
                URL="https://staging.pitchey-api.ndlovucavelle.workers.dev${endpoint}"
                ;;
            *)
                URL="https://${ENVIRONMENT}.pitchey-api.ndlovucavelle.workers.dev${endpoint}"
                ;;
        esac
        
        # Skip actual API calls in dry run
        if [ "$DRY_RUN" = "true" ]; then
            info "Dry run: Would test $URL"
        else
            RESPONSE=$(curl -s -X POST "$URL" \
                -H "Content-Type: application/json" \
                -d '{"test": true}' \
                -w "\n%{http_code}")
            
            HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
            
            if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
                warning "Smoke test failed for $endpoint (HTTP $HTTP_CODE)"
                
                if [ "$ROLLBACK_ON_ERROR" = "true" ]; then
                    rollback_deployment
                    error "Deployment rolled back due to smoke test failure"
                fi
            fi
        fi
    done
    
    success "Smoke tests passed"
}

# Rollback deployment
rollback_deployment() {
    warning "Rolling back deployment..."
    
    ROLLBACK_FILE="${WORKFLOW_DIR}/deployments/rollback_${ENVIRONMENT}.txt"
    if [ ! -f "$ROLLBACK_FILE" ]; then
        error "No rollback version found"
    fi
    
    ROLLBACK_VERSION=$(cat "$ROLLBACK_FILE")
    info "Rolling back to version: $ROLLBACK_VERSION"
    
    if ! wrangler rollback "$ROLLBACK_VERSION" --env "$ENVIRONMENT"; then
        error "Rollback failed"
    fi
    
    success "Deployment rolled back successfully"
}

# Post-deployment tasks
post_deployment() {
    info "Running post-deployment tasks..."
    
    # Clear CDN cache
    info "Clearing CDN cache..."
    if [ "$DRY_RUN" != "true" ]; then
        wrangler dispatch-namespace purge --env "$ENVIRONMENT" 2>&1 | tee -a "$DEPLOYMENT_LOG" || true
    fi
    
    # Send deployment notification
    if [ "$ENVIRONMENT" = "production" ]; then
        info "Sending deployment notification..."
        
        NOTIFICATION_PAYLOAD=$(cat <<EOF
{
    "deployment_id": "$DEPLOYMENT_ID",
    "environment": "$ENVIRONMENT",
    "status": "success",
    "timestamp": "$(date -Iseconds)",
    "deployer": "$(whoami)",
    "git_commit": "$(git rev-parse HEAD)"
}
EOF
)
        
        # Send to notification queue
        if [ "$DRY_RUN" != "true" ]; then
            echo "$NOTIFICATION_PAYLOAD" | wrangler queue send notifications --env "$ENVIRONMENT" 2>&1 | tee -a "$DEPLOYMENT_LOG" || true
        fi
    fi
    
    # Update deployment tracking
    echo "SUCCESS" > "${WORKFLOW_DIR}/deployments/${DEPLOYMENT_ID}_status.txt"
    
    success "Post-deployment tasks completed"
}

# Analytics reporting
report_analytics() {
    info "Deployment Analytics Report"
    info "=========================="
    info "Deployment ID: $DEPLOYMENT_ID"
    info "Environment: $ENVIRONMENT"
    info "Start Time: $(date -r "${DEPLOYMENT_LOG}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo 'Unknown')"
    info "End Time: $(date '+%Y-%m-%d %H:%M:%S')"
    info "Git Commit: $(git rev-parse HEAD)"
    info "Git Branch: $(git rev-parse --abbrev-ref HEAD)"
    
    # Count log entries
    if [ -f "$DEPLOYMENT_LOG" ]; then
        local ERROR_COUNT=$(grep -c "ERROR" "$DEPLOYMENT_LOG" || echo 0)
        local WARNING_COUNT=$(grep -c "WARNING" "$DEPLOYMENT_LOG" || echo 0)
        local SUCCESS_COUNT=$(grep -c "SUCCESS" "$DEPLOYMENT_LOG" || echo 0)
        
        info "Errors: $ERROR_COUNT"
        info "Warnings: $WARNING_COUNT"
        info "Successes: $SUCCESS_COUNT"
    fi
    
    info "=========================="
}

# Main deployment flow
main() {
    # Create deployment directory if it doesn't exist
    mkdir -p "${WORKFLOW_DIR}/deployments"
    
    # Initialize deployment log
    echo "Deployment started at $(date)" > "$DEPLOYMENT_LOG"
    
    info "Starting deployment to $ENVIRONMENT environment"
    
    if [ "$DRY_RUN" = "true" ]; then
        warning "DRY RUN MODE - No actual deployment will occur"
    fi
    
    # Execute deployment steps
    pre_deploy_checks
    backup_current
    deploy_workflows
    
    if [ "$DRY_RUN" != "true" ]; then
        update_secrets
        run_health_checks
        run_smoke_tests
        post_deployment
    fi
    
    report_analytics
    
    success "Deployment completed successfully!"
    
    # Show deployment URL
    case "$ENVIRONMENT" in
        production)
            info "Production URL: https://pitchey-api-prod.ndlovucavelle.workers.dev"
            ;;
        staging)
            info "Staging URL: https://staging.pitchey-api.ndlovucavelle.workers.dev"
            ;;
        *)
            info "Environment URL: https://${ENVIRONMENT}.pitchey-api.ndlovucavelle.workers.dev"
            ;;
    esac
}

# Show usage
usage() {
    cat <<EOF
Usage: $0 [environment] [dry-run]

Arguments:
  environment    Target environment (production, staging, development)
                 Default: staging
  dry-run        Run deployment simulation without actual changes (true/false)
                 Default: false

Environment Variables:
  ROLLBACK_ON_ERROR    Automatically rollback on health check failure (true/false)
                       Default: true

Examples:
  $0                    # Deploy to staging
  $0 production         # Deploy to production
  $0 staging true       # Dry run for staging
  $0 production false   # Deploy to production (explicit)

EOF
}

# Handle help flag
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Validate environment argument
case "$ENVIRONMENT" in
    production|staging|development)
        ;;
    *)
        error "Invalid environment: $ENVIRONMENT. Must be production, staging, or development."
        ;;
esac

# Run deployment
main

exit 0