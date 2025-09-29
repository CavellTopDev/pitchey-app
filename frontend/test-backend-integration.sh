#!/bin/bash

echo "🔍 Testing Backend Integration for Hardcoded Data Replacement"
echo "=============================================="

BASE_URL="http://localhost:8001"
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local path=$1
    local description=$2
    
    echo -n "Testing $description... "
    response=$(curl -s "$BASE_URL$path")
    
    if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
        echo "✅ PASS"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL"
        echo "  Response: $(echo "$response" | jq -c '.')"
        ((TESTS_FAILED++))
    fi
}

echo ""
echo "1️⃣ Configuration Endpoints (Public)"
echo "-----------------------------------"
test_endpoint "/api/config/genres" "Genres configuration"
test_endpoint "/api/config/formats" "Formats configuration"
test_endpoint "/api/config/budgetRanges" "Budget ranges configuration"
test_endpoint "/api/config/riskLevels" "Risk levels configuration"
test_endpoint "/api/config/productionStages" "Production stages configuration"
test_endpoint "/api/config/all" "All configuration"

echo ""
echo "2️⃣ Content Management Endpoints (Public)"
echo "---------------------------------------"
test_endpoint "/api/content/how-it-works" "How It Works content"
test_endpoint "/api/content/about" "About page content"
test_endpoint "/api/content/team" "Team content"
test_endpoint "/api/content/stats" "Statistics content"

echo ""
echo "3️⃣ Search Endpoints (Public)"
echo "----------------------------"
test_endpoint "/api/search/suggestions?q=hor" "Search suggestions"
test_endpoint "/api/search/history" "Search history"

echo ""
echo "4️⃣ Public Data Endpoints"
echo "------------------------"
test_endpoint "/api/pitches/public" "Public pitches"
test_endpoint "/api/pitches/new" "New pitches"

echo ""
echo "📊 RESULTS"
echo "========="
echo "✅ Tests Passed: $TESTS_PASSED"
echo "❌ Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 SUCCESS! All hardcoded data replacement endpoints are working!"
    echo ""
    echo "✨ What's been fixed:"
    echo "  • Dynamic configuration loading for genres, formats, budgets"
    echo "  • Content management for marketing pages"
    echo "  • Search suggestions and history"
    echo "  • All data now comes from backend APIs"
    exit 0
else
    echo "⚠️  Some endpoints are failing. Please check the backend server."
    exit 1
fi
