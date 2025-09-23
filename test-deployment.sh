#!/bin/bash

# Test Pitchey Backend Deployment
# Usage: ./test-deployment.sh [BASE_URL]

BASE_URL=${1:-"http://localhost:8000"}

echo "🧪 Testing Pitchey backend at: $BASE_URL"
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" "$BASE_URL/api/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed"
    echo "   Response: $RESPONSE_BODY"
else
    echo "❌ Health check failed (HTTP $HTTP_CODE)"
    echo "   Response: $RESPONSE_BODY"
    exit 1
fi

echo ""

# Test 2: Creator login
echo "2. Testing creator authentication..."
LOGIN_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
    -X POST "$BASE_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "alex.creator@demo.com",
        "password": "Demo123"
    }')

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Creator login successful"
    
    # Extract token for further tests
    TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        echo "   Token received: ${TOKEN:0:20}..."
    else
        echo "   ⚠️  No token in response"
    fi
else
    echo "❌ Creator login failed (HTTP $HTTP_CODE)"
    echo "   Response: $RESPONSE_BODY"
    echo "   Make sure demo users are created in the database"
fi

echo ""

# Test 3: Profile endpoint (if we have a token)
if [ -n "$TOKEN" ]; then
    echo "3. Testing profile endpoint..."
    PROFILE_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
        "$BASE_URL/api/profile" \
        -H "Authorization: Bearer $TOKEN")
    
    HTTP_CODE=$(echo "$PROFILE_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$PROFILE_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Profile endpoint working"
        echo "   User data received"
    else
        echo "❌ Profile endpoint failed (HTTP $HTTP_CODE)"
        echo "   Response: $RESPONSE_BODY"
    fi
else
    echo "3. ⏭️  Skipping profile test (no auth token)"
fi

echo ""

# Test 4: Creator dashboard
if [ -n "$TOKEN" ]; then
    echo "4. Testing creator dashboard..."
    DASHBOARD_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
        "$BASE_URL/api/creator/dashboard" \
        -H "Authorization: Bearer $TOKEN")
    
    HTTP_CODE=$(echo "$DASHBOARD_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$DASHBOARD_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Creator dashboard working"
        echo "   Dashboard data received"
    else
        echo "❌ Creator dashboard failed (HTTP $HTTP_CODE)"
        echo "   Response: $RESPONSE_BODY"
    fi
else
    echo "4. ⏭️  Skipping dashboard test (no auth token)"
fi

echo ""

# Test 5: Investor login
echo "5. Testing investor authentication..."
INVESTOR_LOGIN_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
    -X POST "$BASE_URL/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "sarah.investor@demo.com",
        "password": "Demo123"
    }')

HTTP_CODE=$(echo "$INVESTOR_LOGIN_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$INVESTOR_LOGIN_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Investor login successful"
else
    echo "❌ Investor login failed (HTTP $HTTP_CODE)"
    echo "   Response: $RESPONSE_BODY"
fi

echo ""

# Test 6: Production login
echo "6. Testing production authentication..."
PRODUCTION_LOGIN_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" \
    -X POST "$BASE_URL/api/auth/production/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "stellar.production@demo.com",
        "password": "Demo123"
    }')

HTTP_CODE=$(echo "$PRODUCTION_LOGIN_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PRODUCTION_LOGIN_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Production login successful"
else
    echo "❌ Production login failed (HTTP $HTTP_CODE)"
    echo "   Response: $RESPONSE_BODY"
fi

echo ""
echo "🎉 Test suite complete!"
echo ""
echo "📋 Summary:"
echo "   Demo credentials that should work:"
echo "   - alex.creator@demo.com / Demo123"
echo "   - sarah.investor@demo.com / Demo123"
echo "   - stellar.production@demo.com / Demo123"
echo ""
echo "   Frontend should be able to connect to: $BASE_URL"