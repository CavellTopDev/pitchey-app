#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo "=== Testing Production Portal Flow ==="

# 1. Sign in as production company
echo -e "\n1. Signing in as production company..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/production/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "stellar.production@demo.com",
    "password": "Demo123"
  }' \
  -c cookies.txt)

echo "Login response: $LOGIN_RESPONSE" | head -100

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$TOKEN" ]; then
  echo "Token received: ${TOKEN:0:20}..."
fi

# 2. Test production dashboard
echo -e "\n2. Fetching production dashboard data..."
DASHBOARD_RESPONSE=$(curl -s "$API_URL/api/production/dashboard" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt)

echo "Dashboard response: $DASHBOARD_RESPONSE" | head -200

# 3. Test current projects
echo -e "\n3. Fetching current projects..."
PROJECTS_RESPONSE=$(curl -s "$API_URL/api/production/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt)

echo "Projects response: $PROJECTS_RESPONSE" | head -200

# 4. Test analytics
echo -e "\n4. Fetching production analytics..."
ANALYTICS_RESPONSE=$(curl -s "$API_URL/api/production/analytics" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt)

echo "Analytics response: $ANALYTICS_RESPONSE" | head -200

# Clean up
rm -f cookies.txt

echo -e "\n=== Production Portal Test Complete ==="
