#!/bin/bash

# Frontend Error Analysis Script
# Analyzes React errors from Cloudflare Pages deployment

echo "🔍 Frontend Error Analysis"
echo "=========================="
echo "URL: https://pitchey-5o8-66n.pages.dev"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

FRONTEND_URL="https://pitchey-5o8-66n.pages.dev"
REPORT_FILE="frontend-error-report-$(date +%Y%m%d-%H%M%S).md"

# Test frontend loading
echo -e "${CYAN}1. Testing Frontend Loading...${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
echo "Homepage HTTP Status: $response"

# Get HTML and check for common React errors
echo -e "\n${CYAN}2. Checking for React Errors...${NC}"
html=$(curl -s "$FRONTEND_URL")

# Check for specific error patterns
if echo "$html" | grep -q "useSyncExternalStore"; then
    echo -e "${RED}❌ Found useSyncExternalStore error reference${NC}"
fi

if echo "$html" | grep -q "React is not defined\|ReactDOM is not defined"; then
    echo -e "${RED}❌ React initialization error detected${NC}"
fi

# Check JavaScript files
echo -e "\n${CYAN}3. Analyzing JavaScript Bundle...${NC}"

# Get main JS file
js_files=$(echo "$html" | grep -o 'src="[^"]*\.js"' | cut -d'"' -f2)
for js_file in $js_files; do
    if [[ $js_file == /* ]]; then
        js_url="$FRONTEND_URL$js_file"
    else
        js_url="$js_file"
    fi
    
    echo "Checking: $js_url"
    js_size=$(curl -s -o /dev/null -w "%{size_download}" "$js_url")
    echo "  Size: $((js_size / 1024))KB"
done

# Check for chunk loading errors
echo -e "\n${CYAN}4. Testing Dynamic Imports...${NC}"
chunk_files=$(echo "$html" | grep -o 'chunk-[^"]*\.js' | head -5)
for chunk in $chunk_files; do
    chunk_url="$FRONTEND_URL/assets/$chunk"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$chunk_url")
    if [ "$status" -eq 200 ]; then
        echo -e "${GREEN}✓${NC} $chunk loaded successfully"
    else
        echo -e "${RED}✗${NC} $chunk failed to load (Status: $status)"
    fi
done

# Test React-specific endpoints
echo -e "\n${CYAN}5. Testing React Router Routes...${NC}"
routes=(
    "/"
    "/login"
    "/signup"
    "/browse"
    "/dashboard"
    "/creator-dashboard"
    "/investor-dashboard"
    "/production-dashboard"
)

for route in "${routes[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL$route")
    if [ "$response" -eq 200 ]; then
        echo -e "${GREEN}✓${NC} $route - OK"
    else
        echo -e "${RED}✗${NC} $route - Failed (Status: $response)"
    fi
done

# Check package.json dependencies
echo -e "\n${CYAN}6. Analyzing Dependencies...${NC}"
echo "Key React dependencies in package.json:"
grep -E "react|zustand|use-sync" frontend/package.json | head -10

# Generate report
echo -e "\n${CYAN}7. Generating Report...${NC}"

cat > "$REPORT_FILE" << EOF
# Frontend Error Analysis Report
**Date**: $(date)
**URL**: $FRONTEND_URL

## Error Summary
The main error affecting the frontend is:
\`\`\`
Uncaught TypeError: can't access property 'useSyncExternalStore', h is undefined
\`\`\`

## Root Cause Analysis
1. **Missing Polyfill**: React 18's \`useSyncExternalStore\` hook is not available in production build
2. **Zustand v5 Dependency**: Zustand v5 requires this hook for state management
3. **Build Configuration**: The production build may be missing the polyfill import

## Solution Applied
1. Installed \`use-sync-external-store\` package
2. Created \`react-global.ts\` to ensure React hooks are globally available
3. Imported polyfill before any React code in \`main.tsx\`

## Verification Steps
1. Build frontend with: \`npm run build\`
2. Deploy to Cloudflare: \`wrangler pages deploy frontend/dist\`
3. Test production URL for errors

## Current Status
- Frontend builds successfully locally
- Deployment to Cloudflare Pages successful
- Need to verify error is resolved in production

## Recommendations
1. Add error boundary components for better error handling
2. Implement Sentry for production error tracking
3. Add bundle size monitoring
4. Set up automated testing for production deployments
EOF

echo -e "${GREEN}✅ Report saved to: $REPORT_FILE${NC}"

# Final status check
echo -e "\n${BLUE}=== Final Status ===${NC}"
echo "1. Frontend URL: $FRONTEND_URL"
echo "2. Worker API: https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "3. Error Count: Check browser console for current errors"
echo ""
echo -e "${YELLOW}To monitor live errors:${NC}"
echo "1. Open browser DevTools"
echo "2. Navigate to $FRONTEND_URL"
echo "3. Check Console tab for errors"
echo "4. Check Network tab for failed requests"