#!/bin/bash

# Test Quick Actions buttons on Creator Dashboard
# This script verifies all Quick Action buttons route correctly

echo "================================================"
echo "Testing Quick Actions on Creator Dashboard"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL (local or production)
if [ -z "$1" ]; then
    BASE_URL="http://localhost:5173"
    echo "Testing locally at: $BASE_URL"
else
    BASE_URL="$1"
    echo "Testing at: $BASE_URL"
fi

echo ""
echo "Note: Make sure you're logged in as a creator before running this test"
echo "Demo creator: alex.creator@demo.com / Demo123"
echo ""
read -p "Press Enter to continue..."
echo ""

# Array of Quick Actions to test
declare -a QUICK_ACTIONS=(
    "Upload New Pitch|/creator/pitch/new|Create new pitch page"
    "Manage Pitches|/creator/pitches|View and manage all pitches"
    "View Analytics|/creator/analytics|Analytics dashboard"
    "NDA Management|/creator/ndas|Manage NDAs and requests"
    "View My Portfolio|/creator/portfolio|Public portfolio page"
    "Following|/creator/following|Users you follow"
    "Messages|/creator/messages|Messaging center"
    "Calendar|/creator/calendar|Event calendar"
    "Billing & Payments|/creator/billing|Billing and subscription management"
)

# Function to test a route
test_route() {
    local name=$1
    local route=$2
    local description=$3
    local full_url="${BASE_URL}${route}"
    
    echo -n "Testing: $name ($route) - "
    
    # Try to access the route (HEAD request to avoid downloading full page)
    response=$(curl -s -o /dev/null -w "%{http_code}" -I "$full_url" 2>/dev/null)
    
    if [ "$response" = "200" ] || [ "$response" = "304" ]; then
        echo -e "${GREEN}✓ PASS${NC} - $description"
        return 0
    elif [ "$response" = "404" ]; then
        echo -e "${RED}✗ FAIL${NC} - Route not found (404)"
        return 1
    elif [ "$response" = "401" ] || [ "$response" = "403" ]; then
        echo -e "${YELLOW}⚠ AUTH${NC} - Requires authentication"
        return 0
    elif [ "$response" = "302" ] || [ "$response" = "301" ]; then
        echo -e "${YELLOW}→ REDIRECT${NC} - Redirects (likely to login)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} - HTTP $response"
        return 1
    fi
}

# Track results
total=0
passed=0
failed=0
missing_routes=()

echo "Starting Quick Actions route tests..."
echo "======================================"
echo ""

# Test each Quick Action
for action in "${QUICK_ACTIONS[@]}"; do
    IFS='|' read -r name route description <<< "$action"
    test_route "$name" "$route" "$description"
    result=$?
    
    total=$((total + 1))
    if [ $result -eq 0 ]; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
        missing_routes+=("$route - $name")
    fi
    echo ""
done

# Summary
echo "======================================"
echo "Test Summary:"
echo "======================================"
echo -e "Total Quick Actions: $total"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$failed${NC}"
echo ""

if [ ${#missing_routes[@]} -gt 0 ]; then
    echo -e "${RED}Missing/Failed Routes:${NC}"
    for route in "${missing_routes[@]}"; do
        echo "  - $route"
    done
    echo ""
fi

# Additional route checks that Quick Actions might use
echo "======================================"
echo "Additional Creator Routes Check:"
echo "======================================"
echo ""

declare -a ADDITIONAL_ROUTES=(
    "Creator Dashboard|/creator/dashboard|Main dashboard"
    "Edit Pitch (example)|/creator/pitch/1/edit|Edit specific pitch"
    "Create Pitch|/create-pitch|Alternative create pitch route"
    "Saved Pitches|/creator/saved|Saved pitches"
    "Settings|/settings|User settings"
    "Profile Settings|/settings/profile|Profile settings"
)

for route_info in "${ADDITIONAL_ROUTES[@]}"; do
    IFS='|' read -r name route description <<< "$route_info"
    test_route "$name" "$route" "$description"
    echo ""
done

echo "======================================"
echo "Recommendations:"
echo "======================================"

if [ $failed -gt 0 ]; then
    echo -e "${YELLOW}Some Quick Actions are not routing correctly.${NC}"
    echo ""
    echo "Missing pages that need to be created or fixed:"
    for route in "${missing_routes[@]}"; do
        echo "  • $route"
    done
    echo ""
    echo "To fix:"
    echo "1. Check if routes are defined in App.tsx"
    echo "2. Verify page components exist"
    echo "3. Ensure proper imports and exports"
    echo "4. Check for typos in route paths"
else
    echo -e "${GREEN}All Quick Actions are routing correctly!${NC}"
fi

echo ""
echo "Test complete!"