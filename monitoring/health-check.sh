#!/bin/bash

# Production Health Check Script
# Run this periodically to monitor application health

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="https://pitchey-backend-fresh.deno.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"
LOG_FILE="monitoring/health-check.log"
ALERT_FILE="monitoring/alerts.log"

# Create monitoring directory if it doesn't exist
mkdir -p monitoring

echo "================================================"
echo "Pitchey Production Health Check"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Function to log alerts
log_alert() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ALERT: $1" >> "$ALERT_FILE"
    echo -e "${RED}❌ ALERT: $1${NC}"
}

# 1. Check Backend Health
echo -e "\n${YELLOW}1. Checking Backend Health...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health" 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend Health: OK${NC}"
    
    # Parse JSON response
    STATUS=$(echo "$BODY" | jq -r '.data.status' 2>/dev/null)
    VERSION=$(echo "$BODY" | jq -r '.data.version' 2>/dev/null)
    CACHE_STATUS=$(echo "$BODY" | jq -r '.data.cache.status' 2>/dev/null)
    
    echo "   Status: $STATUS"
    echo "   Version: $VERSION"
    echo "   Cache: $CACHE_STATUS"
    log_message "Backend health check passed - Status: $STATUS, Version: $VERSION"
else
    log_alert "Backend health check failed - HTTP $HTTP_CODE"
fi

# 2. Check Frontend Availability
echo -e "\n${YELLOW}2. Checking Frontend Availability...${NC}"
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")

if [ "$FRONTEND_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Frontend: OK (HTTP $FRONTEND_CODE)${NC}"
    log_message "Frontend check passed - HTTP $FRONTEND_CODE"
else
    log_alert "Frontend check failed - HTTP $FRONTEND_CODE"
fi

# 3. Check Authentication Endpoint
echo -e "\n${YELLOW}3. Testing Authentication Endpoint...${NC}"
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BACKEND_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' 2>/dev/null)

if [ "$AUTH_RESPONSE" = "401" ] || [ "$AUTH_RESPONSE" = "400" ]; then
    echo -e "${GREEN}✅ Auth Endpoint: Responding correctly${NC}"
    log_message "Auth endpoint check passed"
else
    log_alert "Auth endpoint unexpected response - HTTP $AUTH_RESPONSE"
fi

# 4. Check Response Times
echo -e "\n${YELLOW}4. Measuring Response Times...${NC}"
BACKEND_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/api/health")
FRONTEND_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$FRONTEND_URL")

# Convert to milliseconds (using awk instead of bc for compatibility)
BACKEND_MS=$(awk "BEGIN {printf \"%.0f\", $BACKEND_TIME * 1000}")
FRONTEND_MS=$(awk "BEGIN {printf \"%.0f\", $FRONTEND_TIME * 1000}")

echo "   Backend Response: ${BACKEND_MS}ms"
echo "   Frontend Response: ${FRONTEND_MS}ms"

# Alert if response time is too high
if [ "$BACKEND_MS" -gt 1000 ]; then
    log_alert "Backend response time high: ${BACKEND_MS}ms"
else
    echo -e "   ${GREEN}✅ Backend performance: Good${NC}"
fi

if [ "$FRONTEND_MS" -gt 2000 ]; then
    log_alert "Frontend response time high: ${FRONTEND_MS}ms"
else
    echo -e "   ${GREEN}✅ Frontend performance: Good${NC}"
fi

log_message "Response times - Backend: ${BACKEND_MS}ms, Frontend: ${FRONTEND_MS}ms"

# 5. Check Public Pitches Endpoint
echo -e "\n${YELLOW}5. Checking Public Pitches Endpoint...${NC}"
PITCHES_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/pitches/public?limit=1" 2>/dev/null)
PITCHES_CODE=$(echo "$PITCHES_RESPONSE" | tail -n 1)

if [ "$PITCHES_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Public Pitches: Accessible${NC}"
    log_message "Public pitches endpoint check passed"
else
    log_alert "Public pitches endpoint failed - HTTP $PITCHES_CODE"
fi

# 6. Check CORS Headers
echo -e "\n${YELLOW}6. Checking CORS Configuration...${NC}"
CORS_HEADERS=$(curl -s -I "$BACKEND_URL/api/health" -H "Origin: $FRONTEND_URL" 2>/dev/null | grep -i "access-control-allow-origin")

if [[ $CORS_HEADERS == *"$FRONTEND_URL"* ]] || [[ $CORS_HEADERS == *"*"* ]]; then
    echo -e "${GREEN}✅ CORS: Properly configured${NC}"
    log_message "CORS check passed"
else
    log_alert "CORS not properly configured"
fi

# 7. Summary
echo -e "\n${YELLOW}================================================${NC}"
echo "Summary Report"
echo "================================================"

# Count alerts in the last hour
RECENT_ALERTS=$(grep "$(date '+%Y-%m-%d %H')" "$ALERT_FILE" 2>/dev/null | wc -l)

if [ "$RECENT_ALERTS" -eq 0 ]; then
    echo -e "${GREEN}✅ System Status: HEALTHY${NC}"
    echo "No alerts in the last hour"
else
    echo -e "${RED}⚠️  System Status: ISSUES DETECTED${NC}"
    echo "$RECENT_ALERTS alert(s) in the last hour"
    echo ""
    echo "Recent Alerts:"
    tail -n 5 "$ALERT_FILE" 2>/dev/null
fi

echo ""
echo "Log files:"
echo "  - Health checks: $LOG_FILE"
echo "  - Alerts: $ALERT_FILE"
echo ""
echo "Next check recommended in: 5 minutes"
echo "================================================"

# Exit with appropriate code
if [ "$RECENT_ALERTS" -eq 0 ]; then
    exit 0
else
    exit 1
fi