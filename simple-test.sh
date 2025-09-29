#!/bin/bash

BACKEND_URL="http://localhost:8001"

echo "=== Testing Backend Services ==="

# Test backend connectivity
echo "1. Testing backend connectivity..."
backend_status=$(curl -s -w "%{http_code}" "$BACKEND_URL" -o /dev/null 2>/dev/null || echo "000")
echo "Backend status: $backend_status"

# Test creator login
echo "2. Testing creator login..."
creator_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}' \
    "$BACKEND_URL/api/auth/creator/login" 2>/dev/null || echo "Failed")

echo "Creator login response: $creator_response"

# Test investor login
echo "3. Testing investor login..."
investor_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}' \
    "$BACKEND_URL/api/auth/investor/login" 2>/dev/null || echo "Failed")

echo "Investor login response: $investor_response"

# Test production login
echo "4. Testing production login..."
production_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"stellar.production@demo.com","password":"Demo123"}' \
    "$BACKEND_URL/api/auth/production/login" 2>/dev/null || echo "Failed")

echo "Production login response: $production_response"

# Test public endpoints
echo "5. Testing public endpoints..."
public_pitches_status=$(curl -s -w "%{http_code}" "$BACKEND_URL/api/pitches/public" -o /dev/null 2>/dev/null || echo "000")
echo "Public pitches status: $public_pitches_status"

echo "=== Test Complete ==="