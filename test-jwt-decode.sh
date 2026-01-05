#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Login as creator
CREATOR_RESPONSE=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123",
    "userType": "creator"
  }')

TOKEN=$(echo "$CREATOR_RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "Token obtained. Decoding JWT payload..."
  # Decode JWT (base64 decode the payload part)
  PAYLOAD=$(echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null || echo "$TOKEN" | cut -d. -f2 | base64 -D 2>/dev/null)
  echo "JWT Payload:"
  echo "$PAYLOAD" | jq '.'
else
  echo "No token returned"
fi

echo ""
echo "Full login response:"
echo "$CREATOR_RESPONSE" | jq '.'
