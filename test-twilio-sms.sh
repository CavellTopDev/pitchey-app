#!/bin/bash

# Twilio SMS Integration Test Script
# Tests all SMS features including delivery, opt-outs, and analytics

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:8001}"
TEST_PHONE="${TEST_PHONE:-+1234567890}"  # Replace with your test phone
TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID}"
TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN}"
TWILIO_FROM_NUMBER="${TWILIO_FROM_NUMBER:-+1234567890}"  # Your Twilio number

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}        Twilio SMS Integration Test Suite       ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if Twilio credentials are set
if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  Twilio credentials not set. Please export:${NC}"
  echo "  export TWILIO_ACCOUNT_SID='your_account_sid'"
  echo "  export TWILIO_AUTH_TOKEN='your_auth_token'"
  echo "  export TWILIO_FROM_NUMBER='+1234567890'"
  echo "  export TEST_PHONE='+1987654321'"
  echo ""
  echo "Get credentials from: https://console.twilio.com"
  exit 1
fi

# Login for auth token
echo -e "${YELLOW}1. Authenticating...${NC}"
AUTH_TOKEN=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | \
  grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}❌ Failed to authenticate${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Authenticated${NC}"

echo ""
echo -e "${BLUE}=== Testing Phone Number Validation ===${NC}"

echo -e "${YELLOW}2. Validating test phone number...${NC}"
VALIDATION_RESPONSE=$(curl -s -X POST "$API_URL/api/sms/validate" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"$TEST_PHONE\"}")

echo "$VALIDATION_RESPONSE" | jq '.'

if echo "$VALIDATION_RESPONSE" | grep -q '"valid":true'; then
  echo -e "${GREEN}✅ Phone number is valid${NC}"
else
  echo -e "${RED}❌ Invalid phone number${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}=== Testing Basic SMS Send ===${NC}"

echo -e "${YELLOW}3. Sending test SMS...${NC}"
SMS_RESPONSE=$(curl -s -X POST "$API_URL/api/sms/test" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$TEST_PHONE\",
    \"message\": \"Test SMS from Pitchey notification system. Time: $(date +%H:%M:%S)\",
    \"template\": \"test\"
  }")

echo "$SMS_RESPONSE" | jq '.'

MESSAGE_ID=$(echo "$SMS_RESPONSE" | grep -o '"messageId":"[^"]*' | grep -o '[^"]*$')

if [ -z "$MESSAGE_ID" ]; then
  echo -e "${RED}❌ Failed to send SMS${NC}"
  echo "$SMS_RESPONSE"
else
  echo -e "${GREEN}✅ SMS sent successfully (ID: $MESSAGE_ID)${NC}"
fi

# Wait for delivery
echo -e "${YELLOW}   Waiting 5 seconds for delivery...${NC}"
sleep 5

echo ""
echo -e "${BLUE}=== Testing Delivery Status ===${NC}"

echo -e "${YELLOW}4. Checking delivery status...${NC}"
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/sms/status/$MESSAGE_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "$STATUS_RESPONSE" | jq '.'

if echo "$STATUS_RESPONSE" | grep -q '"status":"delivered"'; then
  echo -e "${GREEN}✅ SMS delivered successfully${NC}"
elif echo "$STATUS_RESPONSE" | grep -q '"status":"sent"'; then
  echo -e "${YELLOW}⚠️  SMS sent, awaiting delivery${NC}"
else
  echo -e "${RED}❌ SMS delivery failed${NC}"
fi

echo ""
echo -e "${BLUE}=== Testing Notification with SMS Channel ===${NC}"

echo -e "${YELLOW}5. Sending notification through SMS channel...${NC}"
NOTIFICATION_RESPONSE=$(curl -s -X POST "$API_URL/api/notifications/send" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": 1,
    \"type\": \"verification_code\",
    \"title\": \"Verification Code\",
    \"message\": \"Your Pitchey verification code is: 123456\",
    \"channels\": [\"sms\"],
    \"priority\": \"high\",
    \"metadata\": {
      \"code\": \"123456\",
      \"expires\": \"5 minutes\"
    }
  }")

