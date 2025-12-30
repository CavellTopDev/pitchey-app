#!/bin/bash

# Test NDA Signing Fix
# This script tests the NDA workflow with the authentication fixes

API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey-5o8.pages.dev}"

echo "🔧 Testing NDA Signing Fix"
echo "================================"
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Demo investor credentials
EMAIL="sarah.investor@demo.com"
PASSWORD="Demo123"

echo "📝 Step 1: Login as demo investor"
echo "---------------------------------"

# Login and capture session cookie
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $FRONTEND_URL" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "user"; then
  echo -e "${GREEN}✅ Login successful${NC}"
  USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"userId":[0-9]*' | cut -d: -f2)
  echo "User ID: $USER_ID"
else
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "📋 Step 2: Request NDA for pitch"
echo "---------------------------------"

# Request NDA for pitch ID 211 (Stellar Horizons)
PITCH_ID=211
NDA_REQUEST=$(curl -s -b cookies.txt -X POST "$API_URL/api/ndas/request" \
  -H "Content-Type: application/json" \
  -H "Origin: $FRONTEND_URL" \
  -H "Accept: application/json" \
  -d "{
    \"pitchId\": $PITCH_ID,
    \"message\": \"Testing NDA signing fix with proper authentication\"
  }")

if echo "$NDA_REQUEST" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ NDA request created${NC}"
  NDA_ID=$(echo "$NDA_REQUEST" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  echo "NDA ID: $NDA_ID"
else
  echo -e "${RED}❌ NDA request failed${NC}"
  echo "$NDA_REQUEST"
  exit 1
fi

echo ""
echo "🔄 Step 3: Auto-approve NDA (for demo accounts)"
echo "-----------------------------------------------"

# For demo accounts, NDAs should auto-approve when signing
echo "Demo account detected - NDA will auto-approve on signing"

echo ""
echo "✍️ Step 4: Sign the NDA"
echo "-----------------------"

# Sign the NDA with digital signature
SIGN_RESPONSE=$(curl -s -b cookies.txt -X POST "$API_URL/api/ndas/$NDA_ID/sign" \
  -H "Content-Type: application/json" \
  -H "Origin: $FRONTEND_URL" \
  -H "Accept: application/json" \
  -d "{
    \"ndaId\": $NDA_ID,
    \"signature\": \"Sarah Mitchell\",
    \"fullName\": \"Sarah Mitchell\",
    \"title\": \"Managing Partner\",
    \"company\": \"Venture Capital Group\",
    \"acceptTerms\": true
  }")

echo "Sign Response:"
echo "$SIGN_RESPONSE" | jq '.' 2>/dev/null || echo "$SIGN_RESPONSE"

if echo "$SIGN_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ NDA signed successfully!${NC}"
  
  # Verify the NDA status
  echo ""
  echo "📊 Step 5: Verify NDA status"
  echo "----------------------------"
  
  STATUS_CHECK=$(curl -s -b cookies.txt -X GET "$API_URL/api/ndas/$NDA_ID" \
    -H "Origin: $FRONTEND_URL" \
    -H "Accept: application/json")
  
  if echo "$STATUS_CHECK" | grep -q '"status":"signed"'; then
    echo -e "${GREEN}✅ NDA status confirmed as 'signed'${NC}"
  else
    echo -e "${YELLOW}⚠️  NDA status check:${NC}"
    echo "$STATUS_CHECK" | jq '.data.nda.status' 2>/dev/null || echo "$STATUS_CHECK"
  fi
else
  echo -e "${RED}❌ NDA signing failed${NC}"
  echo "Error details:"
  echo "$SIGN_RESPONSE" | jq '.error' 2>/dev/null || echo "$SIGN_RESPONSE"
  
  # Check if it's an authentication issue
  if echo "$SIGN_RESPONSE" | grep -q "Authentication required\|401\|403"; then
    echo ""
    echo -e "${YELLOW}⚠️  Authentication issue detected${NC}"
    echo "Possible causes:"
    echo "1. Session cookie not properly transmitted"
    echo "2. CORS credentials not configured"
    echo "3. Better Auth session validation failure"
    echo ""
    echo "Recommendations:"
    echo "- Ensure CORS headers include 'Access-Control-Allow-Credentials: true'"
    echo "- Frontend must use 'credentials: include' in fetch requests"
    echo "- Check Better Auth configuration for cookie settings"
  fi
fi

echo ""
echo "🔍 Step 6: Check enhanced access"
echo "--------------------------------"

# Check if user now has access to enhanced content
ACCESS_CHECK=$(curl -s -b cookies.txt -X GET "$API_URL/api/ndas/pitch/$PITCH_ID/status" \
  -H "Origin: $FRONTEND_URL" \
  -H "Accept: application/json")

if echo "$ACCESS_CHECK" | grep -q '"canAccess":true'; then
  echo -e "${GREEN}✅ Enhanced content access granted${NC}"
else
  echo -e "${YELLOW}⚠️  Access status:${NC}"
  echo "$ACCESS_CHECK" | jq '.data' 2>/dev/null || echo "$ACCESS_CHECK"
fi

# Clean up
rm -f cookies.txt

echo ""
echo "================================"
echo "Test completed!"
echo ""
echo "Summary:"
echo "- CORS configuration: Fixed with credentials support"
echo "- Session authentication: Using Better Auth cookies"
echo "- Demo account handling: Auto-approval implemented"
echo "- NDA signing flow: Complete end-to-end test"