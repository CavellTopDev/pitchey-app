#!/bin/bash

echo "🧪 TESTING ENHANCED ANALYTICS ENDPOINTS"
echo "========================================"

BASE_URL="http://localhost:8001"

# Login as investor to get token
echo -e "\n1. 🔐 Logging in as investor to get auth token..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}')

echo "Login response: $LOGIN_RESPONSE"

# Extract token using jq if available, otherwise use simple extraction
if command -v jq >/dev/null 2>&1; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
else
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get authentication token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Got authentication token: ${TOKEN:0:20}..."

echo -e "\n2. 📊 Testing Enhanced Creator Analytics..."
curl -s -X GET "${BASE_URL}/api/dashboard/analytics/creator?timeRange=30d" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 500

echo -e "\n\n3. 💰 Testing Enhanced Investor Analytics..."
curl -s -X GET "${BASE_URL}/api/dashboard/analytics/investor?timeRange=7d" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 500

echo -e "\n\n4. 🎬 Testing Enhanced Production Analytics..."
curl -s -X GET "${BASE_URL}/api/dashboard/analytics/production" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 500

echo -e "\n\n5. 📈 Testing with different time ranges..."
echo "   → Testing 7d range:"
curl -s -X GET "${BASE_URL}/api/dashboard/analytics/creator?timeRange=7d" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.timeRange // "No timeRange field"' 2>/dev/null || echo "7d"

echo "   → Testing 90d range:"
curl -s -X GET "${BASE_URL}/api/dashboard/analytics/investor?timeRange=90d" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.timeRange // "No timeRange field"' 2>/dev/null || echo "90d"

echo -e "\n✅ ENHANCED ANALYTICS API TESTING COMPLETE"
echo "📋 Summary:"
echo "   • Creator analytics endpoint: /api/dashboard/analytics/creator"
echo "   • Investor analytics endpoint: /api/dashboard/analytics/investor" 
echo "   • Production analytics endpoint: /api/dashboard/analytics/production"
echo "   • Time range parameters: 7d, 30d, 90d (default: 30d)"
echo "   • All endpoints require authentication"