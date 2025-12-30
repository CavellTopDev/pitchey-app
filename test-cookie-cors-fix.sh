#!/bin/bash

# Test Cookie and CORS Configuration Fixes
# Verifies that authentication works correctly across domains

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"

echo "🍪 Testing Cookie & CORS Configuration"
echo "======================================"
echo ""

# Test 1: Login with correct origin and verify cookies
echo "📝 Test 1: Login with production origin"
echo "----------------------------------------"
LOGIN_RESPONSE=$(curl -s -i -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $FRONTEND_URL" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

# Extract headers and body
HEADERS=$(echo "$LOGIN_RESPONSE" | sed '/^$/q')
BODY=$(echo "$LOGIN_RESPONSE" | sed '1,/^$/d')

echo "Response headers:"
echo "$HEADERS" | grep -E "(Set-Cookie|Access-Control-Allow-Origin|Access-Control-Allow-Credentials)"
echo ""

# Check for proper cookie settings
if echo "$HEADERS" | grep -q "Set-Cookie.*SameSite=None"; then
  echo "✅ Cookie has SameSite=None for cross-origin"
else
  echo "❌ Cookie missing SameSite=None"
fi

if echo "$HEADERS" | grep -q "Set-Cookie.*Secure"; then
  echo "✅ Cookie has Secure flag"
else
  echo "❌ Cookie missing Secure flag"
fi

if echo "$HEADERS" | grep -q "Access-Control-Allow-Origin: $FRONTEND_URL"; then
  echo "✅ CORS origin matches frontend URL"
else
  echo "❌ CORS origin doesn't match (should be $FRONTEND_URL)"
fi

if echo "$HEADERS" | grep -q "Access-Control-Allow-Credentials: true"; then
  echo "✅ CORS credentials are enabled"
else
  echo "❌ CORS credentials not enabled"
fi

echo ""

# Test 2: Check session validation with cookies
echo "📝 Test 2: Session validation with cookies"
echo "-------------------------------------------"

# Extract cookie from login response
COOKIE=$(echo "$HEADERS" | grep -o "better-auth-session=[^;]*" | head -1)

if [ -n "$COOKIE" ]; then
  echo "Using cookie: $COOKIE"
  
  SESSION_RESPONSE=$(curl -s -i -X GET "$API_URL/api/auth/session" \
    -H "Cookie: $COOKIE" \
    -H "Origin: $FRONTEND_URL")
  
  SESSION_HEADERS=$(echo "$SESSION_RESPONSE" | sed '/^$/q')
  SESSION_BODY=$(echo "$SESSION_RESPONSE" | sed '1,/^$/d')
  
  if echo "$SESSION_BODY" | grep -q '"user"'; then
    echo "✅ Session validated successfully with cookie"
  else
    echo "❌ Session validation failed"
    echo "Response: $SESSION_BODY"
  fi
  
  # Check CORS headers on session endpoint
  if echo "$SESSION_HEADERS" | grep -q "Access-Control-Allow-Origin: $FRONTEND_URL"; then
    echo "✅ Session endpoint has correct CORS headers"
  else
    echo "❌ Session endpoint has incorrect CORS headers"
  fi
else
  echo "❌ No cookie found in login response"
fi

echo ""

# Test 3: Test NDA request with cookie authentication
echo "📝 Test 3: NDA request with cookie auth"
echo "----------------------------------------"

if [ -n "$COOKIE" ]; then
  NDA_RESPONSE=$(curl -s -i -X POST "$API_URL/api/ndas/request" \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -H "Origin: $FRONTEND_URL" \
    -d '{"pitchId": 214, "message": "Testing cookie auth"}')
  
  NDA_HEADERS=$(echo "$NDA_RESPONSE" | sed '/^$/q')
  NDA_BODY=$(echo "$NDA_RESPONSE" | sed '1,/^$/d')
  
  if echo "$NDA_BODY" | grep -q '"success":true'; then
    echo "✅ NDA request successful with cookie auth"
  elif echo "$NDA_BODY" | grep -q "already exists"; then
    echo "⚠️  NDA already exists (expected for repeated tests)"
  else
    echo "❌ NDA request failed"
    echo "Response: $NDA_BODY"
  fi
  
  # Verify CORS headers are consistent
  if echo "$NDA_HEADERS" | grep -q "Access-Control-Allow-Origin: $FRONTEND_URL"; then
    echo "✅ NDA endpoint has correct CORS headers"
  else
    echo "❌ NDA endpoint has incorrect CORS headers"
  fi
fi

echo ""

# Test 4: Test logout clears cookie properly
echo "📝 Test 4: Logout cookie clearing"
echo "----------------------------------"

if [ -n "$COOKIE" ]; then
  LOGOUT_RESPONSE=$(curl -s -i -X POST "$API_URL/api/auth/signout" \
    -H "Cookie: $COOKIE" \
    -H "Origin: $FRONTEND_URL")
  
  LOGOUT_HEADERS=$(echo "$LOGOUT_RESPONSE" | sed '/^$/q')
  
  if echo "$LOGOUT_HEADERS" | grep -q "Set-Cookie.*better-auth-session=.*Max-Age=0"; then
    echo "✅ Logout properly clears cookie with Max-Age=0"
  else
    echo "❌ Logout doesn't clear cookie properly"
  fi
fi

echo ""

# Test 5: Test preflight OPTIONS request
echo "📝 Test 5: CORS preflight handling"
echo "-----------------------------------"

OPTIONS_RESPONSE=$(curl -s -i -X OPTIONS "$API_URL/api/auth/session" \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type")

OPTIONS_HEADERS=$(echo "$OPTIONS_RESPONSE" | sed '/^$/q')

if echo "$OPTIONS_HEADERS" | grep -q "Access-Control-Allow-Origin"; then
  echo "✅ OPTIONS request handled correctly"
  echo "$OPTIONS_HEADERS" | grep "Access-Control-"
else
  echo "❌ OPTIONS request not handled properly"
fi

echo ""
echo "🎯 Summary"
echo "=========="
echo "Cookie and CORS configuration test complete."
echo "Fixes ensure consistent cross-origin authentication."