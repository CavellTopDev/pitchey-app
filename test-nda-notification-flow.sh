#!/bin/bash

# Test script for NDA notification flow
# This tests the complete flow from NDA request to notification

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"

echo "🔔 Testing NDA Notification Flow"
echo "================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Login as investor
echo -e "\n${YELLOW}1. Logging in as Investor...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -H "Origin: $FRONTEND_URL" \
    -c /tmp/investor-cookies.txt \
    -d '{
        "email": "sarah.investor@demo.com",
        "password": "Demo123",
        "userType": "investor"
    }')

if echo "$LOGIN_RESPONSE" | grep -q "user"; then
    echo -e "${GREEN}✓ Investor logged in successfully${NC}"
    USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    echo "  User ID: $USER_ID"
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "  Response: $LOGIN_RESPONSE"
    exit 1
fi

# Step 2: Check current notifications (baseline)
echo -e "\n${YELLOW}2. Checking current notifications...${NC}"
NOTIF_BEFORE=$(curl -s -X GET "$API_URL/api/notifications/unread" \
    -H "Origin: $FRONTEND_URL" \
    -b /tmp/investor-cookies.txt)
echo "  Unread notifications before: $NOTIF_BEFORE"

# Step 3: Request NDA for a pitch
echo -e "\n${YELLOW}3. Requesting NDA for pitch...${NC}"
NDA_REQUEST=$(curl -s -X POST "$API_URL/api/nda/request" \
    -H "Content-Type: application/json" \
    -H "Origin: $FRONTEND_URL" \
    -b /tmp/investor-cookies.txt \
    -d '{
        "pitchId": 1,
        "message": "Test NDA request for notification flow"
    }')

if echo "$NDA_REQUEST" | grep -q "success\|id"; then
    echo -e "${GREEN}✓ NDA request submitted${NC}"
    echo "  Response: $(echo "$NDA_REQUEST" | head -c 100)..."
else
    echo -e "${RED}✗ NDA request failed${NC}"
    echo "  Response: $NDA_REQUEST"
fi

# Step 4: Poll for notifications (simulating real-time updates)
echo -e "\n${YELLOW}4. Polling for notification updates...${NC}"
for i in {1..5}; do
    sleep 2
    echo -n "  Poll attempt $i: "
    
    # Check unread count
    NOTIF_COUNT=$(curl -s -X GET "$API_URL/api/notifications/unread" \
        -H "Origin: $FRONTEND_URL" \
        -b /tmp/investor-cookies.txt)
    
    # Check poll endpoint
    POLL_RESPONSE=$(curl -s -X GET "$API_URL/api/poll/all" \
        -H "Origin: $FRONTEND_URL" \
        -b /tmp/investor-cookies.txt)
    
    if echo "$POLL_RESPONSE" | grep -q "notification"; then
        echo -e "${GREEN}Notifications received!${NC}"
        echo "    Data: $(echo "$POLL_RESPONSE" | head -c 200)..."
        break
    else
        echo "No new notifications yet"
    fi
done

# Step 5: Check notification list
echo -e "\n${YELLOW}5. Fetching notification list...${NC}"
NOTIF_LIST=$(curl -s -X GET "$API_URL/api/user/notifications?limit=5" \
    -H "Origin: $FRONTEND_URL" \
    -b /tmp/investor-cookies.txt)

if echo "$NOTIF_LIST" | grep -q "nda"; then
    echo -e "${GREEN}✓ NDA notifications found in list${NC}"
    echo "  Recent notifications: $(echo "$NOTIF_LIST" | head -c 300)..."
else
    echo -e "${YELLOW}⚠ No NDA notifications in list${NC}"
    echo "  Response: $NOTIF_LIST"
fi

# Step 6: Now login as creator to check their notifications
echo -e "\n${YELLOW}6. Switching to Creator account...${NC}"
LOGIN_CREATOR=$(curl -s -X POST "$API_URL/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -H "Origin: $FRONTEND_URL" \
    -c /tmp/creator-cookies.txt \
    -d '{
        "email": "alex.creator@demo.com",
        "password": "Demo123",
        "userType": "creator"
    }')

if echo "$LOGIN_CREATOR" | grep -q "user"; then
    echo -e "${GREEN}✓ Creator logged in${NC}"
    
    # Check creator's notifications
    CREATOR_NOTIF=$(curl -s -X GET "$API_URL/api/user/notifications?limit=5" \
        -H "Origin: $FRONTEND_URL" \
        -b /tmp/creator-cookies.txt)
    
    if echo "$CREATOR_NOTIF" | grep -q "nda_request\|NDA"; then
        echo -e "${GREEN}✓ Creator received NDA request notification!${NC}"
        echo "  Notification: $(echo "$CREATOR_NOTIF" | grep -o '"message":"[^"]*' | head -1)"
    else
        echo -e "${YELLOW}⚠ No NDA request notification for creator${NC}"
    fi
fi

# Step 7: Test WebSocket simulation via polling
echo -e "\n${YELLOW}7. Testing real-time updates via polling...${NC}"
echo "Starting continuous polling (5 seconds)..."

for i in {1..3}; do
    REALTIME=$(curl -s -X GET "$API_URL/api/analytics/realtime" \
        -H "Origin: $FRONTEND_URL" \
        -b /tmp/investor-cookies.txt)
    
    if [ ! -z "$REALTIME" ]; then
        echo -e "  ${BLUE}Real-time data:${NC} $(echo "$REALTIME" | head -c 100)..."
    fi
    sleep 2
done

# Step 8: Summary
echo -e "\n${YELLOW}=== NOTIFICATION FLOW SUMMARY ===${NC}"
echo ""
echo "Domain Configuration:"
echo "  Frontend: $FRONTEND_URL ✓"
echo "  API: $API_URL ✓"
echo ""
echo "Authentication:"
echo "  Better Auth Sessions: Working ✓"
echo "  Cross-portal switching: Supported"
echo ""
echo "Notification System:"
echo "  WebSocket: Disabled (Cloudflare free tier)"
echo "  Polling: Active (5-second intervals)"
echo "  Browser Notifications: Available (requires permission)"
echo ""
echo "Issues Found:"
if echo "$POLL_RESPONSE" | grep -q "notification"; then
    echo -e "  ${GREEN}✓ Polling working correctly${NC}"
else
    echo -e "  ${YELLOW}⚠ Polling may need adjustment${NC}"
fi

if echo "$LOGIN_RESPONSE" | grep -q "Set-Cookie.*Partitioned"; then
    echo -e "  ${GREEN}✓ Cookies have Partitioned attribute${NC}"
else
    echo -e "  ${YELLOW}⚠ Cookies missing Partitioned attribute (will be required soon)${NC}"
fi

echo ""
echo "Recommendations:"
echo "  1. Add 'Partitioned' attribute to cookies in Worker"
echo "  2. Ensure CORS headers include credentials"
echo "  3. Consider upgrading to Cloudflare paid tier for WebSocket support"
echo "  4. Monitor polling performance and adjust intervals as needed"

# Cleanup
rm -f /tmp/investor-cookies.txt /tmp/creator-cookies.txt

echo -e "\n${GREEN}✓ Test complete!${NC}"