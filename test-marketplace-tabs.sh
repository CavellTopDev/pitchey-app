#!/bin/bash

echo "🧪 Testing Marketplace Tab Separation"
echo "====================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Start the backend server if not already running
echo "📦 Checking backend server..."
if ! curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "Starting backend server on port 8001..."
    PORT=8001 deno run --allow-all working-server.ts &
    BACKEND_PID=$!
    sleep 5
    echo "✅ Backend server started (PID: $BACKEND_PID)"
else
    echo "✅ Backend server already running"
fi

echo ""
echo "📋 Testing Browse API Endpoints:"
echo "--------------------------------"

# Test the trending endpoint
echo -n "1. Testing Trending endpoint: "
response=$(curl -s "http://localhost:8001/api/pitches/trending?limit=5")
if echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if 'data' in data or 'pitches' in data else 1)" 2>/dev/null; then
    count=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); pitches=data.get('data', data.get('pitches', [])); print(len(pitches))")
    echo -e "${GREEN}✅ Success - $count pitches${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "   Response: $(echo "$response" | head -c 100)"
fi

# Test the new releases endpoint
echo -n "2. Testing New Releases endpoint: "
response=$(curl -s "http://localhost:8001/api/pitches/new?limit=5")
if echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if 'data' in data or 'pitches' in data else 1)" 2>/dev/null; then
    count=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); pitches=data.get('data', data.get('pitches', [])); print(len(pitches))")
    echo -e "${GREEN}✅ Success - $count pitches${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "   Response: $(echo "$response" | head -c 100)"
fi

# Test the browse endpoint with filters
echo -n "3. Testing Browse with genre filter: "
response=$(curl -s "http://localhost:8001/api/pitches/browse?genre=Sci-Fi&limit=5")
if echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if 'data' in data or 'pitches' in data else 1)" 2>/dev/null; then
    count=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); pitches=data.get('data', data.get('pitches', [])); print(len(pitches))")
    echo -e "${GREEN}✅ Success - $count pitches${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "   Response: $(echo "$response" | head -c 100)"
fi

# Test search functionality
echo -n "4. Testing Search endpoint: "
response=$(curl -s "http://localhost:8001/api/search?q=horizon&limit=5")
if echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if 'data' in data or 'results' in data else 1)" 2>/dev/null; then
    count=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); results=data.get('data', data.get('results', [])); print(len(results))")
    echo -e "${GREEN}✅ Success - $count results${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "   Response: $(echo "$response" | head -c 100)"
fi

echo ""
echo "🌐 Frontend Testing Instructions:"
echo "---------------------------------"
echo "1. Open http://localhost:5173/marketplace in your browser"
echo "2. Navigate through each tab and verify:"
echo ""
echo "   📍 ALL Tab:"
echo "      - Should show all pitches"
echo "      - Search, filters, and sorting should work"
echo "      - Pagination should be visible"
echo ""
echo "   📍 TRENDING Tab:"
echo "      - Should show only trending pitches (high views/engagement)"
echo "      - Search should be disabled"
echo "      - Filters should not affect other tabs"
echo ""
echo "   📍 NEW Tab:"
echo "      - Should show only recently added pitches"
echo "      - Sorted by date (newest first)"
echo "      - Search should be disabled"
echo ""
echo "   📍 BROWSE Tab:"
echo "      - Independent filters and search"
echo "      - Should maintain its own state"
echo "      - Pagination should work independently"
echo ""
echo "   📍 GENRES Tab:"
echo "      - Should show genre-organized content"
echo "      - Genre selection should not affect other tabs"
echo ""
echo "3. Test Tab Switching:"
echo "   - Apply filters in Browse tab"
echo "   - Switch to Trending tab (should show unfiltered trending)"
echo "   - Switch back to Browse (filters should persist)"
echo "   - Verify no content mixing between tabs"
echo ""
echo "4. Check Console (F12 → Console):"
echo "   - No errors when switching tabs"
echo "   - No duplicate API calls"
echo "   - State updates logged correctly"
echo ""

# Open browser for manual testing
if command -v xdg-open > /dev/null; then
    echo "Opening browser for manual testing..."
    xdg-open "http://localhost:5173/marketplace" 2>/dev/null &
elif command -v open > /dev/null; then
    echo "Opening browser for manual testing..."
    open "http://localhost:5173/marketplace" 2>/dev/null &
fi

echo "✨ Automated API tests complete. Please perform manual UI testing as described above."
echo ""
echo "Press Ctrl+C to stop the test when done."

# Keep script running for manual testing
trap "echo ''; echo 'Cleaning up...'; if [ ! -z $BACKEND_PID ]; then kill $BACKEND_PID 2>/dev/null; fi; exit" INT
wait