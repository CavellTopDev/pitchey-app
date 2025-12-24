#!/bin/bash

# Test Search and Filtering Functionality

echo "===================="
echo "Testing Search and Filtering"
echo "===================="

# API base URL
API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}1. Testing Basic Search${NC}"
echo "GET /api/search?q=action"
curl -s "${API_URL}/api/search?q=action" | jq '.success, .items[0].title' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}2. Testing Search with Genre Filter${NC}"
echo "GET /api/search?q=thriller&genre=Horror"
curl -s "${API_URL}/api/search?q=thriller&genre=Horror" | jq '.success, .total' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}3. Testing Search with Budget Filter${NC}"
echo "GET /api/search?minBudget=1000000&maxBudget=5000000"
curl -s "${API_URL}/api/search?minBudget=1000000&maxBudget=5000000" | jq '.success, .total' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}4. Testing Search with Sorting${NC}"
echo "GET /api/search?sortBy=views&sortOrder=desc"
curl -s "${API_URL}/api/search?sortBy=views&sortOrder=desc" | jq '.success, .items[0].view_count' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}5. Testing Autocomplete${NC}"
echo "GET /api/search/autocomplete?q=act&field=title"
curl -s "${API_URL}/api/search/autocomplete?q=act&field=title" | jq '.suggestions[0]' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}6. Testing Genre Autocomplete${NC}"
echo "GET /api/search/autocomplete?q=dra&field=genre"
curl -s "${API_URL}/api/search/autocomplete?q=dra&field=genre" | jq '.suggestions' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}7. Testing Trending${NC}"
echo "GET /api/search/trending?limit=5&days=7"
curl -s "${API_URL}/api/search/trending?limit=5&days=7" | jq '.trending[0].title, .trending[0].trending_score' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}8. Testing Facets${NC}"
echo "GET /api/search/facets"
curl -s "${API_URL}/api/search/facets" | jq '.facets.genres[0], .facets.formats[0], .facets.budgetRanges[0]' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}9. Testing Browse - Trending Tab${NC}"
echo "GET /api/browse?tab=trending"
curl -s "${API_URL}/api/browse?tab=trending" | jq '.success, .tab, .items[0].title' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}10. Testing Browse - New Releases Tab${NC}"
echo "GET /api/browse?tab=new"
curl -s "${API_URL}/api/browse?tab=new" | jq '.success, .tab, .items[0].title' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}11. Testing Browse - Popular Tab${NC}"
echo "GET /api/browse?tab=popular"
curl -s "${API_URL}/api/browse?tab=popular" | jq '.success, .tab, .items[0].title' 2>/dev/null || echo "Failed"

echo -e "\n${BLUE}12. Testing Pagination${NC}"
echo "GET /api/search?q=movie&page=2&limit=5"
curl -s "${API_URL}/api/search?q=movie&page=2&limit=5" | jq '.page, .limit, .hasMore' 2>/dev/null || echo "Failed"

echo -e "\n${GREEN}✅ Search and Filtering Testing Complete!${NC}"
echo "===================="