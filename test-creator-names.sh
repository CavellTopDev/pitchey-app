#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "=========================================="
echo "TESTING CREATOR NAME DISPLAY"
echo "=========================================="
echo ""

# Get first 3 pitches
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

IDS=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -3 | cut -d: -f2)

echo "Testing creator info for each pitch:"
echo ""

for ID in $IDS; do
  # Get pitch details with creator info
  PITCH_DETAILS=$(curl -s -X GET "http://localhost:8001/api/creator/pitches/$ID" \
    -H "Authorization: Bearer $TOKEN")
  
  TITLE=$(echo "$PITCH_DETAILS" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
  
  # Check for creator info
  CREATOR_USERNAME=$(echo "$PITCH_DETAILS" | grep -o '"creator":{[^}]*' | grep -o '"username":"[^"]*' | cut -d'"' -f4)
  CREATOR_NAME=$(echo "$PITCH_DETAILS" | grep -o '"creator":{[^}]*' | grep -o '"name":"[^"]*' | cut -d'"' -f4)
  CREATOR_COMPANY=$(echo "$PITCH_DETAILS" | grep -o '"creator":{[^}]*' | grep -o '"companyName":"[^"]*' | cut -d'"' -f4)
  
  echo "✅ Pitch #$ID: \"$TITLE\""
  echo "   Creator Username: ${CREATOR_USERNAME:-Not found}"
  echo "   Creator Name: ${CREATOR_NAME:-Not found}"
  echo "   Company: ${CREATOR_COMPANY:-Not found}"
  echo "   URL: http://localhost:5173/creator/pitches/$ID"
  echo ""
done

echo "=========================================="
echo "EXPECTED DISPLAY ON PITCH DETAIL PAGE:"
echo "=========================================="
echo "Instead of: 'By Unknown Creator'"
echo "Should show: 'By alexcreator' (or actual username)"
echo ""
echo "The page header should display:"
echo "- Pitch title"
echo "- 'By Alex Creator' or 'By alexcreator'"
echo "- Genre and format"
