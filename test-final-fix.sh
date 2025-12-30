#!/bin/bash

echo "Testing Final Pitch Detail Fix"
echo "=============================="
echo ""

# Test multiple pitches
for PITCH_ID in 162 163 2; do
    echo "Testing Pitch ID $PITCH_ID:"
    API_RESPONSE=$(curl -s "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/public/$PITCH_ID")
    
    if echo "$API_RESPONSE" | grep -q '"success":true'; then
        TITLE=$(echo "$API_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data'].get('title', 'No title'))")
        echo "   ✅ API works - Title: $TITLE"
    else
        echo "   ❌ API failed for pitch $PITCH_ID"
    fi
done

echo ""
echo "Frontend URLs to test:"
echo "======================"
echo "✅ Latest deployment: https://d2541ce0.pitchey-5o8.pages.dev"
echo ""
echo "Test these links directly in your browser:"
echo "1. Pitch 163: https://d2541ce0.pitchey-5o8.pages.dev/pitch/163"
echo "2. Pitch 162: https://d2541ce0.pitchey-5o8.pages.dev/pitch/162"
echo "3. Pitch 2: https://d2541ce0.pitchey-5o8.pages.dev/pitch/2"
echo ""
echo "The console should now show:"
echo "- 'Fetched pitch data:' followed by the actual pitch object"
echo "- No more 'undefined' values"
echo "- The pitch should display on the page"
