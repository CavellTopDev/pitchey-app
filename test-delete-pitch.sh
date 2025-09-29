#!/bin/bash

# Test Delete button functionality
echo "Testing Delete button functionality..."

# 1. Login as creator
echo "1. Logging in as creator..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to login"
  exit 1
fi

echo "✅ Logged in successfully"

# 2. Get list of pitches
echo -e "\n2. Getting list of pitches..."
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

echo "Pitches response: $PITCHES" | head -100

# Extract first pitch ID
PITCH_ID=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -z "$PITCH_ID" ]; then
  echo "No pitches found to delete"
else
  echo "Found pitch ID: $PITCH_ID"
  
  # 3. Delete the pitch
  echo -e "\n3. Deleting pitch $PITCH_ID..."
  DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:8001/api/creator/pitches/$PITCH_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Delete response: $DELETE_RESPONSE"
  
  # 4. Verify deletion
  echo -e "\n4. Verifying deletion..."
  VERIFY=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$VERIFY" | grep -q "\"id\":$PITCH_ID"; then
    echo "❌ Pitch was not deleted"
  else
    echo "✅ Pitch deleted successfully"
  fi
fi
