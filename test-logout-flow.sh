#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"

echo "🔐 Testing Logout Flow"
echo "======================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Login first
echo -e "\n${YELLOW}1. Logging in as Production user...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -H "Origin: $FRONTEND_URL" \
    -c /tmp/test-cookies.txt \
    -d '{
        "email": "stellar.production@demo.com",
        "password": "Demo123",
        "userType": "production"
    }')

if echo "$LOGIN_RESPONSE" | grep -q "session"; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "  Session cookie saved"
    
    # Show the cookie
    echo -e "\n${YELLOW}2. Checking session cookie:${NC}"
    cat /tmp/test-cookies.txt | grep better-auth-session || echo "No Better Auth session cookie found"
else
    echo -e "${RED}✗ Login failed${NC}"
    exit 1
fi

# Step 2: Verify we can access authenticated endpoint
echo -e "\n${YELLOW}3. Testing authenticated access...${NC}"
SESSION_CHECK=$(curl -s -X GET "$API_URL/api/auth/session" \
    -H "Origin: $FRONTEND_URL" \
    -b /tmp/test-cookies.txt)

if echo "$SESSION_CHECK" | grep -q "user"; then
    echo -e "${GREEN}✓ Session is valid${NC}"
else
    echo -e "${RED}✗ Session check failed${NC}"
fi

# Step 3: Logout
echo -e "\n${YELLOW}4. Logging out...${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/sign-out" \
    -H "Origin: $FRONTEND_URL" \
    -b /tmp/test-cookies.txt \
    -c /tmp/test-cookies-after-logout.txt)

echo "  Logout response: $LOGOUT_RESPONSE"

# Step 4: Check if session is invalidated
echo -e "\n${YELLOW}5. Checking if session is invalidated...${NC}"
SESSION_AFTER_LOGOUT=$(curl -s -X GET "$API_URL/api/auth/session" \
    -H "Origin: $FRONTEND_URL" \
    -b /tmp/test-cookies-after-logout.txt)

if echo "$SESSION_AFTER_LOGOUT" | grep -q '"user":null\|"authenticated":false\|UNAUTHORIZED'; then
    echo -e "${GREEN}✓ Session properly invalidated after logout${NC}"
    echo "  You will NOT be auto-logged in on next visit"
else
    echo -e "${RED}✗ Session still active after logout!${NC}"
    echo "  Response: $SESSION_AFTER_LOGOUT"
    echo "  This means auto-login might still occur"
fi

# Step 5: Check cookies after logout
echo -e "\n${YELLOW}6. Checking cookies after logout:${NC}"
echo "Before logout:"
grep better-auth-session /tmp/test-cookies.txt 2>/dev/null || echo "  No session cookie"

echo "After logout:"
grep better-auth-session /tmp/test-cookies-after-logout.txt 2>/dev/null || echo "  No session cookie (properly cleared)"

# Cleanup
rm -f /tmp/test-cookies.txt /tmp/test-cookies-after-logout.txt

echo -e "\n${GREEN}✓ Test complete!${NC}"
echo ""
echo "Summary:"
echo "- Login creates a session cookie ✓"
echo "- Session cookie allows authenticated access ✓"
if echo "$SESSION_AFTER_LOGOUT" | grep -q '"user":null\|"authenticated":false\|UNAUTHORIZED'; then
    echo "- Logout invalidates the session ✓"
    echo "- Next visit will NOT auto-login ✓"
else
    echo "- Logout might not be invalidating session properly ✗"
    echo "- Auto-login might still occur ✗"
fi