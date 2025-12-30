#!/bin/bash

# Production Health Monitor for Pitchey Worker
# Continuously monitors critical endpoints and connection pool health

# Configuration
BASE_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
CHECK_INTERVAL=60  # seconds
ALERT_THRESHOLD=3  # consecutive failures before alert

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
TOTAL_SUCCESS=0
TOTAL_FAILURES=0
CONSECUTIVE_FAILURES=0

# Endpoints to monitor
declare -a ENDPOINTS=(
    "/api/pitches/trending?limit=1"
    "/api/pitches/new?limit=1"
    "/api/pitches/public?limit=1"
    "/api/db-test"
)

# Function to check endpoint health
check_endpoint() {
    local endpoint=$1
    local url="${BASE_URL}${endpoint}"
    
    # Make request and capture response code
    response=$(curl -s -w "HTTPCODE:%{http_code}" -m 10 "$url")
    http_code=$(echo "$response" | grep -o "HTTPCODE:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTPCODE:[0-9]*$//')
    
    # Check if successful
    if [[ "$http_code" == "200" ]]; then
        # Check if response contains success:true
        if echo "$body" | grep -q '"success":true'; then
            return 0
        elif echo "$body" | grep -q '"success":false'; then
            # Extract error if present
            error=$(echo "$body" | jq -r '.error // "Unknown error"' 2>/dev/null)
            echo "API Error: $error"
            return 1
        else
            return 0  # No success field, but 200 OK
        fi
    else
        echo "HTTP $http_code"
        return 1
    fi
}

# Function to display statistics
display_stats() {
    local uptime_percentage=0
    if [[ $TOTAL_CHECKS -gt 0 ]]; then
        uptime_percentage=$(echo "scale=2; $TOTAL_SUCCESS * 100 / $TOTAL_CHECKS" | bc)
    fi
    
    echo ""
    echo -e "${BLUE}📊 Health Statistics${NC}"
    echo "===================="
    echo -e "Total Checks:    $TOTAL_CHECKS"
    echo -e "Successful:      ${GREEN}$TOTAL_SUCCESS${NC}"
    echo -e "Failed:          ${RED}$TOTAL_FAILURES${NC}"
    echo -e "Uptime:          ${uptime_percentage}%"
    echo -e "Consecutive Fails: $CONSECUTIVE_FAILURES"
    echo ""
}

# Function to send alert (customize as needed)
send_alert() {
    local message=$1
    echo -e "${RED}🚨 ALERT: $message${NC}"
    
    # Add your alerting mechanism here:
    # - Send to Slack webhook
    # - Send email
    # - Post to monitoring service
    # - Trigger PagerDuty
    
    # Example Slack webhook (uncomment and configure):
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"🚨 Pitchey Production Alert: $message\"}" \
    #   YOUR_SLACK_WEBHOOK_URL
}

# Main monitoring loop
echo -e "${BLUE}🔍 Pitchey Production Health Monitor${NC}"
echo "===================================="
echo "Monitoring: $BASE_URL"
echo "Check Interval: ${CHECK_INTERVAL}s"
echo "Alert Threshold: $ALERT_THRESHOLD consecutive failures"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
    echo -e "\n${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Running health checks..."
    
    all_passed=true
    failed_endpoints=()
    
    for endpoint in "${ENDPOINTS[@]}"; do
        printf "  %-40s ... " "$endpoint"
        
        if check_endpoint "$endpoint"; then
            echo -e "${GREEN}✓ OK${NC}"
        else
            echo -e "${RED}✗ FAILED${NC}"
            all_passed=false
            failed_endpoints+=("$endpoint")
        fi
    done
    
    # Update statistics
    ((TOTAL_CHECKS++))
    
    if $all_passed; then
        ((TOTAL_SUCCESS++))
        CONSECUTIVE_FAILURES=0
        echo -e "\n${GREEN}✅ All endpoints healthy${NC}"
    else
        ((TOTAL_FAILURES++))
        ((CONSECUTIVE_FAILURES++))
        
        echo -e "\n${YELLOW}⚠️  ${#failed_endpoints[@]} endpoint(s) failed${NC}"
        
        # Check if we need to send alert
        if [[ $CONSECUTIVE_FAILURES -ge $ALERT_THRESHOLD ]]; then
            alert_msg="$CONSECUTIVE_FAILURES consecutive failures detected! Failed endpoints: ${failed_endpoints[*]}"
            send_alert "$alert_msg"
        fi
    fi
    
    # Check for specific error patterns
    if [[ $CONSECUTIVE_FAILURES -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}Checking for known issues...${NC}"
        
        # Test database connection specifically
        db_response=$(curl -s "$BASE_URL/api/db-test" 2>/dev/null)
        
        if echo "$db_response" | grep -q "1016"; then
            echo -e "${RED}  ⚠️  Detected Error 1016: Connection pool exhaustion${NC}"
            send_alert "Connection pool exhaustion detected (Error 1016)"
        fi
        
        if echo "$db_response" | grep -q "hyperdrive_error"; then
            echo -e "${YELLOW}  ⚠️  Hyperdrive issues detected, using fallback connection${NC}"
        fi
    fi
    
    # Display statistics every 10 checks
    if [[ $(($TOTAL_CHECKS % 10)) -eq 0 ]]; then
        display_stats
    fi
    
    # Sleep until next check
    echo -e "\n${BLUE}Next check in ${CHECK_INTERVAL} seconds...${NC}"
    sleep $CHECK_INTERVAL
done