#!/bin/bash

echo "Testing Creator Portfolio API Endpoint..."
echo ""

# Test getting portfolio without authentication (public endpoint)
echo "1. Testing public portfolio endpoint (no auth):"
curl -s -X GET "https://pitchey-backend.deno.dev/api/creator/portfolio/1001" | jq '.'

echo ""
echo "2. Testing authenticated portfolio endpoint:"
# Login first to get token
LOGIN_RESPONSE=$(curl -s -X POST https://pitchey-backend.deno.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@demo.com","password":"demo123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "Successfully logged in, got token"
  
  # Test authenticated endpoint
  curl -s -X GET "https://pitchey-backend.deno.dev/api/creator/portfolio" \
    -H "Authorization: Bearer $TOKEN" | jq '.'
else
  echo "Failed to get token"
fi

echo ""
echo "Portfolio API test complete!"