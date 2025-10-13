#!/bin/bash

echo "🧪 Testing Pitch Edit/Update Functionality"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start server if not running
if ! curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
  echo "Starting backend server..."
  source .env
  PORT=8001 JWT_SECRET="$JWT_SECRET" DATABASE_URL="$DATABASE_URL" \
    deno run --allow-all working-server.ts &
  SERVER_PID=$!
  sleep 3
fi

# 1. Login as creator
echo -e "\n${YELLOW}Step 1: Login as creator${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Logged in successfully${NC}"

# 2. Get existing pitches
echo -e "\n${YELLOW}Step 2: Get existing pitches${NC}"
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

FIRST_PITCH_ID=$(echo $PITCHES | jq -r '.data.pitches[0].id // .pitches[0].id')

if [ -z "$FIRST_PITCH_ID" ] || [ "$FIRST_PITCH_ID" = "null" ]; then
  echo -e "${YELLOW}No existing pitches, creating one...${NC}"
  
  # Create a pitch
  CREATE_RESPONSE=$(curl -s -X POST http://localhost:8001/api/pitches \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Test Pitch for Update",
      "logline": "Original logline",
      "genre": "drama",
      "format": "feature",
      "shortSynopsis": "Original synopsis"
    }')
  
  FIRST_PITCH_ID=$(echo $CREATE_RESPONSE | jq -r '.data.pitch.id // .pitch.id')
fi

echo -e "${GREEN}✅ Using pitch ID: $FIRST_PITCH_ID${NC}"

# 3. Get original pitch data
echo -e "\n${YELLOW}Step 3: Get original pitch data${NC}"
ORIGINAL=$(curl -s -X GET "http://localhost:8001/api/pitches/$FIRST_PITCH_ID" \
  -H "Authorization: Bearer $TOKEN")

ORIGINAL_TITLE=$(echo $ORIGINAL | jq -r '.data.pitch.title // .pitch.title')
ORIGINAL_LOGLINE=$(echo $ORIGINAL | jq -r '.data.pitch.logline // .pitch.logline')

echo "Original Title: $ORIGINAL_TITLE"
echo "Original Logline: $ORIGINAL_LOGLINE"

# 4. Update the pitch
echo -e "\n${YELLOW}Step 4: Updating pitch...${NC}"
UPDATE_TIME=$(date +"%H:%M:%S")
UPDATE_RESPONSE=$(curl -s -X PUT "http://localhost:8001/api/creator/pitches/$FIRST_PITCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Updated Title at $UPDATE_TIME\",
    \"logline\": \"Updated logline at $UPDATE_TIME\",
    \"shortSynopsis\": \"This synopsis was updated via the API test at $UPDATE_TIME\"
  }")

UPDATE_SUCCESS=$(echo $UPDATE_RESPONSE | jq -r '.success')

if [ "$UPDATE_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✅ Update request successful${NC}"
else
  echo -e "${RED}❌ Update failed: $UPDATE_RESPONSE${NC}"
fi

# 5. Verify the update persisted
echo -e "\n${YELLOW}Step 5: Verifying update persisted in database...${NC}"
sleep 1

UPDATED=$(curl -s -X GET "http://localhost:8001/api/pitches/$FIRST_PITCH_ID" \
  -H "Authorization: Bearer $TOKEN")

NEW_TITLE=$(echo $UPDATED | jq -r '.data.pitch.title // .pitch.title')
NEW_LOGLINE=$(echo $UPDATED | jq -r '.data.pitch.logline // .pitch.logline')
NEW_SYNOPSIS=$(echo $UPDATED | jq -r '.data.pitch.shortSynopsis // .pitch.shortSynopsis')

echo "New Title: $NEW_TITLE"
echo "New Logline: $NEW_LOGLINE"

# Check if values actually changed
if [[ "$NEW_TITLE" == *"$UPDATE_TIME"* ]]; then
  echo -e "${GREEN}✅ Title was successfully updated in database${NC}"
else
  echo -e "${RED}❌ Title was NOT updated (still: $NEW_TITLE)${NC}"
fi

if [[ "$NEW_LOGLINE" == *"$UPDATE_TIME"* ]]; then
  echo -e "${GREEN}✅ Logline was successfully updated in database${NC}"
else
  echo -e "${RED}❌ Logline was NOT updated (still: $NEW_LOGLINE)${NC}"
fi

if [[ "$NEW_SYNOPSIS" == *"$UPDATE_TIME"* ]]; then
  echo -e "${GREEN}✅ Synopsis was successfully updated in database${NC}"
else
  echo -e "${RED}❌ Synopsis was NOT updated${NC}"
fi

# Summary
echo -e "\n=========================================="
echo -e "${YELLOW}SUMMARY:${NC}"
echo "=========================================="

if [[ "$NEW_TITLE" == *"$UPDATE_TIME"* ]] && [[ "$NEW_LOGLINE" == *"$UPDATE_TIME"* ]]; then
  echo -e "${GREEN}✅ YES! Pitch editing DOES update the backend database!${NC}"
  echo -e "${GREEN}✅ The PUT /api/creator/pitches/{id} endpoint is working correctly${NC}"
  echo -e "${GREEN}✅ Updates are persisted to PostgreSQL database${NC}"
else
  echo -e "${RED}❌ Pitch editing is NOT updating the backend properly${NC}"
  echo "Check the server logs for errors"
fi

# Cleanup
if [ ! -z "$SERVER_PID" ]; then
  kill $SERVER_PID 2>/dev/null
fi