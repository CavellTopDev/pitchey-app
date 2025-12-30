#!/bin/bash

# Pitchey Platform - Emergency Rollback Execution Script
# Implements the most critical rollback procedures from rollback-plan.md

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
WORKER_NAME="pitchey-production"
HEALTH_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
function log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
function log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
function log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

function show_help() {
    cat << EOF
Pitchey Platform Emergency Rollback Script

Usage: $0 [OPTION]

OPTIONS:
    --immediate         Immediate worker rollback (fastest)
    --previous          Rollback to previous deployment
    --maintenance       Deploy maintenance mode
    --config-restore    Restore from configuration backup
    --verify            Verify current system status
    --help             Show this help

EXAMPLES:
    $0 --immediate      # Fast rollback to backup worker
    $0 --previous       # Rollback to last deployment
    $0 --verify         # Check if rollback is needed
EOF
}

function verify_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI not found"
        exit 1
    fi
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare"
        exit 1
    fi
    
    log_success "Prerequisites OK"
}

function check_current_status() {
    log_info "Checking current system status..."
    
    # Health check
    local health_status
    health_status=$(curl -s -f "$HEALTH_URL" 2>/dev/null || echo "FAILED")
    
    if [[ "$health_status" == "FAILED" ]]; then
        log_error "Health check FAILED - system appears down"
        return 1
    elif echo "$health_status" | grep -q "healthy"; then
        log_success "Health check PASSED - system appears operational"
        return 0
    else
        log_warning "Health check inconclusive"
        echo "Response: $health_status"
        return 2
    fi
}

function immediate_rollback() {
    log_error "🚨 EXECUTING IMMEDIATE ROLLBACK 🚨"
    
    # Record incident start
    local incident_log="/tmp/pitchey-incident-$(date +%Y%m%d_%H%M%S).log"
    echo "Incident start: $(date)" > "$incident_log"
    echo "Action: Immediate rollback" >> "$incident_log"
    
    # Step 1: Use backup worker if available
    local backup_worker
    backup_worker=$(ls -t src/worker-production-db.backup.*.ts 2>/dev/null | head -1 || echo "")
    
    if [[ -n "$backup_worker" ]]; then
        log_info "Found backup worker: $backup_worker"
        
        # Backup current worker
        cp src/worker-production-db.ts "src/worker-production-db.current-$(date +%Y%m%d_%H%M%S).ts"
        
        # Use backup
        cp "$backup_worker" src/worker-production-db.ts
        
        # Update wrangler.toml to use standard worker
        sed -i 's/worker-production-db-fixed\.ts/worker-production-db.ts/' wrangler.toml
        
        log_info "Deploying backup worker..."
        if wrangler deploy --compatibility-date=2024-11-01; then
            log_success "Backup worker deployed"
        else
            log_error "Backup worker deployment failed"
            return 1
        fi
    else
        log_warning "No backup worker found, attempting previous deployment rollback"
        rollback_to_previous
        return $?
    fi
    
    # Verify rollback
    log_info "Waiting 15 seconds for deployment to propagate..."
    sleep 15
    
    if check_current_status; then
        log_success "✅ ROLLBACK SUCCESSFUL"
        echo "Incident log: $incident_log"
        return 0
    else
        log_error "❌ ROLLBACK VERIFICATION FAILED"
        echo "Incident log: $incident_log"
        return 1
    fi
}

function rollback_to_previous() {
    log_info "Rolling back to previous deployment..."
    
    # Get deployment list
    local deployments
    deployments=$(wrangler deployments list --name "$WORKER_NAME" --format json 2>/dev/null || echo "[]")
    
    if [[ "$deployments" == "[]" ]]; then
        log_error "Unable to retrieve deployment history"
        return 1
    fi
    
    # Get previous deployment ID (second in list)
    local previous_id
    previous_id=$(echo "$deployments" | grep -o '"id":"[^"]*"' | sed 's/"id":"//' | sed 's/"//' | sed -n '2p')
    
    if [[ -z "$previous_id" ]]; then
        log_error "No previous deployment found"
        return 1
    fi
    
    log_info "Rolling back to deployment: $previous_id"
    
    if wrangler rollback "$previous_id" --name "$WORKER_NAME"; then
        log_success "Rollback to previous deployment completed"
        
        # Verify
        sleep 10
        if check_current_status; then
            log_success "✅ PREVIOUS DEPLOYMENT ROLLBACK SUCCESSFUL"
            return 0
        else
            log_error "❌ ROLLBACK VERIFICATION FAILED"
            return 1
        fi
    else
        log_error "Rollback command failed"
        return 1
    fi
}

