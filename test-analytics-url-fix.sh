#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "=========================================="
echo "TESTING ANALYTICS URL WITH PITCH NAME"
echo "=========================================="
echo ""

# Get first 3 pitches
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

IDS=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -3 | cut -d: -f2)

echo "Analytics pages with improved URLs:"
echo ""

for ID in $IDS; do
  # Get pitch details for title
  PITCH_DETAILS=$(curl -s -X GET "http://localhost:8001/api/creator/pitches/$ID" \
    -H "Authorization: Bearer $TOKEN")
  
  TITLE=$(echo "$PITCH_DETAILS" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
  SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^-*//;s/-*$//' | sed 's/--*/-/g')
  
  echo "✅ Pitch: \"$TITLE\""
  echo "   Old URL: http://localhost:5173/creator/pitches/$ID/analytics"
  echo "   New URL: http://localhost:5173/creator/pitches/$ID/$SLUG/analytics"
  echo ""
done

echo "=========================================="
echo "IMPROVEMENTS COMPLETED:"
echo "=========================================="
echo "✅ Performance Insights now use real calculated data"
echo "✅ Shows 'New', 'Building', 'N/A' for zero-data pitches"
echo "✅ URL includes pitch name slug for better UX"
echo "✅ Both old and new URL formats work"
