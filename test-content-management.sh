#!/bin/bash

# Test Content Management API Endpoints
API_BASE="http://localhost:8001"

echo "🧪 Testing Content Management API Endpoints..."
echo "================================================"

# Test 1: Get Feature Flags
echo ""
echo "1. Testing GET /api/features/flags"
curl -s "${API_BASE}/api/features/flags" | jq '.' || echo "❌ Feature flags endpoint failed"

# Test 2: Get Portal Configuration for Creator
echo ""
echo "2. Testing GET /api/config/portal/creator"
curl -s "${API_BASE}/api/config/portal/creator" | jq '.' || echo "❌ Portal config endpoint failed"

# Test 3: Get Portal Content for Creator
echo ""
echo "3. Testing GET /api/content/portals/creator"
curl -s "${API_BASE}/api/content/portals/creator" | jq '.' || echo "❌ Portal content endpoint failed"

# Test 4: Get Navigation for Creator
echo ""
echo "4. Testing GET /api/content/navigation/creator"
curl -s "${API_BASE}/api/content/navigation/creator" | jq '.' || echo "❌ Navigation endpoint failed"

# Test 5: Get Translations
echo ""
echo "5. Testing GET /api/i18n/translations"
curl -s "${API_BASE}/api/i18n/translations" | jq '.' || echo "❌ Translations endpoint failed"

# Test 6: Get Form Content
echo ""
echo "6. Testing GET /api/content/forms/login"
curl -s "${API_BASE}/api/content/forms/login?portal=creator" | jq '.' || echo "❌ Form content endpoint failed"

# Test 7: Test invalid portal type
echo ""
echo "7. Testing invalid portal type"
curl -s "${API_BASE}/api/content/portals/invalid" | jq '.' || echo "❌ Invalid portal test failed"

# Test 8: Health check to ensure server is responsive
echo ""
echo "8. Testing API health"
curl -s "${API_BASE}/api/health" | jq '.status' || echo "❌ Health check failed"

echo ""
echo "================================================"
echo "✅ Content Management API tests completed!"
echo ""
echo "💡 Note: Some endpoints may return empty data since the database"
echo "   tables are new and may not have been migrated yet."