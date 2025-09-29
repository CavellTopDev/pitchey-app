#!/bin/bash

# Test script for NDA button states on marketplace
# This script tests the different NDA request states and button appearances

API_URL="http://localhost:8001/api"
FRONTEND_URL="http://localhost:5173"

echo "========================================="
echo "Testing NDA Button States"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check NDA status for a pitch (unauthenticated)
echo -e "${BLUE}Test 1: Check NDA status without authentication${NC}"
RESPONSE=$(curl -s "$API_URL/ndas/pitch/46/status")
echo "Response: $RESPONSE"
echo ""

# Test 2: Login as investor
echo -e "${BLUE}Test 2: Login as investor${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
if [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to login${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Logged in successfully${NC}"
echo ""

# Test 3: Check if investor can request NDA
echo -e "${BLUE}Test 3: Check if investor can request NDA for pitch 46${NC}"
CAN_REQUEST=$(curl -s "$API_URL/ndas/pitch/46/can-request" \
  -H "Authorization: Bearer $TOKEN")
echo "Can request NDA: $CAN_REQUEST"
echo ""

# Test 4: Get NDA status for pitch
echo -e "${BLUE}Test 4: Get current NDA status for pitch 46${NC}"
STATUS=$(curl -s "$API_URL/ndas/pitch/46/status" \
  -H "Authorization: Bearer $TOKEN")
echo "NDA Status: $STATUS"
echo ""

# Test 5: Request NDA (if not already requested)
echo -e "${BLUE}Test 5: Request NDA access${NC}"
REQUEST_RESPONSE=$(curl -s -X POST "$API_URL/nda/request" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "pitchId": 46,
    "message": "Requesting access for investment evaluation",
    "expiryDays": 90
  }')
echo "Request response: $REQUEST_RESPONSE"
echo ""

# Test 6: Check updated NDA status
echo -e "${BLUE}Test 6: Check NDA status after request${NC}"
UPDATED_STATUS=$(curl -s "$API_URL/ndas/pitch/46/status" \
  -H "Authorization: Bearer $TOKEN")
echo "Updated NDA Status: $UPDATED_STATUS"
echo ""

# Test 7: Login as creator to approve/reject NDAs
echo -e "${BLUE}Test 7: Login as creator (pitch owner)${NC}"
CREATOR_LOGIN=$(curl -s -X POST "$API_URL/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

CREATOR_TOKEN=$(echo $CREATOR_LOGIN | grep -o '"token":"[^"]*' | sed 's/"token":"//')
if [ -z "$CREATOR_TOKEN" ]; then
  echo -e "${RED}Failed to login as creator${NC}"
else
  echo -e "${GREEN}✓ Logged in as creator${NC}"
  
  # Get pending NDAs
  echo -e "${BLUE}Getting pending NDA requests${NC}"
  PENDING_NDAS=$(curl -s "$API_URL/ndas?status=pending" \
    -H "Authorization: Bearer $CREATOR_TOKEN")
  echo "Pending NDAs: $PENDING_NDAS"
fi
echo ""

echo "========================================="
echo "Button State Test Summary"
echo "========================================="
echo ""
echo -e "${GREEN}Expected Button States:${NC}"
echo "1. Not logged in: 'Sign In to Request Access'"
echo "2. Logged in (no request): 'Request NDA Access' (purple)"
echo "3. Request pending: 'NDA Request Pending Review' (yellow, disabled)"
echo "4. Request approved: 'Access Granted - View Enhanced Info Above' (green, disabled)"
echo "5. Request rejected: 'NDA Request Rejected' (red, disabled)"
echo ""
echo -e "${YELLOW}Test the following scenarios in browser:${NC}"
echo "1. Visit $FRONTEND_URL/marketplace"
echo "2. Click on a pitch (e.g., 'Neon Nights')"
echo "3. Check button state when not logged in"
echo "4. Login as investor via portal"
echo "5. Check button changes to 'Request NDA Access'"
echo "6. Click button to request NDA"
echo "7. Button should change to 'NDA Request Pending Review'"
echo "8. Creator can approve/reject from their NDA management page"
echo "9. After approval, button shows 'Access Granted'"
echo ""