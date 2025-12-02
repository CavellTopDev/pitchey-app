#!/bin/bash

# =============================================================================
# Pitchey Platform - Emergency Rollback System
# =============================================================================
# Comprehensive rollback system for the Pitchey platform with automated
# detection, multi-level rollback strategies, and safety checks.
#
# Features:
# - Automated health detection and rollback triggers
# - Multi-level rollback (worker, frontend, database)
# - Canary deployment rollback
# - Database point-in-time recovery
# - Configuration restoration
# - Rollback verification and monitoring
#
# Usage:
#   ./rollback-deployment.sh [auto|manual] [component] [--emergency] [--dry-run]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/pitchey-rollback.log"
ROLLBACK_DATA_DIR="/var/lib/pitchey-rollback"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Rollback settings
HEALTH_CHECK_TIMEOUT=300  # 5 minutes
HEALTH_CHECK_INTERVAL=10  # 10 seconds
ROLLBACK_CONFIRMATION_TIMEOUT=60  # 1 minute
MAX_ROLLBACK_ATTEMPTS=3

# Create directories
mkdir -p "$ROLLBACK_DATA_DIR"/{worker,frontend,database,configs}
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message" >&2
            echo "[$timestamp] [ERROR] $message" >> "$LOG_FILE"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            echo "[$timestamp] [WARN] $message" >> "$LOG_FILE"
            ;;
        INFO)
            echo -e "${GREEN}[INFO]${NC} $message"
            echo "[$timestamp] [INFO] $message" >> "$LOG_FILE"
            ;;
        DEBUG)
            echo -e "${BLUE}[DEBUG]${NC} $message"
            echo "[$timestamp] [DEBUG] $message" >> "$LOG_FILE"
            ;;
        EMERGENCY)
            echo -e "${PURPLE}[EMERGENCY]${NC} $message" >&2
            echo "[$timestamp] [EMERGENCY] $message" >> "$LOG_FILE"
            ;;
    esac
}

# Parse command line arguments
ROLLBACK_MODE="${1:-manual}"
TARGET_COMPONENT="${2:-all}"
EMERGENCY_MODE=false
DRY_RUN=false
FORCE_ROLLBACK=false

for arg in "$@"; do
    case $arg in
        --emergency)
            EMERGENCY_MODE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE_ROLLBACK=true
            shift
            ;;
    esac
done

