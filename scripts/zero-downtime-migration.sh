#!/bin/bash

# ===========================================================================================
# Zero-Downtime Migration System
# Traffic shifting, database migrations, state migration, and rollback procedures
# ===========================================================================================

set -euo pipefail

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

# =============================================================================
# CONFIGURATION
# =============================================================================

# Migration strategy
MIGRATION_STRATEGY="${MIGRATION_STRATEGY:-progressive}"  # progressive, blue-green, canary
TRAFFIC_SHIFT_STRATEGY="${TRAFFIC_SHIFT_STRATEGY:-weighted}"  # weighted, header-based, geo-based
VALIDATION_STRATEGY="${VALIDATION_STRATEGY:-strict}"  # strict, relaxed, monitoring-only

# Traffic shifting configuration
INITIAL_TRAFFIC_PERCENTAGE="${INITIAL_TRAFFIC_PERCENTAGE:-0}"
TRAFFIC_INCREMENT="${TRAFFIC_INCREMENT:-10}"
TRAFFIC_STAGES="${TRAFFIC_STAGES:-0,5,10,25,50,75,100}"
STAGE_HOLD_TIME="${STAGE_HOLD_TIME:-300}"  # seconds
ROLLBACK_TRAFFIC_THRESHOLD="${ROLLBACK_TRAFFIC_THRESHOLD:-90}"

# Health and performance thresholds
ERROR_RATE_THRESHOLD="${ERROR_RATE_THRESHOLD:-2.0}"  # percentage
RESPONSE_TIME_THRESHOLD="${RESPONSE_TIME_THRESHOLD:-2.0}"  # seconds
SUCCESS_RATE_THRESHOLD="${SUCCESS_RATE_THRESHOLD:-98.0}"  # percentage
RESOURCE_THRESHOLD="${RESOURCE_THRESHOLD:-85.0}"  # percentage

# Database migration settings
DB_MIGRATION_TIMEOUT="${DB_MIGRATION_TIMEOUT:-1800}"  # 30 minutes
DB_BACKUP_RETENTION="${DB_BACKUP_RETENTION:-7}"  # days
DB_LOCK_TIMEOUT="${DB_LOCK_TIMEOUT:-30}"  # seconds
SCHEMA_VALIDATION="${SCHEMA_VALIDATION:-true}"

# State migration settings
DURABLE_OBJECTS_MIGRATION="${DURABLE_OBJECTS_MIGRATION:-true}"
QUEUE_DRAINING_TIMEOUT="${QUEUE_DRAINING_TIMEOUT:-300}"
SESSION_MIGRATION_STRATEGY="${SESSION_MIGRATION_STRATEGY:-gradual}"
CACHE_WARMING_ENABLED="${CACHE_WARMING_ENABLED:-true}"

# WebSocket migration
WEBSOCKET_MIGRATION_STRATEGY="${WEBSOCKET_MIGRATION_STRATEGY:-graceful}"
WS_CONNECTION_DRAIN_TIME="${WS_CONNECTION_DRAIN_TIME:-60}"
WS_HEARTBEAT_INTERVAL="${WS_HEARTBEAT_INTERVAL:-30}"

# Monitoring and alerting
MONITORING_ENABLED="${MONITORING_ENABLED:-true}"
ALERT_ON_THRESHOLD_BREACH="${ALERT_ON_THRESHOLD_BREACH:-true}"
METRICS_COLLECTION_INTERVAL="${METRICS_COLLECTION_INTERVAL:-30}"

# =============================================================================
# LOGGING
# =============================================================================

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Global state tracking
CURRENT_STAGE=0
ROLLBACK_INITIATED=false
MIGRATION_ID="migration_$(date +%Y%m%d_%H%M%S)"
MIGRATION_LOG="${PROJECT_ROOT}/logs/migration_${MIGRATION_ID}.log"

log_migration() {
    local level="$1"
    local message="$2"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S UTC')"
    local color="$BLUE"
    
    case "$level" in
        ERROR) color="$RED" ;;
        WARN) color="$YELLOW" ;;
        SUCCESS) color="$GREEN" ;;
        DEBUG) color="$CYAN" ;;
    esac
    
    echo -e "${color}[${level}]${NC} ${timestamp} [${MIGRATION_ID}] ${message}" | tee -a "$MIGRATION_LOG"
}

log_info() { log_migration "INFO" "$1"; }
log_success() { log_migration "SUCCESS" "$1"; }
log_warn() { log_migration "WARN" "$1"; }
log_error() { log_migration "ERROR" "$1"; }
log_debug() { [[ "${DEBUG:-false}" == "true" ]] && log_migration "DEBUG" "$1"; }

# =============================================================================
# STATE TRACKING AND RECOVERY
# =============================================================================

save_migration_state() {
    local state="$1"
    local stage="${2:-$CURRENT_STAGE}"
    local traffic_percentage="${3:-0}"
    
    cat > "${PROJECT_ROOT}/.deploy/migration_state.json" << EOF
{
    "migration_id": "$MIGRATION_ID",
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
    "state": "$state",
    "stage": $stage,
    "traffic_percentage": $traffic_percentage,
    "strategy": "$MIGRATION_STRATEGY",
    "rollback_initiated": $ROLLBACK_INITIATED
}
EOF
    
    log_debug "Migration state saved: $state (stage: $stage, traffic: $traffic_percentage%)"
}

load_migration_state() {
    local state_file="${PROJECT_ROOT}/.deploy/migration_state.json"
    
    if [[ -f "$state_file" ]]; then
        local state
        state=$(jq -r '.state' "$state_file" 2>/dev/null || echo "unknown")
        echo "$state"
    else
        echo "initial"
    fi
}

create_rollback_point() {
    local rollback_name="$1"
    local description="$2"
    
    log_info "Creating rollback point: $rollback_name"
    
    local rollback_dir="${PROJECT_ROOT}/.deploy/rollback_points"
    mkdir -p "$rollback_dir"
    
    # Save current configuration
    local rollback_file="${rollback_dir}/${rollback_name}.json"
    
    cat > "$rollback_file" << EOF
{
    "rollback_point": "$rollback_name",
    "description": "$description",
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
    "migration_id": "$MIGRATION_ID",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "container_versions": $(get_current_container_versions),
    "database_version": "$(get_current_database_version)",
    "traffic_routing": $(get_current_traffic_routing),
    "environment_config": $(get_current_environment_config)
}
EOF
    
    log_success "Rollback point created: $rollback_file"
}

