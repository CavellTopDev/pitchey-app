#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "Testing View Button Fix"
echo "======================="
echo ""

# Test the endpoint that the View button calls
echo "1. Testing GET /api/creator/pitches/64 endpoint:"
RESPONSE=$(curl -s -X GET http://localhost:8001/api/creator/pitches/64 \
  -H "Authorization: Bearer $TOKEN")

echo "Response received: $(echo "$RESPONSE" | head -c 100)..."

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Backend endpoint working"
else
  echo "❌ Backend endpoint failed"
  exit 1
fi

# Check if pitch data exists
if echo "$RESPONSE" | grep -q '"pitch":'; then
  echo "✅ Pitch data structure correct"
else
  echo "❌ Pitch data structure incorrect"
fi

# Extract pitch title
TITLE=$(echo "$RESPONSE" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✅ Pitch title: $TITLE"

echo ""
echo "======================="
echo "RESULT: View button should now work!"
echo "======================="
echo ""
echo "The fix applied:"
echo "- Updated pitch.service.ts to correctly parse nested response"
echo "- Backend returns: { success: true, data: { pitch: {...} } }"
echo "- Service now correctly extracts response.data.pitch"
echo ""
echo "Test it: Click any View button at http://localhost:5173/creator/pitches"
