#!/bin/bash

# Create Fresh Demo Interactions
# This script creates new interactions between demo accounts
# to showcase the platform's features

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

echo "============================================"
echo "🎬 CREATING FRESH DEMO INTERACTIONS"
echo "============================================"
echo ""

# Get auth tokens for all accounts
echo "🔐 Authenticating demo accounts..."

CREATOR_TOKEN=$(curl -s -X POST $API_URL/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | jq -r '.data.token')

INVESTOR_TOKEN=$(curl -s -X POST $API_URL/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}' | jq -r '.data.token')

PRODUCTION_TOKEN=$(curl -s -X POST $API_URL/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}' | jq -r '.data.token')

if [ -z "$CREATOR_TOKEN" ] || [ "$CREATOR_TOKEN" == "null" ]; then
  echo "❌ Failed to authenticate. Waiting for rate limit..."
  sleep 60
  exit 1
fi

echo "✅ All accounts authenticated"
echo ""

# Get list of pitches
echo "📋 Finding available pitches..."
PITCHES=$(curl -s -X GET "$API_URL/api/pitches/public?limit=10" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

# Try to find pitches without existing interactions
PITCH_IDS=($(echo "$PITCHES" | jq -r '.data[].id'))
echo "Found ${#PITCH_IDS[@]} published pitches"
echo ""

# Create new NDA requests for pitches that don't have them
echo "🔐 Creating NDA requests..."
for pitch_id in "${PITCH_IDS[@]}"; do
  echo -n "  → Pitch $pitch_id: "
  
  NDA_RESULT=$(curl -s -X POST $API_URL/api/nda/request \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": $pitch_id}" | jq -r '.message')
  
  if [[ "$NDA_RESULT" == *"already exists"* ]]; then
    echo "Already has NDA request"
  elif [[ "$NDA_RESULT" == *"success"* ]] || [[ "$NDA_RESULT" == *"created"* ]]; then
    echo "✅ NDA request created"
  else
    echo "$NDA_RESULT"
  fi
done

echo ""
echo "💰 Creating investment interests..."
AMOUNTS=(250000 500000 750000 1000000 1500000)
LEVELS=("moderate" "high" "very_high")

for i in {0..2}; do
  if [ $i -lt ${#PITCH_IDS[@]} ]; then
    pitch_id=${PITCH_IDS[$i]}
    amount=${AMOUNTS[$RANDOM % ${#AMOUNTS[@]}]}
    level=${LEVELS[$RANDOM % ${#LEVELS[@]}]}
    
    echo -n "  → Pitch $pitch_id ($amount): "
    
    INTEREST_RESULT=$(curl -s -X POST $API_URL/api/investment/express-interest \
      -H "Authorization: Bearer $INVESTOR_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"pitchId\": $pitch_id,
        \"amount\": $amount,
        \"interestLevel\": \"$level\",
        \"notes\": \"This project aligns well with our investment strategy.\"
      }" | jq -r '.message')
    
    if [[ "$INTEREST_RESULT" == *"already expressed"* ]]; then
      echo "Already has investment interest"
    elif [[ "$INTEREST_RESULT" == *"success"* ]] || [[ "$INTEREST_RESULT" == *"created"* ]]; then
      echo "✅ Interest expressed ($level)"
    else
      echo "$INTEREST_RESULT"
    fi
  fi
done

echo ""
echo "🎬 Creating production reviews..."
FEEDBACK=(
  "This has strong commercial appeal and fits our production slate perfectly."
  "Excellent concept with clear franchise potential."
  "Unique vision that could resonate with global audiences."
  "Compelling narrative with strong character development."
)

for i in {0..1}; do
  if [ $i -lt ${#PITCH_IDS[@]} ]; then
    pitch_id=${PITCH_IDS[$i]}
    feedback=${FEEDBACK[$RANDOM % ${#FEEDBACK[@]}]}
    
    echo -n "  → Pitch $pitch_id: "
    
    REVIEW_RESULT=$(curl -s -X POST $API_URL/api/production/reviews \
      -H "Authorization: Bearer $PRODUCTION_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"pitchId\": $pitch_id,
        \"status\": \"approved\",
        \"feedback\": \"$feedback\",
        \"rating\": 5,
        \"meetingRequested\": true
      }" | jq -r '.message')
    
    if [[ "$REVIEW_RESULT" == *"unique constraint"* ]] || [[ "$REVIEW_RESULT" == *"already"* ]]; then
      echo "Already reviewed"
    elif [[ "$REVIEW_RESULT" == *"success"* ]] || [[ "$REVIEW_RESULT" == *"submitted"* ]]; then
      echo "✅ Review submitted"
    else
      echo "$REVIEW_RESULT"
    fi
  fi
done

echo ""
echo "🔔 Checking notifications..."
NOTIFICATIONS=$(curl -s -X GET "$API_URL/api/user/notifications?limit=10" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

NOTIF_COUNT=$(echo "$NOTIFICATIONS" | jq '.data | length')
if [ "$NOTIF_COUNT" -gt 0 ]; then
  echo "✅ Creator has $NOTIF_COUNT notifications:"
  echo "$NOTIFICATIONS" | jq -r '.data[] | "   • \(.title)"' | head -5
else
  echo "⚠️  No notifications found"
fi

echo ""
echo "============================================"
echo "✨ Demo interactions created successfully!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Visit https://pitchey.pages.dev"
echo "2. Login with demo accounts"
echo "3. Check notifications and dashboards"
echo "4. Approve/reject NDA requests"
echo "5. Review investment interests"