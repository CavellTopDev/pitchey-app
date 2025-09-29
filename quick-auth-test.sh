#!/bin/bash

# Quick authentication test for debugging
set -e

BACKEND_URL="http://localhost:8001"
CREATOR_EMAIL="alex.creator@demo.com"
DEMO_PASSWORD="Demo123"

echo "Testing creator login..."

# Test creator login
response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}" \
    "$BACKEND_URL/api/auth/creator/login" 2>/dev/null || echo "HTTPSTATUS:000")

status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')

echo "Status: $status_code"
echo "Response: $response_body"

if [ "$status_code" = "200" ]; then
    token=$(echo "$response_body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Token: $token"
    
    if [ -n "$token" ]; then
        echo "Testing protected endpoint with token..."
        
        protected_response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            "$BACKEND_URL/api/profile" 2>/dev/null || echo "HTTPSTATUS:000")
        
        protected_status=$(echo "$protected_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
        protected_body=$(echo "$protected_response" | sed 's/HTTPSTATUS:[0-9]*$//')
        
        echo "Protected endpoint status: $protected_status"
        echo "Protected endpoint response: $protected_body"
    fi
fi