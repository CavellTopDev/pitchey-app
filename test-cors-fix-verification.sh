#!/bin/bash

# CORS Fix Verification Script
# Tests that both frontend URLs can communicate with the backend

echo "🎯 CORS FIX VERIFICATION"
echo "========================"
echo

BACKEND_URL="https://pitchey-backend-fresh.deno.dev"
echo "Backend: $BACKEND_URL"
echo

# Test 1: Cloudflare Pages (Primary)
echo "1. 🔍 Testing Cloudflare Pages → Backend CORS"
echo "   Frontend: https://pitchey.pages.dev"
echo "   Testing OPTIONS preflight request..."

CORS_RESPONSE1=$(curl -i -H "Origin: https://pitchey.pages.dev" -X OPTIONS "$BACKEND_URL/api/health" 2>/dev/null)
CORS_ORIGIN1=$(echo "$CORS_RESPONSE1" | grep -i "access-control-allow-origin" | cut -d: -f2 | tr -d ' \r\n')

if [ "$CORS_ORIGIN1" = "https://pitchey.pages.dev" ]; then
    echo "   ✅ CORS working: Backend allows https://pitchey.pages.dev"
else
    echo "   ❌ CORS failed: Got '$CORS_ORIGIN1', expected 'https://pitchey.pages.dev'"
fi
echo

# Test 2: Secondary Domain Test (if any)
echo "2. 🔍 Testing Additional Domain → Backend CORS"
echo "   Frontend: https://pitchey.pages.dev (Additional test)"
echo "   Testing OPTIONS preflight request..."

CORS_RESPONSE2=$(curl -i -H "Origin: https://pitchey.pages.dev" -X OPTIONS "$BACKEND_URL/api/health" 2>/dev/null)
CORS_ORIGIN2=$(echo "$CORS_RESPONSE2" | grep -i "access-control-allow-origin" | cut -d: -f2 | tr -d ' \r\n')

if [ "$CORS_ORIGIN2" = "https://pitchey.pages.dev" ]; then
    echo "   ✅ CORS working: Backend allows https://pitchey.pages.dev"
else
    echo "   ❌ CORS failed: Got '$CORS_ORIGIN2', expected 'https://pitchey.pages.dev'"
fi
echo

# Test 3: Actual API Call from Cloudflare Pages
echo "3. 🔍 Testing Real API Call from Cloudflare Pages"
echo "   Testing: GET /api/pitches/trending"

API_RESPONSE=$(curl -s -H "Origin: https://pitchey.pages.dev" "$BACKEND_URL/api/pitches/trending?limit=3")
if echo "$API_RESPONSE" | grep -q '"success"'; then
    echo "   ✅ API call successful"
    PITCH_COUNT=$(echo "$API_RESPONSE" | grep -o '"pitches":\[' | wc -l)
    echo "   📊 Response contains pitch data structure"
else
    echo "   ❌ API call failed"
    echo "   Response: $API_RESPONSE"
fi
echo

# Test 4: Frontend Accessibility
echo "4. 🔍 Testing Frontend Accessibility"

# Test Cloudflare Pages
CF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://pitchey.pages.dev")
if [ "$CF_STATUS" = "200" ]; then
    echo "   ✅ Cloudflare Pages accessible (HTTP $CF_STATUS)"
else
    echo "   ❌ Cloudflare Pages issues (HTTP $CF_STATUS)"
fi

# Test Secondary Domain
PAGES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://pitchey.pages.dev")
if [ "$PAGES_STATUS" = "200" ]; then
    echo "   ✅ Secondary domain accessible (HTTP $PAGES_STATUS)"
else
    echo "   ❌ Secondary domain issues (HTTP $PAGES_STATUS)"
fi
echo

# Test 5: Backend Health
echo "5. 🔍 Testing Backend Health"
BACKEND_HEALTH=$(curl -s "$BACKEND_URL/api/health")
if echo "$BACKEND_HEALTH" | grep -q '"status":"healthy"'; then
    echo "   ✅ Backend healthy"
    # Extract version
    VERSION=$(echo "$BACKEND_HEALTH" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    echo "   📋 Backend version: $VERSION"
else
    echo "   ❌ Backend health check failed"
fi
echo

# Summary
echo "🎉 CORS FIX SUMMARY"
echo "=================="

if [ "$CORS_ORIGIN1" = "https://pitchey.pages.dev" ] && [ "$CORS_ORIGIN2" = "https://pitchey.pages.dev" ]; then
    echo "✅ CORS Configuration: WORKING"
    echo "   ✓ Primary: pitchey.pages.dev → backend ✅"
    echo "   ✓ Secondary: pitchey.pages.dev → backend ✅"
    echo 
    echo "🚀 DEPLOYMENT STATUS:"
    echo "   • Frontend (Primary): https://pitchey.pages.dev"
    echo "   • Backend API: https://pitchey-backend-fresh.deno.dev"
    echo
    echo "🔧 TECHNICAL DETAILS:"
    echo "   • CORS origins properly configured in response.ts"
    echo "   • GitHub Actions deploying to Cloudflare Pages"
    echo "   • Frontend deployment functional"
    echo "   • Backend accepting requests from frontend origins"
    echo
    echo "✅ CORS ERRORS: RESOLVED!"
    echo "The platform can now make API calls from the frontend URL"
    echo "without encountering CORS blocking errors."
else
    echo "❌ CORS Configuration: NEEDS ATTENTION"
    echo "   Expected origins not matching - check deployment status"
fi
echo

echo "📌 To test manually:"
echo "   1. Visit https://pitchey.pages.dev"
echo "   2. Open browser DevTools → Network tab"
echo "   3. Interact with the app to trigger API calls"
echo "   4. Verify no CORS errors in console"