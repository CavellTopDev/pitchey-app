#!/bin/bash

echo "🎯 Testing NDA Request Workflow"
echo "================================"

# Test with the demo investor account
echo -e "\n1️⃣ Logging in as investor..."
LOGIN_RESPONSE=$(curl -s -X POST https://pitchey-backend.deno.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Response:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Logged in successfully"

# Get a production company pitch ID
echo -e "\n2️⃣ Getting a production company pitch..."
PITCHES=$(curl -s https://pitchey-backend.deno.dev/api/public/pitches)
PITCH=$(echo "$PITCHES" | jq '.pitches[] | select(.title == "Silicon Dreams") | {id, title}')
PITCH_ID=$(echo "$PITCH" | jq -r '.id')

if [ -z "$PITCH_ID" ] || [ "$PITCH_ID" == "null" ]; then
  echo "❌ Could not find production pitch"
  exit 1
fi

echo "✅ Found pitch: Silicon Dreams (ID: $PITCH_ID)"

# Request NDA
echo -e "\n3️⃣ Requesting NDA access..."
NDA_RESPONSE=$(curl -s -X POST "https://pitchey-backend.deno.dev/api/pitches/$PITCH_ID/request-nda" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "I am interested in this project and would like to review the full details.",
    "requestType": "basic"
  }')

SUCCESS=$(echo "$NDA_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" == "true" ]; then
  echo "✅ NDA request submitted successfully!"
  echo "Response: $NDA_RESPONSE"
else
  echo "❌ NDA request failed:"
  echo "$NDA_RESPONSE"
fi

echo -e "\n================================"
echo "📊 Test Summary:"
if [ "$SUCCESS" == "true" ]; then
  echo "✅ NDA workflow is working correctly!"
  echo "The production company will receive a notification about your NDA request."
else
  echo "❌ There are issues with the NDA workflow that need fixing."
fi