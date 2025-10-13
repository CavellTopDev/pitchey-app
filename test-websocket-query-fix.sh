#!/bin/bash

echo "================================================"
echo "🔧 Testing WebSocket Conversations Query Fix"
echo "================================================"
echo ""

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzYwMTQ3MjExfQ.6H13EMdaTB52uSZ-P8IOISynVRJKuUX7GBlqUdOQCpM"

echo "1. Testing WebSocket Connection..."
# Use websocat if available, otherwise use curl for basic test
if command -v websocat &> /dev/null; then
    echo "Using websocat to test..."
    echo '{"type":"request_initial_data"}' | timeout 2s websocat "ws://localhost:8001/api/messages/ws?token=$TOKEN" 2>&1 | head -20
else
    echo "Testing upgrade request with curl..."
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        "http://localhost:8001/api/messages/ws?token=$TOKEN")
    
    if [ "$response" = "101" ]; then
        echo "✅ WebSocket upgrade successful (101 Switching Protocols)"
    else
        echo "❌ WebSocket returned: $response"
    fi
fi

echo ""
echo "2. Checking Backend Logs..."
echo "Look for these messages in your backend terminal:"
echo "  ✅ '📦 Sending initial data to user alex.creator'"
echo "  ✅ No error about 'operator does not exist'"
echo ""
echo "3. Testing Conversations API directly..."
# Test the conversations endpoint if it exists
response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8001/api/conversations" 2>/dev/null | tail -1)

if [ "$response" = "200" ]; then
    echo "✅ Conversations API working"
elif [ "$response" = "404" ]; then
    echo "⚠️ Conversations endpoint not found (expected if not implemented)"
else
    echo "❌ Conversations API returned: $response"
fi

echo ""
echo "================================================"
echo "📋 Fix Summary:"
echo "================================================"
echo ""
echo "✅ FIXED:"
echo "  • Changed from: conversations.participants @> ARRAY"
echo "  • Changed to: JOIN conversationParticipants table"
echo "  • Proper query using Drizzle relations"
echo ""
echo "The query now:"
echo "1. Joins conversations with conversationParticipants"
echo "2. Filters by userId in the join table"
echo "3. Returns user's conversations properly"
echo ""
echo "================================================"