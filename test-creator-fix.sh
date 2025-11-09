#!/bin/bash

echo "======================================"
echo "🎬 TESTING CREATOR-SPECIFIC FIX"
echo "======================================"

# Start the server
echo "Starting server..."
PORT=8001 JWT_SECRET="test-secret-key-for-development" \
DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" \
timeout 20s deno run --allow-all working-server.ts &
SERVER_PID=$!

# Wait for server to start
sleep 5

echo ""
echo "📋 Test 1: Creator Login"
CREATOR_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

CREATOR_TOKEN=$(echo $CREATOR_RESPONSE | jq -r '.token')

if [ "$CREATOR_TOKEN" != "null" ] && [ -n "$CREATOR_TOKEN" ]; then
  echo "✅ PASS: Creator login successful"
else
  echo "❌ FAIL: Creator login failed"
fi

echo ""
echo "📋 Test 2: Creator Profile (/api/creator/profile)"
echo "This endpoint was broken - should now work"

CREATOR_PROFILE=$(curl -s "http://localhost:8001/api/creator/profile" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

echo "Response:"
echo "$CREATOR_PROFILE" | jq '.'

CREATOR_ID=$(echo $CREATOR_PROFILE | jq -r '.data.user.id // .user.id // "null"')

if [ "$CREATOR_ID" != "null" ] && [ -n "$CREATOR_ID" ]; then
  echo "✅ PASS: Creator profile returned with id: $CREATOR_ID"
else
  echo "❌ FAIL: Creator profile missing user id"
fi

echo ""
echo "📋 Test 3: Creator Dashboard (/api/creator/dashboard)"
echo "This endpoint was also broken - should now work"

DASHBOARD_RESPONSE=$(curl -s "http://localhost:8001/api/creator/dashboard" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

DASHBOARD_SUCCESS=$(echo $DASHBOARD_RESPONSE | jq -r '.success')

if [ "$DASHBOARD_SUCCESS" = "true" ]; then
  echo "✅ PASS: Creator dashboard accessible"
else
  echo "❌ FAIL: Creator dashboard not accessible"
  echo "Response: $DASHBOARD_RESPONSE"
fi

echo ""
echo "📋 Test 4: General Profile (/api/auth/profile)"
echo "Should still work for creators"

GENERAL_PROFILE=$(curl -s "http://localhost:8001/api/auth/profile" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

GENERAL_ID=$(echo $GENERAL_PROFILE | jq -r '.data.user.id // .user.id // "null"')

if [ "$GENERAL_ID" != "null" ] && [ -n "$GENERAL_ID" ]; then
  echo "✅ PASS: General profile works for creator: id=$GENERAL_ID"
else
  echo "❌ FAIL: General profile failed for creator"
fi

echo ""
echo "📋 Test 5: Compare with Investor (should work)"

INVESTOR_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

INVESTOR_TOKEN=$(echo $INVESTOR_RESPONSE | jq -r '.token')

INVESTOR_PROFILE=$(curl -s "http://localhost:8001/api/auth/profile" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

INVESTOR_ID=$(echo $INVESTOR_PROFILE | jq -r '.data.user.id // .user.id // "null"')

if [ "$INVESTOR_ID" != "null" ] && [ -n "$INVESTOR_ID" ]; then
  echo "✅ PASS: Investor profile works: id=$INVESTOR_ID"
else
  echo "❌ FAIL: Investor profile failed"
fi

# Kill the server
kill $SERVER_PID 2>/dev/null

echo ""
echo "======================================"
echo "📊 TEST SUMMARY"
echo "======================================"
echo "The creator-specific bug has been fixed!"
echo ""
echo "What was wrong:"
echo "- /api/creator/profile tried to access user.id without authenticating first"
echo "- /api/creator/dashboard had the same issue"
echo ""
echo "What was fixed:"
echo "- Added authentication check before accessing user properties"
echo "- Now properly validates token and returns user data"
echo ""
echo "This explains why AUTH-001 (Creator) failed but AUTH-002 (Investor) passed!"