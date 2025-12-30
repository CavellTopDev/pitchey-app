#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo "=== Testing Cross-Portal NDA Workflow ==="

# Step 1: Login as creator
echo -e "\n1. Logging in as creator..."
CREATOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }' \
  -c creator_cookies.txt)

CREATOR_TOKEN=$(echo "$CREATOR_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Creator logged in: ${CREATOR_TOKEN:0:20}..."

# Step 2: Get creator's pitches
echo -e "\n2. Getting creator's pitches..."
PITCHES_RESPONSE=$(curl -s "$API_URL/api/pitches/my" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -b creator_cookies.txt)

echo "Creator pitches: $PITCHES_RESPONSE" | head -200

# Extract first pitch ID if available
PITCH_ID=$(echo "$PITCHES_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "Using pitch ID: $PITCH_ID"

# Step 3: Login as investor
echo -e "\n3. Logging in as investor..."
INVESTOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }' \
  -c investor_cookies.txt)

INVESTOR_TOKEN=$(echo "$INVESTOR_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Investor logged in: ${INVESTOR_TOKEN:0:20}..."

# Step 4: Request NDA for a pitch
if [ ! -z "$PITCH_ID" ]; then
  echo -e "\n4. Investor requesting NDA for pitch $PITCH_ID..."
  NDA_REQUEST=$(curl -s -X POST "$API_URL/api/nda/request" \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": $PITCH_ID}" \
    -b investor_cookies.txt)
  
  echo "NDA request response: $NDA_REQUEST"
  
  # Extract NDA request ID
  NDA_ID=$(echo "$NDA_REQUEST" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  echo "NDA request ID: $NDA_ID"
else
  echo "No pitch found to test NDA workflow"
fi

# Step 5: Check creator's pending NDAs
echo -e "\n5. Checking creator's pending NDA requests..."
PENDING_NDAS=$(curl -s "$API_URL/api/nda/pending" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -b creator_cookies.txt)

echo "Pending NDAs: $PENDING_NDAS" | head -200

# Step 6: Test NDA approval (if we have an NDA ID)
if [ ! -z "$NDA_ID" ]; then
  echo -e "\n6. Creator approving NDA request $NDA_ID..."
  APPROVE_RESPONSE=$(curl -s -X POST "$API_URL/api/nda/approve/$NDA_ID" \
    -H "Authorization: Bearer $CREATOR_TOKEN" \
    -b creator_cookies.txt)
  
  echo "Approval response: $APPROVE_RESPONSE"
fi

# Step 7: Check investor's signed NDAs
echo -e "\n7. Checking investor's signed NDAs..."
SIGNED_NDAS=$(curl -s "$API_URL/api/nda/signed" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -b investor_cookies.txt)

echo "Signed NDAs: $SIGNED_NDAS" | head -200

# Clean up
rm -f creator_cookies.txt investor_cookies.txt

echo -e "\n=== Cross-Portal NDA Workflow Test Complete ==="
