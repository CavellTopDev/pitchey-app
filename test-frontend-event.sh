#!/bin/bash

echo "Testing event creation through frontend flow..."

# Get a token from localStorage (simulating frontend)
echo "1. First, let's see if we can get a demo token..."

# Create an event using the demo token
TOKEN="demo-token-creator"

echo -e "\n2. Creating event with simulated frontend request..."
curl -X POST http://localhost:8001/api/creator/calendar/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-creator" \
  -H "Origin: http://localhost:5173" \
  -d '{
    "title": "Test Meeting",
    "type": "meeting",
    "start": "2025-10-09T14:00:00.000Z",
    "end": "2025-10-09T15:00:00.000Z",
    "location": "Conference Room",
    "attendees": [],
    "description": "Test meeting",
    "color": "#8b5cf6",
    "reminder": "15"
  }' -v 2>&1 | grep -E "< HTTP|< |{" | head -20

echo -e "\n3. Fetching October events..."
curl -X GET "http://localhost:8001/api/creator/calendar/events?start=2025-10-01T00:00:00.000Z&end=2025-10-31T23:59:59.999Z" \
  -H "Authorization: Bearer demo-token-creator" \
  -H "Origin: http://localhost:5173" \
  -s | jq '.events | length'
