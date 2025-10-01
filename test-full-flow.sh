#!/bin/bash

echo "=== Full Calendar Event Creation Test ==="
echo

# Step 1: Login as demo creator
echo "1. Logging in as demo creator..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"creator@demo.com","password":"demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .token)

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to login"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:50}..."
echo

# Step 2: Create a calendar event  
echo "2. Creating calendar event..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8001/api/creator/calendar/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Team Meeting",
    "type": "meeting",
    "start": "2025-10-09T14:00:00.000Z",
    "end": "2025-10-09T15:00:00.000Z",
    "location": "Conference Room A",
    "attendees": ["john@example.com", "jane@example.com"],
    "description": "Quarterly review meeting",
    "color": "#8b5cf6",
    "reminder": "15"
  }')

if echo "$CREATE_RESPONSE" | jq -e .success > /dev/null 2>&1; then
  echo "✅ Event created successfully"
  echo "Event: $(echo "$CREATE_RESPONSE" | jq '.event | {id, title, date}')"
else
  echo "❌ Failed to create event"
  echo "Response: $CREATE_RESPONSE"
fi
echo

# Step 3: Fetch events for October 2025
echo "3. Fetching calendar events for October 2025..."
FETCH_RESPONSE=$(curl -s -X GET "http://localhost:8001/api/creator/calendar/events?start=2025-10-01T00:00:00.000Z&end=2025-10-31T23:59:59.999Z" \
  -H "Authorization: Bearer $TOKEN")

EVENT_COUNT=$(echo "$FETCH_RESPONSE" | jq '.total')
echo "✅ Found $EVENT_COUNT events"
echo

echo "Events:"
echo "$FETCH_RESPONSE" | jq '.events[] | {id, title, date}' 2>/dev/null

echo
echo "=== Test Complete ==="
