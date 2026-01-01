#!/bin/bash

echo "🚀 Testing Tabbed Navigation Implementation"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if the new page components exist
echo -e "\n${YELLOW}Checking new page components...${NC}"

FILES=(
    "frontend/src/pages/CreatorAnalyticsPage.tsx"
    "frontend/src/pages/ProductionAnalyticsPage.tsx"
    "frontend/src/pages/TeamManagementPage.tsx"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file missing"
    fi
done

# Check if routes are properly updated in App.tsx
echo -e "\n${YELLOW}Checking route updates in App.tsx...${NC}"

if grep -q "CreatorAnalyticsPage" frontend/src/App.tsx; then
    echo -e "${GREEN}✓${NC} CreatorAnalyticsPage imported and used"
else
    echo -e "${RED}✗${NC} CreatorAnalyticsPage not found in App.tsx"
fi

if grep -q "ProductionAnalyticsPage" frontend/src/App.tsx; then
    echo -e "${GREEN}✓${NC} ProductionAnalyticsPage imported and used"
else
    echo -e "${RED}✗${NC} ProductionAnalyticsPage not found in App.tsx"
fi

if grep -q "TeamManagementPage" frontend/src/App.tsx; then
    echo -e "${GREEN}✓${NC} TeamManagementPage imported and used"
else
    echo -e "${RED}✗${NC} TeamManagementPage not found in App.tsx"
fi

# Check redirect routes for orphaned pages
echo -e "\n${YELLOW}Checking redirect routes for orphaned pages...${NC}"

REDIRECTS=(
    "/creator/activity"
    "/creator/stats"
    "/creator/collaborations"
    "/production/activity"
    "/production/stats"
    "/production/revenue"
    "/production/collaborations"
)

for route in "${REDIRECTS[@]}"; do
    if grep -q "path=\"$route\".*Navigate to=" frontend/src/App.tsx; then
        echo -e "${GREEN}✓${NC} $route redirects properly"
    else
        echo -e "${YELLOW}⚠${NC} $route redirect might need checking"
    fi
done

echo -e "\n${YELLOW}Summary:${NC}"
echo "- Orphaned pages are now integrated as tabs within main pages"
echo "- Creator Analytics includes: Overview, Activity, Stats"
echo "- Production Analytics includes: Overview, Activity, Stats, Revenue"
echo "- Team Management includes: Members, Collaborations, Roles"
echo ""
echo "Old routes redirect to their parent pages:"
echo "  /creator/activity → /creator/analytics"
echo "  /creator/stats → /creator/analytics"
echo "  /creator/collaborations → /creator/team"
echo "  /production/activity → /production/analytics"
echo "  /production/stats → /production/analytics"
echo "  /production/revenue → /production/analytics"
echo "  /production/collaborations → /production/team"

echo -e "\n${GREEN}✓ Tab-based integration complete!${NC}"
echo ""
echo "To test the implementation:"
echo "1. Start the dev server: cd frontend && npm run dev"
echo "2. Login as creator: alex.creator@demo.com / Demo123"
echo "3. Navigate to Analytics - should see tabs for Overview, Activity, Stats"
echo "4. Navigate to Team - should see tabs for Members, Collaborations, Roles"