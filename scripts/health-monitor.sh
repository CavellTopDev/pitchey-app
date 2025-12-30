#!/bin/bash

# Health Monitoring Script for Pitchey Platform
# Continuously monitors system health and alerts on issues

set -e

# Configuration
API_URL=${API_URL:-"https://pitchey-api-prod.ndlovucavelle.workers.dev"}
CHECK_INTERVAL=${CHECK_INTERVAL:-30}  # seconds
ALERT_WEBHOOK=${ALERT_WEBHOOK:-""}   # Slack/Discord webhook URL
LOG_FILE="health-monitor.log"
METRICS_FILE="health-metrics.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Health status tracking
PREVIOUS_STATUS="unknown"
FAILURE_COUNT=0
FAILURE_THRESHOLD=3

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to send alert
send_alert() {
    local severity=$1
    local message=$2
    local details=$3
    
    if [ -n "$ALERT_WEBHOOK" ]; then
        payload=$(cat <<EOF
{
    "text": "🚨 Pitchey Health Alert",
    "blocks": [{
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "*Severity:* ${severity}\n*Message:* ${message}\n*Details:* ${details}"
        }
    }]
}
EOF
        )
        curl -X POST -H 'Content-type: application/json' --data "$payload" "$ALERT_WEBHOOK" 2>/dev/null
    fi
    
    log "ALERT [$severity]: $message - $details"
}

# Function to check basic health
check_basic_health() {
    response=$(curl -s -w "\n%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo "pass"
    else
        echo "fail:$http_code"
    fi
}

# Function to check readiness
check_readiness() {
    response=$(curl -s -w "\n%{http_code}" "${API_URL}/health/ready" 2>/dev/null || echo "000")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo "$body"
    else
        echo "{\"status\":\"not_ready\",\"http_code\":\"$http_code\"}"
    fi
}

# Function to check detailed health
check_detailed_health() {
    response=$(curl -s -w "\n%{http_code}" "${API_URL}/health/detailed" 2>/dev/null || echo "000")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "503" ]; then
        echo "$body"
    else
        echo "{\"status\":\"unknown\",\"http_code\":\"$http_code\"}"
    fi
}

# Function to collect metrics
collect_metrics() {
    metrics=$(curl -s "${API_URL}/health/metrics" 2>/dev/null || echo "")
    
    if [ -n "$metrics" ]; then
        echo "$metrics" > metrics.prom
        
        # Parse key metrics
        uptime=$(echo "$metrics" | grep "pitchey_uptime_seconds" | awk '{print $2}')
        users=$(echo "$metrics" | grep "pitchey_users_total" | awk '{print $2}')
        pitches=$(echo "$metrics" | grep "pitchey_pitches_total" | awk '{print $2}')
        
        cat > "$METRICS_FILE" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "uptime_seconds": ${uptime:-0},
    "total_users": ${users:-0},
    "total_pitches": ${pitches:-0}
}
EOF
    fi
}

# Function to analyze health status
analyze_health() {
    local health_data=$1
    local status=$(echo "$health_data" | jq -r '.status' 2>/dev/null || echo "unknown")
    local health_score=$(echo "$health_data" | jq -r '.healthScore' 2>/dev/null || echo "0")
    
    case "$status" in
        "healthy")
            echo -e "${GREEN}✅ HEALTHY${NC} (Score: $health_score/100)"
            FAILURE_COUNT=0
            ;;
        "degraded")
            echo -e "${YELLOW}⚠️  DEGRADED${NC} (Score: $health_score/100)"
            
            # Check specific failures
            db_status=$(echo "$health_data" | jq -r '.checks.database.status' 2>/dev/null)
            cache_status=$(echo "$health_data" | jq -r '.checks.cache.status' 2>/dev/null)
            
            if [ "$db_status" = "fail" ]; then
                send_alert "WARNING" "Database connectivity issue" "Database health check failed"
            fi
            
            if [ "$cache_status" = "fail" ]; then
                send_alert "INFO" "Cache connectivity issue" "Redis cache is unavailable"
            fi
            ;;
        "unhealthy"|"not_ready")
            echo -e "${RED}❌ UNHEALTHY${NC} (Score: $health_score/100)"
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
            
            if [ "$FAILURE_COUNT" -ge "$FAILURE_THRESHOLD" ]; then
                send_alert "CRITICAL" "Service unhealthy" "Service has been unhealthy for $FAILURE_COUNT consecutive checks"
            fi
            ;;
        *)
            echo -e "${RED}❓ UNKNOWN${NC}"
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
            ;;
    esac
    
    PREVIOUS_STATUS="$status"
}

# Function to display dashboard
display_dashboard() {
    clear
    echo "════════════════════════════════════════════════════════"
    echo "            PITCHEY HEALTH MONITOR DASHBOARD            "
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "API Endpoint: $API_URL"
    echo "Check Interval: ${CHECK_INTERVAL}s"
    echo "Current Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "────────────────────────────────────────────────────────"
    echo ""
}

