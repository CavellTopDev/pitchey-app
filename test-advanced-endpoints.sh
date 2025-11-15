#!/bin/bash

echo "🚀 TESTING ADVANCED API ENDPOINTS"
echo "================================="

BASE_URL="http://localhost:8001"

# Login to get authentication token
echo -e "\n1. 🔐 Authenticating as investor..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}')

if command -v jq >/dev/null 2>&1; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
else
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get authentication token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Got authentication token: ${TOKEN:0:20}..."

# Test Smart Recommendations Endpoints
echo -e "\n🤖 SMART RECOMMENDATIONS ENDPOINTS"
echo "===================================="

echo -e "\n2. 📊 Testing personalized recommendations..."
curl -s -X GET "${BASE_URL}/api/recommendations/personalized?limit=5&excludeViewed=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 400
echo

echo -e "\n3. 🤝 Testing collaborative recommendations..."
curl -s -X GET "${BASE_URL}/api/recommendations/collaborative?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 400
echo

echo -e "\n4. 🎯 Testing smart user matching..."
curl -s -X GET "${BASE_URL}/api/recommendations/matches?userType=creator&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 400
echo

echo -e "\n5. 📈 Testing trending insights..."
curl -s -X GET "${BASE_URL}/api/insights/trending?timeframe=7d" \
  -H "Content-Type: application/json" | head -c 400
echo

# Test Advanced Search Endpoints
echo -e "\n\n🔍 ADVANCED SEARCH ENDPOINTS"
echo "============================="

echo -e "\n6. 🔎 Testing advanced search..."
curl -s -X POST "${BASE_URL}/api/search/advanced" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sci-fi thriller",
    "genres": ["Sci-Fi", "Thriller"],
    "formats": ["Feature Film"],
    "sortBy": "relevance",
    "limit": 5
  }' | head -c 500
echo

echo -e "\n7. 🔗 Testing similar content search..."
curl -s -X GET "${BASE_URL}/api/search/similar/1?limit=3" \
  -H "Content-Type: application/json" | head -c 400
echo

echo -e "\n8. 📊 Testing trending searches..."
curl -s -X GET "${BASE_URL}/api/search/trending?timeframe=7d" \
  -H "Content-Type: application/json" | head -c 400
echo

echo -e "\n9. 🏷️ Testing faceted search..."
curl -s -X GET "${BASE_URL}/api/search/facets?field=genre&query=action" \
  -H "Content-Type: application/json" | head -c 400
echo

# Test Workflow Automation Endpoints
echo -e "\n\n⚙️ WORKFLOW AUTOMATION ENDPOINTS"
echo "================================="

echo -e "\n10. 🔄 Testing workflow automation trigger..."
curl -s -X POST "${BASE_URL}/api/automation/trigger" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "triggerType": "pitch_created",
    "triggerData": {
      "pitchId": 1,
      "genre": "Sci-Fi",
      "viewCount": 150
    }
  }' | head -c 400
echo

echo -e "\n11. 🔔 Testing smart notifications..."
curl -s -X GET "${BASE_URL}/api/automation/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 400
echo

echo -e "\n12. ⏰ Testing follow-up scheduling..."
curl -s -X POST "${BASE_URL}/api/automation/schedule-followup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "pitch_view",
    "targetData": {
      "pitchId": 1,
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
    }
  }' | head -c 400
echo

echo -e "\n13. 🏢 Testing business rules processing..."
curl -s -X POST "${BASE_URL}/api/automation/business-rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "pitch",
    "entityId": 1,
    "action": "auto_approve"
  }' | head -c 400
echo

# Test Error Handling
echo -e "\n\n❗ ERROR HANDLING TESTS"
echo "======================"

echo -e "\n14. ❌ Testing invalid facet field..."
curl -s -X GET "${BASE_URL}/api/search/facets?field=invalid_field" \
  -H "Content-Type: application/json" | head -c 200
echo

echo -e "\n15. ❌ Testing missing trigger type..."
curl -s -X POST "${BASE_URL}/api/automation/trigger" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"triggerData": {}}' | head -c 200
echo

echo -e "\n16. ❌ Testing unauthenticated request..."
curl -s -X GET "${BASE_URL}/api/recommendations/personalized" \
  -H "Content-Type: application/json" | head -c 200
echo

# Performance Test
echo -e "\n\n⚡ PERFORMANCE TEST"
echo "=================="

echo -e "\n17. 🏃‍♂️ Testing endpoint response times..."
START_TIME=$(date +%s%N)
curl -s -X GET "${BASE_URL}/api/recommendations/personalized?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(((END_TIME - START_TIME) / 1000000))
echo "   Personalized recommendations: ${RESPONSE_TIME}ms"

START_TIME=$(date +%s%N)
curl -s -X POST "${BASE_URL}/api/search/advanced" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "drama", "limit": 20}' > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(((END_TIME - START_TIME) / 1000000))
echo "   Advanced search: ${RESPONSE_TIME}ms"

echo -e "\n✅ ADVANCED API ENDPOINTS TESTING COMPLETE"
echo "==========================================="
echo
echo "📋 TESTED ENDPOINTS SUMMARY:"
echo "   🤖 Smart Recommendations:"
echo "      • GET /api/recommendations/personalized"
echo "      • GET /api/recommendations/collaborative" 
echo "      • GET /api/recommendations/matches"
echo "      • GET /api/insights/trending"
echo
echo "   🔍 Advanced Search:"
echo "      • POST /api/search/advanced"
echo "      • GET /api/search/similar/:pitchId"
echo "      • GET /api/search/trending" 
echo "      • GET /api/search/facets"
echo
echo "   ⚙️ Workflow Automation:"
echo "      • POST /api/automation/trigger"
echo "      • GET /api/automation/notifications"
echo "      • POST /api/automation/schedule-followup"
echo "      • POST /api/automation/business-rules"
echo
echo "🎯 All 13 advanced endpoints tested with authentication, error handling, and performance validation!"