#!/bin/bash

echo "🧪 Testing Fixed JWT Authentication"
echo "===================================="

# API URL - test against deployed worker
API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"

# Demo creator credentials
EMAIL="alex.creator@demo.com"
PASSWORD="Demo123"

echo ""
echo "1️⃣ Testing creator login with fixed JWT..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Login response:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"

# Extract JWT token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get authentication token"
    exit 1
fi

# Check if token has proper JWT structure (header.payload.signature)
TOKEN_PARTS=$(echo "$TOKEN" | tr '.' '\n' | wc -l)
if [ "$TOKEN_PARTS" -eq 3 ]; then
    echo "✅ Token has proper JWT structure (3 parts)"
else
    echo "❌ Token does not have proper JWT structure (expected 3 parts, got $TOKEN_PARTS)"
fi

echo ""
echo "Token: ${TOKEN:0:50}..."

echo ""
echo "2️⃣ Testing authenticated endpoint with JWT..."
SETTINGS_RESPONSE=$(curl -s -X GET "$API_URL/api/user/settings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Settings response:"
echo "$SETTINGS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SETTINGS_RESPONSE"

# Check if we got a successful response
if echo "$SETTINGS_RESPONSE" | grep -q '"notifications"'; then
    echo ""
    echo "✅ JWT authentication is working! Settings retrieved successfully."
else
    echo ""
    echo "❌ JWT authentication failed. Response doesn't contain expected data."
fi

echo ""
echo "3️⃣ Testing other authenticated endpoints..."

# Test sessions endpoint
echo ""
echo "Sessions endpoint:"
curl -s -X GET "$API_URL/api/user/sessions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null

# Test activity endpoint
echo ""
echo "Activity endpoint:"
curl -s -X GET "$API_URL/api/user/activity" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null

echo ""
echo "4️⃣ Testing team endpoints with fixed JWT..."
TEAMS_RESPONSE=$(curl -s -X GET "$API_URL/api/teams" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Teams response:"
echo "$TEAMS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TEAMS_RESPONSE"

echo ""
echo "📊 Test Summary:"
if echo "$SETTINGS_RESPONSE" | grep -q '"notifications"' && echo "$TEAMS_RESPONSE" | grep -q '\['; then
    echo "✅ All authenticated endpoints working with fixed JWT!"
    echo "✅ JWT token generation fixed successfully!"
else
    echo "⚠️  Some endpoints may still have issues"
fi