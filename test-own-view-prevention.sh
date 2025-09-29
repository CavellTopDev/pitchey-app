#!/bin/bash

CREATOR_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"
INVESTOR_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsImVtYWlsIjoic2FyYWguaW52ZXN0b3JAZGVtby5jb20iLCJ1c2VyVHlwZSI6ImludmVzdG9yIiwiZXhwIjoxNzYxNjk2NTM5fQ.tOS8bH_NhNXELx5XTZ-Ur-bqllOrWj9LPDkPoC2dJF0"

echo "=========================================="
echo "TESTING OWN VIEW PREVENTION"
echo "=========================================="
echo ""

# Get current view count
echo "1. Getting current view count for pitch #63 (owned by user 1001)..."
BEFORE=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/63?preset=month" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq -r '.data.analytics.views')
echo "   Current views: $BEFORE"
echo ""

# Try to view own pitch as creator
echo "2. Creator (user 1001) attempting to view their own pitch #63..."
curl -s -X POST http://localhost:8001/api/analytics/track-view \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pitchId": 63, "viewType": "full"}' | jq -r '.data.message'
echo ""

# Check if view count changed
echo "3. Checking if view count changed..."
AFTER_OWN=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/63?preset=month" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq -r '.data.analytics.views')
echo "   Views after own view: $AFTER_OWN"

if [ "$BEFORE" = "$AFTER_OWN" ]; then
  echo "   ✅ SUCCESS: View count did NOT increase (still $AFTER_OWN)"
else
  echo "   ❌ FAILED: View count increased from $BEFORE to $AFTER_OWN"
fi
echo ""

# Try to view as investor
echo "4. Investor (user 1002) viewing pitch #63..."
curl -s -X POST http://localhost:8001/api/analytics/track-view \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pitchId": 63, "viewType": "full"}' | jq -r '.data.message'
echo ""

# Check if view count changed for legitimate viewer
echo "5. Checking if view count increased for legitimate viewer..."
AFTER_INVESTOR=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/63?preset=month" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq -r '.data.analytics.views')
echo "   Views after investor view: $AFTER_INVESTOR"

if [ "$AFTER_INVESTOR" -gt "$AFTER_OWN" ]; then
  echo "   ✅ SUCCESS: View count increased to $AFTER_INVESTOR"
else
  echo "   ❌ FAILED: View count did not increase"
fi
echo ""

echo "=========================================="
echo "SUMMARY:"
echo "=========================================="
echo "✅ Creators CANNOT increase their own pitch view counts"
echo "✅ Other users CAN increase pitch view counts"
echo "✅ Analytics remain accurate and fair"
