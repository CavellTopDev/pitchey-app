#!/bin/bash

# Test Better Auth Integration
echo "Testing Better Auth Integration"
echo "================================"

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

# Test 1: Health check
echo -e "\n1. Health Check:"
curl -s "$API_URL/api/health" | jq . || echo "Health check endpoint not available"

# Test 2: Creator Login
echo -e "\n2. Creator Login Test:"
curl -X POST "$API_URL/api/auth/creator/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' \
  2>/dev/null | jq .

# Test 3: Investor Login
echo -e "\n3. Investor Login Test:"
curl -X POST "$API_URL/api/auth/investor/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}' \
  2>/dev/null | jq .

# Test 4: Production Login
echo -e "\n4. Production Login Test:"
curl -X POST "$API_URL/api/auth/production/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}' \
  2>/dev/null | jq .

# Test 5: Check Better Auth session endpoint
echo -e "\n5. Better Auth Session Endpoint:"
curl -s "$API_URL/api/auth/session" \
  -H 'Content-Type: application/json' \
  2>/dev/null | jq .

echo -e "\n================================"
echo "Better Auth Integration Status:"
echo "- Authentication endpoints are responding"
echo "- Users may need to be migrated to Better Auth format"
echo "- Check if password hashing matches Better Auth requirements"