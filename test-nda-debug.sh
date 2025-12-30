#!/bin/bash

# Debug NDA Request Issues
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"

echo "🔍 Debugging NDA Request Endpoint"
echo "=================================="
echo ""

# Step 1: Login
echo "📝 Step 1: Login as investor"
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $FRONTEND_URL" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Login successful"
  USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo "User ID: $USER_ID"
else
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo ""
echo "📝 Step 2: Check available endpoints"

# Try different NDA endpoint variations
ENDPOINTS=(
  "/api/ndas/request"
  "/api/nda/request"
  "/api/info-requests"
  "/api/ndas"
)

for endpoint in "${ENDPOINTS[@]}"; do
  echo ""
  echo "Testing: $endpoint"
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -b cookies.txt -X POST "$API_URL$endpoint" \
    -H "Content-Type: application/json" \
    -H "Origin: $FRONTEND_URL" \
    -d '{"pitchId": 1}')
  echo "HTTP Status: $RESPONSE"
done

echo ""
echo "📝 Step 3: Test NDA request with various pitch IDs"

# Try different pitch IDs
for PITCH_ID in 1 2 3 211 214 217; do
  echo ""
  echo "Testing pitch ID: $PITCH_ID"
  
  NDA_RESPONSE=$(curl -s -b cookies.txt -X POST "$API_URL/api/ndas/request" \
    -H "Content-Type: application/json" \
    -H "Origin: $FRONTEND_URL" \
    -H "Accept: application/json" \
    -d "{\"pitchId\": $PITCH_ID, \"message\": \"Testing NDA for pitch $PITCH_ID\"}")
  
  # Check response
  if echo "$NDA_RESPONSE" | grep -q '"success":true'; then
    echo "✅ NDA request successful"
    echo "$NDA_RESPONSE" | jq '.data | {id, status, pitchId}'
  elif echo "$NDA_RESPONSE" | grep -q "already exists"; then
    echo "⚠️  NDA already exists"
  elif echo "$NDA_RESPONSE" | grep -q "INTERNAL_ERROR"; then
    echo "❌ Internal error"
    echo "$NDA_RESPONSE" | jq '.'
  else
    echo "❌ Request failed"
    echo "$NDA_RESPONSE" | jq '.'
  fi
done

echo ""
echo "📝 Step 4: Test fetching existing NDAs"

# Try to get user's NDAs
echo ""
echo "Getting user's NDA requests:"
curl -s -b cookies.txt -X GET "$API_URL/api/ndas?userId=$USER_ID" \
  -H "Origin: $FRONTEND_URL" \
  -H "Accept: application/json" | jq '.'

echo ""
echo "Getting incoming NDA requests:"
curl -s -b cookies.txt -X GET "$API_URL/api/ndas/request?type=incoming" \
  -H "Origin: $FRONTEND_URL" \
  -H "Accept: application/json" | jq '.'

echo ""
echo "Getting outgoing NDA requests:"
curl -s -b cookies.txt -X GET "$API_URL/api/ndas/request?type=outgoing" \
  -H "Origin: $FRONTEND_URL" \
  -H "Accept: application/json" | jq '.'

rm -f cookies.txt

echo ""
echo "🎯 Debug Summary"
echo "================"
echo "Check the responses above to identify:"
echo "1. Which endpoints are accessible"
echo "2. What error messages are returned"
echo "3. Whether it's a database or routing issue"