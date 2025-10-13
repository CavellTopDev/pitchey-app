#!/bin/bash

echo "🔒 Testing Demo Account Business Logic"
echo "====================================="
echo "Ensuring demo accounts don't use NDA/follow for their own pitches"

# Test Creator trying to follow their own pitch
echo -e "\n1. Testing Creator cannot follow their own pitch..."
CREATOR_TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}' | jq -r '.token')

echo "Creator (ID 1) attempting to follow their own pitch (ID 1):"
FOLLOW_RESULT=$(curl -s -X POST http://localhost:8001/api/pitches/1/follow \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json")
echo "$FOLLOW_RESULT" | jq '{success, error}' || echo "Response: $FOLLOW_RESULT"

# Test Investor trying to follow their own pitch  
echo -e "\n2. Testing Investor cannot follow their own pitch..."
INVESTOR_TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}' | jq -r '.token')

echo "Investor (ID 2) attempting to follow their own pitch (ID 3):"
FOLLOW_RESULT2=$(curl -s -X POST http://localhost:8001/api/pitches/3/follow \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json")
echo "$FOLLOW_RESULT2" | jq '{success, error}' || echo "Response: $FOLLOW_RESULT2"

# Test Creator can follow others' pitches
echo -e "\n3. Testing Creator CAN follow others' pitches..."
echo "Creator (ID 1) attempting to follow Investor's pitch (ID 3):"
FOLLOW_OTHER=$(curl -s -X POST http://localhost:8001/api/pitches/3/follow \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json")
echo "$FOLLOW_OTHER" | jq '{success, error}' || echo "Response: $FOLLOW_OTHER"

echo -e "\n✅ Business Logic Test Complete!"
echo "Expected results:"
echo "- Demo users should NOT be able to follow their own pitches"
echo "- Demo users SHOULD be able to follow others' pitches" 
echo "- Similar logic should apply to NDA requests"