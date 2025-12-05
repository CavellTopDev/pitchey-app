#!/bin/bash

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

echo "Testing Seeking Investment Feature"
echo "=================================="

# 1. Login as creator
TOKEN=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}' | \
  grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "1. Logged in as creator"

# 2. Create pitch with seeking investment
TIMESTAMP=$(date +%s)
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Seeking Investment Test '"$TIMESTAMP"'",
    "logline": "A test pitch with investment needs",
    "synopsis": "Testing the seeking investment feature",
    "genre": "action",
    "format": "feature",
    "status": "draft",
    "visibility": "public",
    "seekingInvestment": true,
    "budgetRange": "$5M - $10M",
    "targetAudience": "General"
  }')

echo "2. Create response:"
echo "$CREATE_RESPONSE" | jq '.'

PITCH_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$PITCH_ID" ]; then
  echo ""
  echo "3. Fetching pitch details (ID: $PITCH_ID)..."
  PITCH_DETAILS=$(curl -s "$API_URL/api/pitches/$PITCH_ID")
  echo "$PITCH_DETAILS" | jq '.pitch | {id, title, seekingInvestment, budgetRange}'
  
  # Clean up
  curl -s -X DELETE "$API_URL/api/pitches/$PITCH_ID" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
  echo ""
  echo "4. Test pitch cleaned up"
fi

echo ""
echo "5. Testing browse with seeking investment filter..."
BROWSE=$(curl -s "$API_URL/api/pitches/browse/enhanced?seekingInvestment=true&limit=3")
echo "$BROWSE" | jq '{success, total, items: .items | length}'

echo ""
echo "=================================="
echo "Done!"
