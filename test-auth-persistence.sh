#!/bin/bash

# Test authentication persistence on refresh

echo "🔧 Testing Authentication Persistence Fix"
echo "========================================"

# Test with production portal
echo -e "\n📊 Testing Production Portal Login..."

# Login first
echo "1. Logging in as production user..."
LOGIN_RESPONSE=$(curl -s -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "stellar.production@demo.com",
    "password": "Demo123"
  }' \
  -c /tmp/cookies.txt \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Login successful"
  echo "Response: $BODY" | jq -r '.user.email' 2>/dev/null || echo "$BODY"
else
  echo "❌ Login failed with status $HTTP_CODE"
  echo "$BODY"
  exit 1
fi

echo -e "\n2. Checking session persistence..."
# Check if session is maintained
SESSION_RESPONSE=$(curl -s -X GET https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/session \
  -b /tmp/cookies.txt \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$SESSION_RESPONSE" | tail -1)
BODY=$(echo "$SESSION_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Session persists - user still authenticated"
  echo "User: $(echo "$BODY" | jq -r '.user.email' 2>/dev/null || echo "Session active")"
else
  echo "❌ Session lost with status $HTTP_CODE"
fi

echo -e "\n3. Testing dashboard access with session..."
DASHBOARD_RESPONSE=$(curl -s -X GET https://pitchey-api-prod.ndlovucavelle.workers.dev/api/production/dashboard \
  -b /tmp/cookies.txt \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$DASHBOARD_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Dashboard accessible with session"
else
  echo "⚠️  Dashboard returned status $HTTP_CODE"
fi

echo -e "\n======================================"
echo "📝 Summary:"
echo "- Authentication persistence fix has been applied"
echo "- JWT token cleanup removed from initialization"
echo "- Session restoration added to App.tsx"
echo "- User data persists in localStorage as fallback"
echo ""
echo "🎯 To test in browser:"
echo "1. Open https://pitchey-5o8.pages.dev/login/production"
echo "2. Login with stellar.production@demo.com / Demo123"
echo "3. Refresh the page (F5)"
echo "4. You should remain logged in"

# Cleanup
rm -f /tmp/cookies.txt