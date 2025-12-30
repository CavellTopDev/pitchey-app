#!/bin/bash

# Seed NDA Workflow Test Data
# This script creates proper test data for the complete NDA workflow

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo "🌱 Seeding NDA Workflow Test Data..."

# 1. First, login as creator to get auth token
echo "1. Logging in as creator..."
CREATOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

CREATOR_TOKEN=$(echo $CREATOR_RESPONSE | jq -r '.data.token // .token // empty')
CREATOR_ID=$(echo $CREATOR_RESPONSE | jq -r '.data.user.id // .user.id // empty')

if [ -z "$CREATOR_TOKEN" ]; then
  echo "❌ Failed to login as creator"
  echo "Response: $CREATOR_RESPONSE"
  exit 1
fi

echo "✅ Creator logged in (ID: $CREATOR_ID)"

# 2. Create a pitch with NDA requirement
echo -e "\n2. Creating pitch with NDA requirement..."
PITCH_RESPONSE=$(curl -s -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NDA Test Pitch - The Secret Project",
    "logline": "A groundbreaking film that requires strict confidentiality.",
    "genre": "Thriller",
    "format": "Feature Film",
    "short_synopsis": "Public synopsis - safe to share.",
    "long_synopsis": "CONFIDENTIAL: This detailed synopsis contains trade secrets and proprietary information.",
    "budget": 5000000,
    "require_nda": true,
    "status": "published",
    "visibility": "public",
    "stage": "development",
    "production_stage": "pre_production",
    "characters": [
      {
        "name": "Secret Agent X",
        "role": "Lead",
        "description": "CONFIDENTIAL: Character details under NDA"
      }
    ],
    "themes": ["Espionage", "Trust", "Betrayal"],
    "target_audience": "Adults 18-45",
    "estimated_budget": 5000000,
    "budget_range": "5-10M",
    "budget_breakdown_url": "https://example.com/budget-breakdown.pdf",
    "production_timeline_url": "https://example.com/timeline.pdf"
  }')

PITCH_ID=$(echo $PITCH_RESPONSE | jq -r '.data.pitch.id // .data.id // .pitch.id // empty')

if [ -z "$PITCH_ID" ]; then
  echo "❌ Failed to create pitch"
  echo "Response: $PITCH_RESPONSE"
  exit 1
fi

echo "✅ Pitch created (ID: $PITCH_ID)"

# 3. Login as investor
echo -e "\n3. Logging in as investor..."
INVESTOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')

INVESTOR_TOKEN=$(echo $INVESTOR_RESPONSE | jq -r '.data.token // .token // empty')
INVESTOR_ID=$(echo $INVESTOR_RESPONSE | jq -r '.data.user.id // .user.id // empty')

if [ -z "$INVESTOR_TOKEN" ]; then
  echo "❌ Failed to login as investor"
  echo "Response: $INVESTOR_RESPONSE"
  exit 1
fi

echo "✅ Investor logged in (ID: $INVESTOR_ID)"

# 4. Request NDA as investor
echo -e "\n4. Requesting NDA access as investor..."
NDA_REQUEST_RESPONSE=$(curl -s -X POST "$API_URL/api/ndas/request" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"pitchId\": $PITCH_ID,
    \"message\": \"I am very interested in this project and would like to review the confidential materials.\",
    \"expiryDays\": 30
  }")

NDA_ID=$(echo $NDA_REQUEST_RESPONSE | jq -r '.data.nda.id // .data.id // .nda.id // empty')

if [ -z "$NDA_ID" ]; then
  echo "❌ Failed to request NDA"
  echo "Response: $NDA_REQUEST_RESPONSE"
else
  echo "✅ NDA request created (ID: $NDA_ID)"
fi

# 5. Check NDA status
echo -e "\n5. Checking NDA status..."
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/ndas/pitch/$PITCH_ID/status" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

echo "NDA Status: $(echo $STATUS_RESPONSE | jq -r '.data.hasNDA // false')"

# 6. Login as production company
echo -e "\n6. Logging in as production company..."
PRODUCTION_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/production/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "stellar.production@demo.com",
    "password": "Demo123"
  }')

PRODUCTION_TOKEN=$(echo $PRODUCTION_RESPONSE | jq -r '.data.token // .token // empty')
PRODUCTION_ID=$(echo $PRODUCTION_RESPONSE | jq -r '.data.user.id // .user.id // empty')

if [ -z "$PRODUCTION_TOKEN" ]; then
  echo "❌ Failed to login as production"
  echo "Response: $PRODUCTION_RESPONSE"
  exit 1
fi

echo "✅ Production company logged in (ID: $PRODUCTION_ID)"

# 7. Request NDA as production company
echo -e "\n7. Requesting NDA access as production company..."
PROD_NDA_RESPONSE=$(curl -s -X POST "$API_URL/api/ndas/request" \
  -H "Authorization: Bearer $PRODUCTION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"pitchId\": $PITCH_ID,
    \"message\": \"Our production company would like to evaluate this project for potential production.\",
    \"expiryDays\": 60
  }")

PROD_NDA_ID=$(echo $PROD_NDA_RESPONSE | jq -r '.data.nda.id // .data.id // .nda.id // empty')

if [ -z "$PROD_NDA_ID" ]; then
  echo "❌ Failed to request NDA as production"
  echo "Response: $PROD_NDA_RESPONSE"
else
  echo "✅ Production NDA request created (ID: $PROD_NDA_ID)"
fi

# Summary
echo -e "\n📊 NDA Workflow Test Data Created:"
echo "================================"
echo "✅ Pitch ID: $PITCH_ID"
echo "✅ Creator ID: $CREATOR_ID"
echo "✅ Investor NDA Request ID: $NDA_ID"
echo "✅ Production NDA Request ID: $PROD_NDA_ID"
echo ""
echo "🔗 Test URLs:"
echo "- View Pitch: https://pitchey-5o8.pages.dev/pitch/$PITCH_ID"
echo "- Creator Dashboard: https://pitchey-5o8.pages.dev/dashboard/creator"
echo "- Investor Dashboard: https://pitchey-5o8.pages.dev/dashboard/investor"
echo "- Production Dashboard: https://pitchey-5o8.pages.dev/dashboard/production"
echo ""
echo "📝 Next Steps:"
echo "1. Creator should see NDA requests in dashboard"
echo "2. Creator can approve/reject NDA requests"
echo "3. Once approved, requesters can sign NDA"
echo "4. After signing, requesters get access to confidential content"