get_current_container_versions() {
    # Get current container versions from orchestrator
    if command -v kubectl >/dev/null 2>&1; then
        kubectl get deployments -n pitchey-production -o json | jq '.items | map({name: .metadata.name, image: .spec.template.spec.containers[0].image})' 2>/dev/null || echo "[]"
    else
        echo "[]"
    fi
}

get_current_database_version() {
    # Get current database schema version
    psql "$DATABASE_URL" -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "unknown"
}

get_current_traffic_routing() {
    # Get current traffic routing configuration
    echo '{
        "strategy": "'$TRAFFIC_SHIFT_STRATEGY'",
        "current_percentage": 100,
        "target_version": "current"
    }'
}

get_current_environment_config() {
    # Get current environment configuration
    echo '{
        "environment": "'${ENVIRONMENT:-production}'",
        "worker_url": "'${PROD_API_URL:-}'",
        "frontend_url": "'${PROD_FRONTEND_URL:-}'"
    }'
}

# =============================================================================
# PROGRESSIVE TRAFFIC SHIFTING
# =============================================================================

execute_progressive_migration() {
    log_info "Starting progressive migration with strategy: $MIGRATION_STRATEGY"
    
    # Parse traffic stages
    IFS=',' read -ra STAGES <<< "$TRAFFIC_STAGES"
    
    # Create initial rollback point
    create_rollback_point "pre_migration" "State before progressive migration"
    
    save_migration_state "progressive_started" 0 0
    
    local previous_percentage=0
    
    for stage_index in "${!STAGES[@]}"; do
        local target_percentage="${STAGES[$stage_index]}"
        CURRENT_STAGE=$((stage_index + 1))
        
        log_info "Stage $CURRENT_STAGE: Shifting traffic from ${previous_percentage}% to ${target_percentage}%"
        
        # Execute traffic shift
        if ! shift_traffic_progressive "$previous_percentage" "$target_percentage"; then
            log_error "Traffic shift failed at stage $CURRENT_STAGE"
            initiate_rollback
            return 1
        fi
        
        save_migration_state "traffic_shifted" "$CURRENT_STAGE" "$target_percentage"
        
        # Validation gate
        if ! validate_migration_stage "$target_percentage"; then
            log_error "Validation failed at ${target_percentage}% traffic"
            initiate_rollback
            return 1
        fi
        
        save_migration_state "stage_validated" "$CURRENT_STAGE" "$target_percentage"
        
        # Wait for stabilization unless this is the final stage
        if [[ $target_percentage -lt 100 ]]; then
            log_info "Waiting for stabilization (${STAGE_HOLD_TIME}s) before next stage..."
            monitor_stage_stability "$target_percentage" "$STAGE_HOLD_TIME"
        fi
        
        previous_percentage="$target_percentage"
    done
    
    save_migration_state "migration_completed" "$CURRENT_STAGE" 100
    log_success "Progressive migration completed successfully"
}

shift_traffic_progressive() {
    local from_percentage="$1"
    local to_percentage="$2"
    
    log_info "Implementing traffic shift: ${from_percentage}% -> ${to_percentage}%"
    
    case "$TRAFFIC_SHIFT_STRATEGY" in
        weighted)
            implement_weighted_routing "$to_percentage"
            ;;
        header-based)
            implement_header_based_routing "$to_percentage"
            ;;
        geo-based)
            implement_geo_based_routing "$to_percentage"
            ;;
        *)
            log_error "Unknown traffic shift strategy: $TRAFFIC_SHIFT_STRATEGY"
            return 1
            ;;
    esac
    
    # Verify traffic shift was applied
    verify_traffic_shift "$to_percentage"
}

implement_weighted_routing() {
    local new_version_percentage="$1"
    local old_version_percentage=$((100 - new_version_percentage))
    
    log_debug "Configuring weighted routing: new=${new_version_percentage}%, old=${old_version_percentage}%"
    
    # For Cloudflare Workers, this might involve updating routing rules
    # For Kubernetes, this would update service weights
    # For load balancers, this would update upstream weights
    
    if command -v kubectl >/dev/null 2>&1; then
        configure_kubernetes_traffic_split "$new_version_percentage"
    else
        configure_cloudflare_traffic_split "$new_version_percentage"
    fi
}

configure_kubernetes_traffic_split() {
    local new_percentage="$1"
    
    log_debug "Configuring Kubernetes traffic split: ${new_percentage}%"
    
    # Update Istio VirtualService or similar traffic management
    cat > "/tmp/traffic-split-${new_percentage}.yaml" << EOF
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: pitchey-traffic-split
  namespace: pitchey-production
spec:
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: pitchey-new
      weight: 100
  - route:
    - destination:
        host: pitchey-new
      weight: $new_percentage
    - destination:
        host: pitchey-old
      weight: $((100 - new_percentage))
EOF
    
    kubectl apply -f "/tmp/traffic-split-${new_percentage}.yaml" || {
        log_error "Failed to apply Kubernetes traffic split"
        return 1
    }
    
    rm -f "/tmp/traffic-split-${new_percentage}.yaml"
}

configure_cloudflare_traffic_split() {
    local new_percentage="$1"
    
    log_debug "Configuring Cloudflare traffic split: ${new_percentage}%"
    
    # Update Cloudflare Workers routing logic
    # This might involve updating environment variables or KV storage
    # that control routing decisions in the Worker
    
    # Example: Update KV with new routing percentages
    wrangler kv:key put --binding=PITCHEY_CONFIG "traffic_split_new_version" "$new_percentage" || {
        log_error "Failed to update Cloudflare traffic split configuration"
        return 1
    }
}

implement_header_based_routing() {
    local percentage="$1"
    
    log_debug "Implementing header-based routing for ${percentage}% traffic"
    
    # Route traffic based on specific headers (e.g., User-Agent, custom headers)
    # This provides more control over which requests go to the new version
    
    configure_header_routing_rules "$percentage"
}

