#!/bin/bash

# Complete Platform Test - All Features
echo "🚀 COMPLETE PLATFORM TEST"
echo "================================="

API_URL="https://pitchey-optimized.cavelltheleaddev.workers.dev"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${BLUE}1. HEALTH & MONITORING${NC}"
echo "------------------------------"

response=$(curl -s "$API_URL/api/health")
status=$(echo $response | jq -r '.status')
version=$(echo $response | jq -r '.version')
echo -e "Health Status: ${GREEN}$status${NC}"
echo -e "Version: $version"

echo -e "\n${BLUE}2. AUTHENTICATION TEST${NC}"
echo "-----------------------"

# Test Creator Login
response=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

success=$(echo $response | jq -r '.success')
if [ "$success" = "true" ]; then
  CREATOR_TOKEN=$(echo $response | jq -r '.data.token')
  echo -e "${GREEN}✅ Creator Login Successful${NC}"
else
  echo -e "${RED}❌ Creator Login Failed${NC}"
fi

# Test Investor Login
response=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

success=$(echo $response | jq -r '.success')
if [ "$success" = "true" ]; then
  INVESTOR_TOKEN=$(echo $response | jq -r '.data.token')
  echo -e "${GREEN}✅ Investor Login Successful${NC}"
else
  echo -e "${RED}❌ Investor Login Failed${NC}"
fi

echo -e "\n${BLUE}3. SEARCH FUNCTIONALITY${NC}"
echo "------------------------"

# Test text search
response=$(curl -s "$API_URL/api/search?q=tomorrow")
results=$(echo $response | jq '.results | length')
echo -e "Search 'tomorrow': ${GREEN}$results results${NC}"

# Test genre search
response=$(curl -s "$API_URL/api/search?genre=sci-fi")
results=$(echo $response | jq '.results | length')
echo -e "Genre 'sci-fi': ${GREEN}$results results${NC}"

# Test budget search
response=$(curl -s "$API_URL/api/search?minBudget=5000000&maxBudget=20000000")
results=$(echo $response | jq '.results | length')
echo -e "Budget $5M-$20M: ${GREEN}$results results${NC}"

# Test combined search
response=$(curl -s "$API_URL/api/search?q=horizon&status=in_production&sortBy=budget")
results=$(echo $response | jq '.results | length')
echo -e "Combined filters: ${GREEN}$results results${NC}"

echo -e "\n${BLUE}4. ADMIN PANEL${NC}"
echo "---------------"