# Health check function
check_system_health() {
    local component="${1:-all}"
    log INFO "Checking system health for: $component"
    
    local health_status=0
    
    # Check frontend
    if [ "$component" = "all" ] || [ "$component" = "frontend" ]; then
        if ! curl -sf --max-time 10 "https://pitchey.pages.dev" > /dev/null 2>&1; then
            log ERROR "Frontend health check failed"
            health_status=1
        else
            log INFO "Frontend health check passed"
        fi
    fi
    
    # Check API worker
    if [ "$component" = "all" ] || [ "$component" = "worker" ]; then
        if ! curl -sf --max-time 10 "https://pitchey-production.cavelltheleaddev.workers.dev/api/health" > /dev/null 2>&1; then
            log ERROR "Worker health check failed"
            health_status=1
        else
            log INFO "Worker health check passed"
        fi
    fi
    
    # Check database connectivity
    if [ "$component" = "all" ] || [ "$component" = "database" ]; then
        if ! timeout 10 deno run --allow-env --allow-net -e "
            import { neon } from 'https://deno.land/x/neon@0.2.0/mod.ts';
            const sql = neon(Deno.env.get('DATABASE_URL'));
            try {
                await sql\`SELECT 1\`;
                console.log('Database check passed');
            } catch (error) {
                console.error('Database check failed:', error.message);
                Deno.exit(1);
            }
        " 2>/dev/null; then
            log ERROR "Database health check failed"
            health_status=1
        else
            log INFO "Database health check passed"
        fi
    fi
    
    return $health_status
}

# Save current deployment state
save_deployment_state() {
    log INFO "Saving current deployment state..."
    
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local state_dir="$ROLLBACK_DATA_DIR/state_$timestamp"
    mkdir -p "$state_dir"
    
    # Save worker state
    if command -v wrangler &> /dev/null; then
        log INFO "Saving worker deployment state..."
        wrangler deployments list --json > "$state_dir/worker_deployments.json" 2>/dev/null || true
        cp "$PROJECT_ROOT/wrangler.toml" "$state_dir/wrangler.toml" 2>/dev/null || true
    fi
    
    # Save frontend state
    log INFO "Saving frontend deployment state..."
    if [ -d "$PROJECT_ROOT/frontend/dist" ]; then
        tar -czf "$state_dir/frontend_dist.tar.gz" -C "$PROJECT_ROOT/frontend" dist/ 2>/dev/null || true
    fi
    
    # Save configuration
    log INFO "Saving configuration state..."
    cp "$PROJECT_ROOT/.env.production" "$state_dir/.env.production" 2>/dev/null || true
    
    # Save database schema
    log INFO "Saving database schema..."
    if [ -n "${DATABASE_URL:-}" ]; then
        pg_dump --schema-only "$DATABASE_URL" > "$state_dir/schema.sql" 2>/dev/null || true
    fi
    
    # Create state metadata
    cat > "$state_dir/metadata.json" << EOF
{
    "timestamp": "$timestamp",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
    "created_by": "$(whoami)@$(hostname)",
    "deployment_target": "$TARGET_COMPONENT"
}
EOF
    
    echo "$state_dir"
}

# Get previous deployment state
get_previous_deployment() {
    local target_timestamp="$1"
    
    if [ -n "$target_timestamp" ]; then
        local state_dir="$ROLLBACK_DATA_DIR/state_$target_timestamp"
        if [ -d "$state_dir" ]; then
            echo "$state_dir"
            return 0
        fi
    fi
    
    # Find the latest state
    local latest_state=$(ls -1t "$ROLLBACK_DATA_DIR"/state_* 2>/dev/null | head -n1)
    if [ -n "$latest_state" ] && [ -d "$latest_state" ]; then
        echo "$latest_state"
        return 0
    fi
    
    log ERROR "No previous deployment state found"
    return 1
}

# Rollback worker deployment
rollback_worker() {
    local previous_state_dir="$1"
    
    log INFO "Rolling back worker deployment..."
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY RUN] Would rollback worker deployment"
        return 0
    fi
    
    # Method 1: Use wrangler rollback if available
    if wrangler rollback --help &>/dev/null; then
        log INFO "Using wrangler rollback..."
        if wrangler rollback --name pitchey-optimized; then
            log INFO "Worker rollback via wrangler completed"
            return 0
        else
            log WARN "Wrangler rollback failed, trying manual method"
        fi
    fi
    
    # Method 2: Redeploy from Git
    if [ -f "$previous_state_dir/metadata.json" ]; then
        local previous_commit=$(jq -r .git_commit "$previous_state_dir/metadata.json" 2>/dev/null)
        
        if [ "$previous_commit" != "unknown" ] && [ "$previous_commit" != "null" ]; then
            log INFO "Deploying worker from commit: $previous_commit"
            
            # Checkout previous commit
            local current_branch=$(git branch --show-current)
            git checkout "$previous_commit" -- src/worker-platform-complete.ts
            
            # Deploy
            wrangler deploy --minify
            
            # Restore current branch
            git checkout "$current_branch" -- src/worker-platform-complete.ts
            
            log INFO "Worker rollback from Git completed"
            return 0
        fi
    fi
    
    log ERROR "Worker rollback failed - no suitable method available"
    return 1
}

# Rollback frontend deployment
rollback_frontend() {
    local previous_state_dir="$1"
    
    log INFO "Rolling back frontend deployment..."
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY RUN] Would rollback frontend deployment"
        return 0
    fi
    
    # Method 1: Deploy from saved build
    if [ -f "$previous_state_dir/frontend_dist.tar.gz" ]; then
        log INFO "Deploying frontend from saved build..."
        
        # Extract previous build
        local temp_dir=$(mktemp -d)
        tar -xzf "$previous_state_dir/frontend_dist.tar.gz" -C "$temp_dir"
        
        # Deploy to Cloudflare Pages
        cd "$PROJECT_ROOT/frontend"
        wrangler pages deploy "$temp_dir/dist" \
            --project-name=pitchey \
            --branch=rollback \
            --compatibility-date=2024-11-01
        
        # Cleanup
        rm -rf "$temp_dir"
        
        log INFO "Frontend rollback from saved build completed"
        return 0
    fi
    
    # Method 2: Rebuild from Git
    if [ -f "$previous_state_dir/metadata.json" ]; then
        local previous_commit=$(jq -r .git_commit "$previous_state_dir/metadata.json" 2>/dev/null)
        
        if [ "$previous_commit" != "unknown" ] && [ "$previous_commit" != "null" ]; then
            log INFO "Rebuilding frontend from commit: $previous_commit"
            
            # Checkout previous commit
            local current_branch=$(git branch --show-current)
            git checkout "$previous_commit" -- frontend/
            
            # Build and deploy
            cd "$PROJECT_ROOT/frontend"
            npm ci
            npm run build:prod
            wrangler pages deploy dist --project-name=pitchey
            
            # Restore current branch
            git checkout "$current_branch" -- frontend/
            
            log INFO "Frontend rollback from Git completed"
            return 0
        fi
    fi
    
    log ERROR "Frontend rollback failed - no suitable method available"
    return 1
}

# Rollback database (point-in-time recovery)
rollback_database() {
    local target_time="$1"
    
    log EMERGENCY "Database rollback requested - THIS WILL CAUSE DATA LOSS!"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY RUN] Would perform database point-in-time recovery to: $target_time"
        return 0
    fi
    
    if [ "$EMERGENCY_MODE" = false ]; then
        echo
        echo -e "${RED}⚠️  DATABASE ROLLBACK WARNING ⚠️${NC}"
        echo "This operation will restore the database to a previous state."
        echo "ALL DATA CREATED AFTER THE ROLLBACK POINT WILL BE LOST!"
        echo
        echo "Target time: $target_time"
        echo
        read -p "Type 'CONFIRM DATABASE ROLLBACK' to proceed: " confirmation
        
        if [ "$confirmation" != "CONFIRM DATABASE ROLLBACK" ]; then
            log INFO "Database rollback cancelled by user"
            return 0
        fi
    fi
    
    # Use backup system for database rollback
    if [ -f "$SCRIPT_DIR/backup-disaster-recovery.sh" ]; then
        log INFO "Using backup system for database rollback..."
        
        # Find closest backup to target time
        local backup_file=""
        for backup in "$ROLLBACK_DATA_DIR"/database/*.sql.gz*; do
            if [ -f "$backup" ]; then
                backup_file="$backup"
                break
            fi
        done
        
        if [ -n "$backup_file" ]; then
            log INFO "Restoring database from backup: $backup_file"
            "$SCRIPT_DIR/backup-disaster-recovery.sh" restore "$backup_file"
        else
            log ERROR "No suitable database backup found for rollback"
            return 1
        fi
    else
        log ERROR "Backup system not available for database rollback"
        return 1
    fi
}

# Automated rollback decision engine
auto_rollback_decision() {
    log INFO "Running automated rollback decision engine..."
    
    # Check error rates
    local error_count=0
    
    # Check recent logs for errors
    if [ -f "$LOG_FILE" ]; then
        local recent_errors=$(tail -n 100 "$LOG_FILE" | grep -c '\[ERROR\]' || true)
        if [ "$recent_errors" -gt 10 ]; then
            log WARN "High error rate detected: $recent_errors errors in recent logs"
            error_count=$((error_count + 1))
        fi
    fi
    
    # Check health endpoints
    local failed_health_checks=0
    
    # Frontend health
    if ! curl -sf --max-time 5 "https://pitchey.pages.dev" > /dev/null 2>&1; then
        failed_health_checks=$((failed_health_checks + 1))
    fi
    
    # API health
    if ! curl -sf --max-time 5 "https://pitchey-production.cavelltheleaddev.workers.dev/api/health" > /dev/null 2>&1; then
        failed_health_checks=$((failed_health_checks + 1))
    fi
    
    # Decision logic
    local rollback_score=$((error_count + failed_health_checks))
    
    if [ "$rollback_score" -ge 2 ]; then
        log EMERGENCY "Automated rollback triggered! Score: $rollback_score"
        return 0  # Trigger rollback
    else
        log INFO "System appears stable. Rollback not triggered. Score: $rollback_score"
        return 1  # Don't rollback
    fi
}

# Send rollback notifications
send_rollback_notification() {
    local status="$1"
    local component="$2"
    local details="$3"
    
    local message="🔄 Pitchey Platform Rollback - $status"
    
    # Send to Slack if configured
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{\"text\":\"$message\n\nComponent: $component\nDetails: $details\nTime: $(date)\"}" \
            --silent --fail || true
    fi
    
    # Send email if configured
    if [ -n "${ALERT_EMAIL:-}" ]; then
        {
            echo "Subject: [URGENT] Pitchey Platform Rollback - $status"
            echo "To: $ALERT_EMAIL"
            echo ""
            echo "Rollback Status: $status"
            echo "Component: $component"
            echo "Details: $details"
            echo "Timestamp: $(date)"
            echo ""
            echo "Please verify system status and take appropriate action."
        } | sendmail "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# Wait for rollback confirmation
wait_for_confirmation() {
    local component="$1"
    
    if [ "$FORCE_ROLLBACK" = true ] || [ "$EMERGENCY_MODE" = true ]; then
        return 0
    fi
    
    echo
    echo -e "${YELLOW}⚠️  ROLLBACK CONFIRMATION REQUIRED ⚠️${NC}"
    echo "Component: $component"
    echo "This operation will rollback the deployment to a previous state."
    echo
    
    local countdown=$ROLLBACK_CONFIRMATION_TIMEOUT
    while [ $countdown -gt 0 ]; do
        echo -ne "\rConfirm rollback in $countdown seconds... (y/N): "
        
        if read -t 1 -n 1 response; then
            echo
            case $response in
                [Yy])
                    log INFO "Rollback confirmed by user"
                    return 0
                    ;;
                [Nn])
                    log INFO "Rollback cancelled by user"
                    return 1
                    ;;
            esac
        fi
        
        countdown=$((countdown - 1))
    done
    
    echo
    log INFO "Rollback confirmation timeout - operation cancelled"
    return 1
}

# Main rollback orchestrator
execute_rollback() {
    local component="$1"
    local rollback_reason="$2"
    
    log INFO "Starting rollback process for: $component"
    log INFO "Rollback reason: $rollback_reason"
    
    # Save current state before rollback
    local current_state=$(save_deployment_state)
    log INFO "Current state saved to: $current_state"
    
    # Get previous deployment state
    local previous_state=$(get_previous_deployment)
    if [ $? -ne 0 ]; then
        log ERROR "Cannot proceed with rollback - no previous state found"
        return 1
    fi
    
    log INFO "Rolling back to state: $previous_state"
    
    # Confirm rollback
    if ! wait_for_confirmation "$component"; then
        log INFO "Rollback cancelled"
        return 1
    fi
    
    local rollback_success=true
    
    # Execute component-specific rollback
    case $component in
        worker)
            if ! rollback_worker "$previous_state"; then
                rollback_success=false
            fi
            ;;
        frontend)
            if ! rollback_frontend "$previous_state"; then
                rollback_success=false
            fi
            ;;
        database)
            if ! rollback_database "$(jq -r .timestamp "$previous_state/metadata.json")"; then
                rollback_success=false
            fi
            ;;
        all)
            # Rollback in reverse order: database -> worker -> frontend
            if [ "$TARGET_COMPONENT" = "all" ]; then
                if ! rollback_worker "$previous_state"; then
                    rollback_success=false
                fi
                
                if ! rollback_frontend "$previous_state"; then
                    rollback_success=false
                fi
            fi
            ;;
        *)
            log ERROR "Unknown component: $component"
            rollback_success=false
            ;;
    esac
    
    # Verify rollback
    if [ "$rollback_success" = true ] && [ "$DRY_RUN" = false ]; then
        log INFO "Waiting for services to stabilize..."
        sleep 30
        
        if check_system_health "$component"; then
            log INFO "Rollback completed successfully - system health verified"
            send_rollback_notification "SUCCESS" "$component" "$rollback_reason"
        else
            log ERROR "Rollback completed but health checks failed"
            send_rollback_notification "PARTIAL SUCCESS" "$component" "$rollback_reason - Health checks failed"
            rollback_success=false
        fi
    elif [ "$rollback_success" = false ]; then
        log ERROR "Rollback failed"
        send_rollback_notification "FAILED" "$component" "$rollback_reason - Rollback operations failed"
    fi
    
    return $([ "$rollback_success" = true ] && echo 0 || echo 1)
}

# Show rollback status and options
show_rollback_status() {
    echo
    echo "🔄 Pitchey Platform Rollback System"
    echo "=================================="
    echo
    echo "Current System Health:"
    
    # Check each component
    if curl -sf --max-time 5 "https://pitchey.pages.dev" > /dev/null 2>&1; then
        echo "  Frontend: ✅ Healthy"
    else
        echo "  Frontend: ❌ Unhealthy"
    fi
    
    if curl -sf --max-time 5 "https://pitchey-production.cavelltheleaddev.workers.dev/api/health" > /dev/null 2>&1; then
        echo "  Worker: ✅ Healthy"
    else
        echo "  Worker: ❌ Unhealthy"
    fi
    
    if timeout 5 deno run --allow-env --allow-net -e "
        import { neon } from 'https://deno.land/x/neon@0.2.0/mod.ts';
        const sql = neon(Deno.env.get('DATABASE_URL'));
        await sql\`SELECT 1\`;
    " 2>/dev/null; then
        echo "  Database: ✅ Healthy"
    else
        echo "  Database: ❌ Unhealthy"
    fi
    
    echo
    echo "Available Rollback States:"
    
    local count=0
    for state_dir in "$ROLLBACK_DATA_DIR"/state_*; do
        if [ -d "$state_dir" ] && [ -f "$state_dir/metadata.json" ]; then
            local timestamp=$(jq -r .timestamp "$state_dir/metadata.json" 2>/dev/null)
            local commit=$(jq -r .git_commit "$state_dir/metadata.json" 2>/dev/null)
            local branch=$(jq -r .git_branch "$state_dir/metadata.json" 2>/dev/null)
            
            echo "  $((count + 1)). $timestamp (commit: ${commit:0:8}, branch: $branch)"
            count=$((count + 1))
            
            if [ $count -ge 5 ]; then
                break
            fi
        fi
    done
    
    if [ $count -eq 0 ]; then
        echo "  No rollback states available"
    fi
    
    echo
}

# Main function
main() {
    log INFO "Rollback system started - Mode: $ROLLBACK_MODE, Component: $TARGET_COMPONENT"
    
    # Load environment variables
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
    fi
    
    case $ROLLBACK_MODE in
        auto)
            log INFO "Running automatic rollback detection..."
            
            if auto_rollback_decision; then
                execute_rollback "$TARGET_COMPONENT" "Automated rollback triggered by health checks"
            else
                log INFO "No rollback required - system appears healthy"
            fi
            ;;
        manual)
            if [ "$TARGET_COMPONENT" = "status" ]; then
                show_rollback_status
            else
                execute_rollback "$TARGET_COMPONENT" "Manual rollback requested"
            fi
            ;;
        emergency)
            log EMERGENCY "Emergency rollback mode activated"
            EMERGENCY_MODE=true
            FORCE_ROLLBACK=true
            execute_rollback "$TARGET_COMPONENT" "EMERGENCY ROLLBACK"
            ;;
        *)
            echo "Usage: $0 {auto|manual|emergency} {worker|frontend|database|all|status} [--emergency] [--dry-run] [--force]"
            echo
            echo "Modes:"
            echo "  auto      - Automatic rollback based on health checks"
            echo "  manual    - Manual rollback with confirmation"
            echo "  emergency - Emergency rollback without confirmation"
            echo
            echo "Components:"
            echo "  worker    - Rollback Cloudflare Worker"
            echo "  frontend  - Rollback frontend deployment"
            echo "  database  - Rollback database (DANGEROUS)"
            echo "  all       - Rollback all components"
            echo "  status    - Show system status and available rollback points"
            echo
            echo "Options:"
            echo "  --emergency  - Skip confirmations"
            echo "  --dry-run    - Show what would be done"
            echo "  --force      - Force rollback without health checks"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"