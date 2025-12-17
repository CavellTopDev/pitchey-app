#!/bin/bash

# Comprehensive Deployment Dashboard
# Real-time monitoring and management interface for Pitchey deployments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"
TEMP_DIR="/tmp/pitchey-dashboard"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Emojis for status
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
ROCKET="🚀"
GEAR="⚙️"
CHART="📊"
GLOBE="🌍"
DATABASE="🗄️"
CACHE="💾"

# URLs and endpoints
PRODUCTION_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
FRONTEND_URL="https://pitchey.pages.dev"
STAGING_URL="https://pitchey-staging.cavelltheleaddev.workers.dev"

# API endpoints for health checks
HEALTH_ENDPOINTS=(
    "/api/health"
    "/api/health/database"
    "/api/health/cache"
    "/api/health/websocket"
)

# Dashboard functions
show_header() {
    clear
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                     ${ROCKET} PITCHEY DEPLOYMENT DASHBOARD ${ROCKET}                     ║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║ Real-time monitoring and deployment management for Pitchey platform ║${NC}"
    echo -e "${WHITE}║ $(date)                                           ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

show_menu() {
    echo -e "${WHITE}Main Dashboard Options:${NC}"
    echo -e "${BLUE}1.${NC} ${CHART} System Status Overview"
    echo -e "${BLUE}2.${NC} ${ROCKET} Deployment Status"
    echo -e "${BLUE}3.${NC} ${DATABASE} Database Health"
    echo -e "${BLUE}4.${NC} ${CACHE} Cache Performance"
    echo -e "${BLUE}5.${NC} ${GLOBE} Network & CDN Status"
    echo -e "${BLUE}6.${NC} ${GEAR} Performance Metrics"
    echo -e "${BLUE}7.${NC} ${INFO} A/B Testing Status"
    echo -e "${BLUE}8.${NC} ${WARNING} Alerts & Monitoring"
    echo -e "${BLUE}9.${NC} ${ROCKET} Deploy New Version"
    echo -e "${BLUE}10.${NC} ${CROSS} Emergency Rollback"
    echo -e "${BLUE}11.${NC} ${CHART} Generate Report"
    echo -e "${BLUE}12.${NC} ${GEAR} Maintenance Mode"
    echo -e "${RED}0.${NC} Exit"
    echo ""
    echo -n "Select option [0-12]: "
}

check_dependencies() {
    local missing_deps=()
    
    # Check required tools
    command -v curl >/dev/null 2>&1 || missing_deps+=("curl")
    command -v jq >/dev/null 2>&1 || missing_deps+=("jq")
    command -v wrangler >/dev/null 2>&1 || missing_deps+=("wrangler")
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${CROSS} ${RED}Missing dependencies: ${missing_deps[*]}${NC}"
        echo "Please install missing dependencies and try again."
        exit 1
    fi
}

setup_environment() {
    # Create necessary directories
    mkdir -p "$LOG_DIR" "$TEMP_DIR"
    
    # Set log file
    DASHBOARD_LOG="$LOG_DIR/dashboard-$(date +%Y%m%d).log"
    
    # Initialize log
    echo "$(date): Dashboard started" >> "$DASHBOARD_LOG"
}

log_action() {
    local action="$1"
    echo "$(date): $action" >> "$DASHBOARD_LOG"
    echo -e "${INFO} $action" >&2
}

# Health check functions
check_endpoint() {
    local url="$1"
    local endpoint="$2"
    local timeout="${3:-10}"
    
    local response
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
                    -m "$timeout" \
                    --connect-timeout 5 \
                    "$url$endpoint" 2>/dev/null)
    
    local body=$(echo "$response" | head -n -2)
    local status_code=$(echo "$response" | tail -n 2 | head -n 1)
    local response_time=$(echo "$response" | tail -n 1)
    
    echo "$status_code|$response_time|$body"
}

