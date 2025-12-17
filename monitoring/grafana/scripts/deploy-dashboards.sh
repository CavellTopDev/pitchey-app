#!/bin/bash

# Grafana Dashboard Deployment Script for Pitchey Monitoring
# Deploys all dashboards, alerts, and data sources to Grafana Cloud

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
DASHBOARDS_DIR="$MONITORING_DIR/dashboards"
ALERTS_DIR="$MONITORING_DIR/alerts"
DATASOURCES_DIR="$MONITORING_DIR/datasources"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
check_env_vars() {
    local required_vars=(
        "GRAFANA_URL"
        "GRAFANA_API_KEY"
        "GRAFANA_ORG_ID"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        log_error "Please set these variables and try again."
        exit 1
    fi
}

# Make API call to Grafana
grafana_api() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    
    local curl_args=(
        -s
        -H "Authorization: Bearer $GRAFANA_API_KEY"
        -H "Content-Type: application/json"
        -H "X-Grafana-Org-Id: $GRAFANA_ORG_ID"
        -X "$method"
    )
    
    if [[ -n "$data" ]]; then
        curl_args+=(-d "$data")
    fi
    
    curl "${curl_args[@]}" "$GRAFANA_URL/api/$endpoint"
}

# Create or update data source
deploy_datasource() {
    local datasource_file="$1"
    local datasource_name
    
    if [[ ! -f "$datasource_file" ]]; then
        log_warning "Data source file not found: $datasource_file"
        return 1
    fi
    
    datasource_name=$(basename "$datasource_file" .json)
    log_info "Deploying data source: $datasource_name"
    
    # Check if data source exists
    local existing_datasource
    existing_datasource=$(grafana_api "GET" "datasources/name/$datasource_name" 2>/dev/null || echo "{}")
    
    if echo "$existing_datasource" | grep -q '"id"'; then
        log_info "Data source '$datasource_name' exists, updating..."
        local datasource_id
        datasource_id=$(echo "$existing_datasource" | jq -r '.id')
        
        local response
        response=$(grafana_api "PUT" "datasources/$datasource_id" "$(cat "$datasource_file")")
        
        if echo "$response" | grep -q '"message":"Datasource updated"'; then
            log_success "Data source '$datasource_name' updated successfully"
        else
            log_error "Failed to update data source '$datasource_name': $response"
            return 1
        fi
    else
        log_info "Creating new data source '$datasource_name'..."
        local response
        response=$(grafana_api "POST" "datasources" "$(cat "$datasource_file")")
        
        if echo "$response" | grep -q '"message":"Datasource added"'; then
            log_success "Data source '$datasource_name' created successfully"
        else
            log_error "Failed to create data source '$datasource_name': $response"
            return 1
        fi
    fi
}

# Create or update dashboard
deploy_dashboard() {
    local dashboard_file="$1"
    local dashboard_name
    
    if [[ ! -f "$dashboard_file" ]]; then
        log_warning "Dashboard file not found: $dashboard_file"
        return 1
    fi
    
    dashboard_name=$(basename "$dashboard_file" .json)
    log_info "Deploying dashboard: $dashboard_name"
    
    # Prepare dashboard payload
    local dashboard_json
    dashboard_json=$(jq '{
        dashboard: .dashboard,
        folderId: 0,
        overwrite: true,
        message: "Deployed by automation script"
    }' "$dashboard_file")
    
    local response
    response=$(grafana_api "POST" "dashboards/db" "$dashboard_json")
    
    if echo "$response" | grep -q '"status":"success"'; then
        local dashboard_uid
        dashboard_uid=$(echo "$response" | jq -r '.uid')
        log_success "Dashboard '$dashboard_name' deployed successfully (UID: $dashboard_uid)"
        
        # Save dashboard UID for later reference
        echo "$dashboard_name:$dashboard_uid" >> "$MONITORING_DIR/.dashboard_uids"
    else
        log_error "Failed to deploy dashboard '$dashboard_name': $response"
        return 1
    fi
}

