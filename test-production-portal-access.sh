#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo "=== Testing Portal Access Control in Production ==="
echo ""

# First login as creator
echo "1. Login as creator (alex.creator@demo.com):"
CREATOR_RESPONSE=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123",
    "userType": "creator"
  }')

SUCCESS=$(echo "$CREATOR_RESPONSE" | jq -r '.success')
echo "Login success: $SUCCESS"

# Extract creator token
CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | jq -r '.data.token')

if [ "$CREATOR_TOKEN" == "null" ] || [ -z "$CREATOR_TOKEN" ]; then
  echo "Using session-based auth..."
  # Try Better Auth sign-in
  CREATOR_SESSION=$(curl -s -X POST $API_URL/api/auth/sign-in \
    -H "Content-Type: application/json" \
    -d '{"email": "alex.creator@demo.com", "password": "Demo123", "userType": "creator"}' \
    -c cookies.txt \
    -w "\nHTTP_CODE:%{http_code}")
  
  HTTP_CODE=$(echo "$CREATOR_SESSION" | grep "HTTP_CODE" | cut -d: -f2)
  echo "Sign-in HTTP code: $HTTP_CODE"
fi

echo ""
echo "2. Testing CREATOR accessing CREATOR dashboard (should SUCCEED):"
if [ -f "cookies.txt" ]; then
  curl -s $API_URL/api/creator/dashboard \
    -b cookies.txt | jq '.success'
else
  curl -s $API_URL/api/creator/dashboard \
    -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.success'
fi

echo ""
echo "3. Testing CREATOR accessing INVESTOR dashboard (should FAIL with 403):"
if [ -f "cookies.txt" ]; then
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" $API_URL/api/investor/dashboard \
    -b cookies.txt)
  echo "$RESPONSE" | head -n -1 | jq '.'
  echo "HTTP Code: $(echo "$RESPONSE" | tail -n 1 | cut -d: -f2)"
else
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" $API_URL/api/investor/dashboard \
    -H "Authorization: Bearer $CREATOR_TOKEN")
  echo "$RESPONSE" | head -n -1 | jq '.'
  echo "HTTP Code: $(echo "$RESPONSE" | tail -n 1 | cut -d: -f2)"
fi

echo ""
echo "4. Testing CREATOR accessing PRODUCTION dashboard (should FAIL with 403):"
if [ -f "cookies.txt" ]; then
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" $API_URL/api/production/dashboard \
    -b cookies.txt)
  echo "$RESPONSE" | head -n -1 | jq '.'
  echo "HTTP Code: $(echo "$RESPONSE" | tail -n 1 | cut -d: -f2)"
else
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" $API_URL/api/production/dashboard \
    -H "Authorization: Bearer $CREATOR_TOKEN")
  echo "$RESPONSE" | head -n -1 | jq '.'
  echo "HTTP Code: $(echo "$RESPONSE" | tail -n 1 | cut -d: -f2)"
fi

# Clean up
rm -f cookies.txt

echo ""
echo "=== Portal Access Control Test Complete ==="
