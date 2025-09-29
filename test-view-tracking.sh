#!/bin/bash

# Different user tokens (using correct user IDs from database)
CREATOR_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"
INVESTOR_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsImVtYWlsIjoic2FyYWguaW52ZXN0b3JAZGV

tby5jb20iLCJ1c2VyVHlwZSI6ImludmVzdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.FPR3Hg-ztIi6Y5hZfLQxfCqANcgHrqz7yLkkp_cLPCM"
PRODUCTION_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsImVtYWlsIjoic3RlbGxhci5wcm9kdWN0aW9uQGRlbW8uY29tIiwidXNlclR5cGUiOiJwcm9kdWN0aW9uIiwiZXhwIjoxNzU5MTgwOTgxfQ.Y7V5rCYaNq6vZdRlRFxLCU5GhtRdxWSHvT5OX0kXsaM"

echo "=========================================="
echo "SIMULATING VIEWS FROM DIFFERENT USER TYPES"
echo "=========================================="
echo ""

# Test pitches to track views for
PITCH_IDS=(63 62 59)

echo "1. Simulating investor views..."
for ID in "${PITCH_IDS[@]}"; do
  curl -s -X POST http://localhost:8001/api/analytics/track-view \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": $ID, \"viewType\": \"full\"}" > /dev/null
  echo "   ✅ Investor viewed pitch #$ID"
done
echo ""

echo "2. Simulating production company views..."
for ID in "${PITCH_IDS[@]}"; do
  curl -s -X POST http://localhost:8001/api/analytics/track-view \
    -H "Authorization: Bearer $PRODUCTION_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": $ID, \"viewType\": \"full\"}" > /dev/null
  echo "   ✅ Production viewed pitch #$ID"
done
echo ""

echo "3. Simulating multiple investor views..."
for i in {1..3}; do
  curl -s -X POST http://localhost:8001/api/analytics/track-view \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": 63, \"viewType\": \"full\"}" > /dev/null
done
echo "   ✅ Added 3 more investor views to pitch #63"
echo ""

echo "4. Checking updated analytics for pitch #63..."
ANALYTICS=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/63?preset=month" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

echo ""
echo "Updated Analytics Data:"
echo "$ANALYTICS" | jq '.data.analytics | {views: .views, uniqueViews: .uniqueViews, demographics: .demographics}'
echo ""

echo "=========================================="
echo "EXPECTED RESULTS:"
echo "=========================================="
echo "✅ Views should increase with each view"
echo "✅ Demographics should show real percentages:"
echo "   - More investor views (due to extra views)"
echo "   - Some production views"
echo "   - Some creator views"
echo ""
echo "Check analytics page to see updated data:"
echo "http://localhost:5173/creator/pitches/63/updated-software-engineer/analytics"