function deploy_maintenance_mode() {
    log_warning "🚧 DEPLOYING MAINTENANCE MODE 🚧"
    
    # Backup current worker
    cp src/worker-production-db.ts "src/worker-production-db.pre-maintenance-$(date +%Y%m%d_%H%M%S).ts"
    
    # Create emergency maintenance worker
    cat > src/emergency-maintenance.js << 'EOF'
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Allow health checks
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({
        status: 'maintenance',
        message: 'Platform temporarily unavailable - maintenance in progress',
        timestamp: new Date().toISOString()
      }), {
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Return maintenance for all other requests
    const maintenanceResponse = {
      error: 'Platform temporarily unavailable',
      message: 'We are currently performing maintenance. Please try again in a few minutes.',
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(maintenanceResponse), { 
      status: 503,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
EOF
    
    # Update wrangler.toml
    cp wrangler.toml "wrangler.toml.pre-maintenance-$(date +%Y%m%d_%H%M%S)"
    sed -i 's/main = .*/main = "src\/emergency-maintenance.js"/' wrangler.toml
    
    # Deploy maintenance mode
    if wrangler deploy --name "$WORKER_NAME"; then
        log_success "🚧 Maintenance mode deployed"
        
        # Verify maintenance mode
        sleep 10
        local response
        response=$(curl -s "$HEALTH_URL" || echo "ERROR")
        
        if echo "$response" | grep -q "maintenance"; then
            log_success "✅ MAINTENANCE MODE ACTIVE"
            echo "Platform is now in maintenance mode"
            echo "To restore: Deploy a working worker and update wrangler.toml"
            return 0
        else
            log_error "❌ MAINTENANCE MODE VERIFICATION FAILED"
            return 1
        fi
    else
        log_error "Maintenance mode deployment failed"
        return 1
    fi
}

function restore_from_config() {
    log_info "Restoring from configuration backup..."
    
    # Find latest wrangler.toml backup
    local latest_backup
    latest_backup=$(ls -t wrangler.toml.backup.* 2>/dev/null | head -1 || echo "")
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No wrangler.toml backup found"
        return 1
    fi
    
    log_info "Restoring from: $latest_backup"
    
    # Backup current config
    cp wrangler.toml "wrangler.toml.current-$(date +%Y%m%d_%H%M%S)"
    
    # Restore backup
    cp "$latest_backup" wrangler.toml
    
    # Deploy with restored config
    if wrangler deploy; then
        log_success "Configuration restored and deployed"
        
        # Verify
        sleep 15
        if check_current_status; then
            log_success "✅ CONFIG RESTORATION SUCCESSFUL"
            return 0
        else
            log_error "❌ CONFIG RESTORATION VERIFICATION FAILED"
            return 1
        fi
    else
        log_error "Deployment with restored config failed"
        return 1
    fi
}

function run_verification() {
    log_info "Running system verification..."
    
    # Check system status
    if check_current_status; then
        log_success "System appears healthy"
        
        # Run quick endpoint tests
        if [[ -f "./test-all-endpoints.sh" ]]; then
            log_info "Running quick endpoint tests..."
            if ./test-all-endpoints.sh --test-type=health --timeout=5; then
                log_success "✅ SYSTEM VERIFICATION PASSED"
                echo "No rollback appears necessary"
                return 0
            else
                log_warning "Some endpoint tests failed"
                echo "Consider investigating or performing rollback"
                return 1
            fi
        else
            log_warning "Test script not found, manual verification required"
            return 2
        fi
    else
        log_error "❌ SYSTEM VERIFICATION FAILED"
        echo "Rollback recommended"
        return 1
    fi
}

function main() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi
    
    # Banner
    echo
    echo "🚨 =============================================== 🚨"
    echo "      PITCHEY PLATFORM EMERGENCY ROLLBACK"
    echo "🚨 =============================================== 🚨"
    echo
    
    verify_prerequisites
    
    case "$1" in
        --immediate)
            immediate_rollback
            ;;
        --previous)
            rollback_to_previous
            ;;
        --maintenance)
            deploy_maintenance_mode
            ;;
        --config-restore)
            restore_from_config
            ;;
        --verify)
            run_verification
            ;;
        --help)
            show_help
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
    
    local exit_code=$?
    
    echo
    echo "================================================="
    if [[ $exit_code -eq 0 ]]; then
        echo "✅ Operation completed successfully"
    else
        echo "❌ Operation failed or requires attention"
    fi
    echo "================================================="
    
    exit $exit_code
}

# Only run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi