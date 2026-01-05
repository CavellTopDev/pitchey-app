#!/bin/bash

echo "=== Testing Portal Access Control Issue ==="
echo "Testing if creator can access investor dashboard (SHOULD FAIL but currently PASSES)"
echo ""

# First login as creator
echo "1. Login as creator (alex.creator@demo.com):"
CREATOR_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123",
    "userType": "creator"
  }')

echo "$CREATOR_RESPONSE" | jq -r '.success'

# Extract creator token
CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | jq -r '.data.token')

if [ "$CREATOR_TOKEN" == "null" ] || [ -z "$CREATOR_TOKEN" ]; then
  echo "Creator login failed. Using cookie-based auth..."
  # Extract cookies for session-based auth
  COOKIES=$(curl -s -X POST http://localhost:8001/api/auth/sign-in \
    -H "Content-Type: application/json" \
    -d '{"email": "alex.creator@demo.com", "password": "Demo123", "userType": "creator"}' \
    -D - | grep -i "set-cookie" | sed 's/^[Ss]et-[Cc]ookie: //' | tr '\n' ';')
  
  echo ""
  echo "2. Attempting to access INVESTOR dashboard as CREATOR (should FAIL):"
  curl -s http://localhost:8001/api/investor/dashboard \
    -H "Cookie: $COOKIES" | jq '.'
else
  echo ""
  echo "2. Attempting to access INVESTOR dashboard as CREATOR (should FAIL):"
  curl -s http://localhost:8001/api/investor/dashboard \
    -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'
fi

echo ""
echo "3. Attempting to access PRODUCTION dashboard as CREATOR (should FAIL):"
if [ -n "$COOKIES" ]; then
  curl -s http://localhost:8001/api/production/dashboard \
    -H "Cookie: $COOKIES" | jq '.'
else
  curl -s http://localhost:8001/api/production/dashboard \
    -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'
fi

echo ""
echo "4. Attempting to access CREATOR dashboard as CREATOR (should SUCCEED):"
if [ -n "$COOKIES" ]; then
  curl -s http://localhost:8001/api/creator/dashboard \
    -H "Cookie: $COOKIES" | jq '.success'
else
  curl -s http://localhost:8001/api/creator/dashboard \
    -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.success'
fi

echo ""
echo "=== ISSUE: Creator can currently access investor/production dashboards! ==="
echo "This needs to be fixed with portal access control middleware."
