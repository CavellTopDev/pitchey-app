#!/bin/bash

# Quick test for critical issues

API_URL="https://pitchey-optimized.cavelltheleaddev.workers.dev"

echo "=== TESTING CRITICAL ISSUES ==="

# 1. Test Investor Login & Logout
echo -e "\n1. Testing Investor Authentication..."

# Login
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "✓ Investor login successful"
    
    # Test logout
    LOGOUT_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/logout" \
      -H "Authorization: Bearer $TOKEN" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$LOGOUT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
        echo "✓ Logout endpoint exists (HTTP $HTTP_STATUS)"
    else
        echo "✗ Logout endpoint issue (HTTP $HTTP_STATUS)"
    fi
else
    echo "✗ Investor login failed"
fi

# 2. Test Investor Dashboard
echo -e "\n2. Testing Investor Dashboard..."

# Re-login for fresh token
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

DASHBOARD_RESPONSE=$(curl -s "$API_URL/api/investor/dashboard" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$DASHBOARD_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✓ Dashboard endpoint accessible (HTTP 200)"
    
    # Check for expected data
    if echo "$DASHBOARD_RESPONSE" | grep -q "portfolio\|savedPitches\|investments"; then
        echo "✓ Dashboard returns expected data"
    else
        echo "✗ Dashboard data structure issue"
    fi
else
    echo "✗ Dashboard endpoint failed (HTTP $HTTP_STATUS)"
fi

# 3. Test Browse Tab Separation
echo -e "\n3. Testing Browse Tab Content..."

# Test Trending
TRENDING=$(curl -s "$API_URL/api/pitches/trending?limit=2" | grep -o '"id"' | wc -l)
echo "Trending pitches found: $TRENDING"

# Test New
NEW=$(curl -s "$API_URL/api/pitches/new?limit=2" | grep -o '"id"' | wc -l)
echo "New pitches found: $NEW"

# Test if Top Rated still exists
TOP_RATED_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/pitches/top-rated")
if [ "$TOP_RATED_STATUS" = "404" ]; then
    echo "✓ Top Rated endpoint removed (404)"
else
    echo "✗ Top Rated endpoint still exists (HTTP $TOP_RATED_STATUS)"
fi

# 4. Test Access Control
echo -e "\n4. Testing Access Control..."

# Test if investor can create pitch (should be blocked)
CREATE_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","logline":"Test"}')

if [ "$CREATE_RESPONSE" = "403" ] || [ "$CREATE_RESPONSE" = "401" ]; then
    echo "✓ Investor blocked from creating pitches (HTTP $CREATE_RESPONSE)"
else
    echo "✗ SECURITY: Investor can create pitches (HTTP $CREATE_RESPONSE)"
fi

# 5. Test NDA Workflow
echo -e "\n5. Testing NDA Workflow..."

# Get a pitch ID
PITCH_ID=$(curl -s "$API_URL/api/pitches/public?limit=1" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -n "$PITCH_ID" ]; then
    # Request NDA
    NDA_RESPONSE=$(curl -s -X POST "$API_URL/api/ndas/request" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"pitchId\":$PITCH_ID}" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$NDA_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
        echo "✓ NDA request endpoint working (HTTP $HTTP_STATUS)"
    else
        echo "✗ NDA request failed (HTTP $HTTP_STATUS)"
    fi
fi

echo -e "\n=== TEST COMPLETE ===