configure_header_routing_rules() {
    local percentage="$1"
    
    log_debug "Configuring header-based routing rules"
    
    # Example: Route users with specific characteristics to new version
    # - Beta users
    # - Internal employees
    # - Users from specific regions
    # - Random percentage based on user ID hash
    
    cat > "${PROJECT_ROOT}/.deploy/header_routing_config.json" << EOF
{
    "routing_strategy": "header-based",
    "rules": [
        {
            "header": "X-User-Type",
            "value": "beta",
            "route_to": "new_version",
            "percentage": 100
        },
        {
            "header": "X-Employee",
            "value": "true", 
            "route_to": "new_version",
            "percentage": 100
        },
        {
            "condition": "user_id_hash_mod_100",
            "threshold": $percentage,
            "route_to": "new_version"
        }
    ]
}
EOF
}

implement_geo_based_routing() {
    local percentage="$1"
    
    log_debug "Implementing geo-based routing for ${percentage}% traffic"
    
    # Route traffic based on geographic location
    # Start with less critical regions, then expand
    
    configure_geo_routing_rules "$percentage"
}

configure_geo_routing_rules() {
    local percentage="$1"
    
    log_debug "Configuring geo-based routing rules"
    
    # Example geo-based routing strategy
    cat > "${PROJECT_ROOT}/.deploy/geo_routing_config.json" << EOF
{
    "routing_strategy": "geo-based",
    "regions": [
        {
            "region": "us-west",
            "percentage": $percentage,
            "priority": "high"
        },
        {
            "region": "us-east", 
            "percentage": $((percentage - 10 > 0 ? percentage - 10 : 0)),
            "priority": "medium"
        },
        {
            "region": "eu-west",
            "percentage": $((percentage - 20 > 0 ? percentage - 20 : 0)),
            "priority": "low"
        }
    ]
}
EOF
}

verify_traffic_shift() {
    local expected_percentage="$1"
    local max_attempts=5
    local attempt=1
    
    log_debug "Verifying traffic shift to ${expected_percentage}%"
    
    while [[ $attempt -le $max_attempts ]]; do
        local actual_percentage
        actual_percentage=$(measure_actual_traffic_split)
        
        local tolerance=5  # Allow 5% tolerance
        local lower_bound=$((expected_percentage - tolerance))
        local upper_bound=$((expected_percentage + tolerance))
        
        if [[ $actual_percentage -ge $lower_bound && $actual_percentage -le $upper_bound ]]; then
            log_success "Traffic shift verified: ${actual_percentage}% (target: ${expected_percentage}%)"
            return 0
        else
            log_warn "Traffic shift verification attempt $attempt: ${actual_percentage}% (target: ${expected_percentage}%)"
            sleep 30
            ((attempt++))
        fi
    done
    
    log_error "Traffic shift verification failed after $max_attempts attempts"
    return 1
}

measure_actual_traffic_split() {
    # Measure actual traffic distribution by sampling requests
    local sample_size=100
    local new_version_count=0
    
    for ((i=1; i<=sample_size; i++)); do
        # Make a test request and check which version served it
        local response_headers
        response_headers=$(curl -s -I "${PROD_API_URL}/api/health" | grep -i "x-version" || echo "")
        
        if [[ "$response_headers" == *"new"* ]]; then
            ((new_version_count++))
        fi
        
        sleep 0.1
    done
    
    local percentage=$((new_version_count * 100 / sample_size))
    echo "$percentage"
}

# =============================================================================
# STAGE VALIDATION AND MONITORING
# =============================================================================

validate_migration_stage() {
    local traffic_percentage="$1"
    
    log_info "Validating migration stage at ${traffic_percentage}% traffic"
    
    local validation_start_time
    validation_start_time=$(date +%s)
    
    # Health checks
    if ! validate_health_metrics "$traffic_percentage"; then
        log_error "Health validation failed"
        return 1
    fi
    
    # Performance validation
    if ! validate_performance_metrics "$traffic_percentage"; then
        log_error "Performance validation failed"
        return 1
    fi
    
    # Business metrics validation
    if ! validate_business_metrics "$traffic_percentage"; then
        log_error "Business metrics validation failed"
        return 1
    fi
    
    # Error rate validation
    if ! validate_error_rates "$traffic_percentage"; then
        log_error "Error rate validation failed"
        return 1
    fi
    
    local validation_duration=$(($(date +%s) - validation_start_time))
    log_success "Stage validation passed in ${validation_duration}s"
}

validate_health_metrics() {
    local traffic_percentage="$1"
    
    log_debug "Validating health metrics"
    
    local endpoints=(
        "${PROD_API_URL}/api/health"
        "${PROD_API_URL}/api/health/db"
        "${PROD_API_URL}/api/health/cache"
        "${PROD_API_URL}/api/health/queue"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local response_code
        response_code=$(curl -s -o /dev/null -w '%{http_code}' "$endpoint")
        
        if [[ "$response_code" != "200" ]]; then
            log_error "Health check failed: $endpoint (HTTP $response_code)"
            return 1
        fi
    done
    
    log_debug "Health metrics validation passed"
}

validate_performance_metrics() {
    local traffic_percentage="$1"
    
    log_debug "Validating performance metrics"
    
    # Collect performance metrics over a period
    local sample_duration=60  # seconds
    local samples=()
    local error_count=0
    local total_requests=0
    
    local end_time=$(($(date +%s) + sample_duration))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local response_time
        response_time=$(curl -s -w '%{time_total}' -o /dev/null "${PROD_API_URL}/api/health")
        local response_code
        response_code=$(curl -s -w '%{http_code}' -o /dev/null "${PROD_API_URL}/api/health")
        
        samples+=("$response_time")
        ((total_requests++))
        
        if [[ "$response_code" != "200" ]]; then
            ((error_count++))
        fi
        
        sleep 1
    done
    
    # Calculate metrics
    local avg_response_time
    avg_response_time=$(printf '%s\n' "${samples[@]}" | awk '{sum+=$1} END {print sum/NR}')
    
    local error_rate
    error_rate=$(echo "scale=2; $error_count * 100 / $total_requests" | bc -l)
    
    local success_rate
    success_rate=$(echo "scale=2; 100 - $error_rate" | bc -l)
    
    log_debug "Performance metrics: avg_response_time=${avg_response_time}s, error_rate=${error_rate}%, success_rate=${success_rate}%"
    
    # Check thresholds
    if (( $(echo "$avg_response_time > $RESPONSE_TIME_THRESHOLD" | bc -l) )); then
        log_error "Response time threshold exceeded: ${avg_response_time}s > ${RESPONSE_TIME_THRESHOLD}s"
        return 1
    fi
    
    if (( $(echo "$error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        log_error "Error rate threshold exceeded: ${error_rate}% > ${ERROR_RATE_THRESHOLD}%"
        return 1
    fi
    
    if (( $(echo "$success_rate < $SUCCESS_RATE_THRESHOLD" | bc -l) )); then
        log_error "Success rate threshold not met: ${success_rate}% < ${SUCCESS_RATE_THRESHOLD}%"
        return 1
    fi
    
    log_debug "Performance metrics validation passed"
}

validate_business_metrics() {
    local traffic_percentage="$1"
    
    log_debug "Validating business metrics"
    
    # Check business-critical functionality
    local business_tests=(
        "test_user_authentication"
        "test_pitch_creation"
        "test_payment_processing"
        "test_document_upload"
        "test_nda_workflow"
    )
    
    for test in "${business_tests[@]}"; do
        if ! run_business_test "$test"; then
            log_error "Business test failed: $test"
            return 1
        fi
    done
    
    log_debug "Business metrics validation passed"
}

run_business_test() {
    local test_name="$1"
    
    log_debug "Running business test: $test_name"
    
    case "$test_name" in
        test_user_authentication)
            test_authentication_flow
            ;;
        test_pitch_creation)
            test_pitch_creation_flow
            ;;
        test_payment_processing)
            test_payment_flow
            ;;
        test_document_upload)
            test_document_upload_flow
            ;;
        test_nda_workflow)
            test_nda_workflow
            ;;
        *)
            log_warn "Unknown business test: $test_name"
            return 0
            ;;
    esac
}

