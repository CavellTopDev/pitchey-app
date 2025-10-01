#!/bin/bash

# Use demo token
TOKEN="demo-token-creator"

echo "Using demo token..."

# Create an event
echo -e "\nCreating event..."
curl -X POST http://localhost:8001/api/creator/calendar/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Event from API",
    "type": "meeting", 
    "start": "2025-10-15T10:00:00Z",
    "end": "2025-10-15T11:00:00Z",
    "description": "This is a test event created via API"
  }' | jq

echo -e "\nFetching events for October 2025..."
curl -X GET "http://localhost:8001/api/creator/calendar/events?start=2025-10-01&end=2025-10-31" \
  -H "Authorization: Bearer $TOKEN" | jq
