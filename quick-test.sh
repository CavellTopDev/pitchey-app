#!/bin/bash

# Quick test to validate basic functionality
API_BASE="http://localhost:8001"

echo "Testing Health..."
curl -s "$API_BASE/api/health" | grep -q "healthy" && echo "✅ Health OK" || echo "❌ Health Failed"

echo "Testing Creator Login..."
CREATOR_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

if echo "$CREATOR_RESPONSE" | grep -q "token"; then
  echo "✅ Creator Login OK"
  CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "Creator Token: ${CREATOR_TOKEN:0:20}..."
else
  echo "❌ Creator Login Failed"
  echo "Response: $CREATOR_RESPONSE"
fi

echo "Testing Investor Login..."
INVESTOR_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

if echo "$INVESTOR_RESPONSE" | grep -q "token"; then
  echo "✅ Investor Login OK"
  INVESTOR_TOKEN=$(echo "$INVESTOR_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "Investor Token: ${INVESTOR_TOKEN:0:20}..."
else
  echo "❌ Investor Login Failed"
  echo "Response: $INVESTOR_RESPONSE"
fi

echo "Testing Production Login..."
PRODUCTION_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/production/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}')

if echo "$PRODUCTION_RESPONSE" | grep -q "token"; then
  echo "✅ Production Login OK"
  PRODUCTION_TOKEN=$(echo "$PRODUCTION_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "Production Token: ${PRODUCTION_TOKEN:0:20}..."
else
  echo "❌ Production Login Failed"
  echo "Response: $PRODUCTION_RESPONSE"
fi

if [[ -n "$CREATOR_TOKEN" ]]; then
  echo "Testing Creator Dashboard..."
  DASHBOARD_RESPONSE=$(curl -s "$API_BASE/api/creator/dashboard" \
    -H "Authorization: Bearer $CREATOR_TOKEN")
  
  if [[ $? -eq 0 ]]; then
    echo "✅ Creator Dashboard accessible"
  else
    echo "❌ Creator Dashboard failed"
  fi
  
  echo "Testing Pitch Creation..."
  PITCH_RESPONSE=$(curl -s -X POST "$API_BASE/api/creator/pitches" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CREATOR_TOKEN" \
    -d '{
      "title": "Quick Test Pitch",
      "logline": "A test pitch for validation", 
      "genre": "drama",
      "format": "feature",
      "shortSynopsis": "Test synopsis"
    }')
  
  if echo "$PITCH_RESPONSE" | grep -q '"id"'; then
    echo "✅ Pitch Creation OK"
    PITCH_ID=$(echo "$PITCH_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo "Created Pitch ID: $PITCH_ID"
  else
    echo "❌ Pitch Creation Failed"
    echo "Response: $PITCH_RESPONSE"
  fi
fi

echo ""
echo "Basic functionality test completed!"