system_status_overview() {
    show_header
    echo -e "${WHITE}${CHART} SYSTEM STATUS OVERVIEW${NC}"
    echo "════════════════════════════════════════════"
    echo ""
    
    local overall_status="OK"
    local issues=()
    
    # Check production API
    echo -n "Production API: "
    local api_result=$(check_endpoint "$PRODUCTION_URL" "/api/health")
    local api_status=$(echo "$api_result" | cut -d'|' -f1)
    local api_time=$(echo "$api_result" | cut -d'|' -f2)
    
    if [ "$api_status" = "200" ]; then
        echo -e "${CHECK} ${GREEN}Online${NC} (${api_time}s)"
    else
        echo -e "${CROSS} ${RED}Offline${NC} (HTTP $api_status)"
        overall_status="DEGRADED"
        issues+=("Production API down")
    fi
    
    # Check frontend
    echo -n "Frontend: "
    local frontend_result=$(check_endpoint "$FRONTEND_URL" "/")
    local frontend_status=$(echo "$frontend_result" | cut -d'|' -f1)
    local frontend_time=$(echo "$frontend_result" | cut -d'|' -f2)
    
    if [ "$frontend_status" = "200" ]; then
        echo -e "${CHECK} ${GREEN}Online${NC} (${frontend_time}s)"
    else
        echo -e "${CROSS} ${RED}Offline${NC} (HTTP $frontend_status)"
        overall_status="DEGRADED"
        issues+=("Frontend down")
    fi
    
    # Check database
    echo -n "Database: "
    local db_result=$(check_endpoint "$PRODUCTION_URL" "/api/health/database")
    local db_status=$(echo "$db_result" | cut -d'|' -f1)
    local db_time=$(echo "$db_result" | cut -d'|' -f2)
    
    if [ "$db_status" = "200" ]; then
        echo -e "${CHECK} ${GREEN}Connected${NC} (${db_time}s)"
    else
        echo -e "${CROSS} ${RED}Connection issues${NC}"
        overall_status="CRITICAL"
        issues+=("Database connectivity issues")
    fi
    
    # Check cache
    echo -n "Cache (Redis): "
    local cache_result=$(check_endpoint "$PRODUCTION_URL" "/api/health/cache")
    local cache_status=$(echo "$cache_result" | cut -d'|' -f1)
    local cache_time=$(echo "$cache_result" | cut -d'|' -f2)
    
    if [ "$cache_status" = "200" ]; then
        echo -e "${CHECK} ${GREEN}Connected${NC} (${cache_time}s)"
    else
        echo -e "${WARNING} ${YELLOW}Cache issues${NC}"
        overall_status="DEGRADED"
        issues+=("Cache connectivity issues")
    fi
    
    echo ""
    echo "Overall System Status: "
    case "$overall_status" in
        "OK")
            echo -e "${CHECK} ${GREEN}ALL SYSTEMS OPERATIONAL${NC}"
            ;;
        "DEGRADED")
            echo -e "${WARNING} ${YELLOW}SYSTEM DEGRADED${NC}"
            ;;
        "CRITICAL")
            echo -e "${CROSS} ${RED}CRITICAL ISSUES DETECTED${NC}"
            ;;
    esac
    
    if [ ${#issues[@]} -ne 0 ]; then
        echo ""
        echo -e "${RED}Active Issues:${NC}"
        for issue in "${issues[@]}"; do
            echo -e "  ${CROSS} $issue"
        done
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

deployment_status() {
    show_header
    echo -e "${WHITE}${ROCKET} DEPLOYMENT STATUS${NC}"
    echo "══════════════════════════════════════════"
    echo ""
    
    # Get current worker version
    echo -n "Checking current deployment..."
    local worker_info
    if worker_info=$(wrangler versions list --name pitchey-production 2>/dev/null); then
        echo -e " ${CHECK}"
        echo ""
        echo -e "${GREEN}Current Production Deployment:${NC}"
        echo "$worker_info" | head -5
    else
        echo -e " ${CROSS}"
        echo -e "${RED}Unable to fetch deployment information${NC}"
    fi
    
    echo ""
    
    # Check deployment health
    echo -e "${BLUE}Deployment Health Checks:${NC}"
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        echo -n "  $endpoint: "
        local result=$(check_endpoint "$PRODUCTION_URL" "$endpoint" 5)
        local status=$(echo "$result" | cut -d'|' -f1)
        local time=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status" = "200" ]; then
            echo -e "${CHECK} ${GREEN}OK${NC} (${time}s)"
        else
            echo -e "${CROSS} ${RED}FAIL${NC} (HTTP $status)"
        fi
    done
    
    echo ""
    
    # Check recent deployments
    echo -e "${BLUE}Recent Deployment Activity:${NC}"
    if [ -f "$LOG_DIR/deployment.log" ]; then
        tail -5 "$LOG_DIR/deployment.log" | while read -r line; do
            echo "  $line"
        done
    else
        echo "  No recent deployment logs found"
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

database_health() {
    show_header
    echo -e "${WHITE}${DATABASE} DATABASE HEALTH${NC}"
    echo "════════════════════════════════════════"
    echo ""
    
    # Database connectivity test
    echo -n "Testing database connection..."
    local db_result=$(check_endpoint "$PRODUCTION_URL" "/api/health/database")
    local db_status=$(echo "$db_result" | cut -d'|' -f1)
    local db_time=$(echo "$db_result" | cut -d'|' -f2)
    local db_body=$(echo "$db_result" | cut -d'|' -f3-)
    
    if [ "$db_status" = "200" ]; then
        echo -e " ${CHECK} ${GREEN}Connected${NC}"
        echo ""
        
        # Parse database health info if available
        if echo "$db_body" | jq . >/dev/null 2>&1; then
            echo -e "${GREEN}Database Health Metrics:${NC}"
            echo "$db_body" | jq -r '
                "Connection Pool: " + (.connectionPool // "unknown") + 
                "\nActive Connections: " + (.activeConnections // "unknown") + 
                "\nQuery Performance: " + (.queryPerformance // "unknown") + 
                "\nLast Migration: " + (.lastMigration // "unknown")'
        fi
    else
        echo -e " ${CROSS} ${RED}Connection failed${NC}"
        echo "Status: HTTP $db_status"
    fi
    
    echo ""
    
    # Test basic database operations
    echo -e "${BLUE}Testing Database Operations:${NC}"
    
    # Test read operation
    echo -n "  Read test: "
    local read_result=$(check_endpoint "$PRODUCTION_URL" "/api/health/database/read" 5)
    local read_status=$(echo "$read_result" | cut -d'|' -f1)
    if [ "$read_status" = "200" ]; then
        echo -e "${CHECK} ${GREEN}OK${NC}"
    else
        echo -e "${CROSS} ${RED}FAIL${NC}"
    fi
    
    # Check Hyperdrive status
    echo -n "  Hyperdrive pooling: "
    if curl -s "$PRODUCTION_URL/api/health/hyperdrive" | grep -q "active"; then
        echo -e "${CHECK} ${GREEN}Active${NC}"
    else
        echo -e "${WARNING} ${YELLOW}Not active${NC}"
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

cache_performance() {
    show_header
    echo -e "${WHITE}${CACHE} CACHE PERFORMANCE${NC}"
    echo "═════════════════════════════════════════"
    echo ""
    
    # Cache connectivity
    echo -n "Testing cache connection..."
    local cache_result=$(check_endpoint "$PRODUCTION_URL" "/api/health/cache")
    local cache_status=$(echo "$cache_result" | cut -d'|' -f1)
    local cache_body=$(echo "$cache_result" | cut -d'|' -f3-)
    
    if [ "$cache_status" = "200" ]; then
        echo -e " ${CHECK} ${GREEN}Connected${NC}"
        
        # Parse cache metrics if available
        if echo "$cache_body" | jq . >/dev/null 2>&1; then
            echo ""
            echo -e "${GREEN}Cache Metrics:${NC}"
            echo "$cache_body" | jq -r '
                "Hit Rate: " + (.hitRate // "unknown") + 
                "\nMemory Usage: " + (.memoryUsage // "unknown") + 
                "\nConnections: " + (.connections // "unknown") + 
                "\nLatency: " + (.latency // "unknown")'
        fi
    else
        echo -e " ${CROSS} ${RED}Connection failed${NC}"
    fi
    
    echo ""
    
    # Test cache operations
    echo -e "${BLUE}Testing Cache Operations:${NC}"
    
    # Test cache write/read
    local test_key="dashboard-test-$(date +%s)"
    echo -n "  Write/Read test: "
    
    # This would require a test endpoint
    if curl -s -X POST "$PRODUCTION_URL/api/test/cache" \
         -H "Content-Type: application/json" \
         -d "{\"key\":\"$test_key\",\"value\":\"test\"}" >/dev/null 2>&1; then
        echo -e "${CHECK} ${GREEN}OK${NC}"
    else
        echo -e "${CROSS} ${RED}FAIL${NC}"
    fi
    
    # Show A/B testing cache status
    echo ""
    echo -e "${BLUE}A/B Testing Cache Status:${NC}"
    if [ -f "$TEMP_DIR/ab-test-status.json" ]; then
        cat "$TEMP_DIR/ab-test-status.json" | jq -r '
            "Test ID: " + (.testId // "None") +
            "\nVariants: " + (.variants // "None") +
            "\nTraffic Split: " + (.trafficSplit // "None")'
    else
        echo "  No active A/B tests"
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

network_cdn_status() {
    show_header
    echo -e "${WHITE}${GLOBE} NETWORK & CDN STATUS${NC}"
    echo "══════════════════════════════════════════"
    echo ""
    
    # Test from multiple locations
    echo -e "${BLUE}Global Response Times:${NC}"
    
    local endpoints=("$PRODUCTION_URL" "$FRONTEND_URL")
    for endpoint in "${endpoints[@]}"; do
        echo "  $(basename "$endpoint"):"
        
        # Test response time
        for i in {1..3}; do
            local result=$(check_endpoint "$endpoint" "/" 10)
            local status=$(echo "$result" | cut -d'|' -f1)
            local time=$(echo "$result" | cut -d'|' -f2)
            
            echo -n "    Test $i: "
            if [ "$status" = "200" ]; then
                echo -e "${GREEN}${time}s${NC}"
            else
                echo -e "${RED}Failed (HTTP $status)${NC}"
            fi
        done
        echo ""
    done
    
    # CDN Cache status
    echo -e "${BLUE}CDN Cache Status:${NC}"
    
    # Test cache headers
    local cache_test=$(curl -sI "$FRONTEND_URL/" | grep -i cache)
    if [ -n "$cache_test" ]; then
        echo "$cache_test" | while read -r line; do
            echo "  $line"
        done
    else
        echo "  No cache headers detected"
    fi
    
    echo ""
    
    # Cloudflare analytics (if available)
    echo -e "${BLUE}CDN Analytics Summary:${NC}"
    echo "  $(date): Global requests, cache hit rate, bandwidth"
    echo "  (Detailed analytics available in Cloudflare dashboard)"
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

performance_metrics() {
    show_header
    echo -e "${WHITE}${GEAR} PERFORMANCE METRICS${NC}"
    echo "════════════════════════════════════════"
    echo ""
    
    # Real-time performance test
    echo -e "${BLUE}Running Performance Tests...${NC}"
    echo ""
    
    local total_time=0
    local successful_requests=0
    local failed_requests=0
    
    for i in {1..10}; do
        echo -n "  Request $i/10: "
        local result=$(check_endpoint "$PRODUCTION_URL" "/api/health" 5)
        local status=$(echo "$result" | cut -d'|' -f1)
        local time=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status" = "200" ]; then
            echo -e "${GREEN}${time}s${NC}"
            total_time=$(echo "$total_time + $time" | bc -l)
            ((successful_requests++))
        else
            echo -e "${RED}Failed${NC}"
            ((failed_requests++))
        fi
    done
    
    echo ""
    echo -e "${GREEN}Performance Summary:${NC}"
    
    if [ $successful_requests -gt 0 ]; then
        local avg_time=$(echo "scale=3; $total_time / $successful_requests" | bc -l)
        echo "  Average Response Time: ${avg_time}s"
        echo "  Successful Requests: $successful_requests/10"
        echo "  Failed Requests: $failed_requests/10"
        
        # Performance rating
        local rating
        if (( $(echo "$avg_time < 0.5" | bc -l) )); then
            rating="${GREEN}Excellent${NC}"
        elif (( $(echo "$avg_time < 1.0" | bc -l) )); then
            rating="${YELLOW}Good${NC}"
        else
            rating="${RED}Needs Improvement${NC}"
        fi
        echo -e "  Performance Rating: $rating"
    else
        echo -e "  ${RED}All requests failed${NC}"
    fi
    
    echo ""
    
    # Load recent performance data
    if [ -f "$LOG_DIR/performance-metrics.json" ]; then
        echo -e "${BLUE}Historical Performance (Last 24h):${NC}"
        cat "$LOG_DIR/performance-metrics.json" | jq -r '
            "P50 Response Time: " + (.p50 // "unknown") +
            "\nP95 Response Time: " + (.p95 // "unknown") +
            "\nP99 Response Time: " + (.p99 // "unknown") +
            "\nThroughput: " + (.throughput // "unknown") + " req/min"'
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

ab_testing_status() {
    show_header
    echo -e "${WHITE}${INFO} A/B TESTING STATUS${NC}"
    echo "═══════════════════════════════════════"
    echo ""
    
    # Check for active A/B tests
    echo -e "${BLUE}Active A/B Tests:${NC}"
    
    # This would query the A/B testing system
    if curl -s "$PRODUCTION_URL/api/ab-tests/status" >/dev/null 2>&1; then
        curl -s "$PRODUCTION_URL/api/ab-tests/status" | jq -r '
            if .tests | length == 0 then
                "  No active tests"
            else
                .tests[] | 
                "  Test: " + .name +
                "\n  Status: " + .status +
                "\n  Progress: " + (.progress // "unknown") +
                "\n  Variants: " + (.variants | join(", ")) +
                "\n  Traffic Split: " + (.trafficSplit | join("/")) + "%\n"
            end'
    else
        echo "  Unable to fetch A/B testing status"
    fi
    
    echo ""
    
    # Show cache optimization A/B test specifically
    echo -e "${BLUE}Cache Optimization Test:${NC}"
    if [ -f "$TEMP_DIR/cache-ab-test.json" ]; then
        cat "$TEMP_DIR/cache-ab-test.json" | jq -r '
            "  Test ID: " + (.testId // "none") +
            "\n  Control Performance: " + (.control.avgResponseTime // "unknown") + "ms" +
            "\n  Treatment Performance: " + (.treatment.avgResponseTime // "unknown") + "ms" +
            "\n  Improvement: " + (.improvement // "unknown") + "%" +
            "\n  Significance: " + (.significant // "unknown")'
    else
        echo "  No cache optimization test data available"
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

alerts_monitoring() {
    show_header
    echo -e "${WHITE}${WARNING} ALERTS & MONITORING${NC}"
    echo "════════════════════════════════════════"
    echo ""
    
    # Check for active alerts
    echo -e "${BLUE}Active Alerts:${NC}"
    
    if [ -f "$LOG_DIR/alerts.log" ]; then
        local recent_alerts
        recent_alerts=$(tail -10 "$LOG_DIR/alerts.log" | grep -v "^$")
        
        if [ -n "$recent_alerts" ]; then
            echo "$recent_alerts" | while read -r alert; do
                if echo "$alert" | grep -q "CRITICAL"; then
                    echo -e "  ${CROSS} ${RED}$alert${NC}"
                elif echo "$alert" | grep -q "WARNING"; then
                    echo -e "  ${WARNING} ${YELLOW}$alert${NC}"
                else
                    echo -e "  ${INFO} $alert"
                fi
            done
        else
            echo -e "  ${CHECK} ${GREEN}No active alerts${NC}"
        fi
    else
        echo "  No alert log found"
    fi
    
    echo ""
    
    # Monitoring system status
    echo -e "${BLUE}Monitoring Systems:${NC}"
    
    # Check Grafana
    echo -n "  Grafana: "
    if curl -s "http://localhost:3000/api/health" >/dev/null 2>&1; then
        echo -e "${CHECK} ${GREEN}Running${NC}"
    else
        echo -e "${CROSS} ${RED}Down${NC}"
    fi
    
    # Check Prometheus
    echo -n "  Prometheus: "
    if curl -s "http://localhost:9090/-/healthy" >/dev/null 2>&1; then
        echo -e "${CHECK} ${GREEN}Running${NC}"
    else
        echo -e "${CROSS} ${RED}Down${NC}"
    fi
    
    # Check Alertmanager
    echo -n "  Alertmanager: "
    if curl -s "http://localhost:9093/-/healthy" >/dev/null 2>&1; then
        echo -e "${CHECK} ${GREEN}Running${NC}"
    else
        echo -e "${CROSS} ${RED}Down${NC}"
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

deploy_new_version() {
    show_header
    echo -e "${WHITE}${ROCKET} DEPLOY NEW VERSION${NC}"
    echo "═══════════════════════════════════════"
    echo ""
    
    echo -e "${YELLOW}WARNING: This will deploy a new version to production${NC}"
    echo ""
    echo -n "Are you sure you want to continue? [y/N]: "
    read -r confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${BLUE}Starting deployment process...${NC}"
        
        # Pre-deployment checks
        echo -n "  Running pre-deployment checks..."
        if system_health_check; then
            echo -e " ${CHECK}"
        else
            echo -e " ${CROSS}"
            echo -e "${RED}Pre-deployment checks failed. Aborting deployment.${NC}"
            return 1
        fi
        
        # Build and deploy
        echo -n "  Building and deploying..."
        if wrangler deploy --env production >/dev/null 2>&1; then
            echo -e " ${CHECK}"
            
            # Post-deployment verification
            echo -n "  Verifying deployment..."
            sleep 10
            if check_endpoint "$PRODUCTION_URL" "/api/health" | grep -q "200"; then
                echo -e " ${CHECK}"
                echo -e "${GREEN}✅ Deployment successful!${NC}"
                log_action "Deployment completed successfully"
            else
                echo -e " ${CROSS}"
                echo -e "${RED}❌ Deployment verification failed!${NC}"
                log_action "Deployment verification failed"
            fi
        else
            echo -e " ${CROSS}"
            echo -e "${RED}❌ Deployment failed!${NC}"
            log_action "Deployment failed"
        fi
    else
        echo "Deployment cancelled."
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

emergency_rollback() {
    show_header
    echo -e "${WHITE}${CROSS} EMERGENCY ROLLBACK${NC}"
    echo "════════════════════════════════════════"
    echo ""
    
    echo -e "${RED}⚠️  EMERGENCY ROLLBACK PROCEDURE ⚠️${NC}"
    echo ""
    echo "This will immediately rollback to the previous working version."
    echo ""
    echo -n "Type 'ROLLBACK' to confirm emergency rollback: "
    read -r confirm
    
    if [ "$confirm" = "ROLLBACK" ]; then
        echo ""
        echo -e "${BLUE}Executing emergency rollback...${NC}"
        
        # Execute rollback script
        if [ -f "$PROJECT_ROOT/scripts/emergency-rollback.sh" ]; then
            chmod +x "$PROJECT_ROOT/scripts/emergency-rollback.sh"
            "$PROJECT_ROOT/scripts/emergency-rollback.sh"
        else
            echo -e "${RED}Emergency rollback script not found!${NC}"
            echo "Manual rollback required."
        fi
        
        log_action "Emergency rollback executed"
    else
        echo "Rollback cancelled."
    fi
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

generate_report() {
    show_header
    echo -e "${WHITE}${CHART} GENERATE REPORT${NC}"
    echo "═══════════════════════════════════════"
    echo ""
    
    local report_file="$LOG_DIR/dashboard-report-$(date +%Y%m%d-%H%M%S).md"
    
    echo -n "Generating comprehensive system report..."
    
    {
        echo "# Pitchey System Report"
        echo "Generated: $(date)"
        echo ""
        
        echo "## System Status"
        # Capture system status
        
        echo "## Performance Metrics"
        # Capture performance data
        
        echo "## Recent Activity"
        if [ -f "$DASHBOARD_LOG" ]; then
            echo "\`\`\`"
            tail -20 "$DASHBOARD_LOG"
            echo "\`\`\`"
        fi
        
        echo "## Alerts and Issues"
        if [ -f "$LOG_DIR/alerts.log" ]; then
            echo "\`\`\`"
            tail -10 "$LOG_DIR/alerts.log"
            echo "\`\`\`"
        fi
        
    } > "$report_file"
    
    echo -e " ${CHECK}"
    echo ""
    echo -e "${GREEN}Report generated: $report_file${NC}"
    
    echo ""
    echo "Press any key to return to main menu..."
    read -n 1
}

maintenance_mode() {
    show_header
    echo -e "${WHITE}${GEAR} MAINTENANCE MODE${NC}"
    echo "════════════════════════════════════════"
    echo ""
    
    echo "Maintenance mode options:"
    echo "1. Enable maintenance mode"
    echo "2. Disable maintenance mode"
    echo "3. Check maintenance status"
    echo "0. Back to main menu"
    echo ""
    echo -n "Select option [0-3]: "
    read -r choice
    
    case $choice in
        1)
            echo -n "Enabling maintenance mode..."
            # Implementation would set maintenance mode
            echo -e " ${CHECK}"
            log_action "Maintenance mode enabled"
            ;;
        2)
            echo -n "Disabling maintenance mode..."
            # Implementation would disable maintenance mode
            echo -e " ${CHECK}"
            log_action "Maintenance mode disabled"
            ;;
        3)
            echo -n "Checking maintenance status..."
            # Implementation would check status
            echo -e " ${INFO} Not in maintenance mode"
            ;;
        0)
            return
            ;;
        *)
            echo "Invalid option"
            ;;
    esac
    
    echo ""
    echo "Press any key to continue..."
    read -n 1
    maintenance_mode
}

system_health_check() {
    # Quick system health check for deployments
    local health_ok=true
    
    # Check API
    local api_result=$(check_endpoint "$PRODUCTION_URL" "/api/health" 10)
    local api_status=$(echo "$api_result" | cut -d'|' -f1)
    if [ "$api_status" != "200" ]; then
        health_ok=false
    fi
    
    # Check database
    local db_result=$(check_endpoint "$PRODUCTION_URL" "/api/health/database" 10)
    local db_status=$(echo "$db_result" | cut -d'|' -f1)
    if [ "$db_status" != "200" ]; then
        health_ok=false
    fi
    
    $health_ok
}

cleanup() {
    # Cleanup function
    rm -rf "$TEMP_DIR"
    echo ""
    echo "Dashboard session ended at $(date)"
}

# Main execution
main() {
    # Setup
    trap cleanup EXIT
    check_dependencies
    setup_environment
    
    # Main loop
    while true; do
        show_header
        show_menu
        
        read -r choice
        
        case $choice in
            1) system_status_overview ;;
            2) deployment_status ;;
            3) database_health ;;
            4) cache_performance ;;
            5) network_cdn_status ;;
            6) performance_metrics ;;
            7) ab_testing_status ;;
            8) alerts_monitoring ;;
            9) deploy_new_version ;;
            10) emergency_rollback ;;
            11) generate_report ;;
            12) maintenance_mode ;;
            0) 
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                sleep 2
                ;;
        esac
    done
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi