#!/bin/bash

echo "=== TESTING NDA AND INFO REQUEST API ENDPOINTS ==="
echo "Testing with backend at http://localhost:8001"

BASE_URL="http://localhost:8001"

# Test 1: Health check
echo -e "\n1. Health Check:"
curl -s "$BASE_URL/api/health" | jq '.success'

# Test 2: Check if NDA endpoints exist
echo -e "\n2. Testing NDA endpoints availability:"

echo "  - GET /api/nda-requests:"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/nda-requests"

echo -e "\n  - GET /api/ndas:"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/ndas"

echo -e "\n  - GET /api/info-requests:"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/info-requests"

# Test 3: Test NDA request creation (without auth first to see the response)
echo -e "\n\n3. Testing NDA request creation (expect auth error):"
curl -s -X POST "$BASE_URL/api/nda-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "pitchId": 1,
    "requestMessage": "Test NDA request",
    "ndaType": "basic"
  }' | jq '.'

# Test 4: Test info request endpoints
echo -e "\n4. Testing info request creation (expect auth error):"
curl -s -X POST "$BASE_URL/api/info-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "ndaId": 1,
    "pitchId": 1,
    "requestType": "financial",
    "subject": "Test Info Request",
    "message": "Test message"
  }' | jq '.'

# Test 5: Check if routes are defined properly
echo -e "\n5. Testing route definitions:"

echo "  - OPTIONS /api/nda-requests:"
curl -s -X OPTIONS "$BASE_URL/api/nda-requests" -w " Status: %{http_code}\n"

echo "  - OPTIONS /api/info-requests:"
curl -s -X OPTIONS "$BASE_URL/api/info-requests" -w " Status: %{http_code}\n"

echo -e "\n6. Database connectivity test via API:"
echo "  - GET /api/users (should work):"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users"

echo -e "\n  - GET /api/pitches (should work):"
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/pitches"

echo -e "\n\n✅ API endpoint testing completed!"
echo "Expected results:"
echo "  - Health check: true"
echo "  - NDA endpoints: 401 (auth required) or 200 (if accessible)"
echo "  - Info request endpoints: 401 (auth required) or 200 (if accessible)"
echo "  - Database connectivity: 200 for users/pitches"