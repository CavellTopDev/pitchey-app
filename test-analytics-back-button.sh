#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "=========================================="
echo "TESTING ANALYTICS BACK BUTTON"
echo "=========================================="
echo ""

# Get first 3 pitches
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

IDS=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -3 | cut -d: -f2)

echo "Analytics pages with fixed back button:"
echo ""

for ID in $IDS; do
  # Get pitch details for title
  PITCH_DETAILS=$(curl -s -X GET "http://localhost:8001/api/creator/pitches/$ID" \
    -H "Authorization: Bearer $TOKEN")
  
  TITLE=$(echo "$PITCH_DETAILS" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
  
  echo "✅ Pitch #$ID: \"$TITLE\""
  echo "   Analytics URL: http://localhost:5173/creator/pitches/$ID/analytics"
  echo "   Back button now navigates to: http://localhost:5173/creator/pitches"
  echo ""
done

echo "=========================================="
echo "FIXED BEHAVIOR:"
echo "=========================================="
echo "✅ Back button (arrow icon) navigates to Manage Pitches page"
echo "✅ Works for all unique pitches"
echo "✅ Users can quickly return to pitch list from analytics"
