#!/bin/bash

echo "Testing frontend authentication and event fetching..."

# First check if user is logged in by checking localStorage
echo -e "\n1. Checking if demo user needs to login..."

# Login as demo creator
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | jq -r .token)

echo "Token obtained: ${TOKEN:0:50}..."

# Now fetch calendar events using the token
echo -e "\n2. Fetching October 2025 events with auth token..."
curl -s -X GET "http://localhost:8001/api/creator/calendar/events?start=2025-10-01T00:00:00.000Z&end=2025-10-31T23:59:59.999Z" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: http://localhost:5173" | jq '{
    success: .success,
    total: .data.total,
    event_count: (.data.events | length),
    events: [.data.events[] | {title, date}]
  }'

echo -e "\n3. Instructions to see events in frontend:"
echo "   a) Open browser console (F12)"
echo "   b) Run this command to set auth token:"
echo "      localStorage.setItem('authToken', '$TOKEN');"
echo "   c) Refresh the calendar page"
echo "   d) Click 'Go to October' button or use arrow to navigate to October 2025"
echo "   e) You should see 6 events on the calendar"
