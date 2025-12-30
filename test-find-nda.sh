#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
EMAIL="sarah.investor@demo.com"
PASSWORD="Demo123"

echo "🔍 Finding and Signing NDA"
echo "================================"
echo ""

# Login
echo "📝 Step 1: Login"
curl -s -c cookies.txt -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null

echo "✅ Logged in"
echo ""

# Try to get NDA status for different pitches
echo "📋 Step 2: Check NDA status for various pitches"
for PITCH_ID in 211 212 213; do
  echo "Checking pitch $PITCH_ID:"
  STATUS=$(curl -s -b cookies.txt -X GET "$API_URL/api/ndas/pitch/$PITCH_ID/status" \
    -H "Accept: application/json")
  echo "$STATUS" | jq '.data' 2>/dev/null || echo "$STATUS"
  echo ""
done

# Try pitch 211 since that was used in original test
PITCH_ID=211
echo "📋 Step 3: Try to get existing NDA for pitch $PITCH_ID"

# First check if we can request it
CAN_REQUEST=$(curl -s -b cookies.txt -X GET "$API_URL/api/ndas/pitch/$PITCH_ID/can-request" \
  -H "Accept: application/json")

echo "Can request check:"
echo "$CAN_REQUEST" | jq '.' 2>/dev/null || echo "$CAN_REQUEST"

# Extract existing NDA ID if present
if echo "$CAN_REQUEST" | grep -q "existingNDA"; then
  NDA_ID=$(echo "$CAN_REQUEST" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$NDA_ID" ]; then
    echo ""
    echo "✍️ Step 4: Sign existing NDA with ID: $NDA_ID"
    
    SIGN_RESPONSE=$(curl -s -b cookies.txt -X POST "$API_URL/api/ndas/$NDA_ID/sign" \
      -H "Content-Type: application/json" \
      -H "Origin: https://pitchey-5o8.pages.dev" \
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
  fi
fi

rm -f cookies.txt
