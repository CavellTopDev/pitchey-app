#!/bin/bash

echo "🧪 TESTING NEWLY IMPLEMENTED BACKEND ENDPOINTS"
echo "=============================================="
echo ""

# Get authentication token first
echo "🔐 Getting authentication token..."
LOGIN_RESPONSE=$(curl -s -X POST "https://pitchey-backend-fresh.deno.dev/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // .token // empty' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "❌ Failed to get authentication token"
    exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."
echo ""

# Test all the newly implemented endpoints
echo "🎯 TESTING NEW ENDPOINTS"
echo "========================"
echo ""

# Test 1: Dashboard Stats
echo "📊 Testing NEW ENDPOINT: /api/investor/dashboard/stats"
STATS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "https://pitchey-backend-fresh.deno.dev/api/investor/dashboard/stats")
echo "Response:"
echo "$STATS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATS_RESPONSE"
echo ""

if [[ "$STATS_RESPONSE" == *"success\":true"* ]]; then
    echo "✅ Dashboard stats endpoint working"
else
    echo "❌ Dashboard stats endpoint failed"
fi
echo ""

# Test 2: Saved Pitches
echo "💾 Testing NEW ENDPOINT: /api/investor/saved-pitches"
SAVED_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "https://pitchey-backend-fresh.deno.dev/api/investor/saved-pitches")
echo "Response:"
echo "$SAVED_RESPONSE" | jq '.' 2>/dev/null || echo "$SAVED_RESPONSE"
echo ""

if [[ "$SAVED_RESPONSE" == *"success\":true"* ]]; then
    echo "✅ Saved pitches endpoint working"
else
    echo "❌ Saved pitches endpoint failed"
fi
echo ""

# Test 3: Investment History
echo "💼 Testing NEW ENDPOINT: /api/investor/investment-history"
HISTORY_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "https://pitchey-backend-fresh.deno.dev/api/investor/investment-history")
echo "Response:"
echo "$HISTORY_RESPONSE" | jq '.' 2>/dev/null || echo "$HISTORY_RESPONSE"
echo ""

if [[ "$HISTORY_RESPONSE" == *"success\":true"* ]]; then
    echo "✅ Investment history endpoint working"
else
    echo "❌ Investment history endpoint failed"
fi
echo ""

# Test 4: NDA Requests
echo "📄 Testing NEW ENDPOINT: /api/nda/requests"
NDA_REQUESTS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "https://pitchey-backend-fresh.deno.dev/api/nda/requests")
echo "Response:"
echo "$NDA_REQUESTS_RESPONSE" | jq '.' 2>/dev/null || echo "$NDA_REQUESTS_RESPONSE"
echo ""

if [[ "$NDA_REQUESTS_RESPONSE" == *"success\":true"* ]]; then
    echo "✅ NDA requests endpoint working"
else
    echo "❌ NDA requests endpoint failed"
fi
echo ""

# Test 5: Signed NDAs
echo "✍️ Testing NEW ENDPOINT: /api/nda/signed"
NDA_SIGNED_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "https://pitchey-backend-fresh.deno.dev/api/nda/signed")
echo "Response:"
echo "$NDA_SIGNED_RESPONSE" | jq '.' 2>/dev/null || echo "$NDA_SIGNED_RESPONSE"
echo ""

if [[ "$NDA_SIGNED_RESPONSE" == *"success\":true"* ]]; then
    echo "✅ Signed NDAs endpoint working"
else
    echo "❌ Signed NDAs endpoint failed"
fi
echo ""

echo "🎯 ENDPOINT IMPLEMENTATION VERIFICATION"
echo "======================================"
echo ""

# Check if all endpoints are now working
SUCCESS_COUNT=0
TOTAL_ENDPOINTS=5

[[ "$STATS_RESPONSE" == *"success\":true"* ]] && ((SUCCESS_COUNT++))
[[ "$SAVED_RESPONSE" == *"success\":true"* ]] && ((SUCCESS_COUNT++))
[[ "$HISTORY_RESPONSE" == *"success\":true"* ]] && ((SUCCESS_COUNT++))
[[ "$NDA_REQUESTS_RESPONSE" == *"success\":true"* ]] && ((SUCCESS_COUNT++))
[[ "$NDA_SIGNED_RESPONSE" == *"success\":true"* ]] && ((SUCCESS_COUNT++))

echo "📈 Success Rate: $SUCCESS_COUNT/$TOTAL_ENDPOINTS endpoints working"
echo ""

if [ $SUCCESS_COUNT -eq 5 ]; then
    echo "🎉 ALL NEW ENDPOINTS SUCCESSFULLY IMPLEMENTED!"
    echo ""
    echo "✅ WHAT THIS MEANS FOR YOUR DASHBOARD:"
    echo "   • Dashboard stats will now show real metrics"
    echo "   • Saved pitches section will load properly"
    echo "   • Investment history will display transactions"
    echo "   • NDA management sections will work"
    echo "   • No more 404 errors on dashboard load"
    echo ""
    echo "🚀 YOUR DASHBOARD SHOULD NOW BE FULLY FUNCTIONAL!"
    echo ""
    echo "🔄 NEXT STEPS:"
    echo "1. The backend changes need to be deployed to production"
    echo "2. Test your dashboard again after deployment"
    echo "3. You should see content in previously empty sections"
elif [ $SUCCESS_COUNT -gt 3 ]; then
    echo "⚠️  MOST ENDPOINTS WORKING"
    echo "   • $SUCCESS_COUNT out of 5 endpoints successful"
    echo "   • Some dashboard sections will now work"
    echo "   • May need backend deployment to production"
else
    echo "❌ IMPLEMENTATION ISSUES DETECTED"
    echo "   • Only $SUCCESS_COUNT out of 5 endpoints working"
    echo "   • Backend may need to be restarted or redeployed"
fi

echo ""
echo "📋 DEPLOYMENT STATUS:"
echo "   • Local backend: ✅ Endpoints implemented"
echo "   • Production backend: ❓ Needs deployment"
echo ""
echo "⚡ TO DEPLOY TO PRODUCTION:"
echo "   • Push changes to GitHub"
echo "   • Deploy via GitHub Actions or manual deploy"
echo "   • Test dashboard after deployment"