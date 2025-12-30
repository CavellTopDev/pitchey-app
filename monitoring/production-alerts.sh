#!/bin/bash

# Production Alerting Setup for Pitchey
# Configures real-time monitoring with webhook alerts

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
ALERT_INTERVAL=300  # 5 minutes
WEBHOOK_URL="${WEBHOOK_URL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

echo -e "${BLUE}🚨 Setting up Production Alerting for Pitchey${NC}"
echo "============================================================"

# Function to send alert
send_alert() {
    local severity="$1"
    local message="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Prepare alert payload
    local payload=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "severity": "$severity",
  "service": "pitchey-production",
  "message": "$message",
  "url": "$API_URL",
  "version": "$(curl -s $API_URL/api/health | jq -r '.timestamp' || echo 'unknown')"
}
EOF
)
    
    echo -e "${RED}🚨 ALERT [$severity]: $message${NC}"
    
    # Send to webhook if configured
    if [[ -n "$WEBHOOK_URL" ]]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "$payload" > /dev/null || echo "Webhook failed"
    fi
    
    # Send to Slack if configured
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local slack_payload="{\"text\":\"🚨 **$severity ALERT**: $message\\n**Service**: pitchey-production\\n**Time**: $timestamp\"}"
        curl -s -X POST "$SLACK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "$slack_payload" > /dev/null || echo "Slack failed"
    fi
    
    # Log to file
    echo "[$timestamp] $severity: $message" >> "./alerts.log"
}

# Function to check health
check_health() {
    local response=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" "$API_URL/api/health" 2>/dev/null || echo "000:999")
    local status_code=$(echo "$response" | cut -d':' -f1)
    local response_time=$(echo "$response" | cut -d':' -f2)
    
    if [[ "$status_code" != "200" ]]; then
        send_alert "CRITICAL" "Health check failed - HTTP $status_code"
        return 1
    fi
    
    # Convert response time to milliseconds
    local response_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null || echo "0")
    
    # Alert if response time > 2 seconds
    if (( $(echo "$response_ms > 2000" | bc -l) )); then
        send_alert "WARNING" "Slow response time: ${response_ms}ms"
    fi
    
    echo -e "${GREEN}✅ Health OK: HTTP $status_code (${response_ms}ms)${NC}"
    return 0
}

# Function to check database performance
check_database() {
    local db_check=$(curl -s "$API_URL/api/health/database-performance" 2>/dev/null || echo '{"error":"failed"}')
    local using_hyperdrive=$(echo "$db_check" | jq -r '.performance.usingHyperdrive // false' 2>/dev/null)
    local query_latency=$(echo "$db_check" | jq -r '.performance.queryLatency // "unknown"' 2>/dev/null)
    
    if [[ "$using_hyperdrive" != "true" ]]; then
        send_alert "WARNING" "Hyperdrive not active - using direct connection"
    fi
    
    echo -e "${GREEN}✅ Database OK: Hyperdrive=$using_hyperdrive, Latency=$query_latency${NC}"
}

# Function to check error rates
check_error_rates() {
    local endpoints=("/api/health" "/api/pitches" "/api/ab-test/variant")
    local total_requests=0
    local error_count=0
    
    for endpoint in "${endpoints[@]}"; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint" 2>/dev/null || echo "000")
        total_requests=$((total_requests + 1))
        
        if [[ "$status" -ge "400" ]]; then
            error_count=$((error_count + 1))
        fi
    done
    
    if [[ $total_requests -gt 0 ]]; then
        local error_rate=$((error_count * 100 / total_requests))
        
        if [[ $error_rate -gt 50 ]]; then
            send_alert "CRITICAL" "High error rate: ${error_rate}%"
        elif [[ $error_rate -gt 20 ]]; then
            send_alert "WARNING" "Elevated error rate: ${error_rate}%"
        fi
        
        echo -e "${GREEN}✅ Error Rate OK: ${error_rate}%${NC}"
    fi
}

# Function to check A/B test results
check_ab_test() {
    local ab_results=$(curl -s "$API_URL/api/ab-test/results" 2>/dev/null || echo '{"error":"failed"}')
    local has_data=$(echo "$ab_results" | jq -r '.success // false' 2>/dev/null)
    
    if [[ "$has_data" == "true" ]]; then
        echo -e "${GREEN}✅ A/B Test OK: Data collection active${NC}"
    else
        echo -e "${YELLOW}⚠️ A/B Test: Insufficient data${NC}"
    fi
}

# Function to run continuous monitoring
run_monitoring() {
    echo -e "${YELLOW}🔄 Starting continuous monitoring (${ALERT_INTERVAL}s intervals)${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    
    while true; do
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S UTC')
        echo -e "${BLUE}[$timestamp] Running health checks...${NC}"
        
        check_health
        check_database  
        check_error_rates
        check_ab_test
        
        echo ""
        sleep $ALERT_INTERVAL
    done
}

# Main execution
main() {
    echo "Configuration:"
    echo "  API URL: $API_URL"
    echo "  Check Interval: ${ALERT_INTERVAL}s"
    echo "  Webhook: $([ -n "$WEBHOOK_URL" ] && echo "Configured" || echo "Not configured")"
    echo "  Slack: $([ -n "$SLACK_WEBHOOK" ] && echo "Configured" || echo "Not configured")"
    echo ""
    
    # Test initial connectivity
    echo "Testing initial connectivity..."
    if check_health; then
        echo -e "${GREEN}✅ Initial health check passed${NC}"
    else
        echo -e "${RED}❌ Initial health check failed${NC}"
        send_alert "CRITICAL" "Production monitoring startup - initial health check failed"
    fi
    
    echo ""
    echo "Setup complete! Options:"
    echo "  1. Run once: ./production-alerts.sh check"
    echo "  2. Continuous: ./production-alerts.sh monitor"
    echo "  3. Setup cron: ./production-alerts.sh cron"
    echo ""
    
    case "${1:-monitor}" in
        "check")
            echo "Running single check..."
            check_health && check_database && check_error_rates && check_ab_test
            ;;
        "monitor")
            run_monitoring
            ;;
        "cron")
            echo "To setup cron job, add this line to crontab:"
            echo "*/5 * * * * cd $(pwd) && ./production-alerts.sh check >> alerts.log 2>&1"
            ;;
        *)
            run_monitoring
            ;;
    esac
}

# Handle signals gracefully
trap 'echo -e "\n${YELLOW}Monitoring stopped.${NC}"; exit 0' INT TERM

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi