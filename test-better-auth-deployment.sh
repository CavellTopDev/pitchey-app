#!/bin/bash

echo "========================================="
echo "  Better Auth Deployment Test"
echo "========================================="

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

echo -e "\n1. Testing Health Endpoint..."
curl -s "$API_URL/api/health" | jq '.'

echo -e "\n2. Testing Better Auth Session Endpoint..."
curl -s "$API_URL/api/auth/session" | jq '.'

echo -e "\n3. Testing Creator Login with Demo Account..."
response=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}')
echo "$response" | jq '.'

echo -e "\n4. Testing Better Auth Sign-In..."
response=$(curl -s -X POST "$API_URL/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}')
echo "$response" | jq '.'

echo -e "\n5. Testing Generic Pitches Endpoint..."
curl -s "$API_URL/api/pitches?limit=1" | jq '.'

echo -e "\n========================================="
echo "  Test Complete"
echo "========================================="