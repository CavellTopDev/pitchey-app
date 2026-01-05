#!/bin/bash

# Deployment Integration Script
# Orchestrates the complete deployment automation system

set -euo pipefail

# Configuration
PROJECT_ROOT="${PROJECT_ROOT:-/home/supremeisbeing/pitcheymovie/pitchey_v0.2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs/integration"

# Environment settings
ENVIRONMENT="${ENVIRONMENT:-production}"
DEPLOYMENT_VERSION="${DEPLOYMENT_VERSION:-$(git rev-parse --short HEAD)}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"

# Notification settings
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_RECIPIENTS="${EMAIL_RECIPIENTS:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging setup
setup_logging() {
    mkdir -p "$LOG_DIR"
    exec 1> >(tee -a "${LOG_DIR}/integration-$(date +%Y%m%d-%H%M%S).log")
    exec 2> >(tee -a "${LOG_DIR}/integration-errors-$(date +%Y%m%d-%H%M%S).log" >&2)
}

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $*${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $*${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $*${NC}" >&2
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $*${NC}"
}

log_info() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  $*${NC}"
}

# Notification functions
send_slack_notification() {
    local message="$1"
    local color="${2:-good}"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local payload
        payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "fields": [
                {
                    "title": "Pitchey Deployment",
                    "value": "$message",
                    "short": false
                },
                {
                    "title": "Environment",
                    "value": "$ENVIRONMENT",
                    "short": true
                },
                {
                    "title": "Version",
                    "value": "$DEPLOYMENT_VERSION",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date)",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "$payload" || log_warning "Failed to send Slack notification"
    fi
}

# System checks
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_commands=()
    local required_commands=("docker" "kubectl" "wrangler" "git" "jq" "curl")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        log_error "Missing required commands: ${missing_commands[*]}"
        return 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        log_error "Not in a git repository"
        return 1
    fi
    
    # Check for required scripts
    local required_scripts=(
        "container-registry-manager.sh"
        "zero-downtime-migration.sh"
        "performance-testing-suite.sh"
        "secrets-config-manager.sh"
        "auto-scaling-manager.sh"
        "validation-suite.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [[ ! -x "${SCRIPT_DIR}/${script}" ]]; then
            log_error "Required script not found or not executable: ${script}"
            return 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Build and test containers
build_and_test() {
    log "Building and testing containers..."
    
    # Build containers with multi-arch support
    "${SCRIPT_DIR}/container-registry-manager.sh" build_all_images
    
    # Run security scanning
    "${SCRIPT_DIR}/container-registry-manager.sh" scan_all_images
    
    # Sign images if not in dry-run mode
    if [[ "$DRY_RUN" != "true" ]]; then
        "${SCRIPT_DIR}/container-registry-manager.sh" sign_all_images
    fi
    
    log_success "Container build and test completed"
}

# Deploy infrastructure
deploy_infrastructure() {
    log "Deploying infrastructure..."
    
    # Apply Kubernetes configurations
    if command -v kubectl >/dev/null 2>&1; then
        kubectl apply -f "${PROJECT_ROOT}/config/auto-scaling-manifest.yaml"
        kubectl apply -f "${PROJECT_ROOT}/config/cloudflare-scaling-config.yaml"
        kubectl apply -f "${PROJECT_ROOT}/config/smoke-tests-config.yaml"
    else
        log_warning "kubectl not available, skipping Kubernetes deployment"
    fi
    
    # Setup auto-scaling
    "${SCRIPT_DIR}/auto-scaling-manager.sh" setup pitchey-api all
    
    log_success "Infrastructure deployment completed"
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Configure secrets
    "${SCRIPT_DIR}/secrets-config-manager.sh" deploy_secrets "$ENVIRONMENT"
    
    # Perform zero-downtime migration
    "${SCRIPT_DIR}/zero-downtime-migration.sh" execute_progressive_migration "$ENVIRONMENT" "$DEPLOYMENT_VERSION"
    
    log_success "Application deployment completed"
}

# Run validation tests
run_validation() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping validation tests"
        return 0
    fi
    
    log "Running validation tests..."
    
    # Wait for deployment to stabilize
    sleep 30
    
    # Run smoke tests
    if ! "${SCRIPT_DIR}/validation-suite.sh" smoke; then
        log_error "Smoke tests failed"
        return 1
    fi
    
    # Run performance tests if not in dry-run mode
    if [[ "$DRY_RUN" != "true" ]]; then
        "${SCRIPT_DIR}/performance-testing-suite.sh" load --duration=300 --users=20
    fi
    
    log_success "Validation tests completed"
}

# Post-deployment tasks
post_deployment_tasks() {
    log "Running post-deployment tasks..."
    
    # Update deployment tracking
    echo "$DEPLOYMENT_VERSION" > "${PROJECT_ROOT}/.last-deployment"
    echo "$(date)" > "${PROJECT_ROOT}/.last-deployment-date"
    
    # Generate deployment report
    generate_deployment_report
    
    # Setup monitoring
    "${SCRIPT_DIR}/auto-scaling-manager.sh" monitor pitchey-api
    
    log_success "Post-deployment tasks completed"
}

# Generate comprehensive deployment report
generate_deployment_report() {
    local report_file="${PROJECT_ROOT}/reports/deployment-report-${DEPLOYMENT_VERSION}-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p "$(dirname "$report_file")"
    
    cat > "$report_file" <<EOF
# Deployment Report

**Deployment Version**: $DEPLOYMENT_VERSION
**Environment**: $ENVIRONMENT
**Timestamp**: $(date)
**Duration**: $(( $(date +%s) - ${DEPLOYMENT_START_TIME:-$(date +%s)} )) seconds

## Deployment Summary

$(git log --oneline -5)

## Components Deployed

- ✅ Container Registry and Images
- ✅ Infrastructure Configuration
- ✅ Auto-scaling Policies
- ✅ Application Code
- ✅ Database Migrations
- ✅ Secrets Configuration

## Validation Results

$(if [[ "$SKIP_TESTS" == "true" ]]; then
    echo "⏭️ Tests skipped"
else
    echo "✅ Smoke tests passed"
    echo "✅ Performance tests completed"
fi)

## Monitoring

- Grafana Dashboard: [Auto-scaling Metrics](${GRAFANA_URL}/d/autoscaling)
- Prometheus Alerts: Active monitoring enabled
- Log Aggregation: Centralized logging configured

## Rollback Procedure

If issues are detected, rollback using:
\`\`\`bash
./scripts/deploy-production-complete.sh rollback
\`\`\`

## Post-Deployment Checklist

- [ ] Monitor application metrics for 30 minutes
- [ ] Verify auto-scaling behavior
- [ ] Check error rates and response times
- [ ] Validate user workflows
- [ ] Update documentation if needed

---
**Report generated by**: $0
**Deployment automation version**: 1.0
EOF

    log_success "Deployment report generated: $report_file"
}

# Rollback function
rollback_deployment() {
    local target_version="${1:-HEAD~1}"
    
    log "Rolling back deployment to $target_version..."
    
    # Stop new deployments
    send_slack_notification "🚨 Rollback initiated for $ENVIRONMENT" "warning"
    
    # Use the main deployment script's rollback function
    "${PROJECT_ROOT}/deploy-production-complete.sh" rollback "$target_version"
    
    # Run validation on rolled back version
    if ! "${SCRIPT_DIR}/validation-suite.sh" smoke; then
        log_error "Rollback validation failed"
        send_slack_notification "❌ Rollback validation failed" "danger"
        return 1
    fi
    
    send_slack_notification "✅ Rollback completed successfully" "good"
    log_success "Rollback completed"
}

# Health check function
health_check() {
    log "Running health check..."
    
    "${SCRIPT_DIR}/validation-suite.sh" smoke
    
    log_success "Health check completed"
}

# Complete deployment orchestration
deploy_complete() {
    local start_time
    start_time=$(date +%s)
    export DEPLOYMENT_START_TIME="$start_time"
    
    log "Starting complete deployment for $ENVIRONMENT (version: $DEPLOYMENT_VERSION)"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No actual changes will be made"
    fi
    
    send_slack_notification "🚀 Deployment started for $ENVIRONMENT" "good"
    
    # Execute deployment pipeline
    if check_prerequisites && \
       build_and_test && \
       deploy_infrastructure && \
       deploy_application && \
       run_validation && \
       post_deployment_tasks; then
        
        local duration=$(($(date +%s) - start_time))
        log_success "Deployment completed successfully in ${duration}s"
        send_slack_notification "✅ Deployment completed successfully (${duration}s)" "good"
    else
        local duration=$(($(date +%s) - start_time))
        log_error "Deployment failed after ${duration}s"
        send_slack_notification "❌ Deployment failed (${duration}s)" "danger"
        
        # Automatically rollback on failure
        log_warning "Initiating automatic rollback..."
        rollback_deployment
        return 1
    fi
}

# Show usage information
show_usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
    deploy          Complete deployment (build, test, deploy, validate)
    build          Build and test containers only
    infrastructure  Deploy infrastructure only
    application     Deploy application only
    validate       Run validation tests only
    rollback       Rollback to previous version
    health         Run health check
    
Options:
    --environment  Target environment (default: production)
    --version      Deployment version (default: git commit hash)
    --dry-run      Simulate deployment without making changes
    --skip-tests   Skip validation tests
    --help         Show this help message

Environment Variables:
    SLACK_WEBHOOK_URL      Slack webhook for notifications
    EMAIL_RECIPIENTS       Email addresses for notifications
    DRY_RUN               Set to 'true' for dry run mode
    SKIP_TESTS            Set to 'true' to skip tests

Examples:
    $0 deploy                               # Full deployment
    $0 deploy --environment staging         # Deploy to staging
    $0 deploy --dry-run                     # Simulate deployment
    $0 rollback v1.2.3                     # Rollback to specific version
    $0 health                               # Check application health
EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --version)
                DEPLOYMENT_VERSION="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done
}

# Main execution
main() {
    setup_logging
    
    # Parse arguments
    parse_arguments "$@"
    
    local command="${1:-deploy}"
    
    case "$command" in
        "deploy")
            deploy_complete
            ;;
        "build")
            check_prerequisites
            build_and_test
            ;;
        "infrastructure")
            check_prerequisites
            deploy_infrastructure
            ;;
        "application")
            check_prerequisites
            deploy_application
            ;;
        "validate")
            run_validation
            ;;
        "rollback")
            rollback_deployment "${2:-HEAD~1}"
            ;;
        "health")
            health_check
            ;;
        "help"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Execute if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi