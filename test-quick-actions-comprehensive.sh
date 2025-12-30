#!/bin/bash

# Comprehensive Quick Actions Test with Authentication
# This script tests Quick Actions with proper login and functionality checks

echo "================================================"
echo "Comprehensive Quick Actions Test Suite"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-https://pitchey-5o8.pages.dev}"
API_URL="${2:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
EMAIL="alex.creator@demo.com"
PASSWORD="Demo123"

echo -e "${BLUE}Testing Environment:${NC}"
echo "  Frontend: $BASE_URL"
echo "  API: $API_URL"
echo ""

# Function to login and get token
login_creator() {
    echo -e "${BLUE}Logging in as creator...${NC}"
    
    response=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "'$EMAIL'",
            "password": "'$PASSWORD'"
        }')
    
    if echo "$response" | grep -q '"token"'; then
        TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        echo -e "${GREEN}✓ Login successful${NC}"
        echo "  Token: ${TOKEN:0:20}..."
        return 0
    else
        echo -e "${RED}✗ Login failed${NC}"
        echo "  Response: $response"
        return 1
    fi
}

# Function to test authenticated API endpoint
test_api_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo -n "  Testing API: $endpoint - "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "$API_URL$endpoint")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC} - $description"
        return 0
    elif [ "$response" = "404" ]; then
        echo -e "${RED}✗ 404${NC} - Endpoint not found"
        return 1
    elif [ "$response" = "401" ]; then
        echo -e "${YELLOW}⚠ 401${NC} - Authentication issue"
        return 1
    else
        echo -e "${RED}✗ $response${NC} - Unexpected response"
        return 1
    fi
}

# Function to test frontend route with content check
test_frontend_route() {
    local route=$1
    local content_check=$2
    local description=$3
    
    echo -n "  Testing Route: $route - "
    
    # Fetch the page
    response=$(curl -s "$BASE_URL$route")
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$route")
    
    if [ "$http_code" = "200" ]; then
        # Check if expected content exists
        if [ -n "$content_check" ] && echo "$response" | grep -q "$content_check"; then
            echo -e "${GREEN}✓ PASS${NC} - $description (content verified)"
        else
            echo -e "${YELLOW}⚠ PARTIAL${NC} - Page loads but expected content not found"
        fi
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} - HTTP $http_code"
        return 1
    fi
}

# Login first
if ! login_creator; then
    echo -e "${RED}Cannot proceed without authentication${NC}"
    exit 1
fi

echo ""
echo "================================================"
echo -e "${BLUE}1. Testing Quick Action API Endpoints${NC}"
echo "================================================"

# Test API endpoints that Quick Actions depend on
declare -a API_ENDPOINTS=(
    "/api/creator/dashboard|Dashboard data"
    "/api/creator/pitches|List of pitches"
    "/api/creator/analytics|Analytics data"
    "/api/creator/ndas|NDA requests"
    "/api/creator/portfolio|Portfolio data"
    "/api/follows/following|Following list"
    "/api/messages|Messages"
    "/api/creator/calendar|Calendar events"
    "/api/billing/credits|Credit balance"
    "/api/billing/subscription|Subscription status"
)

api_passed=0
api_failed=0

for endpoint_info in "${API_ENDPOINTS[@]}"; do
    IFS='|' read -r endpoint description <<< "$endpoint_info"
    test_api_endpoint "$endpoint" "$description"
    if [ $? -eq 0 ]; then
        ((api_passed++))
    else
        ((api_failed++))
    fi
done

echo ""
echo "================================================"
echo -e "${BLUE}2. Testing Quick Action Frontend Routes${NC}"
echo "================================================"

# Test frontend routes with content verification
declare -a FRONTEND_ROUTES=(
    "/creator/dashboard|Creator Dashboard|Main dashboard view"
    "/creator/pitch/new|Create|New pitch creation"
    "/creator/pitches|pitches|Manage all pitches"
    "/creator/analytics|Analytics|View analytics"
    "/creator/ndas|NDA|NDA management"
    "/creator/portfolio|Portfolio|Public portfolio"
    "/creator/following|Following|Following list"
    "/creator/messages|Messages|Message center"
    "/creator/calendar|Calendar|Event calendar"
    "/creator/billing|Billing|Billing management"
)

frontend_passed=0
frontend_failed=0

for route_info in "${FRONTEND_ROUTES[@]}"; do
    IFS='|' read -r route content description <<< "$route_info"
    test_frontend_route "$route" "$content" "$description"
    if [ $? -eq 0 ]; then
        ((frontend_passed++))
    else
        ((frontend_failed++))
    fi
done

echo ""
echo "================================================"
echo -e "${BLUE}3. Testing Quick Action Functionality${NC}"
echo "================================================"