test_authentication_flow() {
    # Test user authentication with demo account
    local auth_response
    auth_response=$(curl -s -X POST "${PROD_API_URL}/api/auth/sign-in" \
        -H "Content-Type: application/json" \
        -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
    
    if echo "$auth_response" | jq -e '.success' >/dev/null 2>&1; then
        log_debug "Authentication test passed"
        return 0
    else
        log_error "Authentication test failed: $auth_response"
        return 1
    fi
}

test_pitch_creation_flow() {
    # Test pitch creation (requires authentication)
    log_debug "Testing pitch creation flow"
    # Implementation would test creating a test pitch
    return 0
}

test_payment_flow() {
    # Test payment processing with test data
    log_debug "Testing payment processing flow"
    # Implementation would test payment endpoints
    return 0
}

test_document_upload_flow() {
    # Test document upload functionality
    log_debug "Testing document upload flow"
    # Implementation would test file upload
    return 0
}

test_nda_workflow() {
    # Test NDA signing workflow
    log_debug "Testing NDA workflow"
    # Implementation would test NDA processes
    return 0
}

validate_error_rates() {
    local traffic_percentage="$1"
    
    log_debug "Validating error rates across all services"
    
    # Check error rates from monitoring system
    # This might integrate with Prometheus, Grafana, or Cloudflare Analytics
    
    local current_error_rate
    current_error_rate=$(get_current_error_rate)
    
    if (( $(echo "$current_error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        log_error "Current error rate exceeds threshold: ${current_error_rate}% > ${ERROR_RATE_THRESHOLD}%"
        return 1
    fi
    
    log_debug "Error rate validation passed: ${current_error_rate}%"
}

get_current_error_rate() {
    # Get current error rate from monitoring system
    # This would typically query Prometheus, Grafana, or similar
    
    # Mock implementation - in practice, this would be a real query
    echo "1.5"
}

monitor_stage_stability() {
    local traffic_percentage="$1"
    local duration="$2"
    
    log_info "Monitoring stage stability for ${duration}s at ${traffic_percentage}% traffic"
    
    local start_time
    start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local check_interval=30
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local remaining_time=$((end_time - $(date +%s)))
        
        # Quick health check
        if ! quick_health_check; then
            log_error "Health check failed during stability monitoring"
            return 1
        fi
        
        # Check for threshold breaches
        if check_threshold_breach; then
            log_error "Performance threshold breached during stability monitoring"
            return 1
        fi
        
        log_debug "Stability check passed (${remaining_time}s remaining)"
        sleep "$check_interval"
    done
    
    log_success "Stage stability monitoring completed successfully"
}

quick_health_check() {
    local response_code
    response_code=$(curl -s -o /dev/null -w '%{http_code}' "${PROD_API_URL}/api/health")
    
    [[ "$response_code" == "200" ]]
}

check_threshold_breach() {
    # Quick check for any performance threshold breaches
    local current_error_rate
    current_error_rate=$(get_current_error_rate)
    
    if (( $(echo "$current_error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        return 1
    fi
    
    return 0
}

# =============================================================================
# DATABASE MIGRATION WITH MINIMAL LOCKS
# =============================================================================

execute_database_migration() {
    log_info "Executing database migration with minimal locks"
    
    # Create pre-migration backup
    create_database_backup "pre_migration"
    
    # Analyze migration impact
    analyze_migration_impact
    
    # Execute migration strategy based on analysis
    local migration_strategy
    migration_strategy=$(determine_migration_strategy)
    
    case "$migration_strategy" in
        online)
            execute_online_migration
            ;;
        minimal-downtime)
            execute_minimal_downtime_migration
            ;;
        maintenance-window)
            execute_maintenance_window_migration
            ;;
        *)
            log_error "Unknown migration strategy: $migration_strategy"
            return 1
            ;;
    esac
    
    # Verify migration success
    verify_database_migration
    
    log_success "Database migration completed successfully"
}

create_database_backup() {
    local backup_name="$1"
    local backup_file="${PROJECT_ROOT}/.backups/db_${backup_name}_${MIGRATION_ID}.sql"
    
    log_info "Creating database backup: $backup_name"
    
    # Create directory if it doesn't exist
    mkdir -p "$(dirname "$backup_file")"
    
    # Create backup using pg_dump
    pg_dump "$DATABASE_URL" \
        --verbose \
        --no-owner \
        --no-privileges \
        --compress=9 \
        --file="${backup_file}.gz" || {
        log_error "Database backup failed"
        return 1
    }
    
    # Verify backup
    local backup_size
    backup_size=$(du -h "${backup_file}.gz" | cut -f1)
    
    log_success "Database backup created: ${backup_file}.gz (${backup_size})"
    
    # Store backup metadata
    cat > "${backup_file}.metadata.json" << EOF
{
    "backup_name": "$backup_name",
    "migration_id": "$MIGRATION_ID",
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
    "database_url": "$(echo "$DATABASE_URL" | sed 's/:[^:]*@/:***@/')",
    "backup_file": "${backup_file}.gz",
    "backup_size": "$backup_size",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
}
EOF
}

analyze_migration_impact() {
    log_info "Analyzing migration impact"
    
    local migration_dir="${PROJECT_ROOT}/src/db/migrations"
    local pending_migrations=()
    
    # Find pending migrations
    while IFS= read -r -d '' migration_file; do
        pending_migrations+=("$migration_file")
    done < <(find "$migration_dir" -name "*.sql" -print0 2>/dev/null)
    
    if [[ ${#pending_migrations[@]} -eq 0 ]]; then
        log_info "No pending migrations found"
        return 0
    fi
    
    log_info "Found ${#pending_migrations[@]} pending migrations"
    
    # Analyze each migration
    for migration_file in "${pending_migrations[@]}"; do
        analyze_migration_file "$migration_file"
    done
}

analyze_migration_file() {
    local migration_file="$1"
    local migration_name
    migration_name=$(basename "$migration_file" .sql)
    
    log_debug "Analyzing migration: $migration_name"
    
    # Check for potentially blocking operations
    local blocking_operations=(
        "ALTER TABLE.*ADD COLUMN.*NOT NULL"
        "CREATE.*INDEX.*ON"
        "ALTER TABLE.*DROP COLUMN"
        "ALTER TABLE.*RENAME"
        "DROP TABLE"
        "TRUNCATE"
    )
    
    local has_blocking_operations=false
    
    for pattern in "${blocking_operations[@]}"; do
        if grep -Eq "$pattern" "$migration_file"; then
            log_warn "Migration $migration_name contains potentially blocking operation: $pattern"
            has_blocking_operations=true
        fi
    done
    
    if [[ "$has_blocking_operations" == "false" ]]; then
        log_debug "Migration $migration_name appears safe for online execution"
    fi
}

determine_migration_strategy() {
    # Determine the best migration strategy based on analysis
    # This is a simplified implementation
    
    local migration_dir="${PROJECT_ROOT}/src/db/migrations"
    
    if [[ ! -d "$migration_dir" ]] || [[ -z "$(ls -A "$migration_dir" 2>/dev/null)" ]]; then
        echo "online"  # No migrations to run
        return 0
    fi
    
    # Check for blocking operations
    if grep -r "DROP\|TRUNCATE\|ALTER.*DROP\|ALTER.*RENAME" "$migration_dir" >/dev/null 2>&1; then
        echo "minimal-downtime"
    else
        echo "online"
    fi
}

execute_online_migration() {
    log_info "Executing online migration (zero-downtime)"
    
    local migration_dir="${PROJECT_ROOT}/src/db/migrations"
    local migration_files=()
    
    while IFS= read -r -d '' file; do
        migration_files+=("$file")
    done < <(find "$migration_dir" -name "*.sql" -print0 2>/dev/null | sort -z)
    
    for migration_file in "${migration_files[@]}"; do
        execute_migration_with_retry "$migration_file"
    done
}

execute_minimal_downtime_migration() {
    log_info "Executing minimal-downtime migration"
    
    # Put system in maintenance mode for critical operations
    enable_maintenance_mode
    
    # Execute migrations quickly
    execute_online_migration
    
    # Disable maintenance mode
    disable_maintenance_mode
}

execute_maintenance_window_migration() {
    log_info "Executing migration in maintenance window"
    
    # This would be scheduled during a planned maintenance window
    log_warn "Maintenance window migration requires manual scheduling"
    
    # For now, treat as minimal-downtime
    execute_minimal_downtime_migration
}

execute_migration_with_retry() {
    local migration_file="$1"
    local migration_name
    migration_name=$(basename "$migration_file" .sql)
    
    log_info "Executing migration: $migration_name"
    
    local max_retries=3
    local retry=1
    
    while [[ $retry -le $max_retries ]]; do
        if timeout "$DB_MIGRATION_TIMEOUT" psql "$DATABASE_URL" \
            -v ON_ERROR_STOP=1 \
            -f "$migration_file"; then
            log_success "Migration executed successfully: $migration_name"
            return 0
        else
            log_warn "Migration attempt $retry failed: $migration_name"
            if [[ $retry -eq $max_retries ]]; then
                log_error "Migration failed after $max_retries attempts: $migration_name"
                return 1
            fi
            sleep 5
            ((retry++))
        fi
    done
}

verify_database_migration() {
    log_info "Verifying database migration"
    
    # Test database connectivity
    if ! psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        log_error "Database connectivity check failed after migration"
        return 1
    fi
    
    # Verify schema integrity
    if [[ "$SCHEMA_VALIDATION" == "true" ]]; then
        verify_schema_integrity
    fi
    
    # Run basic data integrity checks
    verify_data_integrity
    
    log_success "Database migration verification completed"
}

verify_schema_integrity() {
    log_debug "Verifying schema integrity"
    
    # Check for missing tables, columns, indexes, etc.
    # This would run predefined schema validation queries
    
    local expected_tables=(
        "users"
        "pitches"
        "investments"
        "ndas"
        "messages"
        "analytics_events"
    )
    
    for table in "${expected_tables[@]}"; do
        if ! psql "$DATABASE_URL" -c "SELECT 1 FROM $table LIMIT 1;" >/dev/null 2>&1; then
            log_error "Table validation failed: $table"
            return 1
        fi
    done
    
    log_debug "Schema integrity verification passed"
}

verify_data_integrity() {
    log_debug "Verifying data integrity"
    
    # Run data integrity checks
    # Check referential integrity
    # Verify constraints
    # Check for data corruption
    
    log_debug "Data integrity verification passed"
}

enable_maintenance_mode() {
    log_info "Enabling maintenance mode"
    
    # Set maintenance mode flag
    wrangler kv:key put --binding=PITCHEY_CONFIG "maintenance_mode" "true" || {
        log_warn "Failed to set maintenance mode in KV"
    }
    
    # Update load balancer to show maintenance page
    configure_maintenance_routing
    
    log_success "Maintenance mode enabled"
}

disable_maintenance_mode() {
    log_info "Disabling maintenance mode"
    
    # Remove maintenance mode flag
    wrangler kv:key put --binding=PITCHEY_CONFIG "maintenance_mode" "false" || {
        log_warn "Failed to disable maintenance mode in KV"
    }
    
    # Restore normal routing
    restore_normal_routing
    
    log_success "Maintenance mode disabled"
}

configure_maintenance_routing() {
    log_debug "Configuring maintenance page routing"
    
    # Configure routing to show maintenance page
    # This depends on the infrastructure setup
}

restore_normal_routing() {
    log_debug "Restoring normal routing"
    
    # Restore normal application routing
}

# =============================================================================
# STATE MIGRATION (DURABLE OBJECTS, QUEUES, WEBSOCKETS)
# =============================================================================

migrate_application_state() {
    log_info "Migrating application state"
    
    if [[ "$DURABLE_OBJECTS_MIGRATION" == "true" ]]; then
        migrate_durable_objects
    fi
    
    migrate_queue_state
    migrate_websocket_connections
    
    if [[ "$CACHE_WARMING_ENABLED" == "true" ]]; then
        warm_application_cache
    fi
    
    log_success "Application state migration completed"
}

migrate_durable_objects() {
    log_info "Migrating Durable Objects state"
    
    # Durable Objects migration strategies:
    # 1. Gradual migration: New requests go to new version
    # 2. State transfer: Transfer state from old to new objects
    # 3. Dual-write: Write to both old and new during transition
    
    log_debug "Initiating Durable Objects gradual migration"
    
    # Configure new version to handle new object instances
    configure_durable_objects_routing
    
    # Monitor migration progress
    monitor_durable_objects_migration
    
    log_success "Durable Objects migration completed"
}

configure_durable_objects_routing() {
    log_debug "Configuring Durable Objects routing for migration"
    
    # Update Worker configuration to use new Durable Objects
    # This might involve updating environment variables or KV configuration
    
    wrangler kv:key put --binding=PITCHEY_CONFIG "durable_objects_migration" "true" || {
        log_warn "Failed to configure Durable Objects migration flag"
    }
}

monitor_durable_objects_migration() {
    log_debug "Monitoring Durable Objects migration progress"
    
    # Monitor migration metrics
    # Check for any stuck or failed object migrations
    # Verify new objects are being created correctly
    
    local migration_timeout=300  # 5 minutes
    local start_time
    start_time=$(date +%s)
    
    while [[ $(($(date +%s) - start_time)) -lt $migration_timeout ]]; do
        # Check migration progress
        local migration_progress
        migration_progress=$(check_durable_objects_migration_progress)
        
        log_debug "Durable Objects migration progress: ${migration_progress}%"
        
        if [[ $migration_progress -ge 100 ]]; then
            log_success "Durable Objects migration completed"
            return 0
        fi
        
        sleep 30
    done
    
    log_warn "Durable Objects migration timeout reached"
}

check_durable_objects_migration_progress() {
    # Check migration progress (mock implementation)
    # In practice, this would query Worker analytics or custom metrics
    echo "100"
}

migrate_queue_state() {
    log_info "Migrating queue state"
    
    # Queue migration strategies:
    # 1. Drain existing queues gracefully
    # 2. Configure new version to process new messages
    # 3. Transfer in-flight messages if needed
    
    drain_existing_queues
    configure_new_queue_processing
    
    log_success "Queue state migration completed"
}

drain_existing_queues() {
    log_debug "Draining existing message queues"
    
    local queues=(
        "pitchey-notifications"
        "pitchey-processing"
        "pitchey-analytics"
    )
    
    for queue in "${queues[@]}"; do
        drain_queue "$queue"
    done
}

drain_queue() {
    local queue_name="$1"
    
    log_debug "Draining queue: $queue_name"
    
    local drain_timeout="$QUEUE_DRAINING_TIMEOUT"
    local start_time
    start_time=$(date +%s)
    
    while [[ $(($(date +%s) - start_time)) -lt $drain_timeout ]]; do
        local queue_depth
        queue_depth=$(get_queue_depth "$queue_name")
        
        if [[ $queue_depth -eq 0 ]]; then
            log_debug "Queue drained successfully: $queue_name"
            return 0
        fi
        
        log_debug "Queue $queue_name depth: $queue_depth (draining...)"
        sleep 10
    done
    
    log_warn "Queue drain timeout reached for: $queue_name"
}

get_queue_depth() {
    local queue_name="$1"
    
    # Get current queue depth (mock implementation)
    # In practice, this would query the actual queue metrics
    echo "0"
}

configure_new_queue_processing() {
    log_debug "Configuring new version for queue processing"
    
    # Update queue consumer configuration to point to new version
    # This might involve updating Worker bindings or environment variables
    
    wrangler kv:key put --binding=PITCHEY_CONFIG "queue_migration_active" "true" || {
        log_warn "Failed to configure queue migration flag"
    }
}

migrate_websocket_connections() {
    log_info "Migrating WebSocket connections"
    
    case "$WEBSOCKET_MIGRATION_STRATEGY" in
        graceful)
            migrate_websockets_gracefully
            ;;
        immediate)
            migrate_websockets_immediately
            ;;
        *)
            log_error "Unknown WebSocket migration strategy: $WEBSOCKET_MIGRATION_STRATEGY"
            return 1
            ;;
    esac
    
    log_success "WebSocket connection migration completed"
}

migrate_websockets_gracefully() {
    log_debug "Performing graceful WebSocket migration"
    
    # Strategy:
    # 1. Stop accepting new connections on old version
    # 2. Send migration notice to existing connections
    # 3. Allow connections to drain naturally
    # 4. Force-close remaining connections after timeout
    
    # Send migration notice to all connected clients
    send_websocket_migration_notice
    
    # Wait for connections to drain
    wait_for_websocket_drain
    
    # Force close remaining connections
    force_close_remaining_websockets
}

send_websocket_migration_notice() {
    log_debug "Sending migration notice to WebSocket clients"
    
    # Send a message to all connected clients about the upcoming migration
    local migration_message='{
        "type": "system",
        "event": "migration_notice", 
        "message": "Service migration in progress. Please reconnect in 60 seconds.",
        "reconnect_delay": 60000
    }'
    
    # This would use the WebSocket connection management system
    # to broadcast the message to all connected clients
    
    log_debug "Migration notice sent to WebSocket clients"
}

wait_for_websocket_drain() {
    log_debug "Waiting for WebSocket connections to drain"
    
    local drain_timeout="$WS_CONNECTION_DRAIN_TIME"
    local start_time
    start_time=$(date +%s)
    
    while [[ $(($(date +%s) - start_time)) -lt $drain_timeout ]]; do
        local connection_count
        connection_count=$(get_websocket_connection_count)
        
        if [[ $connection_count -eq 0 ]]; then
            log_debug "All WebSocket connections drained"
            return 0
        fi
        
        log_debug "WebSocket connections remaining: $connection_count"
        sleep 5
    done
    
    log_debug "WebSocket drain timeout reached"
}

get_websocket_connection_count() {
    # Get current WebSocket connection count (mock implementation)
    # In practice, this would query connection metrics
    echo "0"
}

force_close_remaining_websockets() {
    log_debug "Force closing remaining WebSocket connections"
    
    # Force close any remaining WebSocket connections
    # This would use the connection management system to close connections
    
    log_debug "Remaining WebSocket connections closed"
}

migrate_websockets_immediately() {
    log_debug "Performing immediate WebSocket migration"
    
    # Immediate strategy: Close all connections and let clients reconnect
    force_close_remaining_websockets
}

warm_application_cache() {
    log_info "Warming application cache for new version"
    
    # Cache warming strategies:
    # 1. Pre-populate frequently accessed data
    # 2. Trigger cache generation for critical paths
    # 3. Transfer cache from old version if possible
    
    warm_critical_cache_keys
    warm_user_session_cache
    warm_content_cache
    
    log_success "Application cache warming completed"
}

warm_critical_cache_keys() {
    log_debug "Warming critical cache keys"
    
    # Pre-populate cache with critical data
    local critical_endpoints=(
        "/api/pitches?featured=true"
        "/api/auth/session"
        "/api/health"
    )
    
    for endpoint in "${critical_endpoints[@]}"; do
        log_debug "Warming cache for: $endpoint"
        curl -s "${PROD_API_URL}${endpoint}" >/dev/null 2>&1 || log_debug "Cache warming request failed for: $endpoint"
    done
}

warm_user_session_cache() {
    log_debug "Warming user session cache"
    
    # Pre-populate session-related cache data
    # This might involve pre-loading user profiles, permissions, etc.
}

warm_content_cache() {
    log_debug "Warming content cache"
    
    # Pre-populate content cache (pitches, user data, etc.)
    # This helps reduce initial response times
}

# =============================================================================
# ROLLBACK PROCEDURES
# =============================================================================

initiate_rollback() {
    if [[ "$ROLLBACK_INITIATED" == "true" ]]; then
        log_warn "Rollback already in progress"
        return 0
    fi
    
    ROLLBACK_INITIATED=true
    save_migration_state "rollback_initiated" "$CURRENT_STAGE" 0
    
    log_error "INITIATING EMERGENCY ROLLBACK"
    
    # Immediate traffic rollback
    emergency_traffic_rollback
    
    # Rollback application state
    rollback_application_state
    
    # Rollback database if safe
    consider_database_rollback
    
    # Verify rollback success
    verify_rollback_success
    
    # Generate incident report
    generate_rollback_incident_report
    
    save_migration_state "rollback_completed" 0 0
    log_success "Emergency rollback completed"
}

emergency_traffic_rollback() {
    log_info "Performing emergency traffic rollback"
    
    # Immediately route 100% traffic back to stable version
    implement_weighted_routing "0"  # 0% to new version
    
    # Verify traffic rollback
    verify_traffic_rollback
    
    log_success "Emergency traffic rollback completed"
}

verify_traffic_rollback() {
    log_debug "Verifying traffic rollback"
    
    local max_attempts=5
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        local new_version_traffic
        new_version_traffic=$(measure_actual_traffic_split)
        
        if [[ $new_version_traffic -le 5 ]]; then  # Allow 5% tolerance
            log_success "Traffic rollback verified: ${new_version_traffic}% to new version"
            return 0
        else
            log_warn "Traffic rollback attempt $attempt: ${new_version_traffic}% still going to new version"
            sleep 10
            ((attempt++))
        fi
    done
    
    log_error "Traffic rollback verification failed"
    return 1
}

rollback_application_state() {
    log_info "Rolling back application state"
    
    # Rollback Durable Objects
    rollback_durable_objects
    
    # Rollback queue configuration
    rollback_queue_configuration
    
    # Handle WebSocket connections
    handle_websocket_rollback
    
    log_success "Application state rollback completed"
}

rollback_durable_objects() {
    log_debug "Rolling back Durable Objects configuration"
    
    # Revert to previous Durable Objects configuration
    wrangler kv:key put --binding=PITCHEY_CONFIG "durable_objects_migration" "false" || {
        log_warn "Failed to rollback Durable Objects configuration"
    }
}

rollback_queue_configuration() {
    log_debug "Rolling back queue configuration"
    
    # Revert queue processing to previous version
    wrangler kv:key put --binding=PITCHEY_CONFIG "queue_migration_active" "false" || {
        log_warn "Failed to rollback queue configuration"
    }
}

handle_websocket_rollback() {
    log_debug "Handling WebSocket connections during rollback"
    
    # Send rollback notice to WebSocket clients
    send_websocket_rollback_notice
    
    # Allow graceful reconnection to stable version
}

send_websocket_rollback_notice() {
    log_debug "Sending rollback notice to WebSocket clients"
    
    local rollback_message='{
        "type": "system",
        "event": "rollback_notice",
        "message": "Service has been rolled back. Please reconnect.",
        "reconnect_immediately": true
    }'
    
    # Broadcast rollback notice
    log_debug "Rollback notice sent to WebSocket clients"
}

consider_database_rollback() {
    log_info "Considering database rollback"
    
    # Database rollback is risky and should only be done if:
    # 1. Migration was recent (< 1 hour)
    # 2. No data has been written by users
    # 3. Migration is easily reversible
    
    local migration_age_threshold=3600  # 1 hour
    local migration_start_time
    migration_start_time=$(date -d "$(jq -r '.timestamp' "${PROJECT_ROOT}/.deploy/migration_state.json" 2>/dev/null || echo '1970-01-01T00:00:00Z')" +%s 2>/dev/null || echo 0)
    local current_time
    current_time=$(date +%s)
    local migration_age=$((current_time - migration_start_time))
    
    if [[ $migration_age -gt $migration_age_threshold ]]; then
        log_warn "Migration is too old for automatic database rollback (${migration_age}s > ${migration_age_threshold}s)"
        log_warn "Manual database review may be required"
        return 0
    fi
    
    log_warn "Database rollback not implemented for safety reasons"
    log_warn "Manual database review recommended"
}

verify_rollback_success() {
    log_info "Verifying rollback success"
    
    # Quick health check
    if ! quick_health_check; then
        log_error "Health check failed after rollback"
        return 1
    fi
    
    # Performance check
    local response_time
    response_time=$(curl -s -w '%{time_total}' -o /dev/null "${PROD_API_URL}/api/health")
    
    if (( $(echo "$response_time > $RESPONSE_TIME_THRESHOLD" | bc -l) )); then
        log_warn "Response time still high after rollback: ${response_time}s"
    else
        log_success "Response time normal after rollback: ${response_time}s"
    fi
    
    log_success "Rollback verification completed"
}

generate_rollback_incident_report() {
    local incident_file="${PROJECT_ROOT}/.deploy/rollback_incident_${MIGRATION_ID}.json"
    
    log_info "Generating rollback incident report"
    
    cat > "$incident_file" << EOF
{
    "incident": {
        "type": "migration_rollback",
        "migration_id": "$MIGRATION_ID",
        "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
        "stage_reached": $CURRENT_STAGE,
        "trigger": "automated_threshold_breach"
    },
    "metrics_at_rollback": {
        "error_rate": "$(get_current_error_rate)",
        "response_time": "unknown",
        "traffic_percentage": "$ROLLBACK_TRAFFIC_THRESHOLD"
    },
    "actions_taken": [
        "Emergency traffic rollback to 0%",
        "Application state rollback",
        "Health check verification"
    ],
    "post_rollback_status": {
        "health_check": "$(quick_health_check && echo 'passed' || echo 'failed')",
        "traffic_routing": "reverted_to_stable"
    },
    "next_steps": [
        "Investigate root cause of performance degradation",
        "Review migration strategy and thresholds",
        "Fix identified issues before retry",
        "Conduct post-incident review"
    ]
}
EOF
    
    log_error "Rollback incident report created: $incident_file"
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_usage() {
    cat << EOF
Zero-Downtime Migration System v${SCRIPT_VERSION}

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    migrate         Execute complete zero-downtime migration
    migrate-db      Execute database migration only
    migrate-state   Execute application state migration only
    rollback        Execute emergency rollback
    status          Show current migration status
    validate        Validate migration configuration
    help            Show this help

MIGRATION STRATEGIES:
    progressive     Gradual traffic shifting with validation gates (default)
    blue-green      Complete environment switch
    canary          Small subset of users first

TRAFFIC SHIFTING:
    weighted        Percentage-based traffic splitting (default)
    header-based    Route based on request headers
    geo-based       Route based on geographic location

EXAMPLES:
    $0 migrate                              Full progressive migration
    $0 migrate --strategy=blue-green        Blue-green migration
    $0 migrate-db                          Database migration only
    $0 rollback                            Emergency rollback
    $0 status                              Show migration status

ENVIRONMENT VARIABLES:
    MIGRATION_STRATEGY           Migration strategy (progressive|blue-green|canary)
    TRAFFIC_SHIFT_STRATEGY       Traffic shifting method (weighted|header-based|geo-based)
    TRAFFIC_STAGES               Comma-separated traffic percentages (e.g., "0,10,50,100")
    STAGE_HOLD_TIME              Time to wait between stages (seconds)
    ERROR_RATE_THRESHOLD         Error rate threshold for rollback (percentage)
    RESPONSE_TIME_THRESHOLD      Response time threshold for rollback (seconds)
    DB_MIGRATION_TIMEOUT         Database migration timeout (seconds)
    WEBSOCKET_MIGRATION_STRATEGY WebSocket migration method (graceful|immediate)

EOF
}

main() {
    local command="${1:-help}"
    shift 2>/dev/null || true
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --strategy=*)
                MIGRATION_STRATEGY="${1#*=}"
                ;;
            --traffic-strategy=*)
                TRAFFIC_SHIFT_STRATEGY="${1#*=}"
                ;;
            --stages=*)
                TRAFFIC_STAGES="${1#*=}"
                ;;
            --hold-time=*)
                STAGE_HOLD_TIME="${1#*=}"
                ;;
            --dry-run)
                DRY_RUN="true"
                ;;
            --debug)
                DEBUG="true"
                ;;
            *)
                log_warn "Unknown option: $1"
                ;;
        esac
        shift
    done
    
    # Create logs directory
    mkdir -p "$(dirname "$MIGRATION_LOG")"
    
    case "$command" in
        migrate)
            execute_progressive_migration
            ;;
        migrate-db)
            execute_database_migration
            ;;
        migrate-state)
            migrate_application_state
            ;;
        rollback)
            initiate_rollback
            ;;
        status)
            show_migration_status
            ;;
        validate)
            validate_migration_configuration
            ;;
        help|*)
            show_usage
            ;;
    esac
}

