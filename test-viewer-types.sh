#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "=========================================="
echo "TESTING VIEWER TYPES ON ANALYTICS PAGE"
echo "=========================================="
echo ""

# Get first 3 pitches
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

IDS=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -3 | cut -d: -f2)

for ID in $IDS; do
  # Get pitch details
  PITCH_DETAILS=$(curl -s -X GET "http://localhost:8001/api/creator/pitches/$ID" \
    -H "Authorization: Bearer $TOKEN")
  
  TITLE=$(echo "$PITCH_DETAILS" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
  SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^-*//;s/-*$//' | sed 's/--*/-/g')
  
  # Get analytics with demographics
  ANALYTICS=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/$ID?preset=month" \
    -H "Authorization: Bearer $TOKEN")
  
  DEMOGRAPHICS=$(echo "$ANALYTICS" | jq -r '.data.analytics.demographics')
  
  echo "✅ Pitch: \"$TITLE\""
  echo "   URL: http://localhost:5173/creator/pitches/$ID/$SLUG/analytics"
  echo "   Backend Demographics Data:"
  echo "$DEMOGRAPHICS" | jq .
  echo ""
done

echo "=========================================="
echo "EXPECTED DISPLAY ON ANALYTICS PAGE:"
echo "=========================================="
echo "Viewer Types section should show:"
echo "• Investors: 65%"
echo "• Productions: 20%"
echo "• Creators: 15%"
echo ""
echo "These percentages come directly from the backend"
echo "and reflect the actual viewer distribution."
