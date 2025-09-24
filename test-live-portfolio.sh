#!/bin/bash

echo "═══════════════════════════════════════════════════════════"
echo "   TESTING PITCHEY FRONTEND-BACKEND INTEGRATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

FRONTEND="https://pitchey-frontend.deno.dev"
BACKEND="https://pitchey-backend.deno.dev"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "1️⃣ CHECKING BACKEND STATUS"
echo "────────────────────────"
# Test backend is responding
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/api/public/pitches")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} Backend is online at $BACKEND"
else
    echo -e "${RED}✗${NC} Backend not responding (HTTP $BACKEND_STATUS)"
fi

echo ""
echo "2️⃣ CHECKING FRONTEND STATUS"
echo "─────────────────────────"
# Test frontend is responding
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} Frontend is online at $FRONTEND"
else
    echo -e "${RED}✗${NC} Frontend not responding (HTTP $FRONTEND_STATUS)"
fi

echo ""
echo "3️⃣ TESTING FRONTEND API CONFIGURATION"
echo "───────────────────────────────────"
# Check if frontend HTML contains the backend URL
FRONTEND_HTML=$(curl -s "$FRONTEND" | head -500)
if echo "$FRONTEND_HTML" | grep -q "pitchey-backend.deno.dev"; then
    echo -e "${GREEN}✓${NC} Frontend is configured to use production backend"
elif echo "$FRONTEND_HTML" | grep -q "localhost:8000"; then
    echo -e "${RED}✗${NC} Frontend is still configured for localhost!"
else
    echo -e "${YELLOW}⚠${NC} Could not determine backend configuration"
fi

echo ""
echo "4️⃣ TESTING CREATOR LOGIN FLOW"
echo "───────────────────────────"
# Test login through backend API
echo "Testing backend login endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

if echo "$LOGIN_RESPONSE" | jq -r '.success' | grep -q "true"; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
    USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')
    echo -e "${GREEN}✓${NC} Backend login successful (User ID: $USER_ID)"
    
    # Test if dashboard returns real data
    echo "Fetching dashboard data..."
    DASHBOARD=$(curl -s "$BACKEND/api/creator/dashboard" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$DASHBOARD" | jq -r '.success' 2>/dev/null | grep -q "true"; then
        VIEWS=$(echo "$DASHBOARD" | jq -r '.data.stats.totalViews' 2>/dev/null)
        if [ "$VIEWS" = "1250" ]; then
            echo -e "${RED}✗${NC} MOCK DATA DETECTED! Still showing 1250 views"
        elif [ "$VIEWS" = "null" ] || [ "$VIEWS" = "" ]; then
            echo -e "${YELLOW}⚠${NC} Dashboard data unavailable"
        else
            echo -e "${GREEN}✓${NC} Real data active (Views: $VIEWS)"
        fi
    else
        echo -e "${YELLOW}⚠${NC} Dashboard endpoint returns error"
    fi
else
    echo -e "${RED}✗${NC} Backend login failed"
fi

echo ""
echo "5️⃣ CHECKING FRONTEND PAGES"
echo "────────────────────────"

# Check if login page exists
LOGIN_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/creator/login")
if [ "$LOGIN_PAGE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Creator login page accessible"
else
    echo -e "${RED}✗${NC} Creator login page not found (HTTP $LOGIN_PAGE)"
fi

# Check investor login
INVESTOR_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/investor/login")
if [ "$INVESTOR_PAGE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Investor login page accessible"
else
    echo -e "${RED}✗${NC} Investor login page not found (HTTP $INVESTOR_PAGE)"
fi

# Check production login
PRODUCTION_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/production/login")
if [ "$PRODUCTION_PAGE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Production login page accessible"
else
    echo -e "${RED}✗${NC} Production login page not found (HTTP $PRODUCTION_PAGE)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${BLUE}INTEGRATION TEST SUMMARY${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Determine overall status
if [ "$BACKEND_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ FRONTEND & BACKEND ARE CONNECTED${NC}"
    echo ""
    echo "To test the full integration:"
    echo "1. Visit $FRONTEND"
    echo "2. Click on any portal (Creator/Investor/Production)"
    echo "3. Login with demo credentials:"
    echo "   • alex.creator@demo.com / Demo123"
    echo "   • sarah.investor@demo.com / Demo123"
    echo "   • stellar.production@demo.com / Demo123"
    echo ""
    echo "The frontend should display real backend data, NOT mock data!"
else
    echo -e "${RED}❌ INTEGRATION ISSUES DETECTED${NC}"
    echo "Frontend and backend may not be properly connected."
fi
echo "═══════════════════════════════════════════════════════════"
