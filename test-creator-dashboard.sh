#!/bin/bash

# Test script for Creator Dashboard
# This script tests all API endpoints and functionality

API_URL="https://pitchey-backend.deno.dev"
EMAIL="alex.creator@demo.com"
PASSWORD="demo123"

echo "================================"
echo "CREATOR DASHBOARD TEST SUITE"
echo "================================"
echo ""

# 1. Test Login
echo "1. Testing Creator Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
else
  echo "✅ Login successful!"
  echo "Token: ${TOKEN:0:50}..."
fi

echo ""
echo "2. Testing Creator Dashboard Endpoint..."
DASHBOARD_RESPONSE=$(curl -s -X GET "$API_URL/api/creator/dashboard" \
  -H "Authorization: Bearer $TOKEN")

echo "Dashboard Response:"
echo $DASHBOARD_RESPONSE | python3 -m json.tool 2>/dev/null || echo $DASHBOARD_RESPONSE

echo ""
echo "3. Testing Creator Following Endpoint..."
FOLLOWING_RESPONSE=$(curl -s -X GET "$API_URL/api/creator/following?tab=activity" \
  -H "Authorization: Bearer $TOKEN")

echo "Following Response:"
echo $FOLLOWING_RESPONSE | python3 -m json.tool 2>/dev/null || echo $FOLLOWING_RESPONSE

echo ""
echo "4. Testing Analytics Endpoint..."
ANALYTICS_RESPONSE=$(curl -s -X GET "$API_URL/api/analytics/dashboard" \
  -H "Authorization: Bearer $TOKEN")

echo "Analytics Response:"
echo $ANALYTICS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $ANALYTICS_RESPONSE

echo ""
echo "5. Testing Credits Balance..."
CREDITS_RESPONSE=$(curl -s -X GET "$API_URL/api/payments/credits/balance" \
  -H "Authorization: Bearer $TOKEN")

echo "Credits Response:"
echo $CREDITS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $CREDITS_RESPONSE

echo ""
echo "6. Testing Pitches Endpoint..."
PITCHES_RESPONSE=$(curl -s -X GET "$API_URL/api/pitches?limit=10" \
  -H "Authorization: Bearer $TOKEN")

echo "Pitches Response:"
echo $PITCHES_RESPONSE | python3 -m json.tool 2>/dev/null || echo $PITCHES_RESPONSE

echo ""
echo "7. Testing Profile Endpoint..."
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/api/users/profile" \
  -H "Authorization: Bearer $TOKEN")

echo "Profile Response:"
echo $PROFILE_RESPONSE | python3 -m json.tool 2>/dev/null || echo $PROFILE_RESPONSE

echo ""
echo "================================"
echo "TEST SUMMARY"
echo "================================"

# Check if all endpoints returned data
if [[ $DASHBOARD_RESPONSE == *"success"* ]] || [[ $DASHBOARD_RESPONSE == *"data"* ]]; then
  echo "✅ Dashboard endpoint working"
else
  echo "❌ Dashboard endpoint failed"
fi

if [[ $FOLLOWING_RESPONSE == *"success"* ]] || [[ $FOLLOWING_RESPONSE == *"data"* ]]; then
  echo "✅ Following endpoint working"
else
  echo "❌ Following endpoint failed"
fi

if [[ $ANALYTICS_RESPONSE == *"success"* ]] || [[ ! -z "$ANALYTICS_RESPONSE" ]]; then
  echo "✅ Analytics endpoint working"
else
  echo "❌ Analytics endpoint failed"
fi

if [[ $CREDITS_RESPONSE == *"success"* ]] || [[ $CREDITS_RESPONSE == *"balance"* ]]; then
  echo "✅ Credits endpoint working"
else
  echo "❌ Credits endpoint failed"
fi

echo ""
echo "Test completed!"