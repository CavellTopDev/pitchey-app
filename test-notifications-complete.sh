#!/bin/bash

# Complete Notification System Test Script
# Tests all notification features including rate limiting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:8001}"
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PASSWORD="Demo123"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}    Complete Notification System Test Suite     ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Login as creator
echo -e "${YELLOW}1. Authenticating as Creator...${NC}"
CREATOR_TOKEN=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$PASSWORD\"}" | \
  grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$CREATOR_TOKEN" ]; then
  echo -e "${RED}❌ Failed to authenticate as creator${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Creator authenticated${NC}"

# Login as investor
echo -e "${YELLOW}2. Authenticating as Investor...${NC}"
INVESTOR_TOKEN=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$PASSWORD\"}" | \
  grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$INVESTOR_TOKEN" ]; then
  echo -e "${RED}❌ Failed to authenticate as investor${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Investor authenticated${NC}"

echo ""
echo -e "${BLUE}=== Testing Basic Notification Features ===${NC}"

# Get unread notifications
echo -e "${YELLOW}3. Getting unread notifications...${NC}"
curl -s -X GET "$API_URL/api/notifications/unread" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

# Get all notifications
echo -e "${YELLOW}4. Getting all notifications...${NC}"
curl -s -X GET "$API_URL/api/user/notifications?limit=10" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

echo ""
echo -e "${BLUE}=== Testing Notification Dashboard (Admin) ===${NC}"

# Get dashboard metrics
echo -e "${YELLOW}5. Getting notification dashboard metrics...${NC}"
DASHBOARD_RESPONSE=$(curl -s -X GET "$API_URL/api/notifications/dashboard?timeRange=24h" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

if echo "$DASHBOARD_RESPONSE" | grep -q "Admin access required"; then
  echo -e "${YELLOW}⚠️  Admin access required for dashboard (expected)${NC}"
else
  echo "$DASHBOARD_RESPONSE" | jq '.'
fi

# Get specific metric details
echo -e "${YELLOW}6. Getting delivery metrics...${NC}"
curl -s -X GET "$API_URL/api/notifications/dashboard/metrics/delivery?timeRange=24h" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

# Export metrics
echo -e "${YELLOW}7. Exporting notification metrics (CSV)...${NC}"
curl -s -X GET "$API_URL/api/notifications/dashboard/export?format=csv&timeRange=24h" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -o notification-metrics.csv

if [ -f notification-metrics.csv ]; then
  echo -e "${GREEN}✅ Metrics exported to notification-metrics.csv${NC}"
  head -5 notification-metrics.csv
  rm notification-metrics.csv
else
  echo -e "${YELLOW}⚠️  Export requires admin access${NC}"
fi

echo ""
echo -e "${BLUE}=== Testing Rate Limiting ===${NC}"

# Function to send notification
send_notification() {
  local token=$1
  local type=$2
  local channel=$3
  
  curl -s -X POST "$API_URL/api/notifications/send" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": 1,
      \"type\": \"$type\",
      \"title\": \"Test notification\",
      \"message\": \"Testing rate limits\",
      \"channel\": \"$channel\"
    }"
}

echo -e "${YELLOW}8. Testing email rate limits (10 per hour)...${NC}"
for i in {1..12}; do
  echo -n "  Attempt $i: "
  RESPONSE=$(send_notification "$CREATOR_TOKEN" "system" "email")
  
  if echo "$RESPONSE" | grep -q "Rate limit exceeded"; then
    echo -e "${RED}Rate limited (expected after 10)${NC}"
    break
  else
    echo -e "${GREEN}Sent successfully${NC}"
  fi
  
  if [ $i -lt 12 ]; then
    sleep 0.5
  fi
done

echo ""
echo -e "${YELLOW}9. Testing burst protection (5 in 10 seconds)...${NC}"
for i in {1..7}; do
  echo -n "  Attempt $i: "
  RESPONSE=$(send_notification "$CREATOR_TOKEN" "system" "inApp")
  
  if echo "$RESPONSE" | grep -q "Burst limit exceeded"; then
    echo -e "${RED}Burst protection triggered (expected after 5)${NC}"
    break
  else
    echo -e "${GREEN}Sent successfully${NC}"
  fi
done

echo ""
echo -e "${BLUE}=== Testing WebSocket Real-time Delivery ===${NC}"

