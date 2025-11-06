#!/bin/bash

# Test script for missing API endpoints with demo user authentication
echo "🧪 Testing missing API endpoints for demo users..."

BASE_URL="http://localhost:8001"

# Demo user credentials
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PRODUCTION_EMAIL="stellar.production@demo.com"
PASSWORD="Demo123"

# Function to login and get token
login_user() {
    local email=$1
    local user_type=$2
    
    echo "🔐 Logging in as $user_type: $email"
    
    local response=$(curl -s -X POST "$BASE_URL/api/auth/$user_type/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")
    
    echo "Login response: $response"
    
    # Extract token from response
    local token=$(echo "$response" | jq -r '.data.token // .token // empty')
    
    if [ -z "$token" ] || [ "$token" = "null" ]; then
        echo "❌ Failed to get token for $user_type"
        return 1
    fi
    
    echo "✅ Got token for $user_type: ${token:0:20}..."
    echo "$token"
}

# Test missing endpoints for creator
test_creator_endpoints() {
    echo -e "\n=== TESTING CREATOR ENDPOINTS ==="
    
    local token=$(login_user "$CREATOR_EMAIL" "creator")
    
    if [ -z "$token" ]; then
        echo "❌ Cannot test creator endpoints - login failed"
        return 1
    fi
    
    echo -e "\n1. Testing /api/creator/funding/overview"
    curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/creator/funding/overview" | jq '.'
    
    echo -e "\n2. Testing /api/analytics/user?preset=month"
    curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/analytics/user?preset=month" | jq '.'
    
    echo -e "\n3. Testing /api/ndas/stats"
    curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/ndas/stats" | jq '.'
}

# Test endpoints for investor
test_investor_endpoints() {
    echo -e "\n=== TESTING INVESTOR ENDPOINTS ==="
    
    local token=$(login_user "$INVESTOR_EMAIL" "investor")
    
    if [ -z "$token" ]; then
        echo "❌ Cannot test investor endpoints - login failed"
        return 1
    fi
    
    echo -e "\n1. Testing /api/analytics/user?preset=week (investor)"
    curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/analytics/user?preset=week" | jq '.'
    
    echo -e "\n2. Testing /api/ndas/stats (investor)"
    curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/ndas/stats" | jq '.'
}

# Test endpoints for production
test_production_endpoints() {
    echo -e "\n=== TESTING PRODUCTION ENDPOINTS ==="
    
    local token=$(login_user "$PRODUCTION_EMAIL" "production")
    
    if [ -z "$token" ]; then
        echo "❌ Cannot test production endpoints - login failed"
        return 1
    fi
    
    echo -e "\n1. Testing /api/analytics/user?preset=month (production)"
    curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/analytics/user?preset=month" | jq '.'
    
    echo -e "\n2. Testing /api/ndas/stats (production)"
    curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/ndas/stats" | jq '.'
}

# Run all tests
test_creator_endpoints
test_investor_endpoints 
test_production_endpoints

echo -e "\n✅ All endpoint tests completed!"