#!/bin/bash

echo "=== Calendar Event Test with Correct Credentials ==="
echo

# Step 1: Login with correct demo creator credentials
echo "1. Logging in as alex.creator@demo.com..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .token)
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r .user.id)

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to login"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "User ID: $USER_ID"
echo "Token: ${TOKEN:0:50}..."
echo

# Step 2: Create multiple calendar events
echo "2. Creating calendar events..."

# Event 1
echo "   Creating Event 1: Team Meeting..."
curl -s -X POST http://localhost:8001/api/creator/calendar/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Team Meeting",
    "type": "meeting",
    "start": "2025-10-09T14:00:00.000Z",
    "end": "2025-10-09T15:00:00.000Z",
    "location": "Conference Room A",
    "attendees": ["john@example.com"],
    "description": "Weekly team sync",
    "color": "#8b5cf6",
    "reminder": "15"
  }' | jq -r '.success' | xargs -I {} echo "   ✅ Event 1 created: {}"

# Event 2
echo "   Creating Event 2: Pitch Presentation..."
curl -s -X POST http://localhost:8001/api/creator/calendar/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Pitch Presentation to Investors",
    "type": "presentation",
    "start": "2025-10-15T10:00:00.000Z",
    "end": "2025-10-15T11:30:00.000Z",
    "location": "Zoom",
    "attendees": ["investor1@example.com", "investor2@example.com"],
    "description": "Present new film project",
    "color": "#10b981",
    "reminder": "30"
  }' | jq -r '.success' | xargs -I {} echo "   ✅ Event 2 created: {}"

# Event 3  
echo "   Creating Event 3: Script Deadline..."
curl -s -X POST http://localhost:8001/api/creator/calendar/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Script Final Draft Due",
    "type": "deadline",
    "start": "2025-10-20T23:59:00.000Z",
    "end": "2025-10-20T23:59:00.000Z",
    "location": "",
    "attendees": [],
    "description": "Submit final script to production",
    "color": "#ef4444",
    "reminder": "1440"
  }' | jq -r '.success' | xargs -I {} echo "   ✅ Event 3 created: {}"

echo

# Step 3: Fetch all events
echo "3. Fetching all October 2025 events..."
FETCH_RESPONSE=$(curl -s -X GET "http://localhost:8001/api/creator/calendar/events?start=2025-10-01T00:00:00.000Z&end=2025-10-31T23:59:59.999Z" \
  -H "Authorization: Bearer $TOKEN")

EVENT_COUNT=$(echo "$FETCH_RESPONSE" | jq '.total')
echo "✅ Total events found: $EVENT_COUNT"
echo

echo "Created Events (non-mock):"
echo "$FETCH_RESPONSE" | jq '.events[] | select(.id > 10) | {id, title, date}' 2>/dev/null

echo
echo "All Events Summary:"
echo "$FETCH_RESPONSE" | jq '.events[] | .title' 2>/dev/null

echo
echo "=== Test Complete ==="
echo "Now refresh http://localhost:5173/creator/calendar to see your events!"
