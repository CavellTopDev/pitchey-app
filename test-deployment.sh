#!/bin/bash

echo "🔍 Testing Pitchey Backend Deployment Status"
echo "==========================================="
echo ""

# Test login and get the user ID
echo "1️⃣ Testing creator login..."
RESPONSE=$(curl -s https://pitchey-backend.deno.dev/api/auth/creator/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

USER_ID=$(echo "$RESPONSE" | jq -r '.user.id')
TOKEN=$(echo "$RESPONSE" | jq -r '.token')

if [ "$USER_ID" = "1" ]; then
  echo "✅ SUCCESS: Using correct ID (1) - Deployment is working!"
elif [ "$USER_ID" = "1001" ]; then
  echo "❌ OLD CODE: Still using ID 1001 - Deployment not updated yet"
else
  echo "⚠️ UNEXPECTED: Got user ID: $USER_ID"
fi

echo ""
echo "2️⃣ Testing dashboard endpoint..."
DASHBOARD=$(curl -s https://pitchey-backend.deno.dev/api/creator/dashboard \
  -H "Authorization: Bearer $TOKEN")

VIEWS=$(echo "$DASHBOARD" | jq -r '.data.stats.totalViews // "error"')
FOLLOWERS=$(echo "$DASHBOARD" | jq -r '.data.socialStats.followers // "error"')

echo "   Total Views: $VIEWS"
echo "   Followers: $FOLLOWERS"

if [ "$VIEWS" = "1250" ]; then
  echo "   ❌ MOCK DATA: Still showing hardcoded 1250 views"
elif [ "$VIEWS" = "0" ] || [ "$VIEWS" = "error" ]; then
  echo "   ⚠️ No data or error accessing dashboard"
else
  echo "   ✅ REAL DATA: Showing actual view count ($VIEWS)"
fi

echo ""
echo "==========================================="
echo "Deployment Status Summary:"
if [ "$USER_ID" = "1" ] && [ "$VIEWS" != "1250" ]; then
  echo "✅ DEPLOYMENT SUCCESSFUL - Real data implementation is live!"
else
  echo "⏳ DEPLOYMENT PENDING - Still using old code"
  echo ""
  echo "To promote the deployment manually:"
  echo "1. Go to Deno Deploy dashboard"  
  echo "2. Find the deployment 'Fix demo account IDs...'"
  echo "3. Click 'Promote to Production'"
fi
