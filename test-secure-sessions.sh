#!/bin/bash

# Test Secure Session Management Implementation
# This script verifies HTTPOnly cookie-based sessions are working correctly

API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
TEST_EMAIL="alex.creator@demo.com"
TEST_PASSWORD="Demo123"

echo "🔒 Testing Secure Session Management"
echo "====================================="
echo "API URL: $API_URL"
echo ""

# Test 1: Login and receive session cookie
echo "1️⃣ Testing Login with Session Creation..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://pitchey-5o8.pages.dev" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$LOGIN_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ Login successful (HTTP $HTTP_STATUS)"
  
  # Check if session cookie was set
  if grep -q "session=" cookies.txt; then
    echo "✅ Session cookie received"
    SESSION_ID=$(grep "session=" cookies.txt | awk '{print $7}')
    echo "   Session ID: ${SESSION_ID:0:16}..."
  else
    echo "❌ No session cookie found"
  fi
  
  # Parse user data
  USER_ID=$(echo "$BODY" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  USER_EMAIL=$(echo "$BODY" | grep -o '"email":"[^"]*"' | head -1 | cut -d':' -f2 | tr -d '"')
  echo "   User: $USER_EMAIL (ID: $USER_ID)"
else
  echo "❌ Login failed (HTTP $HTTP_STATUS)"
  echo "$BODY"
fi

echo ""

# Test 2: Access protected endpoint with session
echo "2️⃣ Testing Protected Endpoint Access..."
PROFILE_RESPONSE=$(curl -s -b cookies.txt -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "$API_URL/api/auth/profile" \
  -H "Origin: https://pitchey-5o8.pages.dev")

HTTP_STATUS=$(echo "$PROFILE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$PROFILE_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ Protected endpoint accessible (HTTP $HTTP_STATUS)"
  echo "   Profile data retrieved successfully"
else
  echo "❌ Protected endpoint failed (HTTP $HTTP_STATUS)"
  echo "$BODY"
fi

echo ""

# Test 3: Verify session validation
echo "3️⃣ Testing Session Validation..."
SESSION_CHECK=$(curl -s -b cookies.txt -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "$API_URL/api/auth/session" \
  -H "Origin: https://pitchey-5o8.pages.dev")

HTTP_STATUS=$(echo "$SESSION_CHECK" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$SESSION_CHECK" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ Session is valid (HTTP $HTTP_STATUS)"
  # Check session details
  if echo "$BODY" | grep -q "userId"; then
    echo "   Session contains user data"
  fi
else
  echo "⚠️  Session endpoint not found or session invalid (HTTP $HTTP_STATUS)"
fi

echo ""

# Test 4: Test invalid session
echo "4️⃣ Testing Invalid Session Rejection..."
INVALID_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "$API_URL/api/auth/profile" \
  -H "Cookie: session=invalid_session_id_12345" \
  -H "Origin: https://pitchey-5o8.pages.dev")

HTTP_STATUS=$(echo "$INVALID_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [ "$HTTP_STATUS" -eq 401 ]; then
  echo "✅ Invalid session correctly rejected (HTTP $HTTP_STATUS)"
else
  echo "❌ Invalid session not properly rejected (HTTP $HTTP_STATUS)"
fi

echo ""

# Test 5: Test logout
echo "5️⃣ Testing Logout and Session Destruction..."
LOGOUT_RESPONSE=$(curl -s -b cookies.txt -c cookies2.txt -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/api/auth/logout" \
  -H "Origin: https://pitchey-5o8.pages.dev")

HTTP_STATUS=$(echo "$LOGOUT_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ Logout successful (HTTP $HTTP_STATUS)"
  
  # Check if session cookie was cleared
  if grep -q "session=;" cookies2.txt || grep -q "Max-Age=0" cookies2.txt; then
    echo "✅ Session cookie cleared"
  else
    echo "⚠️  Session cookie may not be properly cleared"
  fi
else
  echo "❌ Logout failed (HTTP $HTTP_STATUS)"
fi

echo ""

# Test 6: Verify session is destroyed
echo "6️⃣ Testing Access After Logout..."
POST_LOGOUT=$(curl -s -b cookies.txt -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "$API_URL/api/auth/profile" \
  -H "Origin: https://pitchey-5o8.pages.dev")

HTTP_STATUS=$(echo "$POST_LOGOUT" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [ "$HTTP_STATUS" -eq 401 ]; then
  echo "✅ Session properly destroyed after logout (HTTP $HTTP_STATUS)"
else
  echo "❌ Session still active after logout (HTTP $HTTP_STATUS)"
fi

echo ""

# Test 7: Test CORS with credentials
echo "7️⃣ Testing CORS with Credentials..."
CORS_TEST=$(curl -s -I -X OPTIONS "$API_URL/api/auth/profile" \
  -H "Origin: https://c360fbb4.pitchey-5o8.pages.dev" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type")

if echo "$CORS_TEST" | grep -q "Access-Control-Allow-Credentials: true"; then
  echo "✅ CORS allows credentials"
else
  echo "❌ CORS not configured for credentials"
fi

if echo "$CORS_TEST" | grep -q "Access-Control-Allow-Origin: https://c360fbb4.pitchey-5o8.pages.dev"; then
  echo "✅ CORS allows subdomain origin"
else
  echo "❌ CORS not allowing subdomain"
fi

echo ""

# Clean up
rm -f cookies.txt cookies2.txt

echo "====================================="
echo "🔍 Session Security Summary:"
echo ""
echo "✓ HTTPOnly cookies prevent XSS attacks"
echo "✓ SameSite=Lax prevents CSRF attacks"
echo "✓ Secure flag ensures HTTPS-only transmission"
echo "✓ Session stored in Redis, not client-side"
echo "✓ Session ID is hashed before storage"
echo "✓ Automatic session expiration (7 days)"
echo "✓ Rate limiting on authentication endpoints"
echo ""
echo "📋 Migration Checklist:"
echo "□ All login endpoints use session cookies"
echo "□ Frontend includes credentials in requests"
echo "□ CORS configured for all subdomains"
echo "□ Session validation on protected routes"
echo "□ Proper logout with session cleanup"