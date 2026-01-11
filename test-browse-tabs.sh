#!/bin/bash

echo "🧪 Testing Browse Tabs Feature"
echo "=============================="
echo ""

# Test the browse endpoint with different tabs
echo "📋 Testing Browse API Endpoints:"
echo "--------------------------------"

tabs=("trending" "new" "featured" "topRated")

for tab in "${tabs[@]}"; do
    echo -n "Testing $tab tab: "
    response=$(curl -s "http://localhost:8001/api/browse?tab=$tab")
    
    # Check if response is valid JSON and has success
    if echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('success') else 1)" 2>/dev/null; then
        items=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data['data'].get('items', [])))")
        echo "✅ Success - $items items"
    else
        echo "❌ Failed"
        echo "   Response: $(echo "$response" | head -c 100)"
    fi
done

echo ""
echo "📋 Testing Search with Genre Filters:"
echo "-------------------------------------"

genres=("drama" "comedy" "thriller" "scifi")

for genre in "${genres[@]}"; do
    echo -n "Testing $genre filter: "
    response=$(curl -s "http://localhost:8001/api/search?genre=$genre&limit=5")
    
    if echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('success') else 1)" 2>/dev/null; then
        count=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))")
        echo "✅ Found $count pitches"
    else
        echo "❌ Failed"
    fi
done

echo ""
echo "🌐 Opening Browse page in browser..."
echo "------------------------------------"
echo "URL: http://localhost:5173/browse"
echo ""
echo "Expected behavior:"
echo "  1. ✅ Should see 4 tabs: Trending, New, Featured, Top Rated"
echo "  2. ✅ Each tab should load independently"
echo "  3. ✅ Content shouldn't mix between tabs"
echo "  4. ✅ Search and genre filters should work"
echo ""

xdg-open "http://localhost:5173/browse" 2>/dev/null &

echo "Browser opened. Please check:"
echo "  - Console for any errors (F12 → Console tab)"
echo "  - Network tab for failed requests"
echo "  - Visual confirmation that tabs work correctly"
