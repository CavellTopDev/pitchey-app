#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
EMAIL="sarah.investor@demo.com"
PASSWORD="Demo123"

echo "🔧 Testing NDA Signing for Existing NDA"
echo "================================"
echo ""

# Login first
echo "📝 Step 1: Login as demo investor"
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "user"; then
  echo "✅ Login successful"
  USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  echo "User ID: $USER_ID"
else
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "📋 Step 2: Check existing NDAs"
NDA_LIST=$(curl -s -b cookies.txt -X GET "$API_URL/api/ndas?userId=$USER_ID" \
  -H "Accept: application/json")

echo "NDAs found:"
echo "$NDA_LIST" | jq '.' 2>/dev/null || echo "$NDA_LIST"

# Try to extract the first NDA ID
NDA_ID=$(echo "$NDA_LIST" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -z "$NDA_ID" ]; then
  echo "No existing NDAs found. Creating a new one..."
  
  # Request NDA for pitch 212
  NDA_REQUEST=$(curl -s -b cookies.txt -X POST "$API_URL/api/ndas/request" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": 212, \"message\": \"Testing NDA signing\"}")
  
  echo "NDA Request Response:"
  echo "$NDA_REQUEST" | jq '.' 2>/dev/null || echo "$NDA_REQUEST"
  
  NDA_ID=$(echo "$NDA_REQUEST" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
fi

if [ -n "$NDA_ID" ]; then
  echo ""
  echo "✍️ Step 3: Sign NDA with ID: $NDA_ID"
  
  SIGN_RESPONSE=$(curl -s -b cookies.txt -X POST "$API_URL/api/ndas/$NDA_ID/sign" \
    -H "Content-Type: application/json" \
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
    echo "✅ NDA signed successfully!"
  else
    echo "❌ NDA signing failed"
  fi
else
  echo "❌ Could not find or create an NDA to sign"
fi

rm -f cookies.txt