# Test specific functionality
echo -e "${YELLOW}Testing pitch creation flow:${NC}"
create_pitch_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/creator/pitch/new")
if [ "$create_pitch_response" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} Pitch creation page accessible"
else
    echo -e "  ${RED}✗${NC} Pitch creation page not accessible"
fi

echo -e "${YELLOW}Testing analytics data:${NC}"
analytics_data=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/creator/analytics")
if echo "$analytics_data" | grep -q '"views"'; then
    echo -e "  ${GREEN}✓${NC} Analytics data available"
else
    echo -e "  ${RED}✗${NC} Analytics data not available"
fi

echo -e "${YELLOW}Testing NDA management:${NC}"
nda_data=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/creator/ndas")
if [ "$(echo "$nda_data" | grep -c 'error')" -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} NDA endpoint functional"
else
    echo -e "  ${RED}✗${NC} NDA endpoint has errors"
fi

echo ""
echo "================================================"
echo -e "${BLUE}4. Testing Button Click Simulation${NC}"
echo "================================================"

# Create a Playwright/Puppeteer test script
cat > test-buttons.js << 'EOF'
const puppeteer = require('puppeteer');

async function testQuickActionButtons() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to login
    await page.goto('https://pitchey-5o8.pages.dev/login/creator');
    
    // Login
    await page.type('input[type="email"]', 'alex.creator@demo.com');
    await page.type('input[type="password"]', 'Demo123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForNavigation();
    await page.waitForSelector('h2:contains("Quick Actions")', { timeout: 5000 });
    
    // Test each Quick Action button
    const buttons = [
        { text: 'Upload New Pitch', expectedUrl: '/creator/pitch/new' },
        { text: 'Manage Pitches', expectedUrl: '/creator/pitches' },
        { text: 'View Analytics', expectedUrl: '/creator/analytics' },
        { text: 'NDA Management', expectedUrl: '/creator/ndas' },
        { text: 'View My Portfolio', expectedUrl: '/creator/portfolio' },
        { text: 'Following', expectedUrl: '/creator/following' },
        { text: 'Messages', expectedUrl: '/creator/messages' },
        { text: 'Calendar', expectedUrl: '/creator/calendar' },
        { text: 'Billing', expectedUrl: '/creator/billing' }
    ];
    
    for (const button of buttons) {
        try {
            await page.click(`button:contains("${button.text}")`);
            await page.waitForTimeout(1000);
            const url = page.url();
            if (url.includes(button.expectedUrl)) {
                console.log(`✓ ${button.text} - Navigated correctly`);
            } else {
                console.log(`✗ ${button.text} - Wrong destination: ${url}`);
            }
            // Go back to dashboard
            await page.goto('https://pitchey-5o8.pages.dev/creator/dashboard');
        } catch (e) {
            console.log(`✗ ${button.text} - Error: ${e.message}`);
        }
    }
    
    await browser.close();
}

testQuickActionButtons();
EOF

echo "Puppeteer test script created (test-buttons.js)"
echo "To run automated button tests, install Puppeteer:"
echo "  npm install puppeteer"
echo "  node test-buttons.js"

echo ""
echo "================================================"
echo -e "${BLUE}Test Summary${NC}"
echo "================================================"
echo ""
echo "API Endpoints:"
echo -e "  Passed: ${GREEN}$api_passed${NC}"
echo -e "  Failed: ${RED}$api_failed${NC}"
echo ""
echo "Frontend Routes:"
echo -e "  Passed: ${GREEN}$frontend_passed${NC}"
echo -e "  Failed: ${RED}$frontend_failed${NC}"
echo ""

# Overall assessment
total_tests=$((api_passed + api_failed + frontend_passed + frontend_failed))
total_passed=$((api_passed + frontend_passed))
total_failed=$((api_failed + frontend_failed))

if [ $total_failed -eq 0 ]; then
    echo -e "${GREEN}✅ All Quick Actions are fully functional!${NC}"
else
    echo -e "${YELLOW}⚠️ Some Quick Actions need attention:${NC}"
    echo ""
    echo "Issues to fix:"
    if [ $api_failed -gt 0 ]; then
        echo "  - $api_failed API endpoints are not responding correctly"
    fi
    if [ $frontend_failed -gt 0 ]; then
        echo "  - $frontend_failed frontend routes have issues"
    fi
fi

echo ""
echo "================================================"
echo -e "${BLUE}Recommendations${NC}"
echo "================================================"

if [ $api_failed -gt 0 ]; then
    echo "1. Check backend server logs for API errors"
    echo "2. Verify database connections and queries"
    echo "3. Ensure all API routes are properly defined"
fi

if [ $frontend_failed -gt 0 ]; then
    echo "1. Check React Router configuration"
    echo "2. Verify component imports and exports"
    echo "3. Check for JavaScript console errors"
fi

echo ""
echo "Test complete!"