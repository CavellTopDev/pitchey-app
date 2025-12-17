#!/bin/bash

# Deployment Verification Script
# This script verifies that all components are properly deployed and functioning

set -e

echo "🔍 Pitchey Platform - Deployment Verification"
echo "============================================="
echo ""

# Configuration
PRODUCTION_URL="${PRODUCTION_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey.pages.dev}"
ADMIN_TOKEN="${ADMIN_TOKEN}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
    local URL=$1
    local EXPECTED_STATUS=$2
    local DESCRIPTION=$3
    
    echo -n "  Checking $DESCRIPTION... "
    
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
    
    if [ "$STATUS" = "$EXPECTED_STATUS" ]; then
        echo -e "${GREEN}✓${NC} ($STATUS)"
        return 0
    else
        echo -e "${RED}✗${NC} (Expected: $EXPECTED_STATUS, Got: $STATUS)"
        return 1
    fi
}

# Function to check authenticated endpoint
check_auth_endpoint() {
    local URL=$1
    local TOKEN=$2
    local EXPECTED_STATUS=$3
    local DESCRIPTION=$4
    
    echo -n "  Checking $DESCRIPTION... "
    
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "$URL")
    
    if [ "$STATUS" = "$EXPECTED_STATUS" ]; then
        echo -e "${GREEN}✓${NC} ($STATUS)"
        return 0
    else
        echo -e "${RED}✗${NC} (Expected: $EXPECTED_STATUS, Got: $STATUS)"
        return 1
    fi
}

# Function to check response time
check_performance() {
    local URL=$1
    local MAX_TIME=$2
    local DESCRIPTION=$3
    
    echo -n "  Checking $DESCRIPTION... "
    
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$URL")
    RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d. -f1)
    
    if [ "$RESPONSE_MS" -lt "$MAX_TIME" ]; then
        echo -e "${GREEN}✓${NC} (${RESPONSE_MS}ms)"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} (${RESPONSE_MS}ms > ${MAX_TIME}ms)"
        return 1
    fi
}

# Track overall status
TOTAL_CHECKS=0
PASSED_CHECKS=0

echo "1. Infrastructure Health Checks"
echo "-------------------------------"

# Health endpoint
if check_endpoint "$PRODUCTION_URL/health" "200" "Health endpoint"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Database connectivity
if check_endpoint "$PRODUCTION_URL/health?check=database" "200" "Database connection"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Redis connectivity
if check_endpoint "$PRODUCTION_URL/health?check=redis" "200" "Redis connection"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Frontend
if check_endpoint "$FRONTEND_URL" "200" "Frontend homepage"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

echo ""
echo "2. API Endpoints"
echo "----------------"

# Public endpoints
if check_endpoint "$PRODUCTION_URL/api/pitches/trending" "200" "Trending pitches"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

if check_endpoint "$PRODUCTION_URL/api/pitches/featured" "200" "Featured pitches"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

if check_endpoint "$PRODUCTION_URL/api/genres" "200" "Genres endpoint"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Auth endpoints
if check_endpoint "$PRODUCTION_URL/api/auth/session" "401" "Session check (unauthenticated)"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

echo ""
echo "3. Performance Checks"
echo "---------------------"

# Response time checks
if check_performance "$PRODUCTION_URL/health" "500" "Health endpoint response time"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

if check_performance "$PRODUCTION_URL/api/pitches/trending" "1000" "API response time"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

if check_performance "$FRONTEND_URL" "2000" "Frontend load time"; then
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

echo ""
echo "4. Admin Endpoints (requires ADMIN_TOKEN)"
echo "------------------------------------------"

