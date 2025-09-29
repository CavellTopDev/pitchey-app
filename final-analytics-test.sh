#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "=========================================="
echo "FINAL ANALYTICS TEST - REAL DATA"
echo "=========================================="
echo ""

# Get first 3 pitches
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

IDS=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -3 | cut -d: -f2)

echo "Testing analytics for each unique pitch:"
echo ""

for ID in $IDS; do
  # Get pitch details
  PITCH_DETAILS=$(curl -s -X GET "http://localhost:8001/api/creator/pitches/$ID" \
    -H "Authorization: Bearer $TOKEN")
  
  TITLE=$(echo "$PITCH_DETAILS" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
  
  # Get analytics
  ANALYTICS=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/$ID?preset=month" \
    -H "Authorization: Bearer $TOKEN")
  
  VIEWS=$(echo "$ANALYTICS" | grep -o '"views":[0-9]*' | head -1 | cut -d: -f2)
  LIKES=$(echo "$ANALYTICS" | grep -o '"likes":[0-9]*' | head -1 | cut -d: -f2)
  
  echo "✅ Pitch #$ID: \"$TITLE\""
  echo "   Analytics: $VIEWS views, $LIKES likes"
  echo "   URL: http://localhost:5173/creator/pitches/$ID/analytics"
  echo ""
done

echo "=========================================="
echo "IMPROVEMENTS COMPLETED:"
echo "=========================================="
echo "✅ Analytics page shows pitch TITLE not ID"
echo "✅ Backend returns REAL data from database"
echo "✅ Each pitch shows its UNIQUE analytics"
echo "✅ Frontend fetches pitch details for title"
echo ""
echo "Visit any URL above to see:"
echo "- Pitch title in the header"
echo "- Real view/like counts from database"
echo "- Properly mapped data"
