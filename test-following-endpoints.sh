#!/bin/bash

echo "Testing Following Page Endpoints"
echo "================================"

# Production user token (stellar.production@demo.com)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJUeXBlIjoicHJvZHVjdGlvbiIsImVtYWlsIjoic3RlbGxhci5wcm9kdWN0aW9uQGRlbW8uY29tIiwiaWF0IjoxNzMzNTk0OTMzLCJleHAiOjE3NjUxMzA5MzN9.kBfCr9ysZ1WJhZ-7VL0JJqKwjvKqQ0RaT5zJRGBBdWg"

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

echo "1. Testing /api/follows/followers endpoint..."
curl -s -X GET "$API_URL/api/follows/followers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" | python3 -m json.tool | head -20

echo -e "\n2. Testing /api/follows/following endpoint..."
curl -s -X GET "$API_URL/api/follows/following" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" | python3 -m json.tool | head -20

echo -e "\n3. Testing /api/follows/stats endpoint..."
curl -s -X GET "$API_URL/api/follows/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" | python3 -m json.tool

echo -e "\nTest complete!"