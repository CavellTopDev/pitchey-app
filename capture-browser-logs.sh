#!/bin/bash

echo "🌐 Opening Pitchey in browser with console monitoring..."
echo "=================================================="
echo ""
echo "📋 Instructions:"
echo "1. Browser will open to http://localhost:5173"
echo "2. Open Developer Tools (F12 or right-click → Inspect)"
echo "3. Go to Console tab"
echo "4. Look for any red error messages"
echo "5. Go to Network tab"
echo "6. Refresh the page (F5)"
echo "7. Look for any failed requests (red text)"
echo ""
echo "🔍 Common issues to check for:"
echo "   - CORS errors"
echo "   - 404 Not Found errors"
echo "   - Failed to fetch errors"
echo "   - React component errors"
echo "   - WebSocket connection errors"
echo ""
echo "📝 Quick Tests to perform:"
echo "   1. Homepage: Should show pitch list"
echo "   2. Browse: Click Browse tab - should show Trending/New/Featured/Top Rated tabs"
echo "   3. Login: Try Creator login with alex.creator@demo.com / Demo123"
echo ""

# Open in browser
xdg-open "http://localhost:5173" 2>/dev/null &

echo "✅ Browser opened. Check the Console and Network tabs in DevTools!"
echo ""
echo "Meanwhile, monitoring backend requests..."
echo "─────────────────────────────────────────"
echo ""

# Monitor backend logs
tail -f /tmp/pitchey-backend.log 2>/dev/null | while read line; do
    echo "[BACKEND] $line"
done &

# Monitor for specific patterns
echo "Press Ctrl+C to stop monitoring..."
sleep 2

# Test specific endpoints while browser is open
echo ""
echo "🔄 Running automated endpoint tests..."
for i in {1..3}; do
    echo -n "   Test $i: "
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8001/api/pitches?limit=1")
    if [ "$response" = "200" ]; then
        echo "✅ API responding correctly"
    else
        echo "❌ API returned status $response"
    fi
    sleep 2
done