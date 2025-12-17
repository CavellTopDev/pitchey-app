#!/bin/bash

# Pitchey Production Health Check Script
# Run this as a cron job every 5 minutes to monitor worker health

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
WEBHOOK_URL="" # Add Slack/Discord webhook URL for alerts
LOG_FILE="/var/log/pitchey-health.log"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to send alert
send_alert() {
    local message=$1
    local status=$2
    
    # Log to file
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$status] $message" >> "$LOG_FILE"
    
    # Send to webhook if configured
    if [[ -n "$WEBHOOK_URL" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚨 Pitchey Alert: $message\"}" \
            2>/dev/null
    fi
}

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [[ "$http_code" -eq "$expected_status" ]]; then
        echo -e "${GREEN}✓${NC} $description: OK ($http_code)"
        return 0
    else
        echo -e "${RED}✗${NC} $description: FAILED ($http_code)"
        send_alert "$description failed with status $http_code" "ERROR"
        return 1
    fi
}

# Function to check database health
check_database() {
    response=$(curl -s "$API_URL/api/health" 2>/dev/null)
    db_status=$(echo "$response" | jq -r '.database' 2>/dev/null)
    
    if [[ "$db_status" == "true" ]]; then
        echo -e "${GREEN}✓${NC} Database: Connected"
        return 0
    else
        echo -e "${RED}✗${NC} Database: Disconnected"
        send_alert "Database connection lost" "CRITICAL"
        return 1
    fi
}

# Function to check response time
check_response_time() {
    start_time=$(date +%s%N)
    curl -s "$API_URL/api/health" > /dev/null 2>&1
    end_time=$(date +%s%N)
    
    response_time=$(( (end_time - start_time) / 1000000 ))
    
    if [[ $response_time -lt 1000 ]]; then
        echo -e "${GREEN}✓${NC} Response Time: ${response_time}ms"
    elif [[ $response_time -lt 3000 ]]; then
        echo -e "${YELLOW}⚠${NC} Response Time: ${response_time}ms (slow)"
        send_alert "Slow response time: ${response_time}ms" "WARNING"
    else
        echo -e "${RED}✗${NC} Response Time: ${response_time}ms (critical)"
        send_alert "Critical response time: ${response_time}ms" "CRITICAL"
    fi
}

# Function to test authentication
test_authentication() {
    response=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"alex.creator@demo.com","password":"Demo123"}' 2>/dev/null)
    
    success=$(echo "$response" | jq -r '.success' 2>/dev/null)
    
    if [[ "$success" == "true" ]]; then
        echo -e "${GREEN}✓${NC} Authentication: Working"
        return 0
    else
        echo -e "${RED}✗${NC} Authentication: Failed"
        send_alert "Authentication system failure" "CRITICAL"
        return 1
    fi
}

# Main monitoring function
main() {
    echo "================================================"
    echo "Pitchey Production Health Check"
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "================================================"
    
    total_checks=0
    failed_checks=0
    
    # Run health checks
    check_endpoint "/api/health" 200 "Health Endpoint"
    ((total_checks++))
    [[ $? -ne 0 ]] && ((failed_checks++))
    
    check_database
    ((total_checks++))
    [[ $? -ne 0 ]] && ((failed_checks++))
    
    check_response_time
    ((total_checks++))
    
    test_authentication
    ((total_checks++))
    [[ $? -ne 0 ]] && ((failed_checks++))
    
    # Check critical endpoints
    check_endpoint "/api/pitches/browse/enhanced?limit=1" 200 "Browse Endpoint"
    ((total_checks++))
    [[ $? -ne 0 ]] && ((failed_checks++))
    
    check_endpoint "/api/config/genres" 200 "Config Endpoint"
    ((total_checks++))
    [[ $? -ne 0 ]] && ((failed_checks++))
    
    # Summary
    echo "================================================"
    if [[ $failed_checks -eq 0 ]]; then
        echo -e "${GREEN}✓ All checks passed ($total_checks/$total_checks)${NC}"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK] All health checks passed" >> "$LOG_FILE"
    else
        echo -e "${RED}✗ $failed_checks/$total_checks checks failed${NC}"
        send_alert "Health check failed: $failed_checks/$total_checks checks failed" "ERROR"
    fi
    echo "================================================"
    
    exit $failed_checks
}

# Create log file if it doesn't exist
mkdir -p $(dirname "$LOG_FILE")
touch "$LOG_FILE"

# Run main function
main