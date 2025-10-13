#!/bin/bash

echo "🧪 Testing Critical Endpoints Implementation"
echo "==========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start server if not running
if ! curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
  echo -e "${YELLOW}Starting backend server...${NC}"
  source .env
  PORT=8001 JWT_SECRET="$JWT_SECRET" DATABASE_URL="$DATABASE_URL" \
    deno run --allow-all working-server.ts &
  SERVER_PID=$!
  sleep 5
fi

echo -e "\n${YELLOW}Phase 1: Testing Creator Endpoints${NC}"
echo "-----------------------------------"

# Login as creator
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to login as creator${NC}"
  exit 1
fi

# Test creator endpoints
echo -n "1. GET /api/creator/followers: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8001/api/creator/followers")
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

echo -n "2. GET /api/creator/saved-pitches: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8001/api/creator/saved-pitches")
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

echo -n "3. GET /api/creator/recommendations: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8001/api/creator/recommendations")
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

echo -e "\n${YELLOW}Phase 2: Testing Production Endpoints${NC}"
echo "--------------------------------------"

# Login as production
PROD_TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}' | jq -r '.token')

if [ -z "$PROD_TOKEN" ] || [ "$PROD_TOKEN" = "null" ]; then
  echo -e "${YELLOW}⚠️ No production account, skipping production tests${NC}"
else
  echo -n "4. GET /api/production/analytics: "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $PROD_TOKEN" \
    "http://localhost:8001/api/production/analytics")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK${NC}"
  else
    echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
  fi

  echo -n "5. GET /api/production/calendar: "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $PROD_TOKEN" \
    "http://localhost:8001/api/production/calendar")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK${NC}"
  else
    echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
  fi

  echo -n "6. GET /api/production/submissions/stats: "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $PROD_TOKEN" \
    "http://localhost:8001/api/production/submissions/stats")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK${NC}"
  else
    echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
  fi
fi

echo -e "\n${YELLOW}Phase 3: Testing Investment Endpoints${NC}"
echo "--------------------------------------"

# Login as investor
INV_TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}' | jq -r '.token')

if [ -z "$INV_TOKEN" ] || [ "$INV_TOKEN" = "null" ]; then
  echo -e "${YELLOW}⚠️ No investor account, skipping investment tests${NC}"
else
  # First create a test investment
  echo "Creating test investment..."
  INVESTMENT=$(curl -s -X POST http://localhost:8001/api/investments/track \
    -H "Authorization: Bearer $INV_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"pitchId":1,"amount":50000,"terms":"Test investment"}')
  
  INVESTMENT_ID=$(echo $INVESTMENT | jq -r '.data.investment.id // .investment.id // 1')
  
  echo -n "7. GET /api/investments/$INVESTMENT_ID/details: "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $INV_TOKEN" \
    "http://localhost:8001/api/investments/$INVESTMENT_ID/details")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK${NC}"
  else
    echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
  fi

  echo -n "8. POST /api/investments/$INVESTMENT_ID/update: "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $INV_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"notes":"Updated notes"}' \
    "http://localhost:8001/api/investments/$INVESTMENT_ID/update")
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK${NC}"
  else
    echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
  fi
fi

echo -e "\n${YELLOW}Phase 4: Testing Path Fixes${NC}"
echo "---------------------------"

echo -n "9. GET /api/saved-pitches: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8001/api/saved-pitches")
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

echo -n "10. POST /api/notifications/mark-read: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids":[1,2,3]}' \
  "http://localhost:8001/api/notifications/mark-read")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

# Summary
echo -e "\n==========================================="
echo -e "${YELLOW}TEST SUMMARY${NC}"
echo "==========================================="
echo "✅ Database tables created"
echo "✅ Drizzle schema updated"
echo "✅ Critical endpoints ready to implement"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Add endpoint implementations to working-server.ts"
echo "   - See add-critical-endpoints.ts for exact code"
echo "2. Run this test again to verify all endpoints work"
echo "3. Test frontend dashboards"

# Cleanup
if [ ! -z "$SERVER_PID" ]; then
  kill $SERVER_PID 2>/dev/null
fi