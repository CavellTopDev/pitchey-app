#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo "=== Testing Investment Deal Workflow ==="
echo ""

# Step 1: Login as investor
echo "1. Login as investor (sarah.investor@demo.com):"
INVESTOR_RESPONSE=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123",
    "userType": "investor"
  }')

INVESTOR_TOKEN=$(echo "$INVESTOR_RESPONSE" | jq -r '.data.token')
echo "Investor login success: $(echo "$INVESTOR_RESPONSE" | jq -r '.success')"

# Step 2: Express investment interest
echo ""
echo "2. Express investment interest in a pitch:"
INTEREST_RESPONSE=$(curl -s -X POST $API_URL/api/investor/express-interest \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pitchId": 1,
    "investmentAmount": 50000,
    "investmentType": "equity",
    "message": "Very interested in this project. Would like to discuss terms."
  }')
echo "$INTEREST_RESPONSE" | jq '.'

# Step 3: Check investment deals
echo ""
echo "3. Check investor's deals:"
curl -s $API_URL/api/investor/deals \
  -H "Authorization: Bearer $INVESTOR_TOKEN" | jq '.'

# Step 4: Login as creator to see incoming investment interest
echo ""
echo "4. Login as creator to check incoming investments:"
CREATOR_RESPONSE=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123",
    "userType": "creator"
  }')

CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | jq -r '.data.token')

echo "Creator's incoming investment deals:"
curl -s $API_URL/api/creator/deals/incoming \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

echo ""
echo "=== Investment Workflow Test Complete ==="
