#!/bin/bash

# =====================================================
# Rollback script generated during deployment
# Usage: ./rollback-20260110171214.sh
# =====================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

rollback_worker() {
    log "Rolling back Worker deployment..."
    
    # Get previous deployments
    log "Fetching deployment history..."
    local deployments=$(wrangler deployments list --name pitchey-api-prod --json 2>/dev/null || echo "[]")
    
    if command -v jq >/dev/null 2>&1; then
        # Use jq if available
        local previous_version=$(echo "$deployments" | jq -r '.[1].version_id' 2>/dev/null || echo "")
    else
        # Fallback: get second deployment from raw output
        local previous_version=$(wrangler deployments list --name pitchey-api-prod | sed -n '2p' | awk '{print $2}' 2>/dev/null || echo "")
    fi
    
    if [[ -n "$previous_version" && "$previous_version" != "null" ]]; then
        log "Rolling back to version: $previous_version"
        if wrangler rollback --name pitchey-api-prod --version-id "$previous_version" 2>/dev/null; then
            success "Worker rollback successful"
        else
            error "Worker rollback failed"
            return 1
        fi
    else
        warning "No previous version found for Worker rollback"
    fi
}

rollback_frontend() {
    log "Frontend rollback requires manual intervention"
    log "To rollback the frontend:"
    log "1. Access Cloudflare Pages dashboard: https://dash.cloudflare.com/pages"
    log "2. Navigate to the 'pitchey' project"
    log "3. Go to the 'Deployments' tab"
    log "4. Select the previous successful deployment"
    log "5. Click 'Retry deployment' or 'Rollback'"
    log ""
    log "Alternative: Deploy previous frontend version manually:"
    log "  cd frontend && git checkout <previous-commit> && npm run build && wrangler pages deploy dist --project-name pitchey"
}

test_after_rollback() {
    log "Testing services after rollback..."
    
    # Test Worker
    local worker_status=$(curl -sf --max-time 30 "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health" 2>/dev/null || echo "FAILED")
    if [[ "$worker_status" != "FAILED" ]]; then
        success "Worker API responding after rollback"
    else
        error "Worker API not responding after rollback"
    fi
    
    # Test Frontend
    local frontend_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "https://pitchey-5o8-66n.pages.dev" 2>/dev/null || echo "000")
    if [[ "$frontend_status" == "200" ]]; then
        success "Frontend responding after rollback"
    else
        error "Frontend not responding after rollback (Status: $frontend_status)"
    fi
}

main() {
    log "=========================================="
    log "PITCHEY PRODUCTION ROLLBACK"
    log "=========================================="
    log "Starting rollback procedure..."
    log "Deployment timestamp: 20260110171214"
    echo ""
    
    # Check if wrangler is available
    if ! command -v wrangler >/dev/null 2>&1; then
        error "Wrangler CLI not found. Please install it first."
        exit 1
    fi
    
    # Check wrangler authentication
    if ! wrangler whoami >/dev/null 2>&1; then
        error "Wrangler not authenticated. Run 'wrangler login'"
        exit 1
    fi
    
    log "1. Worker rollback"
    rollback_worker
    
    echo ""
    log "2. Frontend rollback (manual)"
    rollback_frontend
    
    echo ""
    log "3. Post-rollback verification"
    test_after_rollback
    
    echo ""
    log "=========================================="
    success "Rollback procedure completed"
    log "=========================================="
    log "Please verify that all services are functioning correctly"
    log "Worker URL: https://pitchey-api-prod.ndlovucavelle.workers.dev"
    log "Frontend URL: https://pitchey-5o8-66n.pages.dev"
}

# Run main function
main "$@"