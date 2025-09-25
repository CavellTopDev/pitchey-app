#!/bin/bash

echo "Testing NDA Request Endpoint (Fixed)"
echo "===================================="

# Login as investor
echo -n "1. Logging in as investor... "
RESPONSE=$(curl -s -X POST "https://pitchey-backend.deno.dev/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "FAILED"
  exit 1
fi
echo "SUCCESS"

# Test NDA request with correct enum value
echo -n "2. Requesting NDA for pitch ID 1... "
NDA_RESPONSE=$(curl -s -X POST "https://pitchey-backend.deno.dev/api/pitches/1/request-nda" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ndaType": "basic",
    "requestMessage": "Testing NDA request after fix",
    "companyInfo": {
      "companyName": "Test Company",
      "position": "investor",
      "intendedUse": "Investment evaluation"
    }
  }')

echo ""
echo "Response: $NDA_RESPONSE"

# Check if successful
if echo "$NDA_RESPONSE" | grep -q '"success":true'; then
  echo "✅ NDA request succeeded!"
elif echo "$NDA_RESPONSE" | grep -q "already"; then
  echo "ℹ️ NDA already exists or pending"
elif echo "$NDA_RESPONSE" | grep -q "not found"; then
  echo "⚠️ Pitch not found (database issue)"
else
  echo "❌ NDA request failed with error"
fi
