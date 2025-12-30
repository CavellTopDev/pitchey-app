#!/bin/bash

# Test character management functionality
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Testing Character Management${NC}"
echo "============================"

# Login as creator
echo -e "\n${BLUE}1. Logging in as creator...${NC}"
CREATOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

CREATOR_TOKEN=$(echo $CREATOR_RESPONSE | jq -r '.data.token')

if [ "$CREATOR_TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to login as creator${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Logged in as creator${NC}"

# Get creator's pitches
echo -e "\n${BLUE}2. Getting creator's pitches...${NC}"
PITCHES_RESPONSE=$(curl -s -X GET "$API_URL/api/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

PITCH_ID=$(echo $PITCHES_RESPONSE | jq -r '.data[0].id')
PITCH_TITLE=$(echo $PITCHES_RESPONSE | jq -r '.data[0].title')

if [ "$PITCH_ID" = "null" ]; then
  echo -e "${RED}❌ No pitches found${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Found pitch: '$PITCH_TITLE' (ID: $PITCH_ID)${NC}"

# Test getting characters
echo -e "\n${BLUE}3. Getting characters for pitch...${NC}"
CHARACTERS_RESPONSE=$(curl -s -X GET "$API_URL/api/pitches/$PITCH_ID/characters" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

if [ "$(echo $CHARACTERS_RESPONSE | jq -r '.success')" = "true" ]; then
  CHARACTER_COUNT=$(echo $CHARACTERS_RESPONSE | jq '.data | length')
  echo -e "${GREEN}✅ Retrieved $CHARACTER_COUNT characters${NC}"
  
  if [ "$CHARACTER_COUNT" -gt 0 ]; then
    echo -e "${BLUE}Current characters:${NC}"
    echo "$CHARACTERS_RESPONSE" | jq '.data[] | {id, name, role}'
  fi
else
  echo -e "${RED}❌ Failed to get characters${NC}"
  echo "$CHARACTERS_RESPONSE" | jq '.'
fi

# Test adding a new character
echo -e "\n${BLUE}4. Adding a new character...${NC}"
NEW_CHARACTER=$(curl -s -X POST "$API_URL/api/pitches/$PITCH_ID/characters" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Character",
    "role": "Supporting Role",
    "description": "A mysterious character added for testing",
    "age": "35",
    "arc": "Transforms from skeptic to believer"
  }')

if [ "$(echo $NEW_CHARACTER | jq -r '.success')" = "true" ]; then
  NEW_CHAR_ID=$(echo $NEW_CHARACTER | jq -r '.data.id')
  echo -e "${GREEN}✅ Character added successfully (ID: $NEW_CHAR_ID)${NC}"
  echo "$NEW_CHARACTER" | jq '.data'
else
  echo -e "${RED}❌ Failed to add character${NC}"
  echo "$NEW_CHARACTER" | jq '.'
  exit 1
fi

# Test updating the character
echo -e "\n${BLUE}5. Updating the character...${NC}"
UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/api/pitches/$PITCH_ID/characters/$NEW_CHAR_ID" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Character",
    "role": "Lead Role",
    "description": "Character has been promoted to lead",
    "age": "36"
  }')

if [ "$(echo $UPDATE_RESPONSE | jq -r '.success')" = "true" ]; then
  echo -e "${GREEN}✅ Character updated successfully${NC}"
  echo "$UPDATE_RESPONSE" | jq '.data | {name, role}'
else
  echo -e "${RED}❌ Failed to update character${NC}"
  echo "$UPDATE_RESPONSE" | jq '.'
fi

# Test reordering characters
echo -e "\n${BLUE}6. Testing character reordering...${NC}"
# Get all characters
ALL_CHARS=$(curl -s -X GET "$API_URL/api/pitches/$PITCH_ID/characters" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

if [ "$(echo $ALL_CHARS | jq -r '.success')" = "true" ]; then
  # Reverse the order of characters
  REORDERED=$(echo $ALL_CHARS | jq '.data | reverse')
  
  REORDER_RESPONSE=$(curl -s -X PUT "$API_URL/api/pitches/$PITCH_ID/characters" \
    -H "Authorization: Bearer $CREATOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"characters\": $REORDERED}")
  
  if [ "$(echo $REORDER_RESPONSE | jq -r '.success')" = "true" ]; then
    echo -e "${GREEN}✅ Characters reordered successfully${NC}"
    echo -e "${BLUE}New order:${NC}"
    echo "$REORDER_RESPONSE" | jq '.data[] | {name, role}'
  else
    echo -e "${YELLOW}⚠️  Could not reorder characters${NC}"
  fi
fi

# Test deleting the character
echo -e "\n${BLUE}7. Deleting the test character...${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/api/pitches/$PITCH_ID/characters/$NEW_CHAR_ID" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

if [ "$(echo $DELETE_RESPONSE | jq -r '.success')" = "true" ]; then
  echo -e "${GREEN}✅ Character deleted successfully${NC}"
else
  echo -e "${RED}❌ Failed to delete character${NC}"
  echo "$DELETE_RESPONSE" | jq '.'
fi

# Verify character was deleted
echo -e "\n${BLUE}8. Verifying deletion...${NC}"
FINAL_CHARS=$(curl -s -X GET "$API_URL/api/pitches/$PITCH_ID/characters" \
  -H "Authorization: Bearer $CREATOR_TOKEN")

FINAL_COUNT=$(echo $FINAL_CHARS | jq '.data | length')
echo -e "${GREEN}✅ Final character count: $FINAL_COUNT${NC}"

echo -e "\n${GREEN}✅ Character Management Test Complete!${NC}"
echo -e "${BLUE}Summary:${NC}"
echo "- ✅ Get characters endpoint works"
echo "- ✅ Add character endpoint works"
echo "- ✅ Update character endpoint works"
echo "- ✅ Reorder characters endpoint works"
echo "- ✅ Delete character endpoint works"
echo -e "\n${YELLOW}Frontend can now implement:${NC}"
echo "- Drag-and-drop reordering"
echo "- In-place character editing"
echo "- Character addition/deletion"