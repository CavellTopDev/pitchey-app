#!/bin/bash

# Test Investor Dashboard Endpoints
echo "Testing Investor Dashboard Endpoints..."

# Use the demo investor credentials
EMAIL="sarah.investor@demo.com"
PASSWORD="Demo123"

# Login as investor
echo "1. Logging in as investor..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Response:"
  echo $LOGIN_RESPONSE
  exit 1
fi

echo "✅ Login successful. Token: ${TOKEN:0:20}..."

# Test portfolio summary
echo -e "\n2. Testing /api/investor/portfolio/summary..."
curl -s -X GET http://localhost:8001/api/investor/portfolio/summary \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test investments
echo -e "\n3. Testing /api/investor/investments..."
curl -s -X GET http://localhost:8001/api/investor/investments \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test dashboard
echo -e "\n4. Testing /api/investor/dashboard..."
curl -s -X GET http://localhost:8001/api/investor/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test saved pitches
echo -e "\n5. Testing /api/saved-pitches..."
curl -s -X GET http://localhost:8001/api/saved-pitches \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test NDA active
echo -e "\n6. Testing /api/nda/active..."
curl -s -X GET http://localhost:8001/api/nda/active \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test notifications
echo -e "\n7. Testing /api/notifications..."
curl -s -X GET http://localhost:8001/api/notifications \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test recommendations
echo -e "\n8. Testing /api/investment/recommendations..."
curl -s -X GET http://localhost:8001/api/investment/recommendations \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n✅ All endpoint tests completed!"