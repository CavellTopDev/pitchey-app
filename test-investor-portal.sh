#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"

echo "=== Testing Investor Portal Flow ==="
echo "Testing with demo investor account..."

# 1. Sign in as investor
echo -e "\n1. Signing in as investor..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }' \
  -c cookies.txt)

echo "Login response: $LOGIN_RESPONSE" | head -100

# Extract token if available
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$TOKEN" ]; then
  echo "Token received: ${TOKEN:0:20}..."
fi

# 2. Test investor dashboard
echo -e "\n2. Fetching investor dashboard data..."
DASHBOARD_RESPONSE=$(curl -s "$API_URL/api/investor/dashboard" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt)

echo "Dashboard response: $DASHBOARD_RESPONSE" | head -200

# 3. Test investment portfolio
echo -e "\n3. Fetching investment portfolio..."
PORTFOLIO_RESPONSE=$(curl -s "$API_URL/api/investor/investments" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt)

echo "Portfolio response: $PORTFOLIO_RESPONSE" | head -200

# 4. Test saved pitches
echo -e "\n4. Fetching saved pitches..."
SAVED_RESPONSE=$(curl -s "$API_URL/api/saved" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt)

echo "Saved pitches response: $SAVED_RESPONSE" | head -200

# 5. Test NDA requests
echo -e "\n5. Checking NDA requests..."
NDA_RESPONSE=$(curl -s "$API_URL/api/nda/requests" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt)

echo "NDA requests response: $NDA_RESPONSE" | head -200

# Clean up
rm -f cookies.txt

echo -e "\n=== Investor Portal Test Complete ==="
