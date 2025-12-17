#!/bin/bash

# Simple Cache Warming Script

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

echo "🔥 Cache Warming Started"
echo "========================"

# Warm critical endpoints
echo ""
echo "Warming endpoints:"

# Health check
echo -n "  /api/health: "
curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" "${API_URL}/api/health"

# Browse endpoints
echo -n "  /api/pitches/browse/enhanced: "
curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" "${API_URL}/api/pitches/browse/enhanced"

echo -n "  /api/pitches/browse/general: "
curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" "${API_URL}/api/pitches/browse/general"

# Trending and new
echo -n "  /api/pitches/trending: "
curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" "${API_URL}/api/pitches/trending"

echo -n "  /api/pitches/new: "
curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" "${API_URL}/api/pitches/new"

echo ""
echo "Testing cache headers:"
echo "======================"

# Check for cache headers
echo ""
echo "Headers from /api/health:"
curl -s -I "${API_URL}/api/health" | grep -E "x-cache|x-response|cache-control" || echo "No cache headers found"

echo ""
echo "Headers from /api/pitches/browse/enhanced:"
curl -s -I "${API_URL}/api/pitches/browse/enhanced" | grep -E "x-cache|x-response|cache-control" || echo "No cache headers found"

echo ""
echo "✅ Cache warming complete!"