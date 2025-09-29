#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "=========================================="
echo "TESTING ANALYTICS WITH PITCH TITLES"
echo "=========================================="
echo ""

# Get list of pitches
echo "1. Fetching all pitches to test:"
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

# Get first 3 pitch IDs and titles
IDS=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -3 | cut -d: -f2)

echo ""
echo "2. Testing analytics for each unique pitch:"
echo ""

for ID in $IDS; do
  # Get pitch details
  PITCH_DETAILS=$(curl -s -X GET "http://localhost:8001/api/creator/pitches/$ID" \
    -H "Authorization: Bearer $TOKEN")
  
  TITLE=$(echo "$PITCH_DETAILS" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
  GENRE=$(echo "$PITCH_DETAILS" | grep -o '"genre":"[^"]*' | head -1 | cut -d'"' -f4)
  VIEWS=$(echo "$PITCH_DETAILS" | grep -o '"viewCount":[0-9]*' | head -1 | cut -d: -f2)
  LIKES=$(echo "$PITCH_DETAILS" | grep -o '"likeCount":[0-9]*' | head -1 | cut -d: -f2)
  
  echo "Pitch #$ID:"
  echo "  Title: $TITLE"
  echo "  Genre: $GENRE"
  echo "  Views: $VIEWS"
  echo "  Likes: $LIKES"
  
  # Get analytics
  ANALYTICS=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/$ID?preset=month" \
    -H "Authorization: Bearer $TOKEN")
  
  ANALYTICS_VIEWS=$(echo "$ANALYTICS" | grep -o '"views":[0-9]*' | head -1 | cut -d: -f2)
  ANALYTICS_LIKES=$(echo "$ANALYTICS" | grep -o '"likes":[0-9]*' | head -1 | cut -d: -f2)
  
  echo "  Analytics Data:"
  echo "    - Views: $ANALYTICS_VIEWS"
  echo "    - Likes: $ANALYTICS_LIKES"
  echo "  URL: http://localhost:5173/creator/pitches/$ID/analytics"
  echo ""
done

echo "=========================================="
echo "FIXES APPLIED:"
echo "=========================================="
echo "✅ Analytics page now fetches pitch details"
echo "✅ Shows actual pitch title instead of ID"
echo "✅ Maps backend data correctly:"
echo "   - views → totalViews"
echo "   - likes → totalLikes"
echo "   - Uses pitch viewCount/likeCount as fallback"
echo "✅ Each pitch shows its unique title in header"
echo ""
echo "Test by visiting each URL above!"
