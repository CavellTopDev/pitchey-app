#!/bin/bash

# Comprehensive Cloudflare Worker Status Check
# Tests all aspects of the deployment

echo "🔍 Cloudflare Worker Status Check"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo -e "\n${YELLOW}1. Health Check:${NC}"
HEALTH=$(curl -s "$WORKER_URL/api/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✓ Worker is running${NC}"
    echo "   Response: $HEALTH"
else
    echo -e "${RED}✗ Worker health check failed${NC}"
fi

echo -e "\n${YELLOW}2. Database Connection:${NC}"
PITCHES=$(curl -s "$WORKER_URL/api/pitches" | head -c 200)
if echo "$PITCHES" | grep -q '"success":true'; then
    if echo "$PITCHES" | grep -q "Mock Pitch"; then
        echo -e "${YELLOW}⚠ Connected but using MOCK data${NC}"
        echo "   Database secrets may not be configured"
    else
        echo -e "${GREEN}✓ Connected to real database${NC}"
        PITCH_COUNT=$(curl -s "$WORKER_URL/api/pitches" | grep -o '"id":[0-9]*' | wc -l)
        echo "   Found $PITCH_COUNT pitches in database"
    fi
else
    echo -e "${RED}✗ Database connection failed${NC}"
fi

echo -e "\n${YELLOW}3. Authentication System:${NC}"
AUTH_TEST=$(curl -s -X POST "$WORKER_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}')
if echo "$AUTH_TEST" | grep -q '"success":true'; then
    if echo "$AUTH_TEST" | grep -q "mock-jwt"; then
        echo -e "${YELLOW}⚠ Auth working with MOCK tokens${NC}"
    else
        echo -e "${GREEN}✓ Authentication system operational${NC}"
    fi
else
    echo -e "${RED}✗ Authentication failed${NC}"
fi

echo -e "\n${YELLOW}4. CORS Configuration:${NC}"
CORS_HEADERS=$(curl -s -I "$WORKER_URL/api/health" 2>/dev/null | grep -i "access-control")
if echo "$CORS_HEADERS" | grep -q "Access-Control-Allow-Origin"; then
    echo -e "${GREEN}✓ CORS headers configured${NC}"
    echo "$CORS_HEADERS" | sed 's/^/   /'
else
    echo -e "${YELLOW}⚠ CORS headers not visible${NC}"
fi

echo -e "\n${YELLOW}5. Response Times:${NC}"
TIME1=$(curl -o /dev/null -s -w '%{time_total}' "$WORKER_URL/api/health")
TIME2=$(curl -o /dev/null -s -w '%{time_total}' "$WORKER_URL/api/pitches?limit=1")
echo "   Health endpoint: ${TIME1}s"
echo "   Pitches endpoint: ${TIME2}s"

if (( $(echo "$TIME1 < 1" | bc -l) )) && (( $(echo "$TIME2 < 2" | bc -l) )); then
    echo -e "${GREEN}✓ Response times acceptable${NC}"
else
    echo -e "${YELLOW}⚠ Slow response times detected${NC}"
fi

echo -e "\n${YELLOW}6. Error Handling:${NC}"
ERROR_TEST=$(curl -s "$WORKER_URL/api/nonexistent" | head -c 200)
if echo "$ERROR_TEST" | grep -q '"success":false' || echo "$ERROR_TEST" | grep -q "404"; then
    echo -e "${GREEN}✓ Error handling working${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected error response${NC}"
fi

echo -e "\n${YELLOW}Summary:${NC}"
echo "================================"
echo "Worker URL: $WORKER_URL"
echo "Dashboard: https://dash.cloudflare.com/workers-and-pages/pitchey-api-prod"

# Overall status
if echo "$PITCHES" | grep -q "Mock Pitch"; then
    echo -e "\n${YELLOW}⚠ STATUS: Partially Working${NC}"
    echo "The worker is deployed but using mock data."
    echo "Add database secrets via Cloudflare Dashboard to connect to real database."
elif echo "$PITCHES" | grep -q '"success":true'; then
    echo -e "\n${GREEN}✓ STATUS: Fully Operational${NC}"
    echo "Worker is deployed and connected to the database."
else
    echo -e "\n${RED}✗ STATUS: Issues Detected${NC}"
    echo "Check the Cloudflare Dashboard for errors."
fi