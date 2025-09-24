#!/bin/bash

echo "Testing Live Portfolio Page..."
echo ""

# First, login to get a token
echo "1. Logging in as creator..."
LOGIN_RESPONSE=$(curl -s -X POST https://pitchey-backend-rx095sy3rywk.deno.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@demo.com","password":"demo123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.user.id')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "✓ Login successful. User ID: $USER_ID"
  
  echo ""
  echo "2. Fetching portfolio data..."
  
  # Test the portfolio endpoint
  PORTFOLIO_RESPONSE=$(curl -s -X GET "https://pitchey-backend-rx095sy3rywk.deno.dev/api/creator/portfolio/$USER_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Portfolio Response:"
  echo $PORTFOLIO_RESPONSE | jq '{
    success: .success,
    creator_name: .creator.name,
    total_pitches: .creator.stats.totalPitches,
    total_views: .creator.stats.totalViews,
    pitches_count: (.pitches | length),
    first_pitch: .pitches[0].title
  }'
  
  echo ""
  echo "3. Testing trending endpoint..."
  TRENDING_RESPONSE=$(curl -s "https://pitchey-backend-rx095sy3rywk.deno.dev/api/trending")
  echo "Trending pitches count: $(echo $TRENDING_RESPONSE | jq '. | length')"
  
else
  echo "✗ Login failed"
  echo $LOGIN_RESPONSE | jq '.'
fi

echo ""
echo "4. Frontend URLs:"
echo "Main: https://pitchey-frontend.deno.dev/creator/portfolio"
echo "Latest deployment: https://pitchey-frontend-x3j06s4d9e6f.deno.dev/creator/portfolio"
echo ""
echo "To test: Login as alex@demo.com / demo123 and click 'View My Portfolio'"