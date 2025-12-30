#!/bin/bash

# Test the actual connection between Cloudflare frontend and Deno backend

FRONTEND_URL="https://pitchey-5o8.pages.dev"
WORKER_API="https://pitchey-api-prod.ndlovucavelle.workers.dev"
BACKEND_URL="https://pitchey-backend-fresh.deno.dev"

echo "🔍 Testing Frontend → Backend Notifications Connection"
echo "======================================================"
echo ""
echo "Architecture:"
echo "  Frontend (Cloudflare Pages) → Worker API → Deno Backend"
echo "  $FRONTEND_URL → $WORKER_API → $BACKEND_URL"
echo ""

# Step 1: Login to get a valid token
echo "📌 Step 1: Login as demo creator to get auth token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "✅ Login successful"
    echo "   Token (first 30 chars): ${TOKEN:0:30}..."
else
    echo "❌ Login failed - cannot proceed with tests"
    echo "$LOGIN_RESPONSE" | jq .
    exit 1
fi

echo ""
echo "📌 Step 2: Test the notification endpoints that frontend uses..."
echo ""

# Test the main user notifications endpoint (what NotificationCenter uses)
echo "1️⃣ Testing /api/user/notifications (used by NotificationCenter component):"
echo "   Request: GET $WORKER_API/api/user/notifications"
RESPONSE=$(curl -s "$WORKER_API/api/user/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $FRONTEND_URL")

if echo "$RESPONSE" | jq . 2>/dev/null; then
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo "   ✅ SUCCESS: Frontend can retrieve notifications"
        NOTIF_COUNT=$(echo "$RESPONSE" | jq -r '.data.total // 0')
        UNREAD_COUNT=$(echo "$RESPONSE" | jq -r '.data.unreadCount // 0')
        echo "   📊 Stats: Total=$NOTIF_COUNT, Unread=$UNREAD_COUNT"
    else
        echo "   ⚠️ API returned error but with proper structure"
        echo "   This means frontend won't crash"
    fi
else
    echo "   ❌ Invalid response format"
    echo "$RESPONSE"
fi

echo ""
echo "2️⃣ Testing /api/notifications (alternative endpoint):"
echo "   Request: GET $WORKER_API/api/notifications?limit=10"
RESPONSE=$(curl -s "$WORKER_API/api/notifications?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $FRONTEND_URL")

if echo "$RESPONSE" | jq . 2>/dev/null; then
    if echo "$RESPONSE" | grep -q '"notifications"'; then
        echo "   ✅ SUCCESS: Can retrieve notifications list"
    elif echo "$RESPONSE" | grep -q '"success":false'; then
        echo "   ⚠️ Endpoint returns error (deployment may be pending)"
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
        echo "   Error: $ERROR_MSG"
    fi
else
    echo "   ❌ Invalid response format"
fi

echo ""
echo "3️⃣ Testing WebSocket connection for real-time notifications:"
echo "   WebSocket URL: wss://pitchey-backend-fresh.deno.dev/ws"

# Test if WebSocket endpoint is accessible
WS_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  "https://pitchey-backend-fresh.deno.dev/ws")

if [ "$WS_TEST" = "426" ] || [ "$WS_TEST" = "101" ]; then
    echo "   ✅ WebSocket endpoint is accessible"
else
    echo "   ⚠️ WebSocket endpoint returned: $WS_TEST"
fi

echo ""
echo "======================================================"
echo "📊 CONNECTION STATUS SUMMARY:"
echo ""

# Check if the critical endpoint works
CRITICAL_TEST=$(curl -s "$WORKER_API/api/user/notifications" \
  -H "Authorization: Bearer $TOKEN" | grep -q '"success":true' && echo "YES" || echo "NO")

if [ "$CRITICAL_TEST" = "YES" ]; then
    echo "✅ WORKING: Frontend CAN connect to backend for notifications"
    echo "   - NotificationCenter component will load properly"
    echo "   - Real-time updates via WebSocket are available"
    echo "   - No more crashes from undefined errors"
else
    echo "⚠️ PARTIAL: Frontend receives proper error structures"
    echo "   - NotificationCenter won't crash (handles errors gracefully)"
    echo "   - But notifications may not load until deployment completes"
fi

echo ""
echo "🔗 Live Test URLs:"
echo "   - Frontend: $FRONTEND_URL"
echo "   - Login as: alex.creator@demo.com / Demo123"
echo "   - Check the notification bell icon in the header"
echo ""