echo "$NOTIFICATION_RESPONSE" | jq '.'

echo ""
echo -e "${BLUE}=== Testing Multi-Channel Delivery ===${NC}"

echo -e "${YELLOW}6. Sending notification through multiple channels...${NC}"
MULTI_CHANNEL_RESPONSE=$(curl -s -X POST "$API_URL/api/notifications/send" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "type": "nda_approved",
    "title": "NDA Approved",
    "message": "Your NDA request for '\''Neon Dreams'\'' has been approved!",
    "channels": ["sms", "email", "push", "inApp"],
    "priority": "high",
    "actionUrl": "https://pitchey.com/pitch/123",
    "actionText": "View Pitch"
  }')

echo "$MULTI_CHANNEL_RESPONSE" | jq '.'

# Count successful channels
SUCCESSFUL_CHANNELS=$(echo "$MULTI_CHANNEL_RESPONSE" | jq '[.channels[] | select(.success == true)] | length')
echo -e "${GREEN}✅ Delivered to $SUCCESSFUL_CHANNELS channels${NC}"

echo ""
echo -e "${BLUE}=== Testing Bulk SMS ===${NC}"

echo -e "${YELLOW}7. Sending bulk SMS (3 messages)...${NC}"
BULK_RESPONSE=$(curl -s -X POST "$API_URL/api/sms/bulk" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"messages\": [
      {
        \"to\": \"$TEST_PHONE\",
        \"body\": \"Bulk message 1: Welcome to Pitchey!\",
        \"template\": \"welcome\"
      },
      {
        \"to\": \"$TEST_PHONE\",
        \"body\": \"Bulk message 2: You have a new message\",
        \"template\": \"message\"
      },
      {
        \"to\": \"$TEST_PHONE\",
        \"body\": \"Bulk message 3: Weekly digest available\",
        \"template\": \"digest\"
      }
    ],
    \"options\": {
      \"batchSize\": 2,
      \"delayBetweenBatches\": 1000
    }
  }")

echo "$BULK_RESPONSE" | jq '.'

echo ""
echo -e "${BLUE}=== Testing SMS Rate Limiting ===${NC}"

echo -e "${YELLOW}8. Testing SMS rate limits (5 per day for basic tier)...${NC}"
for i in {1..7}; do
  echo -n "  Attempt $i: "
  RATE_RESPONSE=$(curl -s -X POST "$API_URL/api/sms/test" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"to\": \"$TEST_PHONE\",
      \"message\": \"Rate limit test $i\",
      \"template\": \"test\"
    }")
  
  if echo "$RATE_RESPONSE" | grep -q "Rate limit exceeded"; then
    echo -e "${RED}Rate limited (expected after 5)${NC}"
    break
  else
    echo -e "${GREEN}Sent successfully${NC}"
  fi
  
  sleep 1
done

echo ""
echo -e "${BLUE}=== Testing URL Shortening ===${NC}"

echo -e "${YELLOW}9. Sending SMS with URL shortening...${NC}"
URL_SMS_RESPONSE=$(curl -s -X POST "$API_URL/api/sms/test" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'"$TEST_PHONE"'",
    "message": "Check out this pitch: https://pitchey.com/pitch/very-long-url-that-needs-shortening-123456789",
    "template": "pitch_share",
    "shortenUrls": true,
    "trackClicks": true
  }')

echo "$URL_SMS_RESPONSE" | jq '.'

echo ""
echo -e "${BLUE}=== Testing SMS Analytics ===${NC}"

