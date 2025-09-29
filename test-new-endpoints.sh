#!/bin/bash

echo "🧪 Testing New API Endpoints - Follow Check and NDA Can-Request"
echo "================================================================"

BASE_URL="http://localhost:8001"

# Function to wait and avoid rate limits
wait_for_rate_limit() {
    echo "⏳ Waiting 3 seconds to avoid rate limits..."
    sleep 3
}

echo "📋 Step 1: Getting authentication token..."
wait_for_rate_limit

TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}' | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Failed to get authentication token"
    exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."

wait_for_rate_limit

echo "📋 Step 2: Testing Follow Check Endpoints..."

echo "   Testing follow check for user (targetId=2, type=user):"
curl -s "$BASE_URL/api/follows/check?targetId=2&type=user" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'

wait_for_rate_limit

echo "   Testing follow check for pitch (targetId=11, type=pitch):"
curl -s "$BASE_URL/api/follows/check?targetId=11&type=pitch" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'

wait_for_rate_limit

echo "📋 Step 3: Testing NDA Can-Request Endpoint..."

echo "   Testing NDA can-request for pitch that requires NDA (pitch 11):"
curl -s "$BASE_URL/api/ndas/pitch/11/can-request" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'

wait_for_rate_limit

echo "   Testing NDA can-request for pitch that doesn't require NDA (pitch 7):"
curl -s "$BASE_URL/api/ndas/pitch/7/can-request" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'

wait_for_rate_limit

echo "📋 Step 4: Testing as pitch owner (should be denied)..."
CREATOR_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}' | jq -r '.token')

wait_for_rate_limit

if [ "$CREATOR_TOKEN" != "null" ] && [ -n "$CREATOR_TOKEN" ]; then
    echo "   Testing NDA can-request as pitch owner (should be denied):"
    curl -s "$BASE_URL/api/ndas/pitch/11/can-request" \
      -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.data'
fi

echo ""
echo "🎉 All endpoint tests completed!"
echo ""
echo "📊 Summary of implemented endpoints:"
echo "   ✅ GET /api/follows/check?targetId={id}&type={user|pitch}"
echo "   ✅ GET /api/ndas/pitch/{id}/can-request" 
echo "   ✅ POST /api/ndas/request (already existed)"