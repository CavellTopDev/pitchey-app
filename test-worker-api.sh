#!/bin/bash

echo "🔍 Testing Pitchey Worker API Endpoints"
echo "========================================="

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n1. Testing Health Endpoint:"
curl -s "$API_URL/health" | jq '.'

echo -e "\n2. Testing API Info:"
curl -s "$API_URL/api" | jq '.' 2>/dev/null || echo "No JSON response"

echo -e "\n3. Testing Session (should return 401 without auth):"
curl -s -w "\nStatus: %{http_code}\n" "$API_URL/api/auth/session"

echo -e "\n4. Testing Public Pitches Endpoint:"
curl -s "$API_URL/api/pitches?limit=5" | jq '.pitches | length' 2>/dev/null || echo "Failed to fetch pitches"

echo -e "\n5. Testing CORS Headers:"
curl -s -I "$API_URL/api/pitches" | grep -i "access-control"

echo -e "\n6. Testing Error Handling (404):"
curl -s -w "\nStatus: %{http_code}\n" "$API_URL/api/nonexistent"

echo -e "\n7. Testing WebSocket Upgrade:"
curl -s -I "$API_URL/ws" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" | grep -i "sec-websocket"

