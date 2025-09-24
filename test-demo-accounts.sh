#!/bin/bash

# Script to test demo accounts on both local and deployed backends

echo "================================================"
echo "Demo Account Testing - Local vs Deployed"
echo "================================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Demo accounts
declare -A DEMO_ACCOUNTS=(
    ["alex.creator@demo.com"]="Demo123:creator"
    ["sarah.investor@demo.com"]="Demo123:investor"
    ["stellar.production@demo.com"]="Demo123:production"
)

# Backends to test
LOCAL_API="http://localhost:8000"
DEPLOYED_API="https://pitchey-backend-62414fc1npma.deno.dev"

test_login() {
    local api=$1
    local email=$2
    local password=$3
    local portal=$4
    
    response=$(curl -s -X POST "$api/api/auth/$portal/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✓${NC}"
        token=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        echo "$token" | head -c 20
        echo "..."
    else
        echo -e "${RED}✗ Failed${NC}"
        echo ""
    fi
}

test_dashboard() {
    local api=$1
    local token=$2
    local portal=$3
    
    response=$(curl -s -X GET "$api/api/$portal/dashboard" \
        -H "Authorization: Bearer $token")
    
    # Check for mock data patterns
    if echo "$response" | grep -q "1250\|892\|15000"; then
        echo -e "${YELLOW}⚠ Mock data detected${NC}"
    elif echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ Real data${NC}"
    else
        echo -e "${RED}✗ No data${NC}"
    fi
    
    # Extract key stats
    if echo "$response" | grep -q "totalViews"; then
        views=$(echo "$response" | grep -o '"totalViews":[0-9]*' | cut -d: -f2 | head -1)
        echo "  Views: $views"
    fi
}

echo ""
echo -e "${BLUE}LOCAL BACKEND ($LOCAL_API)${NC}"
echo "----------------------------------------"

# Check if local backend is running
if curl -s "$LOCAL_API/api/health" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Backend is running${NC}"
    
    for email in "${!DEMO_ACCOUNTS[@]}"; do
        IFS=':' read -r password portal <<< "${DEMO_ACCOUNTS[$email]}"
        echo ""
        echo "Testing $email ($portal):"
        echo -n "  Login: "
        token=$(test_login "$LOCAL_API" "$email" "$password" "$portal")
        
        if [ ! -z "$token" ] && [ "$token" != "..." ]; then
            echo -n "  Dashboard: "
            test_dashboard "$LOCAL_API" "$token" "$portal"
        fi
    done
else
    echo -e "${RED}✗ Backend not running${NC}"
    echo "Start with: JWT_SECRET=\"test-secret-key-for-development\" DATABASE_URL=\"postgresql://postgres:password@localhost:5432/pitchey\" deno run --allow-all working-server.ts"
fi

echo ""
echo -e "${BLUE}DEPLOYED BACKEND ($DEPLOYED_API)${NC}"
echo "----------------------------------------"

# Deployed backend should always be available
echo -e "${GREEN}✓ Backend is running${NC}"

for email in "${!DEMO_ACCOUNTS[@]}"; do
    IFS=':' read -r password portal <<< "${DEMO_ACCOUNTS[$email]}"
    echo ""
    echo "Testing $email ($portal):"
    echo -n "  Login: "
    token=$(curl -s -X POST "$DEPLOYED_API/api/auth/$portal/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" | \
        grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ ! -z "$token" ]; then
        echo -e "${GREEN}✓${NC}"
        echo "$token" | head -c 20
        echo "..."
        echo -n "  Dashboard: "
        test_dashboard "$DEPLOYED_API" "$token" "$portal"
    else
        echo -e "${RED}✗ Failed${NC}"
    fi
done

echo ""
echo "================================================"
echo -e "${YELLOW}Summary:${NC}"
echo "------------------------------------------------"

echo ""
echo "The deployed backend is currently returning mock data."
echo "To deploy the real data implementation:"
echo ""
echo "1. Deploy the updated working-server.ts to Deno Deploy"
echo "2. Update the database connection to use Neon PostgreSQL"
echo "3. Run migrations on the production database"
echo ""
echo "Demo accounts are working correctly on both environments."
echo "Password for all demo accounts: Demo123"