#!/bin/bash
# Test all migrated endpoints

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
TOKEN="your-jwt-token-here"

echo "Testing API endpoints..."

# Health check
curl -X GET "$API_URL/api/health"

# Browse endpoint
curl -X GET "$API_URL/api/pitches/browse/enhanced"

# Authenticated endpoint test
curl -X GET "$API_URL/api/creator/dashboard" \
  -H "Authorization: Bearer $TOKEN"

echo "Test complete!"