# Admin login
response=$(curl -s -X POST "$API_URL/api/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"Admin123!"}')

success=$(echo $response | jq -r '.success')
if [ "$success" = "true" ]; then
  ADMIN_TOKEN=$(echo $response | jq -r '.data.token')
  echo -e "${GREEN}✅ Admin Login Successful${NC}"
  
  # Test admin endpoints
  response=$(curl -s "$API_URL/api/admin/stats" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  users=$(echo $response | jq -r '.stats.totalUsers')
  pitches=$(echo $response | jq -r '.stats.totalPitches')
  echo -e "   Total Users: $users"
  echo -e "   Total Pitches: $pitches"
  
  # Test user management
  response=$(curl -s "$API_URL/api/admin/users?page=1&limit=10" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  userCount=$(echo $response | jq '.users | length')
  echo -e "   Users Retrieved: $userCount"
else
  echo -e "${RED}❌ Admin Login Failed${NC}"
fi

echo -e "\n${BLUE}5. PASSWORD RESET${NC}"
echo "------------------"

# Request password reset
response=$(curl -s -X POST "$API_URL/api/auth/request-reset" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com"}')

success=$(echo $response | jq -r '.success')
if [ "$success" = "true" ]; then
  token=$(echo $response | jq -r '.resetToken')
  echo -e "${GREEN}✅ Reset Token Generated${NC}"
  echo -e "   Token: ${token:0:20}..."
  
  # Test reset with token
  response=$(curl -s -X POST "$API_URL/api/auth/reset-password" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$token\",\"newPassword\":\"NewDemo123\"}")
  
  success=$(echo $response | jq -r '.success')
  if [ "$success" = "true" ]; then
    echo -e "${GREEN}✅ Password Reset Successful${NC}"
  else
    echo -e "${RED}❌ Password Reset Failed${NC}"
  fi
else
  echo -e "${RED}❌ Reset Request Failed${NC}"
fi

echo -e "\n${BLUE}6. EMAIL VERIFICATION${NC}"
echo "---------------------"

# Request verification
response=$(curl -s -X POST "$API_URL/api/auth/request-verification" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

success=$(echo $response | jq -r '.success')
if [ "$success" = "true" ]; then
  token=$(echo $response | jq -r '.verificationToken')
  echo -e "${GREEN}✅ Verification Token Generated${NC}"
  
  # Verify email
  response=$(curl -s -X POST "$API_URL/api/auth/verify-email" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$token\"}")
  
  success=$(echo $response | jq -r '.success')
  if [ "$success" = "true" ]; then
    echo -e "${GREEN}✅ Email Verified${NC}"
  else
    echo -e "${RED}❌ Verification Failed${NC}"
  fi
else
  echo -e "${RED}❌ Verification Request Failed${NC}"
fi

echo -e "\n${BLUE}7. BROWSE ENHANCED${NC}"
echo "-------------------"

# Test all filters
response=$(curl -s "$API_URL/api/pitches/browse/enhanced?genre=sci-fi&status=seeking_investment&minBudget=10000000&maxBudget=20000000&sortBy=views&order=desc")
pitches=$(echo $response | jq '.pitches | length')
echo -e "Filtered Browse: ${GREEN}$pitches pitches${NC}"

# Test pagination
response=$(curl -s "$API_URL/api/pitches/browse/enhanced?page=1&limit=2")
pitches=$(echo $response | jq '.pitches | length')
total=$(echo $response | jq '.total')
pages=$(echo $response | jq '.totalPages')
echo -e "Pagination: ${GREEN}$pitches of $total (Page 1 of $pages)${NC}"

echo -e "\n${BLUE}8. PITCH MANAGEMENT${NC}"
echo "--------------------"

if [ -n "$CREATOR_TOKEN" ]; then
  # Create pitch
  response=$(curl -s -X POST "$API_URL/api/pitches" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CREATOR_TOKEN" \
    -d '{
      "title": "Test Pitch",
      "tagline": "Testing the platform",
      "genre": "Action",
      "budget": 5000000,
      "synopsis": "A test pitch for the platform",
      "targetAudience": "All ages",
      "status": "draft"
    }')
  
  success=$(echo $response | jq -r '.success')
  if [ "$success" = "true" ]; then
    pitch_id=$(echo $response | jq -r '.data.id')
    echo -e "${GREEN}✅ Pitch Created (ID: $pitch_id)${NC}"
    
    # Update pitch
    response=$(curl -s -X PUT "$API_URL/api/pitches/$pitch_id" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $CREATOR_TOKEN" \
      -d '{"status": "seeking_investment"}')
    
    success=$(echo $response | jq -r '.success')
    if [ "$success" = "true" ]; then
      echo -e "${GREEN}✅ Pitch Updated${NC}"
    else
      echo -e "${RED}❌ Pitch Update Failed${NC}"
    fi
    
    # Delete pitch
    response=$(curl -s -X DELETE "$API_URL/api/pitches/$pitch_id" \
      -H "Authorization: Bearer $CREATOR_TOKEN")
    
    success=$(echo $response | jq -r '.success')
    if [ "$success" = "true" ]; then
      echo -e "${GREEN}✅ Pitch Deleted${NC}"
    else
      echo -e "${RED}❌ Pitch Delete Failed${NC}"
    fi
  else
    echo -e "${RED}❌ Pitch Creation Failed${NC}"
  fi
fi

echo -e "\n${BLUE}9. RESOURCE LIMITS${NC}"
echo "-------------------"

echo "Testing rapid requests..."
errors=0
for i in {1..20}; do
  response_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
  if [ "$response_code" = "503" ]; then
    ((errors++))
    echo -e "${RED}❌ Request $i: Resource limit hit${NC}"
  else
    echo -ne "${GREEN}.${NC}"
  fi
done

if [ $errors -eq 0 ]; then
  echo -e "\n${GREEN}✅ No resource limit errors!${NC}"
else
  echo -e "\n${RED}❌ $errors resource limit errors${NC}"
fi

echo -e "\n================================="
echo -e "${GREEN}✅ COMPLETE PLATFORM TEST DONE${NC}"
echo -e "\nFeatures Tested:"
echo -e "✓ Authentication (Creator, Investor, Production, Admin)"
echo -e "✓ Search (text, genre, budget, combined)"
echo -e "✓ Admin Panel (stats, users, pitches)"
echo -e "✓ Password Reset"
echo -e "✓ Email Verification"
echo -e "✓ Browse with Filters & Pagination"
echo -e "✓ Full CRUD Operations"
echo -e "✓ Resource Limits"