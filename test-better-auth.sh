#!/bin/bash

echo "Testing Better Auth implementation on pitchey-api-prod"
echo "=========================================="

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo -e "\n1. Testing health endpoint:"
curl -s "$API_URL/health" | jq .

echo -e "\n2. Testing creator login (with cookies):"
curl -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' \
  -c cookies.txt \
  -s | jq .

echo -e "\n3. Testing session with cookies:"
curl "$API_URL/api/auth/session" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -s | jq .

echo -e "\n4. Testing logout:"
curl -X POST "$API_URL/api/auth/logout" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -s | jq .

echo -e "\nDone!"
