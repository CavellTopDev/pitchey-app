#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "Testing Real Pitch Data Retrieval"
echo "=================================="
echo ""

# First, let's get the list of pitches to see what IDs we have
echo "1. Getting list of all pitches:"
PITCHES=$(curl -s -X GET http://localhost:8001/api/creator/pitches \
  -H "Authorization: Bearer $TOKEN")

# Extract first 3 pitch IDs
IDS=$(echo "$PITCHES" | grep -o '"id":[0-9]*' | head -3 | cut -d: -f2)

echo "Found pitch IDs: $(echo $IDS | tr '\n' ' ')"
echo ""

echo "2. Fetching individual pitches to verify unique data:"
echo ""

for ID in $IDS; do
  echo "Fetching pitch $ID:"
  PITCH=$(curl -s -X GET "http://localhost:8001/api/creator/pitches/$ID" \
    -H "Authorization: Bearer $TOKEN")
  
  # Extract title and logline
  TITLE=$(echo "$PITCH" | grep -o '"title":"[^"]*' | head -1 | cut -d'"' -f4)
  LOGLINE=$(echo "$PITCH" | grep -o '"logline":"[^"]*' | head -1 | cut -d'"' -f4)
  GENRE=$(echo "$PITCH" | grep -o '"genre":"[^"]*' | head -1 | cut -d'"' -f4)
  
  echo "  • Title: $TITLE"
  echo "  • Logline: $LOGLINE" 
  echo "  • Genre: $GENRE"
  echo ""
done

echo "=================================="
echo "RESULT: Each pitch should show different data!"
