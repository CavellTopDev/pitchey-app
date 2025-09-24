#!/bin/bash

echo "══════════════════════════════════════════════════════════════"
echo "      PITCHEY FRONTEND-BACKEND INTEGRATION ANALYSIS"
echo "══════════════════════════════════════════════════════════════"
echo ""

# URLs
FRONTEND="https://pitchey-frontend.deno.dev"
BACKEND_CURRENT="https://pitchey-backend.deno.dev"
BACKEND_OLD="https://pitchey-backend-62414fc1npma.deno.dev"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}🚨 CRITICAL ISSUE DETECTED!${NC}"
echo "─────────────────────────────────────"
echo ""
echo "The frontend JavaScript is configured to use:"
echo -e "${YELLOW}OLD URL:${NC} https://pitchey-backend-62414fc1npma.deno.dev"
echo ""
echo "But your current backend is deployed at:"
echo -e "${GREEN}NEW URL:${NC} https://pitchey-backend.deno.dev"
echo ""
echo -e "${RED}THE FRONTEND AND BACKEND ARE NOT CONNECTED!${NC}"
echo ""

echo "Testing both backend URLs..."
echo "─────────────────────────────────"

# Test OLD backend
echo -n "OLD Backend Status: "
OLD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_OLD/api/auth/creator/login" -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}')
if [ "$OLD_STATUS" = "401" ] || [ "$OLD_STATUS" = "200" ]; then
    echo -e "${YELLOW}Still responding (HTTP $OLD_STATUS)${NC}"
else
    echo -e "${RED}Not responding (HTTP $OLD_STATUS)${NC}"
fi

# Test CURRENT backend
echo -n "NEW Backend Status: "
NEW_STATUS=$(curl -s "$BACKEND_CURRENT/api/auth/creator/login" -X POST -H "Content-Type: application/json" -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | jq -r '.success')
if [ "$NEW_STATUS" = "true" ]; then
    echo -e "${GREEN}Working correctly ✓${NC}"
else
    echo -e "${RED}Not working${NC}"
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo -e "${BLUE}HOW TO FIX THIS:${NC}"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "The frontend needs to be updated to use the correct backend URL."
echo ""
echo "1. Update your frontend code to use:"
echo "   ${GREEN}https://pitchey-backend.deno.dev${NC}"
echo ""
echo "2. Look for API configuration in your frontend code"
echo "   (probably in a config file or environment variable)"
echo ""
echo "3. Change from:"
echo "   ${RED}https://pitchey-backend-62414fc1npma.deno.dev${NC}"
echo "   To:"
echo "   ${GREEN}https://pitchey-backend.deno.dev${NC}"
echo ""
echo "4. Rebuild and redeploy the frontend"
echo ""
echo "Once fixed, the frontend will display real data from your backend!"
echo "══════════════════════════════════════════════════════════════"
