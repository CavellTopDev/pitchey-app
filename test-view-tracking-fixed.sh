#!/bin/bash

# Generate correct tokens for existing users
# User 1001: alex.creator@demo.com (creator)
# User 1002: sarah.investor@demo.com (investor)  
# User 1003: stellar.production@demo.com (production)

CREATOR_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"
INVESTOR_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsImVtYWlsIjoic2FyYWguaW52ZXN0b3JAZGV

tby5jb20iLCJ1c2VyVHlwZSI6ImludmVzdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.FPR3Hg-ztIi6Y5hZfLQxfCqANcgHrqz7yLkkp_cLPCM"  
PRODUCTION_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsImVtYWlsIjoic3RlbGxhci5wcm9kdWN0aW9uQGRlbW8uY29tIiwidXNlclR5cGUiOiJwcm9kdWN0aW9uIiwiZXhwIjoxNzU5MTgwOTgxfQ.Y7V5rCYaNq6vZdRlRFxLCU5GhtRdxWSHvT5OX0kXsaM"

echo "=========================================="
echo "TESTING VIEW TRACKING WITH REAL USER IDS"
echo "=========================================="
echo ""

# First, manually insert some test views to verify it works
echo "1. Inserting test views directly into database..."
PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c "
INSERT INTO pitch_views (pitch_id, user_id, view_type, created_at) VALUES 
  (63, 1002, 'full', NOW()),
  (63, 1002, 'full', NOW() - INTERVAL '1 hour'),
  (63, 1003, 'full', NOW() - INTERVAL '2 hours'),
  (63, 1001, 'full', NOW() - INTERVAL '3 hours'),
  (62, 1002, 'full', NOW()),
  (62, 1003, 'full', NOW());
" 2>/dev/null

echo "   ✅ Inserted test views"
echo ""

echo "2. Checking analytics for pitch #63..."
ANALYTICS=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/63?preset=month" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

echo ""
echo "Analytics Data:"
echo "$ANALYTICS" | jq '.data.analytics | {views: .views, uniqueViews: .uniqueViews, demographics: .demographics}'
echo ""

echo "3. Now testing view tracking endpoint..."
for i in {1..2}; do
  curl -s -X POST http://localhost:8001/api/analytics/track-view \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": 63, \"viewType\": \"full\"}" > /dev/null
done
echo "   ✅ Added 2 more investor views via API"

curl -s -X POST http://localhost:8001/api/analytics/track-view \
  -H "Authorization: Bearer $PRODUCTION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pitchId\": 63, \"viewType\": \"full\"}" > /dev/null
echo "   ✅ Added 1 production view via API"
echo ""

echo "4. Checking updated analytics..."
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
echo "✅ Demographics should show real distribution:"
echo "   - Investor views should be highest"
echo "   - Some production and creator views"
echo ""
echo "Visit analytics page to see real-time data:"
echo "http://localhost:5173/creator/pitches/63/updated-software-engineer/analytics"