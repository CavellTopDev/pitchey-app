#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
EMAIL="sarah.investor@demo.com"
PASSWORD="Demo123"
PITCH_ID=214  # Try a different pitch ID

echo "🔧 Testing NDA with Fresh Pitch ID"
echo "================================"
echo ""

# Login
echo "📝 Step 1: Login"
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://pitchey-5o8.pages.dev" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "user"; then
  echo "✅ Login successful"
else
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "📋 Step 2: Request NDA for pitch $PITCH_ID"

NDA_REQUEST=$(curl -s -b cookies.txt -X POST "$API_URL/api/ndas/request" \
  -H "Content-Type: application/json" \
  -H "Origin: https://pitchey-5o8.pages.dev" \
  -H "Accept: application/json" \
  -d "{\"pitchId\": $PITCH_ID, \"message\": \"Testing NDA with fresh pitch\"}")

echo "NDA Request Response:"
echo "$NDA_REQUEST" | jq '.' 2>/dev/null || echo "$NDA_REQUEST"

# Extract NDA ID
NDA_ID=$(echo "$NDA_REQUEST" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -n "$NDA_ID" ]; then
  echo ""
  echo "✅ NDA created with ID: $NDA_ID (should be auto-approved for demo account)"
  
  echo ""
  echo "✍️ Step 3: Sign the NDA"
  
  SIGN_RESPONSE=$(curl -s -b cookies.txt -X POST "$API_URL/api/ndas/$NDA_ID/sign" \
    -H "Content-Type: application/json" \
    -H "Origin: https://pitchey-5o8.pages.dev" \
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
    echo ""
    echo "🎉 SUCCESS! NDA signed successfully!"
    
    # Verify status
    echo ""
    echo "📊 Step 4: Verify NDA status"
    STATUS_CHECK=$(curl -s -b cookies.txt -X GET "$API_URL/api/ndas/pitch/$PITCH_ID/status" \
      -H "Origin: https://pitchey-5o8.pages.dev" \
      -H "Accept: application/json")
    
    echo "Status:"
    echo "$STATUS_CHECK" | jq '.data' 2>/dev/null || echo "$STATUS_CHECK"
  fi
fi

rm -f cookies.txt
