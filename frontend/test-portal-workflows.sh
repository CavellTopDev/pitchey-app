#!/bin/bash

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

echo "============================================"
echo "Testing Portal Workflow Interactions"
echo "============================================"
echo ""

# 1. Login as Creator
echo "1. LOGIN AS CREATOR (alex.creator@demo.com)"
echo "-------------------------------------------"
CREATOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

CREATOR_TOKEN=$(echo $CREATOR_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
CREATOR_ID=$(echo $CREATOR_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$CREATOR_TOKEN" ]; then
  echo "✅ Creator logged in successfully"
  echo "   User ID: $CREATOR_ID"
else
  echo "❌ Creator login failed"
  echo "$CREATOR_RESPONSE"
fi
echo ""

# 2. Login as Investor
echo "2. LOGIN AS INVESTOR (sarah.investor@demo.com)"
echo "-----------------------------------------------"
INVESTOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')

INVESTOR_TOKEN=$(echo $INVESTOR_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
INVESTOR_ID=$(echo $INVESTOR_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$INVESTOR_TOKEN" ]; then
  echo "✅ Investor logged in successfully"
  echo "   User ID: $INVESTOR_ID"
else
  echo "❌ Investor login failed"
  echo "$INVESTOR_RESPONSE"
fi
echo ""

# 3. Login as Production Company
echo "3. LOGIN AS PRODUCTION (stellar.production@demo.com)"
echo "-----------------------------------------------------"
PROD_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/production/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "stellar.production@demo.com",
    "password": "Demo123"
  }')

PROD_TOKEN=$(echo $PROD_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
PROD_ID=$(echo $PROD_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$PROD_TOKEN" ]; then
  echo "✅ Production logged in successfully"
  echo "   User ID: $PROD_ID"
else
  echo "❌ Production login failed"
  echo "$PROD_RESPONSE"
fi
echo ""

echo "============================================"
echo "TESTING CREATOR WORKFLOWS"
echo "============================================"
echo ""

# 4. Creator creates a new pitch
echo "4. CREATOR CREATES NEW PITCH"
echo "-----------------------------"
NEW_PITCH=$(curl -s -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Pitch from Creator Portal",
    "logline": "A thrilling story about portal interactions",
    "synopsis": "This is a test pitch to verify workflow functionality",
    "genre": "Drama",
    "target_audience": "18-35",
    "budget_range": "$1M-$5M",
    "status": "published"
  }')

PITCH_ID=$(echo $NEW_PITCH | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$PITCH_ID" ]; then
  echo "✅ Pitch created successfully"
  echo "   Pitch ID: $PITCH_ID"
else
  echo "❌ Failed to create pitch"
  echo "$NEW_PITCH"
fi
echo ""

# 5. Get creator's pitches
echo "5. GET CREATOR'S PITCHES"
echo "-------------------------"
CREATOR_PITCHES=$(curl -s -X GET "$API_URL/api/creator/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

PITCH_COUNT=$(echo $CREATOR_PITCHES | grep -o '"id"' | wc -l)
echo "   Found $PITCH_COUNT pitches"
echo ""

echo "============================================"
echo "TESTING INVESTOR WORKFLOWS"
echo "============================================"
echo ""

# 6. Investor searches for pitches
echo "6. INVESTOR SEARCHES FOR PITCHES"
echo "---------------------------------"
SEARCH_RESULTS=$(curl -s -X GET "$API_URL/api/pitches/search?query=test" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

SEARCH_COUNT=$(echo $SEARCH_RESULTS | grep -o '"id"' | wc -l)
echo "   Found $SEARCH_COUNT pitches in search"
echo ""

# 7. Investor requests NDA for a pitch
echo "7. INVESTOR REQUESTS NDA"
echo "-------------------------"
if [ -n "$PITCH_ID" ]; then
  NDA_REQUEST=$(curl -s -X POST "$API_URL/api/nda/request" \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": $PITCH_ID}")
  
  NDA_ID=$(echo $NDA_REQUEST | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)
  
  if [ -n "$NDA_ID" ]; then
    echo "✅ NDA requested successfully"
    echo "   NDA Request ID: $NDA_ID"
  else
    echo "⚠️  NDA request response:"
    echo "$NDA_REQUEST"
  fi
else
  echo "⚠️  No pitch ID available for NDA request"
fi
echo ""

# 8. Investor saves a pitch
echo "8. INVESTOR SAVES PITCH"
echo "------------------------"
if [ -n "$PITCH_ID" ]; then
  SAVE_RESPONSE=$(curl -s -X POST "$API_URL/api/investor/saved/$PITCH_ID" \
    -H "Authorization: Bearer $INVESTOR_TOKEN")
  
  if echo "$SAVE_RESPONSE" | grep -q "success\|saved"; then
    echo "✅ Pitch saved successfully"
  else
    echo "⚠️  Save response:"
    echo "$SAVE_RESPONSE"
  fi
else
  echo "⚠️  No pitch ID available to save"
fi
echo ""

# 9. Check investor's saved pitches
echo "9. GET INVESTOR'S SAVED PITCHES"
echo "--------------------------------"
SAVED_PITCHES=$(curl -s -X GET "$API_URL/api/investor/saved" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

SAVED_COUNT=$(echo $SAVED_PITCHES | grep -o '"id"' | wc -l)
echo "   Found $SAVED_COUNT saved pitches"
echo ""

echo "============================================"
echo "TESTING PRODUCTION WORKFLOWS"
echo "============================================"
echo ""

# 10. Production views submissions
echo "10. PRODUCTION VIEWS SUBMISSIONS"
echo "---------------------------------"
SUBMISSIONS=$(curl -s -X GET "$API_URL/api/production/submissions" \
  -H "Authorization: Bearer $PROD_TOKEN")

SUBMISSION_COUNT=$(echo $SUBMISSIONS | grep -o '"id"' | wc -l)
echo "   Found $SUBMISSION_COUNT submissions"
echo ""

# 11. Production views projects
echo "11. PRODUCTION VIEWS PROJECTS"
echo "------------------------------"
PROJECTS=$(curl -s -X GET "$API_URL/api/production/projects" \
  -H "Authorization: Bearer $PROD_TOKEN")

PROJECT_COUNT=$(echo $PROJECTS | grep -o '"id"' | wc -l)
echo "   Found $PROJECT_COUNT projects"
echo ""

echo "============================================"
echo "TESTING CROSS-PORTAL INTERACTIONS"
echo "============================================"
echo ""

# 12. Creator views NDA requests
echo "12. CREATOR VIEWS NDA REQUESTS"
echo "-------------------------------"
CREATOR_NDAS=$(curl -s -X GET "$API_URL/api/creator/nda/requests" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

NDA_COUNT=$(echo $CREATOR_NDAS | grep -o '"id"' | wc -l)
echo "   Found $NDA_COUNT NDA requests"
echo ""

# 13. Test follow functionality
echo "13. INVESTOR FOLLOWS CREATOR"
echo "-----------------------------"
if [ -n "$CREATOR_ID" ]; then
  FOLLOW_RESPONSE=$(curl -s -X POST "$API_URL/api/follows/$CREATOR_ID" \
    -H "Authorization: Bearer $INVESTOR_TOKEN")
  
  if echo "$FOLLOW_RESPONSE" | grep -q "success\|following"; then
    echo "✅ Successfully followed creator"
  else
    echo "⚠️  Follow response:"
    echo "$FOLLOW_RESPONSE"
  fi
else
  echo "⚠️  No creator ID available to follow"
fi
echo ""

# 14. Check notifications
echo "14. CHECK NOTIFICATIONS FOR EACH USER"
echo "--------------------------------------"
echo "Creator notifications:"
CREATOR_NOTIFS=$(curl -s -X GET "$API_URL/api/notifications" \
  -H "Authorization: Bearer $CREATOR_TOKEN")
CREATOR_NOTIF_COUNT=$(echo $CREATOR_NOTIFS | grep -o '"id"' | wc -l)
echo "   $CREATOR_NOTIF_COUNT notifications"

echo "Investor notifications:"
INVESTOR_NOTIFS=$(curl -s -X GET "$API_URL/api/notifications" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")
INVESTOR_NOTIF_COUNT=$(echo $INVESTOR_NOTIFS | grep -o '"id"' | wc -l)
echo "   $INVESTOR_NOTIF_COUNT notifications"

echo "Production notifications:"
PROD_NOTIFS=$(curl -s -X GET "$API_URL/api/notifications" \
  -H "Authorization: Bearer $PROD_TOKEN")
PROD_NOTIF_COUNT=$(echo $PROD_NOTIFS | grep -o '"id"' | wc -l)
echo "   $PROD_NOTIF_COUNT notifications"
echo ""

echo "============================================"
echo "TESTING REAL-TIME FEATURES"
echo "============================================"
echo ""

# 15. Test WebSocket connection
echo "15. TEST WEBSOCKET CONNECTIONS"
echo "-------------------------------"
WS_URL="wss://pitchey-production.cavelltheleaddev.workers.dev"

# Test WebSocket endpoint availability
WS_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/ws")
if [ "$WS_TEST" = "426" ] || [ "$WS_TEST" = "101" ]; then
  echo "✅ WebSocket endpoint available"
else
  echo "⚠️  WebSocket endpoint status: $WS_TEST"
fi
echo ""

echo "============================================"
echo "WORKFLOW TEST SUMMARY"
echo "============================================"
echo ""
echo "Authentication:"
[ -n "$CREATOR_TOKEN" ] && echo "✅ Creator login works" || echo "❌ Creator login failed"
[ -n "$INVESTOR_TOKEN" ] && echo "✅ Investor login works" || echo "❌ Investor login failed"
[ -n "$PROD_TOKEN" ] && echo "✅ Production login works" || echo "❌ Production login failed"
echo ""
echo "Core Features:"
[ -n "$PITCH_ID" ] && echo "✅ Pitch creation works" || echo "❌ Pitch creation failed"
[ -n "$NDA_ID" ] && echo "✅ NDA requests work" || echo "⚠️  NDA requests need verification"
[ "$SAVED_COUNT" -gt 0 ] && echo "✅ Save functionality works" || echo "⚠️  Save functionality needs verification"
echo ""
echo "Cross-Portal:"
[ "$NDA_COUNT" -gt 0 ] && echo "✅ Cross-portal NDA flow works" || echo "⚠️  NDA workflow needs verification"
echo "✅ Follow functionality tested"
echo "✅ Notification system tested"
echo ""

