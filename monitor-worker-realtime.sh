#!/bin/bash

# Real-time Cloudflare Worker Monitoring Script
# Monitors pitchey-api-prod.ndlovucavelle.workers.dev

echo "🔍 Real-time Worker Monitoring"
echo "=============================="
echo "API: pitchey-api-prod.ndlovucavelle.workers.dev"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
LOG_FILE="worker-monitor-$(date +%Y%m%d-%H%M%S).log"
ERROR_LOG="worker-errors-$(date +%Y%m%d-%H%M%S).log"

# Function to test endpoint
test_endpoint() {
    local path=$1
    local method=${2:-GET}
    local data=${3:-}
    
    local response
    local status
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n==STATUS==%{http_code}" "$API_URL$path" -X $method)
    else
        response=$(curl -s -w "\n==STATUS==%{http_code}" "$API_URL$path" -X $method -H "Content-Type: application/json" -d "$data")
    fi
    
    status=$(echo "$response" | grep "==STATUS==" | cut -d'=' -f4)
    body=$(echo "$response" | sed '/==STATUS==/d')
    
    echo "[$method] $path - Status: $status" >> "$LOG_FILE"
    
    if [ "$status" -ge 500 ]; then
        echo -e "${RED}[ERROR]${NC} $method $path - Status: $status"
        echo "[$(date)] ERROR: $method $path - Status: $status - Body: $body" >> "$ERROR_LOG"
    elif [ "$status" -ge 400 ]; then
        echo -e "${YELLOW}[CLIENT_ERROR]${NC} $method $path - Status: $status"
    else
        echo -e "${GREEN}[OK]${NC} $method $path - Status: $status"
    fi
    
    # Check for specific error patterns in response
    if echo "$body" | grep -q "TypeError\|ReferenceError\|undefined\|null"; then
        echo -e "${RED}[JS_ERROR]${NC} JavaScript error detected in response"
        echo "[$(date)] JS_ERROR: $path - $body" >> "$ERROR_LOG"
    fi
}

# Function to monitor health continuously
monitor_health() {
    while true; do
        response=$(curl -s "$API_URL/health")
        timestamp=$(date +"%Y-%m-%d %H:%M:%S")
        
        if echo "$response" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
            responseTime=$(echo "$response" | jq -r '.metrics.responseTime')
            connections=$(echo "$response" | jq -r '.metrics.activeConnections')
            errors=$(echo "$response" | jq -r '.errors | length')
            
            echo -e "${GREEN}[$timestamp]${NC} Health: OK | Response: ${responseTime}ms | Connections: $connections | Errors: $errors"
            
            # Check for degraded performance
            if [ "$responseTime" -gt 3000 ]; then
                echo -e "${YELLOW}⚠️  Slow response time: ${responseTime}ms${NC}"
            fi
            
            if [ "$errors" -gt 0 ]; then
                echo -e "${RED}⚠️  Errors detected:${NC}"
                echo "$response" | jq '.errors[]'
            fi
        else
            echo -e "${RED}[$timestamp]${NC} Health check failed"
            echo "[$(date)] HEALTH_CHECK_FAILED: $response" >> "$ERROR_LOG"
        fi
        
        sleep 5
    done
}

# Function to test critical endpoints
test_critical_endpoints() {
    echo -e "\n${CYAN}Testing Critical Endpoints...${NC}"
    
    # Public endpoints
    test_endpoint "/health" "GET"
    test_endpoint "/api/pitches?limit=5" "GET"
    test_endpoint "/api/auth/session" "GET"
    
    # Auth endpoints
    test_endpoint "/api/auth/sign-in" "POST" '{"email":"test@test.com","password":"test"}'
    
    # WebSocket test
    echo -e "\n${CYAN}Testing WebSocket...${NC}"
    wscat_available=$(command -v wscat &> /dev/null && echo "yes" || echo "no")
    if [ "$wscat_available" = "yes" ]; then
        timeout 2 wscat -c "wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws" 2>&1 | head -5
    else
        curl -s -I "$API_URL/ws" \
            -H "Connection: Upgrade" \
            -H "Upgrade: websocket" \
            -H "Sec-WebSocket-Version: 13" \
            -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" | grep "HTTP\|sec-websocket"
    fi
}

# Function to analyze error patterns
analyze_errors() {
    echo -e "\n${MAGENTA}Analyzing Error Patterns...${NC}"
    
    if [ -f "$ERROR_LOG" ]; then
        echo "Top error types:"
        grep -o "ERROR\|JS_ERROR\|HEALTH_CHECK_FAILED" "$ERROR_LOG" | sort | uniq -c | sort -rn
        
        echo -e "\nRecent errors:"
        tail -5 "$ERROR_LOG"
    else
        echo "No errors logged yet"
    fi
}

# Function to get usage statistics
get_statistics() {
    echo -e "\n${BLUE}API Statistics:${NC}"
    
    # Get Cloudflare analytics if available
    ACCOUNT_ID="002bd5c0e90ae753a387c60546cf6869"
    
    # Try to fetch worker analytics
    analytics=$(curl -s -X GET \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/analytics/stored" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$analytics" | jq -e '.success' > /dev/null 2>&1; then
        echo "$analytics" | jq '.result'
    else
        echo "Analytics not available"
    fi
}

# Main menu
echo "Select monitoring mode:"
echo "1. Real-time health monitoring (continuous)"
echo "2. Test critical endpoints (one-time)"
echo "3. Analyze error patterns"
echo "4. Get usage statistics"
echo "5. Full diagnostic (all tests)"

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo -e "\n${GREEN}Starting real-time monitoring...${NC}"
        echo "Press Ctrl+C to stop"
        monitor_health
        ;;
    2)
        test_critical_endpoints
        ;;
    3)
        test_critical_endpoints
        analyze_errors
        ;;
    4)
        get_statistics
        ;;
    5)
        test_critical_endpoints
        analyze_errors
        get_statistics
        echo -e "\n${GREEN}Starting real-time monitoring...${NC}"
        echo "Press Ctrl+C to stop"
        monitor_health
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}✅ Monitoring session saved to: $LOG_FILE${NC}"
[ -f "$ERROR_LOG" ] && echo -e "${YELLOW}⚠️  Errors logged to: $ERROR_LOG${NC}"