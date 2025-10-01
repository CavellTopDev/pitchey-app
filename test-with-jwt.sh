#!/bin/bash

echo "Creating a proper JWT token for testing..."

# Create a JWT token for demo creator (user ID 1001)
# This simulates what the frontend would have
JWT_PAYLOAD='{"userId":1001,"email":"creator@demo.com","userType":"creator","role":"creator"}'
JWT_HEADER='{"alg":"HS256","typ":"JWT"}'

# Base64 encode (URL safe)
HEADER_B64=$(echo -n "$JWT_HEADER" | base64 | tr -d '=' | tr '+/' '-_')
PAYLOAD_B64=$(echo -n "$JWT_PAYLOAD" | base64 | tr -d '=' | tr '+/' '-_')

# For demo, we'll use a simple signature
SIGNATURE="demo-signature"
TOKEN="${HEADER_B64}.${PAYLOAD_B64}.${SIGNATURE}"

echo "Using token: ${TOKEN:0:50}..."

echo -e "\n1. Creating event with JWT token..."
curl -X POST http://localhost:8001/api/creator/calendar/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Important Meeting",
    "type": "meeting",
    "start": "2025-10-09T14:00:00.000Z",
    "end": "2025-10-09T15:00:00.000Z",
    "location": "Office",
    "attendees": [],
    "description": "Discussing project",
    "color": "#8b5cf6",
    "reminder": "15"
  }' | jq

echo -e "\n2. Fetching events..."
curl -X GET "http://localhost:8001/api/creator/calendar/events?start=2025-10-01T00:00:00.000Z&end=2025-10-31T23:59:59.999Z" \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '{total: .total, events: [.events[] | {id, title, date}]}'