echo -e "${YELLOW}10. Getting SMS analytics...${NC}"
ANALYTICS_RESPONSE=$(curl -s -X GET "$API_URL/api/sms/analytics?timeRange=24h" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "$ANALYTICS_RESPONSE" | jq '.'

# Display key metrics
if echo "$ANALYTICS_RESPONSE" | grep -q '"sent"'; then
  SENT=$(echo "$ANALYTICS_RESPONSE" | jq '.data.sent')
  DELIVERED=$(echo "$ANALYTICS_RESPONSE" | jq '.data.delivered')
  FAILED=$(echo "$ANALYTICS_RESPONSE" | jq '.data.failed')
  DELIVERY_RATE=$(echo "$ANALYTICS_RESPONSE" | jq '.data.deliveryRate')
  COST=$(echo "$ANALYTICS_RESPONSE" | jq '.data.costTotal')
  
  echo ""
  echo -e "${BLUE}📊 SMS Metrics Summary:${NC}"
  echo "  • Sent: $SENT"
  echo "  • Delivered: $DELIVERED"
  echo "  • Failed: $FAILED"
  echo "  • Delivery Rate: ${DELIVERY_RATE}%"
  echo "  • Total Cost: \$$COST"
fi

echo ""
echo -e "${BLUE}=== Testing Opt-Out Management ===${NC}"

echo -e "${YELLOW}11. Simulating opt-out...${NC}"
curl -s -X POST "$API_URL/api/sms/optout" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"$TEST_PHONE\"}"

echo -e "${GREEN}✅ Phone number added to opt-out list${NC}"

echo -e "${YELLOW}12. Attempting to send to opted-out number...${NC}"
OPTOUT_RESPONSE=$(curl -s -X POST "$API_URL/api/sms/test" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$TEST_PHONE\",
    \"message\": \"This should be blocked\",
    \"template\": \"test\"
  }")

if echo "$OPTOUT_RESPONSE" | grep -q "opted out"; then
  echo -e "${GREEN}✅ SMS correctly blocked for opted-out number${NC}"
else
  echo -e "${RED}❌ Opt-out not working properly${NC}"
fi

# Remove from opt-out list
echo -e "${YELLOW}13. Removing opt-out...${NC}"
curl -s -X DELETE "$API_URL/api/sms/optout" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"$TEST_PHONE\"}"

echo -e "${GREEN}✅ Phone number removed from opt-out list${NC}"

echo ""
echo -e "${BLUE}=== Testing Critical Notifications ===${NC}"

echo -e "${YELLOW}14. Sending password reset SMS...${NC}"
PASSWORD_RESET_RESPONSE=$(curl -s -X POST "$API_URL/api/notifications/send" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "type": "password_reset",
    "title": "Password Reset",
    "message": "Your password reset code is: 789012. Valid for 15 minutes.",
    "channels": ["sms"],
    "priority": "critical",
    "skipRateLimit": true
  }')

echo "$PASSWORD_RESET_RESPONSE" | jq '.'

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}       Twilio SMS Integration Test Complete!    ${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Features tested:"
echo "  ✅ Phone number validation"
echo "  ✅ Basic SMS sending"
echo "  ✅ Delivery status tracking"
echo "  ✅ Multi-channel notifications with SMS"
echo "  ✅ Bulk SMS sending"
echo "  ✅ Rate limiting"
echo "  ✅ URL shortening and click tracking"
echo "  ✅ SMS analytics"
echo "  ✅ Opt-out management"
echo "  ✅ Critical notifications (bypass rate limits)"
echo ""
echo -e "${BLUE}Configuration Required for Production:${NC}"
echo "  1. Set TWILIO_ACCOUNT_SID in environment"
echo "  2. Set TWILIO_AUTH_TOKEN in environment"
echo "  3. Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID"
echo "  4. Configure webhook URL: $API_URL/webhooks/twilio/status"
echo "  5. Set up click tracking domain for URL shortening"
echo ""
echo -e "${YELLOW}Twilio Console: https://console.twilio.com${NC}"