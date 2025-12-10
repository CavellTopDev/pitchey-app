#!/bin/bash

# Test Browse Tab Separation
echo "🔍 Testing Browse Tab Content Separation"
echo "========================================="

API_URL="http://localhost:8001"

# Test Trending tab
echo -e "\n📈 Testing TRENDING tab:"
curl -s "$API_URL/api/browse?tab=trending&limit=3" | python3 -m json.tool | head -30

# Test New tab
echo -e "\n🆕 Testing NEW tab:"
curl -s "$API_URL/api/browse?tab=new&limit=3" | python3 -m json.tool | head -30

# Test Popular tab
echo -e "\n⭐ Testing POPULAR tab:"
curl -s "$API_URL/api/browse?tab=popular&limit=3" | python3 -m json.tool | head -30

# Test with filters
echo -e "\n🎬 Testing with Genre filter (Horror):"
curl -s "$API_URL/api/browse?tab=trending&genre=Horror&limit=3" | python3 -m json.tool | head -30

echo -e "\n✅ Tab separation test complete!"