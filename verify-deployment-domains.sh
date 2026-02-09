#!/bin/bash

echo "🔍 Verifying Pitchey Deployment Domains and Configuration"
echo "=========================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}1. Checking Frontend Deployments:${NC}"
echo "----------------------------------------"

# Check primary frontend
FRONTEND_PRIMARY="https://pitchey-5o8.pages.dev"
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_PRIMARY" | grep -q "200\|304"; then
    echo -e "${GREEN}✓ Primary Frontend: $FRONTEND_PRIMARY (Active)${NC}"
else
    echo -e "${RED}✗ Primary Frontend: $FRONTEND_PRIMARY (Not responding)${NC}"
fi

# Check latest deployment from wrangler
echo -e "\n${YELLOW}2. Checking Backend API Endpoints:${NC}"
echo "----------------------------------------"

# List of backend endpoints to check
BACKENDS=(
    "https://pitchey-api-prod.ndlovucavelle.workers.dev"
    "https://pitchey-api-prod.ndlovucavelle.workers.dev"
)

for BACKEND in "${BACKENDS[@]}"; do
    echo -n "Testing $BACKEND... "
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/api/health" 2>/dev/null)
    if [[ "$RESPONSE" == "200" ]] || [[ "$RESPONSE" == "404" ]]; then
        echo -e "${GREEN}Active (HTTP $RESPONSE)${NC}"
        
        # Test auth session endpoint
        AUTH_RESPONSE=$(curl -s "$BACKEND/api/auth/session" 2>/dev/null | head -c 100)
        echo "  └─ Auth endpoint: $AUTH_RESPONSE..."
    else
        echo -e "${RED}Not responding (HTTP $RESPONSE)${NC}"
    fi
done

echo -e "\n${YELLOW}3. Checking Cookie Configuration:${NC}"
echo "----------------------------------------"

# Test cookie headers
TEST_BACKEND="https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "Testing CORS and Cookie headers from $TEST_BACKEND:"

HEADERS=$(curl -s -I -X OPTIONS \
    -H "Origin: https://pitchey-5o8.pages.dev" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    "$TEST_BACKEND/api/auth/session" 2>/dev/null)

if echo "$HEADERS" | grep -q "Access-Control-Allow-Origin"; then
    CORS_ORIGIN=$(echo "$HEADERS" | grep "Access-Control-Allow-Origin" | cut -d: -f2- | tr -d '\r\n ')
    echo -e "  CORS Origin: ${GREEN}$CORS_ORIGIN${NC}"
fi

if echo "$HEADERS" | grep -q "Access-Control-Allow-Credentials"; then
    CORS_CREDS=$(echo "$HEADERS" | grep "Access-Control-Allow-Credentials" | cut -d: -f2- | tr -d '\r\n ')
    echo -e "  Allow Credentials: ${GREEN}$CORS_CREDS${NC}"
fi

echo -e "\n${YELLOW}4. Checking Environment Variables:${NC}"
echo "----------------------------------------"

# Check local env files
if [ -f "frontend/.env.production" ]; then
    echo "Frontend Production Environment:"
    grep "VITE_API_URL" frontend/.env.production || echo "  VITE_API_URL not set"
    grep "VITE_WS_URL" frontend/.env.production || echo "  VITE_WS_URL not set"
else
    echo -e "${RED}frontend/.env.production not found${NC}"
fi

echo -e "\n${YELLOW}5. Recommendations:${NC}"
echo "----------------------------------------"

# Determine primary backend
ACTIVE_BACKEND=""
for BACKEND in "${BACKENDS[@]}"; do
    if curl -s -o /dev/null -w "%{http_code}" "$BACKEND/api/health" 2>/dev/null | grep -q "200\|404"; then
        ACTIVE_BACKEND="$BACKEND"
        break
    fi
done

if [ -n "$ACTIVE_BACKEND" ]; then
    echo -e "${GREEN}✓ Active Backend Found: $ACTIVE_BACKEND${NC}"
    echo ""
    echo "To consolidate deployments, update frontend/.env.production:"
    echo "  VITE_API_URL=$ACTIVE_BACKEND"
    echo "  VITE_WS_URL=wss://$(echo $ACTIVE_BACKEND | sed 's|https://||')"
    echo ""
    echo "Then rebuild and deploy:"
    echo "  cd frontend"
    echo "  npm run build"
    echo "  wrangler pages deploy dist --project-name=pitchey"
else
    echo -e "${RED}✗ No active backend found. Please check deployments.${NC}"
fi

echo -e "\n${YELLOW}6. Testing Demo Account Login:${NC}"
echo "----------------------------------------"

if [ -n "$ACTIVE_BACKEND" ]; then
    echo "Testing production company login..."
    LOGIN_RESPONSE=$(curl -s -X POST "$ACTIVE_BACKEND/api/auth/sign-in" \
        -H "Content-Type: application/json" \
        -H "Origin: $FRONTEND_PRIMARY" \
        -d '{"email":"stellar.production@demo.com","password":"Demo123"}' 2>/dev/null)
    
    if echo "$LOGIN_RESPONSE" | grep -q "session\|user\|token"; then
        echo -e "${GREEN}✓ Authentication endpoint working${NC}"
        echo "  Response preview: $(echo "$LOGIN_RESPONSE" | head -c 100)..."
    else
        echo -e "${RED}✗ Authentication might have issues${NC}"
        echo "  Response: $LOGIN_RESPONSE"
    fi
fi

echo -e "\n=========================================================="
echo "Verification complete!"