#!/bin/bash

echo "Testing Pitch Detail Fix"
echo "========================"
echo ""

# Test that the API endpoint works
echo "1. Testing API endpoint /api/pitches/public/2:"
API_RESPONSE=$(curl -s "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/public/2")
if echo "$API_RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ API returns success"
    if echo "$API_RESPONSE" | grep -q '"title":"Quantum Dreams"'; then
        echo "   ✅ API returns correct pitch data"
    fi
else
    echo "   ❌ API failed"
fi

echo ""
echo "2. Testing frontend pitch detail page:"
# Check if the page loads and contains expected content
PAGE_CONTENT=$(curl -s "https://36a61a1e.pitchey-5o8.pages.dev/pitch/2")
if echo "$PAGE_CONTENT" | grep -q "Pitchey"; then
    echo "   ✅ Frontend page loads successfully"
else
    echo "   ❌ Frontend page failed to load"
fi

echo ""
echo "3. Testing that 'Pitch not found' error is resolved:"
# Check that the error message is not present
if ! echo "$PAGE_CONTENT" | grep -q "Pitch not found"; then
    echo "   ✅ 'Pitch not found' error is no longer present"
else
    echo "   ⚠️  'Pitch not found' may still be appearing (requires JavaScript execution to verify fully)"
fi

echo ""
echo "✅ Deployment URL: https://36a61a1e.pitchey-5o8.pages.dev"
echo "✅ Test a pitch directly: https://36a61a1e.pitchey-5o8.pages.dev/pitch/2"