# Function to run continuous monitoring
run_monitoring() {
    log "Starting health monitoring for $API_URL"
    
    while true; do
        display_dashboard
        
        # Basic health check
        echo -e "${BLUE}[1/4] Checking basic health...${NC}"
        basic_result=$(check_basic_health)
        if [[ "$basic_result" == "pass" ]]; then
            echo -e "  └─ ${GREEN}✓ Service is responding${NC}"
        else
            echo -e "  └─ ${RED}✗ Service not responding (${basic_result#fail:})${NC}"
        fi
        echo ""
        
        # Readiness check
        echo -e "${BLUE}[2/4] Checking readiness...${NC}"
        ready_data=$(check_readiness)
        ready_status=$(echo "$ready_data" | jq -r '.status' 2>/dev/null || echo "unknown")
        
        if [ "$ready_status" = "ready" ]; then
            echo -e "  └─ ${GREEN}✓ Service is ready${NC}"
            
            # Show component status
            db_status=$(echo "$ready_data" | jq -r '.checks.database.status' 2>/dev/null)
            redis_status=$(echo "$ready_data" | jq -r '.checks.redis.status' 2>/dev/null)
            storage_status=$(echo "$ready_data" | jq -r '.checks.storage.status' 2>/dev/null)
            
            [ -n "$db_status" ] && echo "      • Database: $db_status"
            [ -n "$redis_status" ] && echo "      • Redis: $redis_status"
            [ -n "$storage_status" ] && echo "      • Storage: $storage_status"
        else
            echo -e "  └─ ${YELLOW}⚠️  Service not ready${NC}"
        fi
        echo ""
        
        # Detailed health check
        echo -e "${BLUE}[3/4] Checking detailed health...${NC}"
        detailed_data=$(check_detailed_health)
        echo -n "  └─ Status: "
        analyze_health "$detailed_data"
        
        # Show response times
        db_time=$(echo "$detailed_data" | jq -r '.checks.database.responseTime' 2>/dev/null)
        cache_time=$(echo "$detailed_data" | jq -r '.checks.cache.responseTime' 2>/dev/null)
        api_time=$(echo "$detailed_data" | jq -r '.checks.api.responseTime' 2>/dev/null)
        
        echo ""
        echo "  Response Times:"
        [ -n "$db_time" ] && [ "$db_time" != "null" ] && echo "    • Database: ${db_time}ms"
        [ -n "$cache_time" ] && [ "$cache_time" != "null" ] && echo "    • Cache: ${cache_time}ms"
        [ -n "$api_time" ] && [ "$api_time" != "null" ] && echo "    • API Total: ${api_time}ms"
        echo ""
        
        # Collect metrics
        echo -e "${BLUE}[4/4] Collecting metrics...${NC}"
        collect_metrics
        
        if [ -f "$METRICS_FILE" ]; then
            uptime=$(jq -r '.uptime_seconds' "$METRICS_FILE")
            users=$(jq -r '.total_users' "$METRICS_FILE")
            pitches=$(jq -r '.total_pitches' "$METRICS_FILE")
            
            echo -e "  └─ ${GREEN}✓ Metrics collected${NC}"
            echo "      • Uptime: $(printf '%d days, %02d:%02d:%02d' $((uptime/86400)) $((uptime%86400/3600)) $((uptime%3600/60)) $((uptime%60)))"
            echo "      • Total Users: $users"
            echo "      • Total Pitches: $pitches"
        else
            echo -e "  └─ ${YELLOW}⚠️  Metrics unavailable${NC}"
        fi
        
        echo ""
        echo "────────────────────────────────────────────────────────"
        echo "Next check in ${CHECK_INTERVAL} seconds... (Press Ctrl+C to stop)"
        
        # Store snapshot
        if [ -n "$detailed_data" ]; then
            echo "$detailed_data" > "health-snapshot-$(date +%Y%m%d-%H%M%S).json"
            
            # Keep only last 100 snapshots
            ls -t health-snapshot-*.json 2>/dev/null | tail -n +101 | xargs rm -f 2>/dev/null
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Function to run single check
run_single_check() {
    echo "Running single health check for $API_URL"
    echo ""
    
    echo "Basic Health:"
    basic_result=$(check_basic_health)
    echo "  Status: $basic_result"
    echo ""
    
    echo "Readiness:"
    ready_data=$(check_readiness)
    echo "$ready_data" | jq '.' 2>/dev/null || echo "$ready_data"
    echo ""
    
    echo "Detailed Health:"
    detailed_data=$(check_detailed_health)
    echo "$detailed_data" | jq '.' 2>/dev/null || echo "$detailed_data"
    echo ""
    
    echo "Metrics:"
    collect_metrics
    if [ -f "$METRICS_FILE" ]; then
        cat "$METRICS_FILE" | jq '.' 2>/dev/null
    else
        echo "  Metrics unavailable"
    fi
}

# Main execution
main() {
    # Check dependencies
    if ! command -v curl &> /dev/null; then
        echo "Error: curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo "Warning: jq is not installed. Some features will be limited."
    fi
    
    # Parse arguments
    case "${1:-}" in
        "single")
            run_single_check
            ;;
        "monitor")
            run_monitoring
            ;;
        *)
            echo "Usage: $0 [single|monitor]"
            echo ""
            echo "  single  - Run a single health check and exit"
            echo "  monitor - Run continuous monitoring (default)"
            echo ""
            echo "Environment variables:"
            echo "  API_URL         - API endpoint to monitor (default: https://pitchey-api-prod.ndlovucavelle.workers.dev)"
            echo "  CHECK_INTERVAL  - Seconds between checks (default: 30)"
            echo "  ALERT_WEBHOOK   - Webhook URL for alerts (optional)"
            echo ""
            run_monitoring
            ;;
    esac
}

# Trap for clean exit
trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT TERM

# Run main function
main "$@"