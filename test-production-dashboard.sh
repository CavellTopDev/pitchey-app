#!/bin/bash

echo "Testing Production Dashboard Analytics..."

# Login as production demo user
echo -e "\n1. Logging in as production demo user..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .token)

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to login"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"

# Test analytics dashboard endpoint
echo -e "\n2. Fetching dashboard analytics..."
ANALYTICS_RESPONSE=$(curl -s -X GET http://localhost:8001/api/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN")

echo "Analytics Response:"
echo "$ANALYTICS_RESPONSE" | jq '{
  success: .success,
  totalViews: .data.analytics.totalViews,
  totalLikes: .data.analytics.totalLikes,
  totalNDAs: .data.analytics.totalNDAs,
  viewsChange: .data.analytics.viewsChange,
  likesChange: .data.analytics.likesChange,
  ndasChange: .data.analytics.ndasChange,
  topPitch: .data.analytics.topPitch,
  recentActivityCount: (.data.analytics.recentActivity | length)
}'

echo -e "\n3. To test in browser:"
echo "   - Open browser console (F12)"
echo "   - Set auth token:"
echo "     localStorage.setItem('authToken', '$TOKEN');"
echo "   - Navigate to http://localhost:5173/production/dashboard"
echo "   - You should now see:"
echo "     • Total Views: 0"
echo "     • Total Likes: 0"
echo "     • NDAs Signed: 0"
echo "     • No top performing pitch yet"
echo "     • No recent activity yet"
