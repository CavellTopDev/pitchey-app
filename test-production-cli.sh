#!/bin/bash

# Comprehensive CLI Testing for Pitchey Production Stack
echo "🚀 Pitchey Production Stack Testing"
echo "═══════════════════════════════════════════"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Production URLs
WORKER_API="https://pitchey-api-prod.ndlovucavelle.workers.dev"
BACKEND_API="https://pitchey-backend-fresh-dpgqq3t2wr6w.deno.dev"
FRONTEND_URL="https://e7279e57.pitchey-5o8.pages.dev"
WS_URL="wss://pitchey-backend-fresh-dpgqq3t2wr6w.deno.dev/ws"

echo -e "\n${BLUE}1. 🌐 Testing Frontend Availability${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$FRONTEND_STATUS" = "200" ]; then
  echo -e "   ${GREEN}✅ Frontend: Active ($FRONTEND_STATUS)${NC}"
else
  echo -e "   ${RED}❌ Frontend: Error ($FRONTEND_STATUS)${NC}"
fi

echo -e "\n${BLUE}2. ⚡ Testing Worker API Health${NC}"
WORKER_RESPONSE=$(curl -s -H "Origin: https://pitchey-5o8.pages.dev" "$WORKER_API/api/health")
WORKER_STATUS=$(echo $WORKER_RESPONSE | jq -r '.status' 2>/dev/null)
USER_COUNT=$(echo $WORKER_RESPONSE | jq -r '.userCount' 2>/dev/null)

if [ "$WORKER_STATUS" = "ok" ]; then
  echo -e "   ${GREEN}✅ Worker API: $WORKER_STATUS${NC}"
  echo -e "   ${GREEN}📊 Database: $USER_COUNT users${NC}"
else
  echo -e "   ${RED}❌ Worker API: Failed${NC}"
  echo "   Response: $WORKER_RESPONSE"
fi

echo -e "\n${BLUE}3. 🔌 Testing WebSocket Server${NC}"
WS_HEALTH=$(curl -s "$BACKEND_API/api/health" 2>/dev/null)
WS_STATUS=$(echo $WS_HEALTH | jq -r '.status' 2>/dev/null)
WS_AVAILABLE=$(echo $WS_HEALTH | jq -r '.websocket.available' 2>/dev/null)
REDIS_ENABLED=$(echo $WS_HEALTH | jq -r '.redis.enabled' 2>/dev/null)

if [ "$WS_STATUS" = "ok" ]; then
  echo -e "   ${GREEN}✅ WebSocket Server: $WS_STATUS${NC}"
  echo -e "   ${GREEN}🔗 WebSocket Available: $WS_AVAILABLE${NC}"
  echo -e "   ${GREEN}💾 Redis Enabled: $REDIS_ENABLED${NC}"
else
  echo -e "   ${RED}❌ WebSocket Server: Failed${NC}"
  echo "   Response: $WS_HEALTH"
fi

echo -e "\n${BLUE}4. 🔐 Testing Authentication Flow${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$WORKER_API/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://pitchey-5o8.pages.dev" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token' 2>/dev/null)
USER_NAME=$(echo $LOGIN_RESPONSE | jq -r '.user.firstName' 2>/dev/null)

if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
  echo -e "   ${GREEN}✅ Login Success: $USER_NAME${NC}"
  echo -e "   ${GREEN}🎫 Token: ${TOKEN:0:20}...${NC}"
  
  # Test authenticated endpoint
  DASHBOARD_RESPONSE=$(curl -s -X GET "$WORKER_API/api/creator/dashboard" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Origin: https://pitchey-5o8.pages.dev")
  
  DASH_STATUS=$(echo $DASHBOARD_RESPONSE | jq -r '.totalPitches' 2>/dev/null)
  if [ "$DASH_STATUS" != "null" ] && [ "$DASH_STATUS" != "" ]; then
    echo -e "   ${GREEN}✅ Dashboard Access: Working${NC}"
  else
    echo -e "   ${YELLOW}⚠️ Dashboard: Limited response${NC}"
  fi
else
  echo -e "   ${RED}❌ Authentication: Failed${NC}"
  echo "   Response: $LOGIN_RESPONSE"
fi

echo -e "\n${BLUE}5. 📊 Testing Core API Endpoints${NC}"

# Test endpoints array
declare -a endpoints=(
  "GET:/api/pitches"
  "GET:/api/creator/pitches" 
  "GET:/api/notifications"
  "GET:/api/search/pitches"
)

for endpoint_info in "${endpoints[@]}"; do
  method=$(echo $endpoint_info | cut -d: -f1)
  endpoint=$(echo $endpoint_info | cut -d: -f2)
  
  if [ "$method" = "GET" ]; then
    if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
      RESPONSE=$(curl -s -X $method "$WORKER_API$endpoint" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Origin: https://pitchey-5o8.pages.dev")
      
      # Check if response is valid JSON
      if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ $method $endpoint${NC}"
      else
        echo -e "   ${YELLOW}⚠️ $method $endpoint (Non-JSON response)${NC}"
      fi
    else
      echo -e "   ${YELLOW}⚠️ $method $endpoint (No auth token)${NC}"
    fi
  fi
done

echo -e "\n${BLUE}6. 🌍 Testing CORS Configuration${NC}"
CORS_TEST=$(curl -s -X OPTIONS "$WORKER_API/api/health" \
  -H "Origin: https://pitchey-5o8.pages.dev" \
  -H "Access-Control-Request-Method: GET" \
  -o /dev/null -w "%{http_code}")

if [ "$CORS_TEST" = "200" ]; then
  echo -e "   ${GREEN}✅ CORS: Properly configured${NC}"
else
  echo -e "   ${RED}❌ CORS: Issues detected ($CORS_TEST)${NC}"
fi

echo -e "\n${BLUE}7. ⚡ Performance Testing${NC}"
START_TIME=$(date +%s%N)
PERF_RESPONSE=$(curl -s "$WORKER_API/api/health" -H "Origin: https://pitchey-5o8.pages.dev")
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( ($END_TIME - $START_TIME) / 1000000 ))

echo -e "   ${GREEN}⚡ API Response Time: ${RESPONSE_TIME}ms${NC}"

if [ $RESPONSE_TIME -lt 100 ]; then
  echo -e "   ${GREEN}✅ Performance: Excellent (<100ms)${NC}"
elif [ $RESPONSE_TIME -lt 500 ]; then
  echo -e "   ${YELLOW}⚠️ Performance: Good (<500ms)${NC}"
else
  echo -e "   ${RED}❌ Performance: Slow (>500ms)${NC}"
fi

echo -e "\n${GREEN}📋 TESTING COMPLETE${NC}"
echo "═══════════════════════════════════════════"
echo -e "${YELLOW}🚀 Production URLs:${NC}"
echo -e "   Frontend: $FRONTEND_URL"
echo -e "   Worker API: $WORKER_API"
echo -e "   WebSocket: $WS_URL"
echo -e "   Demo Login: alex.creator@demo.com / Demo123"

echo -e "\n${YELLOW}💡 WebSocket Testing:${NC}"
echo "   npm install -g wscat"
echo "   wscat -c '$WS_URL'"

echo -e "\n${YELLOW}🔧 Manual Testing:${NC}"
echo "   curl '$WORKER_API/api/health' -H 'Origin: https://pitchey-5o8.pages.dev'"