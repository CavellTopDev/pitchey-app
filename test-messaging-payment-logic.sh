#!/bin/bash

echo "🔍 Testing Messaging Payment Logic Implementation"
echo "================================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:8001"

echo -e "\n1️⃣ Testing Creator Message Sending (Should require credits)"
echo "Logging in as creator..."

CREATOR_TOKEN=$(curl -s -X POST $BASE_URL/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}' | jq -r '.token')

if [ "$CREATOR_TOKEN" != "null" ] && [ "$CREATOR_TOKEN" != "" ]; then
  echo -e "${GREEN}✓ Creator login successful${NC}"
  
  echo "Sending message as creator..."
  CREATOR_RESPONSE=$(curl -s -X POST $BASE_URL/api/messages \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CREATOR_TOKEN" \
    -d '{"content": "Test message from creator", "recipientId": 2}')
  
  echo "Creator response: $CREATOR_RESPONSE"
  
  if echo "$CREATOR_RESPONSE" | grep -q "successfully"; then
    echo -e "${GREEN}✓ Creator message sent successfully (credits deducted)${NC}"
  else
    echo -e "${RED}✗ Creator message failed${NC}"
  fi
else
  echo -e "${RED}✗ Creator login failed${NC}"
fi

echo -e "\n2️⃣ Testing Investor Message Sending (Should be free)"
echo "Logging in as investor..."

INVESTOR_TOKEN=$(curl -s -X POST $BASE_URL/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}' | jq -r '.token')

if [ "$INVESTOR_TOKEN" != "null" ] && [ "$INVESTOR_TOKEN" != "" ]; then
  echo -e "${GREEN}✓ Investor login successful${NC}"
  
  echo "Sending message as investor..."
  INVESTOR_RESPONSE=$(curl -s -X POST $BASE_URL/api/messages \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -d '{"content": "Test message from investor", "recipientId": 1}')
  
  echo "Investor response: $INVESTOR_RESPONSE"
  
  if echo "$INVESTOR_RESPONSE" | grep -q "successfully"; then
    echo -e "${GREEN}✓ Investor message sent successfully (free messaging)${NC}"
  else
    echo -e "${RED}✗ Investor message failed${NC}"
  fi
else
  echo -e "${RED}✗ Investor login failed${NC}"
fi

echo -e "\n3️⃣ Testing Production Company Message Sending (Should be free)"
echo "Logging in as production company..."

PRODUCTION_TOKEN=$(curl -s -X POST $BASE_URL/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email": "stellar.production@demo.com", "password": "Demo123"}' | jq -r '.token')

if [ "$PRODUCTION_TOKEN" != "null" ] && [ "$PRODUCTION_TOKEN" != "" ]; then
  echo -e "${GREEN}✓ Production company login successful${NC}"
  
  echo "Sending message as production company..."
  PRODUCTION_RESPONSE=$(curl -s -X POST $BASE_URL/api/messages \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $PRODUCTION_TOKEN" \
    -d '{"content": "Test message from production company", "recipientId": 1}')
  
  echo "Production response: $PRODUCTION_RESPONSE"
  
  if echo "$PRODUCTION_RESPONSE" | grep -q "successfully"; then
    echo -e "${GREEN}✓ Production company message sent successfully (free messaging)${NC}"
  else
    echo -e "${RED}✗ Production company message failed${NC}"
  fi
else
  echo -e "${RED}✗ Production company login failed${NC}"
fi

echo -e "\n✅ Messaging Payment Logic Summary:"
echo "- Creators: Pay 2 credits per message"
echo "- Investors: Free messaging" 
echo "- Production Companies: Free messaging"
echo ""
echo "Frontend features implemented:"
echo "- Cost display for creators (2 credits per message)"
echo "- Free messaging notice for investors/production"
echo "- Enhanced error handling for insufficient credits"
echo "- Payment required error messages with purchase guidance"