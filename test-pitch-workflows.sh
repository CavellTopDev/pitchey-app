#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "======================================"
echo "Testing Pitch Management Workflows"
echo "======================================"

# Test 1: Get current pitches
echo -e "\n1. Getting current pitches..."
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

echo "Response structure:"
echo "$PITCHES" | python3 -m json.tool 2>/dev/null | head -50 || echo "$PITCHES" | head -100

# Extract pitch count
PITCH_COUNT=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | wc -l)
echo "Found $PITCH_COUNT pitches"

# Extract first pitch ID if exists
PITCH_ID=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ ! -z "$PITCH_ID" ]; then
  echo -e "\n2. Testing operations on pitch ID: $PITCH_ID"
  
  # Test 2: Get single pitch
  echo -e "\n2a. Getting single pitch..."
  SINGLE=$(curl -s -X GET "http://localhost:8001/api/creator/pitches/$PITCH_ID" \
    -H "Authorization: Bearer $TOKEN")
  echo "Single pitch response: $(echo "$SINGLE" | head -100)"
  
  # Test 3: Update pitch
  echo -e "\n2b. Updating pitch title..."
  UPDATE=$(curl -s -X PUT "http://localhost:8001/api/creator/pitches/$PITCH_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Updated Title Test"}')
  echo "Update response: $UPDATE"
  
  # Test 4: Publish pitch
  echo -e "\n2c. Publishing pitch..."
  PUBLISH=$(curl -s -X POST "http://localhost:8001/api/creator/pitches/$PITCH_ID/publish" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  echo "Publish response: $PUBLISH"
  
  # Test 5: Archive pitch
  echo -e "\n2d. Archiving pitch..."
  ARCHIVE=$(curl -s -X POST "http://localhost:8001/api/creator/pitches/$PITCH_ID/archive" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  echo "Archive response: $ARCHIVE"
  
  # Test 6: Delete pitch (commented out to preserve test data)
  echo -e "\n2e. Testing delete endpoint (dry run)..."
  # DELETE=$(curl -s -X DELETE "http://localhost:8001/api/creator/pitches/$PITCH_ID" \
  #   -H "Authorization: Bearer $TOKEN")
  # echo "Delete response: $DELETE"
  echo "Delete endpoint exists but skipping to preserve test data"
else
  echo "No pitches found. Creating a test pitch..."
  
  # Create a test pitch
  CREATE=$(curl -s -X POST http://localhost:8001/api/creator/pitches \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Test Pitch for Workflow",
      "logline": "A test pitch to verify all workflows",
      "genre": "drama",
      "format": "feature",
      "shortSynopsis": "Test synopsis"
    }')
  
  echo "Create response: $CREATE"
  
  NEW_ID=$(echo "$CREATE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ ! -z "$NEW_ID" ]; then
    echo "Created pitch with ID: $NEW_ID"
    echo "Run this script again to test all operations"
  fi
fi

echo -e "\n======================================"
echo "Workflow Test Complete"
echo "======================================"