if [ -n "$ADMIN_TOKEN" ]; then
    if check_auth_endpoint "$PRODUCTION_URL/api/admin/cache/stats" "$ADMIN_TOKEN" "200" "Cache stats"; then
        ((PASSED_CHECKS++))
    fi
    ((TOTAL_CHECKS++))
    
    if check_auth_endpoint "$PRODUCTION_URL/metrics" "$ADMIN_TOKEN" "200" "Metrics endpoint"; then
        ((PASSED_CHECKS++))
    fi
    ((TOTAL_CHECKS++))
else
    echo "  ⏭️  Skipping admin checks (ADMIN_TOKEN not provided)"
fi

echo ""
echo "5. Security Headers"
echo "-------------------"

echo -n "  Checking CORS headers... "
CORS_HEADER=$(curl -s -I "$PRODUCTION_URL/health" | grep -i "access-control-allow-origin" || echo "")
if [ -n "$CORS_HEADER" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED_CHECKS++))
else
    echo -e "${RED}✗${NC} (Missing CORS headers)"
fi
((TOTAL_CHECKS++))

echo -n "  Checking security headers... "
CSP_HEADER=$(curl -s -I "$PRODUCTION_URL/health" | grep -i "content-security-policy" || echo "")
if [ -n "$CSP_HEADER" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED_CHECKS++))
else
    echo -e "${YELLOW}⚠${NC} (Missing CSP header)"
fi
((TOTAL_CHECKS++))

echo ""
echo "6. WebSocket Connection"
echo "-----------------------"

echo -n "  Testing WebSocket upgrade... "
WS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Upgrade: websocket" \
    -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
    -H "Sec-WebSocket-Version: 13" \
    "$PRODUCTION_URL/ws")

if [ "$WS_RESPONSE" = "101" ] || [ "$WS_RESPONSE" = "426" ]; then
    echo -e "${GREEN}✓${NC} (WebSocket available)"
    ((PASSED_CHECKS++))
else
    echo -e "${RED}✗${NC} (WebSocket not available)"
fi
((TOTAL_CHECKS++))

echo ""
echo "7. Cache Verification"
echo "---------------------"

# Test cache warming
echo -n "  Testing cache functionality... "
CACHE_TEST=$(curl -s "$PRODUCTION_URL/api/pitches/trending" -H "X-Cache-Test: true" -I | grep -i "x-cache-status" || echo "")
if [ -n "$CACHE_TEST" ]; then
    echo -e "${GREEN}✓${NC} (Cache active)"
    ((PASSED_CHECKS++))
else
    echo -e "${YELLOW}⚠${NC} (Cache status unknown)"
fi
((TOTAL_CHECKS++))

echo ""
echo "8. Database Migrations"
echo "----------------------"

echo -n "  Checking migration status... "
if [ -n "$DATABASE_URL" ]; then
    # Would run: deno run --allow-all src/db/migrate.ts status
    echo -e "${YELLOW}⚠${NC} (Requires DATABASE_URL)"
else
    echo -e "${YELLOW}⚠${NC} (DATABASE_URL not set)"
fi

echo ""
echo "================================================"
echo "Deployment Verification Results"
echo "================================================"
echo ""

# Calculate percentage
PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

# Determine overall status
if [ "$PERCENTAGE" -ge 90 ]; then
    echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL${NC}"
    echo "   Passed: $PASSED_CHECKS/$TOTAL_CHECKS checks ($PERCENTAGE%)"
    exit 0
elif [ "$PERCENTAGE" -ge 70 ]; then
    echo -e "${YELLOW}⚠️  DEPLOYMENT PARTIALLY SUCCESSFUL${NC}"
    echo "   Passed: $PASSED_CHECKS/$TOTAL_CHECKS checks ($PERCENTAGE%)"
    echo "   Some non-critical checks failed. Review and fix if needed."
    exit 0
else
    echo -e "${RED}❌ DEPLOYMENT FAILED${NC}"
    echo "   Passed: $PASSED_CHECKS/$TOTAL_CHECKS checks ($PERCENTAGE%)"
    echo "   Critical checks failed. Immediate action required."
    exit 1
fi