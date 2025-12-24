#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo "====================================="
echo "JWT Authentication Debug Test"
echo "====================================="
echo ""

# Step 1: Login and get token
echo "1. Getting fresh JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}')

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq '.'
echo ""

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained successfully"
echo "Token (first 50 chars): ${TOKEN:0:50}..."
echo ""

# Step 2: Decode JWT payload (base64)
echo "2. Decoding JWT payload..."
PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
# Add padding if needed
PADDING=$(( 4 - ${#PAYLOAD} % 4 ))
if [ $PADDING -ne 4 ]; then
  PAYLOAD="${PAYLOAD}$(printf '=%.0s' $(seq 1 $PADDING))"
fi
DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo "$PAYLOAD" | base64 -D 2>/dev/null)
echo "JWT Payload:"
echo "$DECODED" | jq '.' 2>/dev/null || echo "$DECODED"
echo ""

# Step 3: Test session endpoint
echo "3. Testing /api/auth/session..."
SESSION_RESPONSE=$(curl -s "$API_URL/api/auth/session" \
  -H "Authorization: Bearer $TOKEN")
echo "Session response:"
echo "$SESSION_RESPONSE" | jq '.'
echo ""

# Step 4: Test profile endpoint  
echo "4. Testing /api/users/profile..."
PROFILE_RESPONSE=$(curl -s "$API_URL/api/users/profile" \
  -H "Authorization: Bearer $TOKEN")
echo "Profile response:"
echo "$PROFILE_RESPONSE" | jq '.'
echo ""

# Step 5: Test a pitch creation (POST endpoint)
echo "5. Testing POST /api/pitches (protected endpoint)..."
PITCH_RESPONSE=$(curl -s -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Pitch",
    "logline": "A test pitch for JWT validation",
    "genre": "Action",
    "format": "Feature Film",
    "budgetRange": "$1M-$5M",
    "targetAudience": "18-35",
    "synopsis": "Testing JWT authentication"
  }')
echo "Create pitch response:"
echo "$PITCH_RESPONSE" | jq '.'
echo ""

# Step 6: Test with invalid token
echo "6. Testing with invalid token..."
INVALID_RESPONSE=$(curl -s "$API_URL/api/users/profile" \
  -H "Authorization: Bearer invalid-token-12345")
echo "Invalid token response:"
echo "$INVALID_RESPONSE" | jq '.'
echo ""

# Step 7: Test without token
echo "7. Testing without token..."
NO_TOKEN_RESPONSE=$(curl -s "$API_URL/api/users/profile")
echo "No token response:"
echo "$NO_TOKEN_RESPONSE" | jq '.'
echo ""

echo "====================================="
echo "Debug Summary"
echo "====================================="

if echo "$SESSION_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Session endpoint works"
else
  echo "❌ Session endpoint failed"
fi

if echo "$PROFILE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Profile endpoint works"
else
  echo "❌ Profile endpoint failed"
fi

if echo "$PITCH_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Protected POST endpoint works"
else
  echo "❌ Protected POST endpoint failed"
fi

echo ""
echo "Token expiry check:"
if echo "$DECODED" | grep -q '"exp"'; then
  EXP=$(echo "$DECODED" | jq -r '.exp')
  NOW=$(date +%s)
  if [ "$EXP" -gt "$NOW" ]; then
    REMAINING=$((EXP - NOW))
    echo "✅ Token is valid for $((REMAINING / 60)) more minutes"
  else
    echo "❌ Token has expired"
  fi
fi