#!/bin/bash

# Test Twilio SMS Integration
echo "=== Testing Twilio SMS Notifications ==="
echo "Testing at: $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Test phone number (use your own for testing)
TEST_PHONE="+1234567890"

echo -e "${BLUE}Enter test phone number (with country code, e.g., +1234567890):${NC}"
read -r TEST_PHONE

# Login to get auth token
echo -e "${YELLOW}1. Logging in as creator...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Failed to get auth token${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Authenticated successfully${NC}"
echo ""

# Test 1: Send test SMS notification
echo -e "${YELLOW}2. Sending test SMS notification...${NC}"
SMS_RESPONSE=$(curl -s -X POST "$API_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"type\": \"sms\",
    \"to\": \"$TEST_PHONE\",
    \"template\": \"test\",
    \"data\": {
      \"message\": \"Test SMS from Pitchey notification system\",
      \"timestamp\": \"$(date)\"
    }
  }")

if echo "$SMS_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ SMS sent successfully${NC}"
  echo "Response: $SMS_RESPONSE"
else
  echo -e "${RED}✗ Failed to send SMS${NC}"
  echo "Response: $SMS_RESPONSE"
fi
echo ""

# Test 2: Send NDA notification via SMS
echo -e "${YELLOW}3. Testing NDA notification via SMS...${NC}"
NDA_SMS_RESPONSE=$(curl -s -X POST "$API_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"type\": \"sms\",
    \"to\": \"$TEST_PHONE\",
    \"template\": \"nda-request\",
    \"data\": {
      \"pitchTitle\": \"Test Movie Project\",
      \"requesterName\": \"Sarah Investor\",
      \"requestDate\": \"$(date)\"
    }
  }")

if echo "$NDA_SMS_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ NDA SMS notification sent${NC}"
else
  echo -e "${RED}✗ Failed to send NDA SMS${NC}"
  echo "Response: $NDA_SMS_RESPONSE"
fi
echo ""

# Test 3: Test SMS rate limiting
echo -e "${YELLOW}4. Testing SMS rate limiting...${NC}"
for i in {1..3}; do
  echo "Attempt $i:"
  RATE_RESPONSE=$(curl -s -X POST "$API_URL/api/notifications/send" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"type\": \"sms\",
      \"to\": \"$TEST_PHONE\",
      \"template\": \"test\",
      \"data\": {
        \"message\": \"Rate limit test $i\"
      }
    }")
  
  if echo "$RATE_RESPONSE" | grep -q "rate_limited"; then
    echo -e "${YELLOW}⚠ Rate limited (expected after multiple requests)${NC}"
  elif echo "$RATE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ SMS $i sent${NC}"
  else
    echo -e "${RED}✗ Unexpected response${NC}"
  fi
  sleep 1
done
echo ""

echo -e "${GREEN}=== SMS Test Complete ===${NC}"
echo ""
echo "Summary:"
echo "- SMS endpoint: $API_URL/api/notifications/send"
echo "- Webhook URL: $API_URL/api/webhooks/twilio/status"
echo "- Rate limiting: Active"
echo ""

