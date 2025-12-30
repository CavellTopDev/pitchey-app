#!/bin/bash

echo "Testing Pitch Detail Fix"
echo "========================"
echo ""

# Test the API directly
echo "1. Testing API response for pitch 163:"
API_RESPONSE=$(curl -s "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/public/163")
if echo "$API_RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ API returns success"
    if echo "$API_RESPONSE" | grep -q '"title":"The Last Colony"'; then
        echo "   ✅ API returns correct pitch data"
    fi
else
    echo "   ❌ API failed"
fi

echo ""
echo "2. Verifying response structure:"
echo "$API_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('   Success:', data.get('success'))
print('   Has data:', 'data' in data)
if 'data' in data:
    print('   Pitch ID:', data['data'].get('id'))
    print('   Pitch Title:', data['data'].get('title'))
"

echo ""
echo "✅ Deployment URL: https://50c3015a.pitchey-5o8.pages.dev"
echo "✅ Test pitch 163: https://50c3015a.pitchey-5o8.pages.dev/pitch/163"
echo "✅ Test pitch 162: https://50c3015a.pitchey-5o8.pages.dev/pitch/162"