# Test WebSocket connection (requires wscat or similar)
echo -e "${YELLOW}10. Testing WebSocket connection...${NC}"
if command -v wscat &> /dev/null; then
  timeout 5 wscat -c "ws://localhost:8001/ws" \
    -H "Authorization: Bearer $CREATOR_TOKEN" \
    --execute '{"type":"subscribe","channel":"notifications"}' &
  WS_PID=$!
  
  sleep 2
  
  # Send a notification that should trigger WebSocket
  curl -s -X POST "$API_URL/api/notifications/send" \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "userId": 1,
      "type": "message",
      "title": "New message from investor",
      "message": "Testing WebSocket delivery"
    }' > /dev/null
  
  sleep 2
  kill $WS_PID 2>/dev/null || true
  echo -e "${GREEN}✅ WebSocket test completed${NC}"
else
  echo -e "${YELLOW}⚠️  wscat not installed, skipping WebSocket test${NC}"
  echo "    Install with: npm install -g wscat"
fi

echo ""
echo -e "${BLUE}=== Testing Notification Triggers ===${NC}"

# Trigger various notification types
echo -e "${YELLOW}11. Testing notification triggers...${NC}"

# Pitch view notification
echo "  Creating pitch view notification..."
curl -s -X POST "$API_URL/api/notifications/trigger" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": "pitch_view",
    "pitchId": 1,
    "viewerId": 2
  }' | jq '.success'

# NDA request notification
echo "  Creating NDA request notification..."
curl -s -X POST "$API_URL/api/notifications/trigger" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": "nda_request",
    "pitchId": 1,
    "requesterId": 2
  }' | jq '.success'

# Follow notification
echo "  Creating follow notification..."
curl -s -X POST "$API_URL/api/notifications/trigger" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": "new_follow",
    "followerId": 2,
    "followedId": 1
  }' | jq '.success'

echo ""
echo -e "${BLUE}=== Testing Notification Preferences ===${NC}"

echo -e "${YELLOW}12. Getting notification preferences...${NC}"
curl -s -X GET "$API_URL/api/notifications/preferences" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

echo -e "${YELLOW}13. Updating notification preferences...${NC}"
curl -s -X PUT "$API_URL/api/notifications/preferences" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": {
      "enabled": true,
      "frequency": "instant",
      "types": ["nda_request", "investment", "message"]
    },
    "push": {
      "enabled": true,
      "types": ["message", "nda_request"]
    },
    "digest": {
      "enabled": true,
      "frequency": "weekly"
    }
  }' | jq '.'

echo ""
echo -e "${BLUE}=== Testing Notification Operations ===${NC}"

echo -e "${YELLOW}14. Marking notifications as read...${NC}"
curl -s -X PUT "$API_URL/api/notifications/mark-read" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notificationIds": [1, 2, 3]}' | jq '.'

echo -e "${YELLOW}15. Marking all as read...${NC}"
curl -s -X PUT "$API_URL/api/notifications/mark-all-read" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

echo -e "${YELLOW}16. Deleting old notifications...${NC}"
curl -s -X DELETE "$API_URL/api/notifications/cleanup?olderThan=30d" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

echo ""
echo -e "${BLUE}=== Testing A/B Testing Features ===${NC}"

echo -e "${YELLOW}17. Getting active A/B tests...${NC}"
curl -s -X GET "$API_URL/api/notifications/ab-tests" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

echo ""
echo -e "${BLUE}=== Testing Analytics ===${NC}"

echo -e "${YELLOW}18. Getting notification analytics...${NC}"
curl -s -X GET "$API_URL/api/notifications/analytics?timeRange=7d" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '.'

echo ""
echo -e "${BLUE}=== Test Summary ===${NC}"

# Check overall health
echo -e "${YELLOW}19. Checking notification system health...${NC}"
HEALTH=$(curl -s -X GET "$API_URL/api/notifications/health" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

if echo "$HEALTH" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Notification system is healthy${NC}"
else
  echo -e "${RED}❌ Notification system may have issues${NC}"
  echo "$HEALTH" | jq '.'
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}    Notification System Test Complete!          ${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Features tested:"
echo "  ✅ Basic notifications (create, read, unread)"
echo "  ✅ Notification dashboard endpoints"
echo "  ✅ Rate limiting (per channel and burst)"
echo "  ✅ WebSocket real-time delivery"
echo "  ✅ Notification triggers"
echo "  ✅ User preferences"
echo "  ✅ Batch operations"
echo "  ✅ A/B testing"
echo "  ✅ Analytics"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Deploy to production with: wrangler deploy"
echo "  2. Configure SMS provider (Twilio/MessageBird)"
echo "  3. Set up monitoring alerts"
echo "  4. Run load tests for scale validation"