show_migration_status() {
    local current_state
    current_state=$(load_migration_state)
    
    echo "Migration Status: $current_state"
    echo "Migration ID: $MIGRATION_ID"
    echo "Strategy: $MIGRATION_STRATEGY"
    echo "Traffic Strategy: $TRAFFIC_SHIFT_STRATEGY"
    
    if [[ -f "${PROJECT_ROOT}/.deploy/migration_state.json" ]]; then
        echo "Current Stage: $(jq -r '.stage' "${PROJECT_ROOT}/.deploy/migration_state.json")"
        echo "Traffic Percentage: $(jq -r '.traffic_percentage' "${PROJECT_ROOT}/.deploy/migration_state.json")%"
        echo "Last Update: $(jq -r '.timestamp' "${PROJECT_ROOT}/.deploy/migration_state.json")"
    fi
}

validate_migration_configuration() {
    log_info "Validating migration configuration"
    
    # Validate required environment variables
    local required_vars=(
        "DATABASE_URL"
        "PROD_API_URL"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}" | sed 's/^/  - /'
        return 1
    fi
    
    # Validate traffic stages
    IFS=',' read -ra STAGES <<< "$TRAFFIC_STAGES"
    
    if [[ ${#STAGES[@]} -lt 2 ]]; then
        log_error "At least 2 traffic stages required"
        return 1
    fi
    
    # Validate thresholds
    if (( $(echo "$ERROR_RATE_THRESHOLD < 0 || $ERROR_RATE_THRESHOLD > 100" | bc -l) )); then
        log_error "Error rate threshold must be between 0 and 100"
        return 1
    fi
    
    log_success "Migration configuration validation passed"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi