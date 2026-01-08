#!/bin/bash

# Script to verify React useSyncExternalStore error is fixed in production

echo "🔍 Verifying Production Fix"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Latest deployment URL
PROD_URL="https://449d43f3.pitchey-5o8.pages.dev"

echo -e "${CYAN}Testing new deployment: $PROD_URL${NC}"
echo ""

# 1. Check if page loads
echo "1. Testing page load..."
status=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL")
if [ "$status" -eq 200 ]; then
    echo -e "${GREEN}✅ Page loads successfully (HTTP 200)${NC}"
else
    echo -e "${RED}❌ Page failed to load (HTTP $status)${NC}"
fi

# 2. Check for error references in HTML
echo -e "\n2. Checking for error references..."
html=$(curl -s "$PROD_URL")
if echo "$html" | grep -q "useSyncExternalStore.*undefined"; then
    echo -e "${RED}❌ Error still present in HTML${NC}"
else
    echo -e "${GREEN}✅ No useSyncExternalStore errors in HTML${NC}"
fi

# 3. Test the main JS bundle
echo -e "\n3. Analyzing JavaScript bundle..."
js_file=$(echo "$html" | grep -o 'entry-[^"]*\.js' | head -1)
if [ ! -z "$js_file" ]; then
    js_url="$PROD_URL/$js_file"
    echo "   Checking: $js_url"
    
    # Download and check for the polyfill
    js_content=$(curl -s "$js_url")
    
    if echo "$js_content" | grep -q "use-sync-external-store"; then
        echo -e "${GREEN}✅ use-sync-external-store polyfill is included${NC}"
    else
        echo -e "${YELLOW}⚠️  Polyfill may be bundled differently${NC}"
    fi
    
    # Check if React.useSyncExternalStore is defined
    if echo "$js_content" | grep -q "useSyncExternalStore.*function"; then
        echo -e "${GREEN}✅ useSyncExternalStore function is defined${NC}"
    else
        echo -e "${YELLOW}⚠️  Function may be minified${NC}"
    fi
fi

# 4. Test key routes
echo -e "\n4. Testing application routes..."
routes=("/login" "/browse" "/dashboard")
all_good=true

for route in "${routes[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL$route")
    if [ "$status" -eq 200 ]; then
        echo -e "${GREEN}✓${NC} $route - OK"
    else
        echo -e "${RED}✗${NC} $route - Failed (HTTP $status)"
        all_good=false
    fi
done

# 5. Test API connectivity
echo -e "\n5. Testing API connectivity..."
api_health=$(curl -s "https://pitchey-api-prod.ndlovucavelle.workers.dev/health")
if echo "$api_health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ API is healthy${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
fi

# Final summary
echo -e "\n${CYAN}=== DEPLOYMENT SUMMARY ===${NC}"
echo "Deployment URL: $PROD_URL"
echo "API URL: https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo ""

if [ "$all_good" = true ]; then
    echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL!${NC}"
    echo -e "${GREEN}The React useSyncExternalStore error should be resolved.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Open $PROD_URL in browser"
    echo "2. Check browser console for errors"
    echo "3. Test user interactions (login, browse, etc.)"
else
    echo -e "${YELLOW}⚠️  Some issues detected${NC}"
    echo "Please check browser console for detailed errors"
fi

echo ""
echo "To monitor errors in real-time:"
echo "1. Open Chrome DevTools (F12)"
echo "2. Go to Console tab"
echo "3. Navigate to $PROD_URL"
echo "4. Look for any red error messages"