# Deploy alert rules
deploy_alerts() {
    local alerts_file="$1"
    
    if [[ ! -f "$alerts_file" ]]; then
        log_warning "Alerts file not found: $alerts_file"
        return 1
    fi
    
    log_info "Deploying alert rules from: $(basename "$alerts_file")"
    
    # Deploy contact points
    local contact_points
    contact_points=$(jq -c '.contactPoints[]?' "$alerts_file" 2>/dev/null || echo "")
    
    if [[ -n "$contact_points" ]]; then
        while IFS= read -r contact_point; do
            if [[ -n "$contact_point" ]]; then
                local contact_name
                contact_name=$(echo "$contact_point" | jq -r '.name')
                log_info "Deploying contact point: $contact_name"
                
                local response
                response=$(grafana_api "POST" "alertmanager/grafana/config/api/v1/receivers" "$contact_point")
                
                if echo "$response" | grep -q '"message":"configuration created"' || echo "$response" | grep -q '"message":"contact point updated"'; then
                    log_success "Contact point '$contact_name' deployed successfully"
                else
                    log_warning "Contact point '$contact_name' may already exist or failed: $response"
                fi
            fi
        done <<< "$(echo "$contact_points" | jq -c '.')"
    fi
    
    # Deploy alert rules
    local alerts
    alerts=$(jq -c '.alerts[]?' "$alerts_file" 2>/dev/null || echo "")
    
    if [[ -n "$alerts" ]]; then
        while IFS= read -r alert_rule; do
            if [[ -n "$alert_rule" ]]; then
                local alert_title
                alert_title=$(echo "$alert_rule" | jq -r '.title')
                log_info "Deploying alert rule: $alert_title"
                
                # Prepare alert rule payload
                local alert_payload
                alert_payload=$(echo "$alert_rule" | jq '{
                    uid: .uid,
                    title: .title,
                    condition: .condition,
                    data: .data,
                    noDataState: .noDataState,
                    execErrState: .execErrState,
                    for: .for,
                    annotations: .annotations,
                    labels: .labels,
                    folderUID: "general"
                }')
                
                local response
                response=$(grafana_api "POST" "ruler/grafana/api/v1/rules/general" "$alert_payload")
                
                if echo "$response" | grep -q '"message":"rule created"' || echo "$response" | grep -q '"created"'; then
                    log_success "Alert rule '$alert_title' deployed successfully"
                else
                    log_warning "Alert rule '$alert_title' may already exist or failed: $response"
                fi
            fi
        done <<< "$(echo "$alerts" | jq -c '.')"
    fi
}

# Main deployment function
main() {
    log_info "Starting Grafana deployment for Pitchey monitoring..."
    
    # Check environment variables
    check_env_vars
    
    # Create tracking files
    mkdir -p "$MONITORING_DIR"
    : > "$MONITORING_DIR/.dashboard_uids"
    
    # Deploy data sources (if any)
    if [[ -d "$DATASOURCES_DIR" ]]; then
        log_info "Deploying data sources..."
        for datasource_file in "$DATASOURCES_DIR"/*.json; do
            if [[ -f "$datasource_file" ]]; then
                deploy_datasource "$datasource_file"
            fi
        done
    else
        log_info "No data sources directory found, skipping..."
    fi
    
    # Deploy dashboards
    if [[ -d "$DASHBOARDS_DIR" ]]; then
        log_info "Deploying dashboards..."
        for dashboard_file in "$DASHBOARDS_DIR"/*.json; do
            if [[ -f "$dashboard_file" ]]; then
                deploy_dashboard "$dashboard_file"
            fi
        done
    else
        log_error "Dashboards directory not found: $DASHBOARDS_DIR"
        exit 1
    fi
    
    # Deploy alerts
    if [[ -d "$ALERTS_DIR" ]]; then
        log_info "Deploying alerts..."
        for alerts_file in "$ALERTS_DIR"/*.json; do
            if [[ -f "$alerts_file" ]]; then
                deploy_alerts "$alerts_file"
            fi
        done
    else
        log_warning "Alerts directory not found: $ALERTS_DIR"
    fi
    
    log_success "Grafana deployment completed successfully!"
    log_info "Dashboard UIDs have been saved to: $MONITORING_DIR/.dashboard_uids"
    
    # Display summary
    echo
    log_info "Deployment Summary:"
    echo "  - Dashboards deployed: $(find "$DASHBOARDS_DIR" -name "*.json" | wc -l)"
    echo "  - Alert files processed: $(find "$ALERTS_DIR" -name "*.json" 2>/dev/null | wc -l)"
    echo "  - Grafana URL: $GRAFANA_URL"
    echo
    log_info "Next steps:"
    echo "  1. Verify dashboards in Grafana UI"
    echo "  2. Test alert notifications"
    echo "  3. Configure metrics collection: $SCRIPT_DIR/start-metrics-collection.sh"
}

# Help function
show_help() {
    cat << EOF
Grafana Dashboard Deployment Script for Pitchey

This script deploys Grafana dashboards, alerts, and data sources to Grafana Cloud.

Usage:
    $0 [OPTIONS]

Options:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    --dry-run       Show what would be deployed without making changes

Required Environment Variables:
    GRAFANA_URL         Your Grafana instance URL (e.g., https://your-org.grafana.net)
    GRAFANA_API_KEY     Your Grafana API key with admin permissions
    GRAFANA_ORG_ID      Your Grafana organization ID

Optional Environment Variables:
    SLACK_WEBHOOK_URL           Slack webhook for alert notifications
    ALERT_EMAIL_ADDRESSES       Email addresses for alerts (comma-separated)
    PAGERDUTY_INTEGRATION_KEY   PagerDuty integration key for critical alerts

Example:
    export GRAFANA_URL="https://your-org.grafana.net"
    export GRAFANA_API_KEY="your-api-key"
    export GRAFANA_ORG_ID="1"
    $0

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        --dry-run)
            log_info "DRY RUN MODE - No changes will be made"
            DRY_RUN=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function if not in dry-run mode
if [[ "${DRY_RUN:-false}" == "true" ]]; then
    log_info "Would deploy the following files:"
    find "$DASHBOARDS_DIR" -name "*.json" -exec basename {} \; | sed 's/^/  Dashboard: /'
    find "$ALERTS_DIR" -name "*.json" -exec basename {} \; 2>/dev/null | sed 's/^/  Alerts: /' || true
else
    main
fi